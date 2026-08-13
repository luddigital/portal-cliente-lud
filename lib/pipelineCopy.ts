/**
 * Lud. Digital — pipeline fino de produção de copy.
 *
 * As 6 etapas do MÉTODO DE COPY da Lud. (pesquisa → dor → hook → briefing →
 * copy → revisão). O Notion guarda o estado macro do post; estas etapas finas
 * moram no Supabase (tabela `pipeline_copy`, migration 0013).
 *
 * Modo HÍBRIDO de regeneração:
 *  - `gerarRascunhoEtapa()`  → rascunho instantâneo via Anthropic (o app resolve
 *    sozinho, na hora, com o contexto que tiver). Status vira 'rascunho'.
 *  - `enfileirarProducaoFinal()` → marca a etapa como 'producao_pedida'. O Claude
 *    Code (skills/Remy, com briefing + regras-aprendidas) roda o método REAL
 *    depois e grava o resultado final. Status vira 'pronto'.
 *
 * Degrada com graça: sem Supabase configurado, leitura devolve estado vazio
 * (todas as etapas 'na_fila') em vez de quebrar a página — igual ao resto do
 * portal (ver lib/supabase.ts).
 */
import { env } from './env';
import { supabaseAdmin } from './supabase';

// ---------------------------------------------------------------------------
// As 6 etapas — ordem é obrigatória (CLAUDE.md, seção 5).
// ---------------------------------------------------------------------------

export type EtapaCopyId =
  | 'pesquisa'
  | 'dor'
  | 'hook'
  | 'briefing'
  | 'copy'
  | 'revisao';

export type StatusEtapa =
  | 'na_fila'
  | 'rascunho'
  | 'producao_pedida'
  | 'pronto';

export type EtapaCopyDef = {
  id: EtapaCopyId;
  label: string;
  descricao: string;
  skill: string; // skill/agente da Lud. que faz a produção final
};

export const ETAPAS_COPY: readonly EtapaCopyDef[] = [
  { id: 'pesquisa', label: 'Pesquisa', descricao: 'fatos e fontes verificadas', skill: 'pesquisador' },
  { id: 'dor', label: 'Dor', descricao: 'dor real do público ancorada', skill: 'dor' },
  { id: 'hook', label: 'Hook', descricao: '3 ganchos pro formato', skill: 'hook-criativo' },
  { id: 'briefing', label: 'Briefing', descricao: 'briefing do post montado', skill: 'briefing-copy' },
  { id: 'copy', label: 'Copy', descricao: 'legenda / roteiro / voice over', skill: 'criar-copy' },
  { id: 'revisao', label: 'Revisão', descricao: 'revisao-copy + copy-guide', skill: 'revisao-copy' },
] as const;

export const ETAPA_IDS: readonly EtapaCopyId[] = ETAPAS_COPY.map((e) => e.id);

// ---------------------------------------------------------------------------
// Tipos de estado
// ---------------------------------------------------------------------------

export type EtapaEstado = {
  etapa: EtapaCopyId;
  status: StatusEtapa;
  output: string | null;
  contextoExtra: string | null;
  fonte: string | null;
  atualizadoEm: string | null;
  atualizadoPor: string | null;
};

/** Estado das 6 etapas de UM post, sempre completo (preenche 'na_fila' o que faltar). */
export type PostPipeline = {
  postId: string;
  etapas: Record<EtapaCopyId, EtapaEstado>;
  /** índice da etapa atual (primeira não-pronta), 0..6 (6 = tudo pronto) */
  etapaAtual: number;
  progresso: number; // 0..100
};

function etapaVazia(etapa: EtapaCopyId): EtapaEstado {
  return {
    etapa,
    status: 'na_fila',
    output: null,
    contextoExtra: null,
    fonte: null,
    atualizadoEm: null,
    atualizadoPor: null,
  };
}

function montarPostPipeline(
  postId: string,
  linhas: EtapaEstado[],
): PostPipeline {
  const etapas = {} as Record<EtapaCopyId, EtapaEstado>;
  for (const id of ETAPA_IDS) etapas[id] = etapaVazia(id);
  for (const l of linhas) {
    if (etapas[l.etapa]) etapas[l.etapa] = l;
  }
  // etapa atual = primeira que ainda não está 'pronto'
  let atual = ETAPA_IDS.findIndex((id) => etapas[id].status !== 'pronto');
  if (atual === -1) atual = ETAPA_IDS.length;
  const progresso = Math.round((atual / ETAPA_IDS.length) * 100);
  return { postId, etapas, etapaAtual: atual, progresso };
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

function mapRow(row: any): EtapaEstado {
  return {
    etapa: row.etapa,
    status: row.status ?? 'na_fila',
    output: row.output ?? null,
    contextoExtra: row.contexto_extra ?? null,
    fonte: row.fonte ?? null,
    atualizadoEm: row.atualizado_em ?? null,
    atualizadoPor: row.atualizado_por ?? null,
  };
}

/** Estado das etapas de vários posts numa query só. Chave = postId. */
export async function lerPipelineDosPosts(
  postIds: string[],
): Promise<Record<string, PostPipeline>> {
  const vazio: Record<string, PostPipeline> = {};
  for (const id of postIds) vazio[id] = montarPostPipeline(id, []);
  if (postIds.length === 0) return vazio;
  try {
    const sb = await supabaseAdmin();
    const { data, error } = await sb
      .from('pipeline_copy')
      .select('post_id, etapa, status, output, contexto_extra, fonte, atualizado_em, atualizado_por')
      .in('post_id', postIds);
    if (error || !data) return vazio;
    const porPost: Record<string, EtapaEstado[]> = {};
    for (const row of data) {
      (porPost[row.post_id] ??= []).push(mapRow(row));
    }
    for (const id of postIds) {
      vazio[id] = montarPostPipeline(id, porPost[id] ?? []);
    }
    return vazio;
  } catch {
    // Supabase não configurado (dev/preview) — devolve tudo 'na_fila'.
    return vazio;
  }
}

/** Estado de UM post. */
export async function lerPipelineDoPost(postId: string): Promise<PostPipeline> {
  const m = await lerPipelineDosPosts([postId]);
  return m[postId];
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

async function upsertEtapa(
  postId: string,
  projetoId: string,
  etapa: EtapaCopyId,
  patch: Partial<{
    status: StatusEtapa;
    output: string | null;
    contexto_extra: string | null;
    fonte: string | null;
  }>,
  emailAutor: string,
): Promise<void> {
  const sb = await supabaseAdmin();
  const { error } = await sb.from('pipeline_copy').upsert(
    {
      post_id: postId,
      projeto_id: projetoId,
      etapa,
      ...patch,
      atualizado_em: new Date().toISOString(),
      atualizado_por: emailAutor,
    },
    { onConflict: 'post_id,etapa' },
  );
  if (error) throw new Error(`Supabase: ${error.message}`);
}

/** Salva/atualiza só o contexto extra de uma etapa (botão "+"). */
export async function salvarContextoEtapa(
  postId: string,
  projetoId: string,
  etapa: EtapaCopyId,
  contexto: string,
  emailAutor: string,
): Promise<void> {
  await upsertEtapa(postId, projetoId, etapa, { contexto_extra: contexto }, emailAutor);
}

/** Enfileira a produção FINAL de uma etapa para o Claude Code rodar o método real. */
export async function enfileirarProducaoFinal(
  postId: string,
  projetoId: string,
  etapa: EtapaCopyId,
  emailAutor: string,
): Promise<void> {
  await upsertEtapa(postId, projetoId, etapa, { status: 'producao_pedida' }, emailAutor);
}

/** Marca uma etapa como pronta (usado pelo Claude Code ao entregar a produção final). */
export async function marcarEtapaPronta(
  postId: string,
  projetoId: string,
  etapa: EtapaCopyId,
  output: string,
  emailAutor: string,
): Promise<void> {
  await upsertEtapa(
    postId,
    projetoId,
    etapa,
    { status: 'pronto', output, fonte: 'producao_claude_code' },
    emailAutor,
  );
}

// ---------------------------------------------------------------------------
// Rascunho instantâneo (metade "app" do híbrido) — via Anthropic.
// ---------------------------------------------------------------------------

const SYSTEM_RASCUNHO = `Você é um assistente de copywriting da Lud. Digital, um hub de marketing digital.
Você produz o RASCUNHO de UMA etapa do método de copy da Lud., para social media (Instagram).

Tom de voz da Lud.: divertido mas não bobo, humano, próximo, criativo. Frases curtas.
SEM travessão (—), sem jargão vazio, sem tom de guru.

Regras:
- Entregue SÓ o conteúdo da etapa pedida, pronto pra usar. Sem preâmbulo, sem
  explicar o que você fez, sem títulos genéricos.
- NUNCA invente números, datas, valores ou fatos. Se precisar de um dado que não
  tem, deixe um marcador entre colchetes tipo [confirmar no pesquisador].
- Este é um RASCUNHO rápido pra destravar; a versão final passa pelo método
  completo depois.`;

const INSTRUCAO_ETAPA: Record<EtapaCopyId, string> = {
  pesquisa:
    'Levante os pontos de pesquisa que embasam este post: 3 a 6 fatos/ângulos verificáveis e o que precisa de double check. Marque com [confirmar] o que não puder garantir.',
  dor:
    'Identifique a dor real do público que este post ativa. Traga a dor principal em 1 frase + 2 ou 3 sub-dores concretas, do jeito que o público sente e falaria.',
  hook:
    'Crie 3 opções de hook (gancho de abertura) adaptadas ao formato, ancoradas na dor. Numere de 1 a 3, cada um em uma linha, curtos e escaneáveis.',
  briefing:
    'Monte o briefing do post: objetivo, formato, ângulo, estrutura (o que vem em cada parte) e CTA. Bullet points objetivos.',
  copy:
    'Escreva a copy/legenda final do post (ou o roteiro, se for Reels): abertura com o hook, desenvolvimento, CTA e sugestão de hashtags. Pronta pra publicar.',
  revisao:
    'Revise a copy sob a ótica do método da Lud. (clareza, dor, hook, tom de voz, CTA). Aponte ajustes concretos e devolva a versão revisada.',
};

/** Contexto que alimenta o rascunho de uma etapa. */
export type RascunhoContexto = {
  postTitulo: string;
  formato: string | null; // "Reels", "Carrossel", "Post"...
  clienteNome: string | null;
  /** contexto extra que a Luiza digitou no botão "+" */
  contextoExtra?: string | null;
  /** outputs das etapas anteriores (pra encadear) */
  anteriores?: { etapa: EtapaCopyId; output: string }[];
};

/**
 * Gera o rascunho de UMA etapa via Anthropic e persiste (status 'rascunho').
 * Devolve o texto gerado. Lança se a ANTHROPIC_API_KEY não estiver configurada.
 */
export async function gerarRascunhoEtapa(
  postId: string,
  projetoId: string,
  etapa: EtapaCopyId,
  ctx: RascunhoContexto,
  emailAutor: string,
): Promise<string> {
  if (!env.anthropic.apiKey) {
    throw new Error('ANTHROPIC_API_KEY não configurada');
  }
  // @ts-ignore — dependência opcional (igual claude.ts)
  const mod = await import('@anthropic-ai/sdk');
  const Anthropic = mod.default;
  const client = new Anthropic({ apiKey: env.anthropic.apiKey });

  const def = ETAPAS_COPY.find((e) => e.id === etapa)!;
  const partes: string[] = [];
  partes.push(`Cliente: ${ctx.clienteNome ?? '(não informado)'}`);
  partes.push(`Post: ${ctx.postTitulo}`);
  if (ctx.formato) partes.push(`Formato: ${ctx.formato}`);
  if (ctx.anteriores?.length) {
    partes.push('\nEtapas anteriores já produzidas:');
    for (const a of ctx.anteriores) {
      const nome = ETAPAS_COPY.find((e) => e.id === a.etapa)?.label ?? a.etapa;
      partes.push(`\n### ${nome}\n${a.output}`);
    }
  }
  if (ctx.contextoExtra?.trim()) {
    partes.push(`\nContexto adicional da Luiza (leve muito em conta):\n${ctx.contextoExtra.trim()}`);
  }
  partes.push(`\nEtapa a produzir agora — ${def.label}:\n${INSTRUCAO_ETAPA[etapa]}`);

  const resp = await client.messages.create({
    model: env.anthropic.model,
    max_tokens: 1200,
    system: SYSTEM_RASCUNHO,
    messages: [{ role: 'user', content: partes.join('\n') }],
  });

  const bloco = resp.content.find((b: any) => b.type === 'text') as
    | { type: 'text'; text: string }
    | undefined;
  const texto = (bloco?.text ?? '').trim();

  await upsertEtapa(
    postId,
    projetoId,
    etapa,
    { status: 'rascunho', output: texto, fonte: 'rascunho_app' },
    emailAutor,
  );
  return texto;
}
