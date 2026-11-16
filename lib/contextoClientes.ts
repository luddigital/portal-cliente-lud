/**
 * Contexto de cada cliente: espelho dos projetos do Claude (briefing, tom de voz, guia de copy,
 * referências, regras que a melhoria contínua aprendeu). Fica na tabela contexto_clientes do Supabase.
 *
 * Quem lê: a Esteira Copy (ajuste na hora) e a tarefa agendada da Fila de Copy.
 * Quem escreve: a página "Contexto dos clientes" no admin e a rotina de melhoria contínua.
 */
import { supabaseAdmin } from '@/lib/supabase';
import seed from '@/contextos/seed-contexto-clientes.json';

export type DocContexto = {
  id: string;
  handle: string;
  categoria: string;
  titulo: string;
  texto: string;
  ativo: boolean;
  ordem: number;
  origem: string | null;
  atualizado_em: string;
};

export const CATEGORIAS_CONTEXTO = [
  'Briefing do cliente',
  'Tom de voz',
  'Guia de copy',
  'Regras de copy (melhoria contínua)',
  'Referências',
  'Alterações pedidas',
  'Análise de dados mais recente',
  'Design',
  'Inclusões',
  'Outro',
];

/** "@ligiabueno___" → "ligiabueno". Mesma chave pra portal, tarefa agendada e melhoria contínua. */
export function chaveDoCliente(handle: string): string {
  return (handle || '').toLowerCase().replace(/^@/, '').replace(/[^a-z0-9]/g, '');
}

/** Na primeira vez, importa os documentos que vieram das pastas dos projetos. */
async function garantirSeed(): Promise<void> {
  const sb = await supabaseAdmin();
  const { count } = await sb.from('contexto_clientes').select('id', { count: 'exact', head: true });
  if ((count ?? 0) > 0) return;
  const linhas = (seed as any[]).map((s) => ({ ...s, ativo: true }));
  for (let i = 0; i < linhas.length; i += 5) await sb.from('contexto_clientes').insert(linhas.slice(i, i + 5));
}

export async function listarContextos(): Promise<DocContexto[]> {
  await garantirSeed();
  const sb = await supabaseAdmin();
  const { data, error } = await sb.from('contexto_clientes').select('*').order('handle').order('ordem');
  if (error) throw new Error(error.message);
  return (data ?? []) as DocContexto[];
}

const cache = new Map<string, { em: number; texto: string }>();

/** Texto do contexto do cliente pra mandar junto no ajuste (só documentos ativos). Cache de 2 min. */
export async function textoDoContexto(handle: string): Promise<string> {
  const chave = chaveDoCliente(handle);
  if (!chave) return '';
  const c = cache.get(chave);
  if (c && Date.now() - c.em < 120_000) return c.texto;
  try {
    await garantirSeed();
    const sb = await supabaseAdmin();
    const { data } = await sb
      .from('contexto_clientes')
      .select('categoria,titulo,texto')
      .eq('handle', chave)
      .eq('ativo', true)
      .order('ordem');
    const texto = (data ?? []).map((d: any) => `### ${d.categoria} · ${d.titulo}\n${d.texto}`).join('\n\n');
    cache.set(chave, { em: Date.now(), texto });
    return texto;
  } catch {
    return '';
  }
}

export async function salvarDocContexto(d: Partial<DocContexto> & { handle: string; titulo: string }): Promise<DocContexto> {
  const sb = await supabaseAdmin();
  const linha = {
    handle: chaveDoCliente(d.handle),
    categoria: d.categoria || 'Outro',
    titulo: d.titulo.trim().slice(0, 200),
    texto: d.texto ?? '',
    ativo: d.ativo ?? true,
    ordem: d.ordem ?? 50,
    origem: d.origem ?? 'Portal',
    atualizado_em: new Date().toISOString(),
  };
  const q = d.id ? sb.from('contexto_clientes').update(linha).eq('id', d.id) : sb.from('contexto_clientes').insert(linha);
  const { data, error } = await q.select('*').single();
  if (error) throw new Error(error.message);
  cache.delete(linha.handle);
  return data as DocContexto;
}

export async function apagarDocContexto(id: string): Promise<void> {
  const sb = await supabaseAdmin();
  const { error } = await sb.from('contexto_clientes').delete().eq('id', id);
  if (error) throw new Error(error.message);
  cache.clear();
}
