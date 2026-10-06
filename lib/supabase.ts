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

/**
 * Retorna o group ID do WhatsApp (ex: "120363XXXX@g.us") associado a um projeto,
 * ou null se o projeto não tem grupo cadastrado.
 */
export async function getGrupoWhatsappDoProjeto(
  projetoId: string,
): Promise<WhatsappGrupo | null> {
  const sb = await supabaseAdmin();
  const { data, error } = await sb
    .from('whatsapp_grupos')
    .select('*')
    .eq('projeto_id', projetoId)
    .eq('ativo', true)
    .maybeSingle();
  if (error) {
    console.warn('[getGrupoWhatsappDoProjeto]', error.message);
    return null;
  }
  return (data as WhatsappGrupo | null) ?? null;
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
