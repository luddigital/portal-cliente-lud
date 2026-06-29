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
