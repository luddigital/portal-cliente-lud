import { supabaseAdmin } from '@/lib/supabase';
import { PADRAO } from '@/lib/lembrete-aprovacao';

/** Textos editados no admin (só as chaves que fogem do padrão). */
export async function lerMensagensEditadas(): Promise<Record<string, string>> {
  const sb = await supabaseAdmin();
  const { data, error } = await sb.from('mensagens_padrao').select('chave, texto');
  if (error) {
    console.warn('[mensagens_padrao]', error.message);
    return {};
  }
  const out: Record<string, string> = {};
  for (const r of data ?? []) {
    if (r.chave in PADRAO) out[r.chave] = r.texto;
  }
  return out;
}

/** Salva textos; texto igual ao padrão (ou null) volta pro padrão. */
export async function salvarMensagens(
  textos: Record<string, string | null>,
  email: string,
): Promise<void> {
  const sb = await supabaseAdmin();
  const upserts: { chave: string; texto: string; atualizado_em: string; atualizado_por: string }[] = [];
  const remover: string[] = [];
  for (const [chave, texto] of Object.entries(textos)) {
    if (!(chave in PADRAO)) continue;
    if (texto === null || texto === PADRAO[chave]) remover.push(chave);
    else
      upserts.push({
        chave,
        texto,
        atualizado_em: new Date().toISOString(),
        atualizado_por: email,
      });
  }
  if (upserts.length) {
    const { error } = await sb.from('mensagens_padrao').upsert(upserts);
    if (error) throw new Error(error.message);
  }
  if (remover.length) {
    const { error } = await sb.from('mensagens_padrao').delete().in('chave', remover);
    if (error) throw new Error(error.message);
  }
}
