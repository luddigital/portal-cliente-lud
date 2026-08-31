import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { getColaboradorByEmail, lerCopyDoPost } from '@/lib/notion';
import { reescreverCopyComClaude } from '@/lib/reescreverCopy';

export const runtime = 'nodejs';
export const maxDuration = 120;

// Reescreve a copy de um post aplicando feedbacks + instrução geral.
// Puxa a copy atual do Notion, chama o Claude e insere a versão nova
// como um bloco novo no post (heading "✨ Copy Reescrita — v2, v3…").
export async function POST(
  req: Request,
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

    const body = (await req.json().catch(() => ({}))) as {
      feedbacksCards?: Record<string, string>;
      instrucaoGeral?: string;
      copyEditada?: {
        voice?: string | null;
        carrossel?: string | null;
        legenda?: string | null;
      };
      // Se true: só chama Claude e devolve a copy, SEM salvar no Notion.
      // Usado pelo botão "Reescrever com Claude" da lateral pra iterar
      // antes de commitar.
      soPreview?: boolean;
    };
    const feedbacksCards = body.feedbacksCards ?? {};
    const instrucaoGeral = (body.instrucaoGeral ?? '').trim();
    const soPreview = body.soPreview === true;
    if (
      Object.keys(feedbacksCards).length === 0 &&
      instrucaoGeral.length < 3
    ) {
      return NextResponse.json(
        { error: 'Adicione ao menos um feedback antes de pedir alteração.' },
        { status: 400 },
      );
    }

    const notion = new Client({ auth: env.notion.token });

    // Puxa dados do post (título + cliente via projeto)
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

    // Prioriza a copy editada pelo cliente (edições manuais). Fallback pro Notion.
    const copyDoNotion = await lerCopyDoPost(params.postId);
    const copyAtual = body.copyEditada
      ? {
          voice: body.copyEditada.voice ?? copyDoNotion.voice,
          carrossel: body.copyEditada.carrossel ?? copyDoNotion.carrossel,
          legenda: body.copyEditada.legenda ?? copyDoNotion.legenda,
        }
      : copyDoNotion;

    console.log('[esteira/reescrever] chamando Claude', {
      postId: params.postId,
      postTitulo,
      clienteNome,
      cardsComFeedback: Object.keys(feedbacksCards),
      temInstrucaoGeral: instrucaoGeral.length > 0,
    });

    const copyNova = await reescreverCopyComClaude({
      copyAtual,
      feedbacksPorCard: feedbacksCards,
      instrucaoGeral,
      clienteNome,
      postTitulo,
    });

    // Se é só preview (botão da lateral), devolve a copy nova sem tocar no Notion
    if (soPreview) {
      return NextResponse.json({ ok: true, preview: true, copyNova });
    }

    // Insere a copy nova DENTRO dos slots corretos do template
    // (Legenda no tab Post, Copy Carrossel no tab Briefing). Limpa
    // reescritas anteriores antes pra não acumular.
    const resultado = await inserirNosSlots(notion, params.postId, copyNova);

    return NextResponse.json({
      ok: true,
      versao: resultado.versao,
      copyNova,
      inseridoEm: resultado.slotsUsados,
    });
  } catch (err: any) {
    console.error('[esteira/reescrever] erro:', err);
    return NextResponse.json(
      { error: err?.message ?? 'Erro inesperado ao reescrever' },
      { status: 500 },
    );
  }
}

// Conversor bem simples de markdown → blocos Notion (headings + paragraphs).
function markdownParaBlocos(md: string): any[] {
  const blocos: any[] = [];
  const linhas = md.split('\n');
  for (const l of linhas) {
    if (!l.trim()) continue;
    if (l.startsWith('# ')) {
      blocos.push(paraBloco('heading_1', l.slice(2).trim()));
    } else if (l.startsWith('## ')) {
      blocos.push(paraBloco('heading_2', l.slice(3).trim()));
    } else if (l.startsWith('### ')) {
      blocos.push(paraBloco('heading_3', l.slice(4).trim()));
    } else if (l.startsWith('> ')) {
      blocos.push(paraBloco('quote', l.slice(2).trim()));
    } else if (l.startsWith('---')) {
      blocos.push({ object: 'block', type: 'divider', divider: {} });
    } else if (l.startsWith('• ') || l.startsWith('- ')) {
      blocos.push(paraBloco('bulleted_list_item', l.slice(2).trim()));
    } else {
      blocos.push(paraBloco('paragraph', l));
    }
  }
  return blocos;
}

function paraBloco(tipo: string, texto: string): any {
  return {
    object: 'block',
    type: tipo,
    [tipo]: {
      rich_text: [
        {
          type: 'text',
          text: { content: texto.slice(0, 2000) },
        },
      ],
    },
  };
}

// Puxa todos os children de um bloco (com paginação)
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
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
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

const MARCADOR_INICIO = '🤖 Reescrita Claude — v';

/**
 * Insere a copy nova nos slots corretos do template (Legenda no tab Post,
 * Copy do Carrossel no tab Briefing). Antes de inserir a nova versão,
 * REMOVE reescritas antigas do mesmo slot (marcadas com "🤖 Reescrita Claude").
 */
async function inserirNosSlots(
  notion: any,
  postId: string,
  copy: { voice: string | null; carrossel: string | null; legenda: string | null },
): Promise<{ versao: number; slotsUsados: string[] }> {
  const versao = await proximaVersao(notion, postId);
  const rootBlocks = await listarFilhos(notion, postId);
  const tabs = rootBlocks.filter((b: any) => b.type === 'tab');
  const slotsUsados: string[] = [];

  const marcador = `${MARCADOR_INICIO}${versao}`;
  const dataHoje = new Date().toISOString().slice(0, 10);

  for (const tab of tabs) {
    const tabTxt = textoDoBloco(tab).toLowerCase();
    const filhos = await listarFilhos(notion, tab.id);

    // Tab "Post" → slot Legenda
    if (tabTxt.includes('post') && copy.legenda) {
      const headingLegenda = filhos.find(
        (b: any) =>
          ehHeading(b) && /^legenda/i.test(textoDoBloco(b)),
      );
      if (headingLegenda) {
        await limparReescritasAntigas(notion, tab.id, headingLegenda.id, filhos);
        const blocos = [
          paraBloco(
            'heading_3',
            `${marcador} · Legenda · ${dataHoje}`,
          ),
          ...markdownParaBlocos(copy.legenda),
        ];
        await appendEmChunks(notion, tab.id, headingLegenda.id, blocos);
        slotsUsados.push('Legenda (tab Post)');
      }
    }

    // Tab "Briefing" → slot Copy para Carrossel
    if (tabTxt.includes('briefing') && copy.carrossel) {
      const headingCarrossel = filhos.find(
        (b: any) =>
          ehHeading(b) && /copy\s*para\s*carrossel/i.test(textoDoBloco(b)),
      );
      if (headingCarrossel) {
        await limparReescritasAntigas(
          notion,
          tab.id,
          headingCarrossel.id,
          filhos,
        );
        const blocos = [
          paraBloco(
            'heading_3',
            `${marcador} · Copy do Carrossel · ${dataHoje}`,
          ),
          ...markdownParaBlocos(copy.carrossel),
        ];
        await appendEmChunks(notion, tab.id, headingCarrossel.id, blocos);
        slotsUsados.push('Copy para Carrossel (tab Briefing)');
      }
    }
  }

  return { versao, slotsUsados };
}

async function proximaVersao(notion: any, postId: string): Promise<number> {
  try {
    const rootBlocks = await listarFilhos(notion, postId);
    let maxVersao = 1;
    for (const tab of rootBlocks.filter((b: any) => b.type === 'tab')) {
      const filhos = await listarFilhos(notion, tab.id);
      for (const b of filhos) {
        if (!ehHeading(b)) continue;
        const m = textoDoBloco(b).match(
          /reescrita\s+claude\s*—\s*v(\d+)/i,
        );
        if (m) {
          const v = parseInt(m[1], 10);
          if (v > maxVersao) maxVersao = v;
        }
      }
    }
    return maxVersao + 1;
  } catch {
    return 2;
  }
}

/**
 * Remove blocos entre o heading do slot (Legenda ou Copy Carrossel) e o
 * próximo heading/divisor que pertençam a uma reescrita anterior.
 * Uma reescrita anterior começa com um heading_3 marcado com "🤖 Reescrita Claude".
 */
async function limparReescritasAntigas(
  notion: any,
  tabId: string,
  headingSlotId: string,
  filhosDoTab: any[],
): Promise<void> {
  const idxHeading = filhosDoTab.findIndex((b: any) => b.id === headingSlotId);
  if (idxHeading < 0) return;

  // Coleta blocos após o heading até o próximo heading_1 ou _2 (mantém intacto o
  // resto do tab). Deleta os que fizerem parte de uma reescrita anterior.
  let dentroDeReescrita = false;
  for (let i = idxHeading + 1; i < filhosDoTab.length; i++) {
    const b = filhosDoTab[i];
    // Bateu num heading grande — sai do slot
    if (b.type === 'heading_1' || b.type === 'heading_2') break;
    // Divisor com --- fecha slot também
    if (b.type === 'divider') break;

    // heading_3 com marcador começa/renova reescrita antiga
    if (b.type === 'heading_3' && textoDoBloco(b).includes(MARCADOR_INICIO)) {
      dentroDeReescrita = true;
    }
    if (dentroDeReescrita) {
      try {
        await notion.blocks.delete({ block_id: b.id });
      } catch {
        // Bloco não deletável (ex: sync block) — pula
      }
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
    // Próximo append fica após o último bloco inserido, mantendo ordem
    if (res.results && res.results.length > 0) {
      anchor = res.results[res.results.length - 1].id;
    }
  }
}
