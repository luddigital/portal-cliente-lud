import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import {
  getColaboradorByEmail,
  lerBriefingDoPost,
  type CopyDoPost,
} from '@/lib/notion';
import { produzirCopyDoZeroComClaude } from '@/lib/reescreverCopy';

export const runtime = 'nodejs';
export const maxDuration = 180;

// Produz copy de UM post específico (drag-and-drop da Fila pra Produzindo)
export async function POST(
  _req: Request,
  { params }: { params: { postId: string } },
) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
    const ehAdmin = env.auth.adminEmails.includes(
      session.email.trim().toLowerCase(),
    );
    let ehColaborador = !!session.colaboradorId;
    if (!ehColaborador && !ehAdmin) {
      try {
        const colab = await getColaboradorByEmail(session.email);
        ehColaborador = !!colab;
      } catch {}
    }
    if (!ehAdmin && !ehColaborador)
      return NextResponse.json({ error: 'sem permissão' }, { status: 403 });

    const notion = new Client({ auth: env.notion.token });

    // Puxa título + cliente
    const page = (await notion.pages.retrieve({
      page_id: params.postId,
    })) as any;
    const titleProp = Object.values(page.properties).find(
      (p: any) => p.type === 'title',
    ) as any;
    const postTitulo =
      titleProp?.title?.map((t: any) => t.plain_text).join('') ??
      '(sem título)';
    const projetoRel = page.properties.Projeto?.relation ?? [];
    let clienteNome = 'Cliente';
    if (projetoRel[0]) {
      try {
        const proj = (await notion.pages.retrieve({
          page_id: projetoRel[0].id,
        })) as any;
        const pt = Object.values(proj.properties).find(
          (p: any) => p.type === 'title',
        ) as any;
        clienteNome =
          pt?.title?.map((t: any) => t.plain_text).join('') ?? clienteNome;
      } catch {}
    }

    const briefing = await lerBriefingDoPost(params.postId);
    const formato = detectarFormato(postTitulo);

    const copyNova = await produzirCopyDoZeroComClaude({
      briefing,
      clienteNome,
      postTitulo,
      formato,
    });

    const slots = await inserirNosSlots(notion, params.postId, copyNova);

    return NextResponse.json({ ok: true, slots, copyNova, postTitulo });
  } catch (err: any) {
    console.error('[esteira/produzir/[postId]] erro:', err);
    return NextResponse.json(
      { error: err?.message ?? 'Erro inesperado' },
      { status: 500 },
    );
  }
}

function detectarFormato(
  titulo: string,
): 'carrossel' | 'reels' | 'story' | 'desconhecido' {
  const t = titulo.toLowerCase();
  if (/\breels?\b|\bvideo\b/i.test(t)) return 'reels';
  if (/\bstor(y|ies)\b/i.test(t)) return 'story';
  if (/\bcarrossel\b/i.test(t)) return 'carrossel';
  return 'carrossel';
}

// (Duplicado do /produzir-todos por enquanto — se virar recorrente, movo pra lib compartilhada)
async function inserirNosSlots(
  notion: any,
  postId: string,
  copy: CopyDoPost,
): Promise<string[]> {
  const slotsUsados: string[] = [];
  const dataHoje = new Date().toISOString().slice(0, 10);
  const MARCADOR = '🤖 Copy Produzida — v';
  const versao = await proximaVersaoRecursiva(notion, postId, MARCADOR);
  const marcador = `${MARCADOR}${versao}`;
  const marcadoresAntigos = [MARCADOR, '🤖 Reescrita Claude — v'];

  if (copy.legenda) {
    const slot = await encontrarSlotRecursivo(notion, postId, /^legenda/i);
    if (slot) {
      await limparReescritasAntigas(
        notion,
        slot.headingId,
        slot.siblings,
        marcadoresAntigos,
      );
      await appendEmChunks(notion, slot.parentId, slot.headingId, [
        paraBloco('heading_3', `${marcador} · Legenda · ${dataHoje}`),
        ...markdownParaBlocos(copy.legenda),
      ]);
      slotsUsados.push('Legenda');
    }
  }

  if (copy.carrossel) {
    const slot = await encontrarSlotRecursivo(
      notion,
      postId,
      /copy\s*para\s*carrossel/i,
    );
    if (slot) {
      await limparReescritasAntigas(
        notion,
        slot.headingId,
        slot.siblings,
        marcadoresAntigos,
      );
      await appendEmChunks(notion, slot.parentId, slot.headingId, [
        paraBloco('heading_3', `${marcador} · Carrossel · ${dataHoje}`),
        ...markdownParaBlocos(copy.carrossel),
      ]);
      slotsUsados.push('Carrossel');
    }
  }
  return slotsUsados;
}

async function encontrarSlotRecursivo(
  notion: any,
  rootId: string,
  headingRegex: RegExp,
  depth = 0,
): Promise<{ parentId: string; headingId: string; siblings: any[] } | null> {
  if (depth > 4) return null;
  const filhos = await listarFilhos(notion, rootId);
  for (const b of filhos) {
    if (ehHeading(b) && headingRegex.test(textoDoBloco(b))) {
      return { parentId: rootId, headingId: b.id, siblings: filhos };
    }
  }
  for (const b of filhos) {
    if (b.has_children) {
      const a = await encontrarSlotRecursivo(
        notion,
        b.id,
        headingRegex,
        depth + 1,
      );
      if (a) return a;
    }
  }
  return null;
}

async function proximaVersaoRecursiva(
  notion: any,
  rootId: string,
  marcador: string,
  depth = 0,
): Promise<number> {
  if (depth > 4) return 1;
  const filhos = await listarFilhos(notion, rootId);
  const re = new RegExp(
    marcador.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\d+)',
    'i',
  );
  let maxV = 0;
  for (const b of filhos) {
    if (ehHeading(b)) {
      const m = textoDoBloco(b).match(re);
      if (m) maxV = Math.max(maxV, parseInt(m[1], 10));
    }
    if (b.has_children) {
      const filhoMax = await proximaVersaoRecursiva(
        notion,
        b.id,
        marcador,
        depth + 1,
      );
      if (filhoMax > maxV + 1) maxV = filhoMax - 1;
    }
  }
  return maxV + 1;
}

async function limparReescritasAntigas(
  notion: any,
  headingSlotId: string,
  filhosDoTab: any[],
  marcadores: string[],
): Promise<void> {
  const idx = filhosDoTab.findIndex((b: any) => b.id === headingSlotId);
  if (idx < 0) return;
  let dentro = false;
  for (let i = idx + 1; i < filhosDoTab.length; i++) {
    const b = filhosDoTab[i];
    if (b.type === 'heading_1' || b.type === 'heading_2') break;
    if (b.type === 'divider') break;
    if (b.type === 'heading_3') {
      const txt = textoDoBloco(b);
      if (marcadores.some((m) => txt.includes(m))) dentro = true;
    }
    if (dentro) {
      try {
        await notion.blocks.delete({ block_id: b.id });
      } catch {}
    }
  }
}

async function listarFilhos(notion: any, blockId: string): Promise<any[]> {
  const out: any[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.blocks.children.list({
      block_id: blockId,
      page_size: 100,
      start_cursor: cursor,
    });
    out.push(...(res.results as any[]));
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);
  return out;
}

function textoDoBloco(b: any): string {
  const rt = b[b.type]?.rich_text;
  if (!Array.isArray(rt)) return '';
  return rt.map((r: any) => r.plain_text).join('').trim();
}

function ehHeading(b: any): boolean {
  return (
    b.type === 'heading_1' || b.type === 'heading_2' || b.type === 'heading_3'
  );
}

async function appendEmChunks(
  notion: any,
  parentId: string,
  afterBlockId: string,
  children: any[],
): Promise<void> {
  let anchor = afterBlockId;
  for (let i = 0; i < children.length; i += 100) {
    const chunk = children.slice(i, i + 100);
    const res = await notion.blocks.children.append({
      block_id: parentId,
      after: anchor,
      children: chunk,
    });
    if (res.results && res.results.length > 0) {
      anchor = res.results[res.results.length - 1].id;
    }
  }
}

function markdownParaBlocos(md: string): any[] {
  const blocos: any[] = [];
  for (const l of md.split('\n')) {
    if (!l.trim()) continue;
    if (l.startsWith('# ')) blocos.push(paraBloco('heading_1', l.slice(2).trim()));
    else if (l.startsWith('## ')) blocos.push(paraBloco('heading_2', l.slice(3).trim()));
    else if (l.startsWith('### ')) blocos.push(paraBloco('heading_3', l.slice(4).trim()));
    else if (l.startsWith('> ')) blocos.push(paraBloco('quote', l.slice(2).trim()));
    else if (l.startsWith('---')) blocos.push({ object: 'block', type: 'divider', divider: {} });
    else if (l.startsWith('• ') || l.startsWith('- ')) blocos.push(paraBloco('bulleted_list_item', l.slice(2).trim()));
    else blocos.push(paraBloco('paragraph', l));
  }
  return blocos;
}

function paraBloco(tipo: string, texto: string): any {
  return {
    object: 'block',
    type: tipo,
    [tipo]: {
      rich_text: [{ type: 'text', text: { content: texto.slice(0, 2000) } }],
    },
  };
}
