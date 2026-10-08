/**
 * Lud. Digital — cliente Supabase
 *
 * Dois clientes diferentes:
 *  - `supabaseAdmin()`  → usa service_role (bypass de RLS). Só backend.
 *  - `supabasePublic()` → usa anon key. Pode ser exposto no frontend (Realtime).
 *
 * Lazy import do SDK pra não quebrar build se as envs ainda não estiverem
 * configuradas (o portal funciona sem WhatsApp).
 */
import { env } from './env';

type SupabaseClient = any; // tipagem leve — evita dependência forte do SDK

let _admin: SupabaseClient | null = null;
let _public: SupabaseClient | null = null;

async function loadClient() {
  // @ts-ignore — dependência opcional, instalada via `npm install @supabase/supabase-js`
  const mod = await import('@supabase/supabase-js');
  return mod.createClient;
}

/** Cliente com privilégio total. Só pode ser usado em rotas/server actions. */
export async function supabaseAdmin(): Promise<SupabaseClient> {
  if (_admin) return _admin;
  if (!env.supabase.url || !env.supabase.serviceRoleKey) {
    throw new Error(
      'Supabase não configurado: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY',
    );
  }
  const createClient = await loadClient();
  _admin = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

/** Cliente com chave pública. Seguro pra usar no client component (Realtime). */
export async function supabasePublic(): Promise<SupabaseClient> {
  if (_public) return _public;
  if (!env.supabase.publicUrl || !env.supabase.anonKey) {
    throw new Error(
      'Supabase público não configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY',
    );
  }
  const createClient = await loadClient();
  _public = createClient(env.supabase.publicUrl, env.supabase.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _public;
}

// -----------------------------------------------------------------
// Tipos espelhando o schema (mantém sincronizado com migrations/0001)
// -----------------------------------------------------------------

export type WhatsappGrupo = {
  id: string;
  nome: string;
  foto_url: string | null;
  ativo: boolean;
  projeto_id: string | null;
  apelido: string | null;
  principal: boolean;
  criado_em: string;
  atualizado_em: string;
};

export type WhatsappPermissao = {
  id: string;
  usuario_email: string;
  grupo_id: string;
  pode_ler: boolean;
  pode_responder: boolean;
  criado_em: string;
};

export type WhatsappMensagem = {
  id: string;
  grupo_id: string;
  remetente_numero: string | null;
  remetente_nome: string | null;
  conteudo: string | null;
  tipo: 'texto' | 'imagem' | 'audio' | 'video' | 'doc' | 'sticker';
  midia_url: string | null;
  midia_mimetype: string | null;
  enviado_via_portal: boolean;
  enviado_por_usuario: string | null;
  citada_id: string | null;
  timestamp: string;
  criado_em: string;
};

export type WhatsappSugestao = {
  id: string;
  grupo_id: string;
  mensagem_id: string | null;
  texto: string;
  status: 'pendente' | 'aprovada' | 'rejeitada';
  modelo: string | null;
  enviada_mensagem_id: string | null;
  aprovada_por: string | null;
  criado_em: string;
  atualizado_em: string;
};

// -----------------------------------------------------------------
// Helpers de domínio
// -----------------------------------------------------------------

/** Grupos ativos de um projeto, com o principal primeiro. */
export async function getGruposWhatsappDoProjeto(projetoId: string): Promise<WhatsappGrupo[]> {
  const sb = await supabaseAdmin();
  const { data, error } = await sb
    .from('whatsapp_grupos')
    .select('*')
    .eq('projeto_id', projetoId)
    .eq('ativo', true)
    .order('principal', { ascending: false })
    .order('nome', { ascending: true });
  if (error) {
    console.warn('[getGruposWhatsappDoProjeto]', error.message);
    return [];
  }
  return (data as WhatsappGrupo[]) ?? [];
}

/**
 * Grupo pra onde mandar mensagens do projeto: o escolhido (se for mesmo
 * desse projeto) ou o principal. null = projeto sem grupo vinculado.
 */
export async function getGrupoWhatsappDoProjeto(
  projetoId: string,
  grupoId?: string | null,
): Promise<WhatsappGrupo | null> {
  const grupos = await getGruposWhatsappDoProjeto(projetoId);
  if (grupoId) return grupos.find((g) => g.id === grupoId) ?? null;
  return grupos[0] ?? null;
}

/** Lista grupos que um email tem permissão de LER (ativos + permissão concedida). */
export async function listarGruposDoUsuario(email: string): Promise<WhatsappGrupo[]> {
  const sb = await supabaseAdmin();
  const { data, error } = await sb
    .from('whatsapp_permissoes')
    .select('grupo_id, pode_ler, whatsapp_grupos!inner(*)')
    .eq('usuario_email', email.toLowerCase())
    .eq('pode_ler', true)
    .eq('whatsapp_grupos.ativo', true);
  if (error) throw new Error(`Supabase: ${error.message}`);
  return (data ?? []).map((r: any) => r.whatsapp_grupos as WhatsappGrupo);
}

/** Verifica se o usuário pode responder no grupo. */
export async function podeResponderNoGrupo(
  email: string,
  grupoId: string,
): Promise<boolean> {
  const sb = await supabaseAdmin();
  const { data, error } = await sb
    .from('whatsapp_permissoes')
    .select('pode_responder')
    .eq('usuario_email', email.toLowerCase())
    .eq('grupo_id', grupoId)
    .maybeSingle();
  if (error) throw new Error(`Supabase: ${error.message}`);
  return !!data?.pode_responder;
}

/** Histórico de mensagens (mais recentes primeiro, default 50). */
export async function listarMensagens(
  grupoId: string,
  limit = 50,
): Promise<WhatsappMensagem[]> {
  const sb = await supabaseAdmin();
  const { data, error } = await sb
    .from('whatsapp_mensagens')
    .select('*')
    .eq('grupo_id', grupoId)
    .order('timestamp', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Supabase: ${error.message}`);
  // devolve em ordem crescente pra renderizar de cima pra baixo
  return (data ?? []).reverse() as WhatsappMensagem[];
}

/** Sugestões pendentes da Claude para um grupo (mais recentes primeiro). */
export async function listarSugestoesPendentes(
  grupoId: string,
): Promise<WhatsappSugestao[]> {
  const sb = await supabaseAdmin();
  const { data, error } = await sb
    .from('whatsapp_sugestoes')
    .select('*')
    .eq('grupo_id', grupoId)
    .eq('status', 'pendente')
    .order('criado_em', { ascending: false });
  if (error) throw new Error(`Supabase: ${error.message}`);
  return (data ?? []) as WhatsappSugestao[];
}

// ============================================================================
// Notas editáveis do relatório de Instagram (saímos do Notion pra Supabase).
// ============================================================================

export type RelatorioNotas = {
  funcionou: string;
  naoFuncionou: string;
  plano: string;
  atualizadoEm: string | null;
  atualizadoPor: string | null;
};

const NOTAS_VAZIAS: RelatorioNotas = {
  funcionou: '',
  naoFuncionou: '',
  plano: '',
  atualizadoEm: null,
  atualizadoPor: null,
};

/** Lê as notas do relatório pra (projeto, período). Devolve vazio se não há. */
export async function lerRelatorioNotas(
  projetoId: string,
  inicio: string,
  fim: string,
): Promise<RelatorioNotas> {
  try {
    const sb = await supabaseAdmin();
    const { data, error } = await sb
      .from('relatorio_notas')
      .select('funcionou, nao_funcionou, plano, atualizado_em, atualizado_por')
      .eq('projeto_id', projetoId)
      .eq('inicio', inicio)
      .eq('fim', fim)
      .maybeSingle();
    if (error) {
      console.warn('[relatorio_notas] leitura falhou:', error.message);
      return NOTAS_VAZIAS;
    }
    if (!data) return NOTAS_VAZIAS;
    return {
      funcionou: data.funcionou ?? '',
      naoFuncionou: data.nao_funcionou ?? '',
      plano: data.plano ?? '',
      atualizadoEm: data.atualizado_em ?? null,
      atualizadoPor: data.atualizado_por ?? null,
    };
  } catch (err: any) {
    // Supabase pode não estar configurado em dev/preview — devolve vazio.
    console.warn('[relatorio_notas] sem Supabase:', err?.message);
    return NOTAS_VAZIAS;
  }
}

// ============================================================================
// Rascunho da aprovação (comentário + marcações) — cross-device via Supabase
// ============================================================================

export type Marcacao = { t: number; texto: string };

export type RascunhoAprovacao = {
  comentarioGeral: string;
  marcacoes: Marcacao[];
  atualizadoEm: string | null;
};

const RASCUNHO_VAZIO: RascunhoAprovacao = {
  comentarioGeral: '',
  marcacoes: [],
  atualizadoEm: null,
};

/** Lê o rascunho da aprovação. Devolve vazio se não há rascunho ou erro. */
export async function lerRascunhoAprovacao(
  tarefaId: string,
  email: string,
): Promise<RascunhoAprovacao> {
  try {
    const sb = await supabaseAdmin();
    const { data, error } = await sb
      .from('rascunho_aprovacao')
      .select('comentario_geral, marcacoes, atualizado_em')
      .eq('tarefa_id', tarefaId)
      .eq('email', email)
      .maybeSingle();
    if (error) {
      console.warn('[rascunho_aprovacao] leitura falhou:', error.message);
      return RASCUNHO_VAZIO;
    }
    if (!data) return RASCUNHO_VAZIO;
    return {
      comentarioGeral: data.comentario_geral ?? '',
      marcacoes: Array.isArray(data.marcacoes) ? data.marcacoes : [],
      atualizadoEm: data.atualizado_em ?? null,
    };
  } catch (err: any) {
    console.warn('[rascunho_aprovacao] sem Supabase:', err?.message);
    return RASCUNHO_VAZIO;
  }
}

export async function salvarRascunhoAprovacao(
  tarefaId: string,
  email: string,
  comentarioGeral: string,
  marcacoes: Marcacao[],
): Promise<void> {
  const sb = await supabaseAdmin();
  const { error } = await sb.from('rascunho_aprovacao').upsert(
    {
      tarefa_id: tarefaId,
      email,
      comentario_geral: comentarioGeral,
      marcacoes,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: 'tarefa_id,email' },
  );
  if (error) throw new Error(`Supabase: ${error.message}`);
}

// ============================================================================
// Objetivos da semana — texto livre por projeto, editado em /gestao
// ============================================================================

export type ObjetivosSemana = {
  texto: string;
  atualizadoEm: string | null;
  atualizadoPor: string | null;
};

/** Lê o texto de objetivos de UM projeto. Vazio se não há. */
export async function lerObjetivosSemana(
  projetoId: string,
): Promise<ObjetivosSemana> {
  try {
    const sb = await supabaseAdmin();
    const { data, error } = await sb
      .from('objetivos_semana')
      .select('texto, atualizado_em, atualizado_por')
      .eq('projeto_id', projetoId)
      .maybeSingle();
    if (error || !data) return { texto: '', atualizadoEm: null, atualizadoPor: null };
    return {
      texto: data.texto ?? '',
      atualizadoEm: data.atualizado_em ?? null,
      atualizadoPor: data.atualizado_por ?? null,
    };
  } catch {
    return { texto: '', atualizadoEm: null, atualizadoPor: null };
  }
}

/** Batch: lê objetivos de vários projetos numa query só. */
export async function lerObjetivosSemanaBatch(
  projetoIds: string[],
): Promise<Record<string, ObjetivosSemana>> {
  const vazio: Record<string, ObjetivosSemana> = {};
  for (const id of projetoIds) {
    vazio[id] = { texto: '', atualizadoEm: null, atualizadoPor: null };
  }
  if (projetoIds.length === 0) return vazio;
  try {
    const sb = await supabaseAdmin();
    const { data, error } = await sb
      .from('objetivos_semana')
      .select('projeto_id, texto, atualizado_em, atualizado_por')
      .in('projeto_id', projetoIds);
    if (error || !data) return vazio;
    for (const row of data) {
      vazio[row.projeto_id] = {
        texto: row.texto ?? '',
        atualizadoEm: row.atualizado_em ?? null,
        atualizadoPor: row.atualizado_por ?? null,
      };
    }
    return vazio;
  } catch {
    return vazio;
  }
}

export async function salvarObjetivosSemana(
  projetoId: string,
  texto: string,
  emailAutor: string,
): Promise<void> {
  const sb = await supabaseAdmin();
  const { error } = await sb.from('objetivos_semana').upsert(
    {
      projeto_id: projetoId,
      texto,
      atualizado_em: new Date().toISOString(),
      atualizado_por: emailAutor,
    },
    { onConflict: 'projeto_id' },
  );
  if (error) throw new Error(`Supabase: ${error.message}`);
}

// ============================================================================
// Config de programação por post — horário + plataformas + formato + legenda
// ============================================================================

export type ProgramacaoConfig = {
  data: string; // YYYY-MM-DD; vazio = usa a data do Notion
  horario: string;
  plataformas: string[];
  formato: string;
  legenda: string;
  atualizadoEm: string | null;
  atualizadoPor: string | null;
};

const CONFIG_VAZIA: ProgramacaoConfig = {
  data: '',
  horario: '',
  plataformas: [],
  formato: '',
  legenda: '',
  atualizadoEm: null,
  atualizadoPor: null,
};

export async function lerConfigProgramacao(postId: string): Promise<ProgramacaoConfig> {
  try {
    const sb = await supabaseAdmin();
    const { data, error } = await sb
      .from('programacao_config')
      .select('data_postagem, horario, plataformas, formato, legenda, atualizado_em, atualizado_por')
      .eq('post_id', postId)
      .maybeSingle();
    if (error || !data) return CONFIG_VAZIA;
    return {
      data: data.data_postagem ?? '',
      horario: data.horario ?? '',
      plataformas: Array.isArray(data.plataformas) ? data.plataformas : [],
      formato: data.formato ?? '',
      legenda: data.legenda ?? '',
      atualizadoEm: data.atualizado_em ?? null,
      atualizadoPor: data.atualizado_por ?? null,
    };
  } catch {
    return CONFIG_VAZIA;
  }
}

export async function salvarConfigProgramacao(
  postId: string,
  config: { data: string; horario: string; plataformas: string[]; formato: string; legenda: string },
  emailAutor: string,
): Promise<void> {
  const sb = await supabaseAdmin();
  const { error } = await sb.from('programacao_config').upsert(
    {
      post_id: postId,
      data_postagem: config.data || null,
      horario: config.horario,
      plataformas: config.plataformas,
      formato: config.formato,
      legenda: config.legenda,
      atualizado_em: new Date().toISOString(),
      atualizado_por: emailAutor,
    },
    { onConflict: 'post_id' },
  );
  if (error) throw new Error(`Supabase: ${error.message}`);
}

// ---- Fila de publicação no Instagram (agendamento via cron) ----

export type IGFilaItem = {
  postId: string;
  conta: string;
  legenda: string;
};

/** Coloca o post na fila de publicação do Instagram. */
export async function enfileirarIGPublicacao(
  postId: string,
  opts: { conta: string; agendadoPara: string },
): Promise<void> {
  const sb = await supabaseAdmin();
  const { error } = await sb
    .from('programacao_config')
    .update({
      ig_status: 'na_fila',
      ig_conta: opts.conta,
      ig_agendado_para: opts.agendadoPara,
      ig_erro: null,
    })
    .eq('post_id', postId);
  if (error) throw new Error(`Supabase: ${error.message}`);
}

/** Posts do IG cuja hora já chegou e que ainda estão na fila. */
export async function listarIGVencidos(agoraISO: string, limite = 5): Promise<IGFilaItem[]> {
  const sb = await supabaseAdmin();
  const { data, error } = await sb
    .from('programacao_config')
    .select('post_id, ig_conta, legenda')
    .eq('ig_status', 'na_fila')
    .lte('ig_agendado_para', agoraISO)
    .order('ig_agendado_para', { ascending: true })
    .limit(limite);
  if (error || !data) return [];
  return data.map((r: any) => ({
    postId: r.post_id,
    conta: r.ig_conta ?? '',
    legenda: r.legenda ?? '',
  }));
}

/**
 * Transição atômica na_fila -> publicando. Só um processo "ganha" o post —
 * evita que dois crons sobrepostos publiquem o mesmo post duas vezes.
 * Retorna true se este processo reivindicou o post.
 */
export async function reivindicarIG(postId: string): Promise<boolean> {
  const sb = await supabaseAdmin();
  const { data, error } = await sb
    .from('programacao_config')
    .update({ ig_status: 'publicando' })
    .eq('post_id', postId)
    .eq('ig_status', 'na_fila')
    .select('post_id');
  return !error && Array.isArray(data) && data.length > 0;
}

export async function marcarIGResultado(
  postId: string,
  resultado:
    | { ok: true; mediaId: string; permalink: string | null }
    | { ok: false; erro: string },
): Promise<void> {
  const sb = await supabaseAdmin();
  const patch: Record<string, any> = resultado.ok
    ? {
        ig_status: 'publicado',
        ig_media_id: resultado.mediaId,
        ig_permalink: resultado.permalink,
        ig_publicado_em: new Date().toISOString(),
        ig_erro: null,
      }
    : { ig_status: 'erro', ig_erro: resultado.erro };
  await sb.from('programacao_config').update(patch).eq('post_id', postId);
}

export async function limparRascunhoAprovacao(
  tarefaId: string,
  email: string,
): Promise<void> {
  try {
    const sb = await supabaseAdmin();
    await sb
      .from('rascunho_aprovacao')
      .delete()
      .eq('tarefa_id', tarefaId)
      .eq('email', email);
  } catch {
    /* silencioso — não travar aprovação por rascunho velho */
  }
}

/** Upsert das notas. Cria a linha se ainda não existe. */
export async function salvarRelatorioNotas(
  projetoId: string,
  inicio: string,
  fim: string,
  notas: { funcionou: string; naoFuncionou: string; plano: string },
  emailAutor: string,
): Promise<void> {
  const sb = await supabaseAdmin();
  const { error } = await sb.from('relatorio_notas').upsert(
    {
      projeto_id: projetoId,
      inicio,
      fim,
      funcionou: notas.funcionou,
      nao_funcionou: notas.naoFuncionou,
      plano: notas.plano,
      atualizado_em: new Date().toISOString(),
      atualizado_por: emailAutor,
    },
    { onConflict: 'projeto_id,inicio,fim' },
  );
  if (error) throw new Error(`Supabase: ${error.message}`);
}

/** Registra que o cliente abriu um post no portal. Nunca trava a página. */
export async function registrarVisualizacao(
  postId: string,
  tarefaId: string | null,
  email: string,
): Promise<void> {
  try {
    const sb = await supabaseAdmin();
    await sb.from('post_visualizacoes').insert({
      post_id: postId,
      tarefa_id: tarefaId,
      email: email.trim().toLowerCase(),
    });
  } catch (e: any) {
    console.warn('[post_visualizacoes]', e?.message);
  }
}

export type Visualizacao = { primeira: string; ultima: string; total: number };

/** Primeira/última visualização do cliente por post. */
export async function lerVisualizacoes(
  postIds: string[],
): Promise<Record<string, Visualizacao>> {
  const out: Record<string, Visualizacao> = {};
  if (postIds.length === 0) return out;
  const sb = await supabaseAdmin();
  const { data, error } = await sb
    .from('post_visualizacoes')
    .select('post_id, visto_em')
    .in('post_id', postIds);
  if (error) {
    console.warn('[post_visualizacoes]', error.message);
    return out;
  }
  for (const r of data ?? []) {
    const v = out[r.post_id];
    if (!v) out[r.post_id] = { primeira: r.visto_em, ultima: r.visto_em, total: 1 };
    else {
      v.total += 1;
      if (r.visto_em < v.primeira) v.primeira = r.visto_em;
      if (r.visto_em > v.ultima) v.ultima = r.visto_em;
    }
  }
  return out;
}

/** Lembrete avulso (botão 📱 lembrar) entra no mesmo histórico da régua. */
export async function registrarEnvioAvulso(e: {
  projetoId: string;
  postId: string | null;
  /** Mensagem geral: aparece no histórico de cada post incluído. */
  postIds?: string[];
  /** Padrão 'avulso'; a mensagem geral do projeto usa 'geral'. */
  momento?: string;
  situacao: string;
  texto: string;
  grupoId: string;
  messageId: string | null;
  email: string;
}): Promise<void> {
  try {
    const sb = await supabaseAdmin();
    await sb.from('regua_envios').insert({
      projeto_id: e.projetoId,
      ciclo: null,
      momento: e.momento ?? 'avulso',
      variante: e.situacao,
      texto: e.texto,
      post_ids: e.postIds ?? (e.postId ? [e.postId] : []),
      grupo_id: e.grupoId,
      message_id: e.messageId,
      enviado_por: e.email.trim().toLowerCase(),
    });
  } catch (err: any) {
    console.warn('[regua_envios avulso]', err?.message);
  }
}

export type HistoricoComunicacao = {
  visualizacoes: { email: string; vistoEm: string }[];
  envios: { momento: string; variante: string | null; enviadoEm: string; enviadoPor: string | null }[];
};

/** Lembretes enviados e visualizações do cliente de um post. */
export async function lerHistoricoComunicacao(postId: string): Promise<HistoricoComunicacao> {
  const sb = await supabaseAdmin();
  const [{ data: views }, { data: envios }] = await Promise.all([
    sb
      .from('post_visualizacoes')
      .select('email, visto_em')
      .eq('post_id', postId)
      .order('visto_em', { ascending: false }),
    sb
      .from('regua_envios')
      .select('momento, variante, enviado_em, enviado_por')
      .contains('post_ids', [postId])
      .order('enviado_em', { ascending: false }),
  ]);
  return {
    visualizacoes: (views ?? []).map((v: any) => ({ email: v.email, vistoEm: v.visto_em })),
    envios: (envios ?? []).map((e: any) => ({
      momento: e.momento,
      variante: e.variante,
      enviadoEm: e.enviado_em,
      enviadoPor: e.enviado_por,
    })),
  };
}

/** Envios pra aprovação (lote de quinta) dos últimos dias: post → quando foi enviado. */
export async function lerEnviosParaAprovacao(postIds: string[], dias = 70): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (postIds.length === 0) return out;
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  const sb = await supabaseAdmin();
  const { data, error } = await sb
    .from('regua_envios')
    .select('post_ids, enviado_em')
    .eq('momento', 'quinta')
    .gte('enviado_em', desde)
    .order('enviado_em', { ascending: true });
  if (error) {
    console.warn('[regua_envios]', error.message);
    return out;
  }
  const alvo = new Set(postIds);
  for (const r of data ?? []) {
    for (const id of (r.post_ids as string[]) ?? []) {
      if (alvo.has(id)) out[id] = r.enviado_em; // fica o envio mais recente
    }
  }
  return out;
}

// ============================================================================
// Histórico de prazos das tarefas (mudanças de Data Entrega feitas no portal)
// ============================================================================

export type MudancaPrazo = {
  id: number;
  tarefaId: string;
  tarefaTitulo: string | null;
  de: string | null;
  para: string;
  por: string;
  em: string;
};

function linhaParaMudanca(r: any): MudancaPrazo {
  return {
    id: r.id,
    tarefaId: r.tarefa_id,
    tarefaTitulo: r.tarefa_titulo ?? null,
    de: r.prazo_anterior ?? null,
    para: r.prazo_novo,
    por: r.alterado_por_nome || String(r.alterado_por ?? '').split('@')[0],
    em: r.alterado_em,
  };
}

export async function registrarMudancaPrazo(m: {
  tarefaId: string;
  postId: string | null;
  tarefaTitulo: string | null;
  de: string | null;
  para: string;
  email: string;
  nome: string | null;
}): Promise<MudancaPrazo | null> {
  try {
    const sb = await supabaseAdmin();
    const { data, error } = await sb
      .from('tarefa_prazo_historico')
      .insert({
        tarefa_id: m.tarefaId,
        post_id: m.postId,
        tarefa_titulo: m.tarefaTitulo,
        prazo_anterior: m.de,
        prazo_novo: m.para,
        alterado_por: m.email.trim().toLowerCase(),
        alterado_por_nome: m.nome,
      })
      .select('*')
      .single();
    if (error) throw error;
    return linhaParaMudanca(data);
  } catch (err: any) {
    console.warn('[tarefa_prazo_historico]', err?.message);
    return null;
  }
}

/** Mudanças de prazo das tarefas de um post, mais recentes primeiro. */
export async function lerHistoricoPrazos(postId: string): Promise<MudancaPrazo[]> {
  try {
    const sb = await supabaseAdmin();
    const { data, error } = await sb
      .from('tarefa_prazo_historico')
      .select('*')
      .eq('post_id', postId)
      .order('alterado_em', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data ?? []).map(linhaParaMudanca);
  } catch (err: any) {
    console.warn('[tarefa_prazo_historico]', err?.message);
    return [];
  }
}
