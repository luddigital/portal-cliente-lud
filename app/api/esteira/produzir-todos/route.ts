import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import {
  listarTarefasDaEsteira,
  lerBriefingDoPost,
  type CardEsteiraNotion,
  type CopyDoPost,
} from '@/lib/notion';
import { produzirCopyDoZeroComClaude } from '@/lib/reescreverCopy';

export const runtime = 'nodejs';
export const maxDuration = 300;

// Posts que NÃO devem ser processados (produzidos manualmente, etc)
const POSTS_EXCLUIDOS = new Set<string>([
  '3aad04d2-3b4a-80e0-9906-ccdcdd9b3239', // Quanto custa África do Sul — já feito
]);

const CONCORRENCIA = 5;

/**
 * Rotina de produção em lote:
 * - Puxa todos os cards na coluna "Fila" da Esteira (Briefing & Copy prontos)
 * - Pra cada, chama Claude produzindo copy do zero baseado no briefing
 * - Insere a copy nos slots corretos do post no Notion
 * - Não cria tarefas novas, só produz nos slots do post existente
 *
 * Pode rodar via curl (admin) ou via cron scheduled task.
 * Autenticação: sessão de admin OU header X-Cron-Secret == env.
 */
// Vercel Cron chama GET com header "Authorization: Bearer <CRON_SECRET>"
export async function GET(req: Request) {
  return handle(req, {});
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    limite?: number;
    dryRun?: boolean;
  };
  return handle(req, body);
}

async function handle(
  req: Request,
  body: { limite?: number; dryRun?: boolean },
) {
  // Auth: aceita sessão admin OU secret via header (X-Cron-Secret ou Authorization Bearer do Vercel Cron)
  const session = await getSession();
  const secretHeader = req.headers.get('x-cron-secret');
  const authHeader = req.headers.get('authorization') ?? '';
  const bearer = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : '';
  const secretOk =
    !!env.auth.cronSecret &&
    (secretHeader === env.auth.cronSecret ||
      bearer === env.auth.cronSecret);
  const adminOk =
    !!session &&
    env.auth.adminEmails.includes(session.email.trim().toLowerCase());
  if (!secretOk && !adminOk) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }

  const dryRun = body.dryRun === true;
  const limite = Math.max(1, Math.min(60, body.limite ?? 60));

  const notion = new Client({ auth: env.notion.token });
  const inicio = Date.now();

  // Puxa cards da Fila (Briefing & Copy pronto pra produzir)
  const todos = await listarTarefasDaEsteira();
  const alvos = todos
    .filter((c) => c.coluna === 'fila')
    .filter((c) => !POSTS_EXCLUIDOS.has(c.postId))
    .slice(0, limite);

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      totalAlvos: alvos.length,
      alvos: alvos.map((c) => ({
        tarefaId: c.tarefaId,
        postId: c.postId,
        postTitulo: c.postTitulo,
        cliente: c.clienteNome ?? c.projetoNome,
      })),
    });
  }

  const resultados: Array<{
    postId: string;
    postTitulo: string;
    ok: boolean;
    erro?: string;
    slots?: string[];
    duracaoMs?: number;
  }> = [];

  async function produzirUm(card: CardEsteiraNotion): Promise<void> {
    const t0 = Date.now();
    try {
      const formato = detectarFormato(card.postTitulo);
      const briefing = await lerBriefingDoPost(card.postId);
      const copyNova = await produzirCopyDoZeroComClaude({
        briefing,
        clienteNome: card.clienteNome ?? card.projetoNome,
        postTitulo: card.postTitulo,
        formato,
      });
      const slots = await inserirNosSlots(notion, card.postId, copyNova);
      resultados.push({
        postId: card.postId,
        postTitulo: card.postTitulo,
        ok: true,
        slots,
        duracaoMs: Date.now() - t0,
      });
    } catch (e: any) {
      console.error(
        '[produzir-todos] falhou',
        card.postId,
        card.postTitulo,
        e?.message,
      );
      resultados.push({
        postId: card.postId,
        postTitulo: card.postTitulo,
        ok: false,
        erro: e?.message ?? 'Erro',
        duracaoMs: Date.now() - t0,
      });
    }
  }

  // Paralelismo controlado (5 por vez)
  for (let i = 0; i < alvos.length; i += CONCORRENCIA) {
    const lote = alvos.slice(i, i + CONCORRENCIA);
    await Promise.all(lote.map(produzirUm));
  }

  const okCount = resultados.filter((r) => r.ok).length;
  const failCount = resultados.length - okCount;

  return NextResponse.json({
    ok: true,
    processados: resultados.length,
    sucesso: okCount,
    falhas: failCount,
    duracaoMs: Date.now() - inicio,
    resultados,
  });
}

function detectarFormato(
  titulo: string,
): 'carrossel' | 'reels' | 'story' | 'desconhecido' {
  const t = titulo.toLowerCase();
  if (/\breels?\b|\bvideo\b/i.test(t)) return 'reels';
  if (/\bstor(y|ies)\b/i.test(t)) return 'story';
  if (/\bcarrossel\b|\bcards?\b/i.test(t)) return 'carrossel';
  // Default: carrossel (é o formato mais comum)
  return 'carrossel';
}

// ============================================================
// Insere copy nos slots corretos (mesma lógica do /reescrever)
// ============================================================
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

/**
 * Busca recursiva por um heading que bata com o regex. Retorna o heading,
 * o parent onde ele mora, e os siblings (pra facilitar limpeza).
 * Necessário porque no template do Notion os headings ficam dentro de
 * paragraphs "Post"/"Briefing" dentro do bloco tab.
 */
async function encontrarSlotRecursivo(
  notion: any,
  rootId: string,
  headingRegex: RegExp,
  depth = 0,
): Promise<{ parentId: string; headingId: string; siblings: any[] } | null> {
  if (depth > 4) return null;
  const filhos = await listarFilhos(notion, rootId);
  // Primeiro procura entre os irmãos deste nível
  for (const b of filhos) {
    if (ehHeading(b) && headingRegex.test(textoDoBloco(b))) {
      return { parentId: rootId, headingId: b.id, siblings: filhos };
    }
  }
  // Depois desce em filhos que tenham children
  for (const b of filhos) {
    if (b.has_children) {
      const achado = await encontrarSlotRecursivo(
        notion,
        b.id,
        headingRegex,
        depth + 1,
      );
      if (achado) return achado;
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

async function proximaVersao(
  notion: any,
  postId: string,
  marcador: string,
): Promise<number> {
  try {
    const rootBlocks = await listarFilhos(notion, postId);
    let maxVersao = 0;
    for (const tab of rootBlocks.filter((b: any) => b.type === 'tab')) {
      const filhos = await listarFilhos(notion, tab.id);
      for (const b of filhos) {
        if (!ehHeading(b)) continue;
        const t = textoDoBloco(b);
        const re = new RegExp(
          marcador.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\d+)',
          'i',
        );
        const m = t.match(re);
        if (m) {
          const v = parseInt(m[1], 10);
          if (v > maxVersao) maxVersao = v;
        }
      }
    }
    return maxVersao + 1;
  } catch {
    return 1;
  }
}

async function limparReescritasAntigas(
  notion: any,
  headingSlotId: string,
  filhosDoTab: any[],
  marcadores: string[],
): Promise<void> {
  const idxHeading = filhosDoTab.findIndex((b: any) => b.id === headingSlotId);
  if (idxHeading < 0) return;
  let dentroDeReescrita = false;
  for (let i = idxHeading + 1; i < filhosDoTab.length; i++) {
    const b = filhosDoTab[i];
    if (b.type === 'heading_1' || b.type === 'heading_2') break;
    if (b.type === 'divider') break;
    if (b.type === 'heading_3') {
      const txt = textoDoBloco(b);
      if (marcadores.some((m) => txt.includes(m))) {
        dentroDeReescrita = true;
      }
    }
    if (dentroDeReescrita) {
      try {
        await notion.blocks.delete({ block_id: b.id });
      } catch {}
    }
  }
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
  const linhas = md.split('\n');
  for (const l of linhas) {
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
