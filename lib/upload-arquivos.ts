/**
 * Regras do envio de arquivos do cliente (tela de materiais), sem React,
 * pra poder testar. Usado em app/tarefa/[id]/form.tsx.
 */

/** Teto por arquivo no portal. Acima disso, o cliente manda por link. */
export const TAMANHO_MAX_MB = 450;

type ArquivoLike = { name: string; size: number; type: string; lastModified: number };

export function tipoArquivo(file: { name: string; type: string }): 'imagem' | 'video' | 'audio' | 'outro' {
  const mime = (file.type || '').toLowerCase();
  const nome = file.name.toLowerCase();
  if (mime.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(nome)) return 'imagem';
  if (mime.startsWith('video/') || /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(nome)) return 'video';
  if (mime.startsWith('audio/') || /\.(mp3|m4a|wav|ogg|aac|flac)$/i.test(nome)) return 'audio';
  return 'outro';
}

/** Tipos que sobem pelo portal (o resto vai por link). Sem tipo = deixa passar (HEIC em alguns navegadores). */
export function tipoAceito(file: { name: string; type: string }): boolean {
  const mime = (file.type || '').toLowerCase();
  if (!mime) return true;
  return /^(image|video|audio)\//.test(mime) || mime === 'application/pdf' || tipoArquivo(file) !== 'outro';
}

/** Erro técnico → frase que a cliente entende. */
export function erroAmigavel(msg: string | undefined): string {
  const m = (msg ?? '').toLowerCase();
  if (/failed to fetch|network|load failed|fetch failed|timeout|timed out|internet/.test(m)) {
    return 'A internet oscilou e esse arquivo não chegou. Clica em enviar de novo.';
  }
  if (/content type|content-type/.test(m)) return 'Esse tipo de arquivo não sobe por aqui. Manda por link.';
  if (/too large|file size|exceeds/.test(m)) {
    return `Arquivo grande demais pro portal (máx. ${TAMANHO_MAX_MB} MB). Manda por link.`;
  }
  if (/não autenticado|unauthori|401/.test(m)) return 'Sua sessão expirou. Atualiza a página e entra de novo.';
  return msg || 'Esse arquivo não subiu. Clica em enviar de novo.';
}

/** Caminho no Blob sem caracteres que quebram URL (#, ?, %, barras). O nome no Drive continua o escolhido. */
export function nomeSeguroBlob(nome: string): string {
  return nome.replace(/[#?%\\/:*"<>|]/g, '-').replace(/\s+/g, ' ').trim() || 'arquivo';
}

/** Mesmo arquivo escolhido duas vezes (nome + tamanho + data) não entra repetido. */
export const chaveArquivo = (f: ArquivoLike) => `${f.name}|${f.size}|${f.lastModified}`;

/**
 * Escolha de arquivos SOMA à lista (no celular a cliente escolhe em várias
 * rodadas). Separa os vazios (0 KB, comum no iCloud) e os tipos que não sobem.
 */
export function separarEscolhidos<T extends ArquivoLike>(
  jaNaLista: T[],
  escolhidos: T[],
): { novos: T[]; vazios: T[]; naoAceitos: T[]; grandes: T[] } {
  const ja = new Set(jaNaLista.map(chaveArquivo));
  const vistos = new Set<string>();
  const novos: T[] = [];
  for (const f of escolhidos) {
    if (f.size === 0 || !tipoAceito(f)) continue;
    const k = chaveArquivo(f);
    if (ja.has(k) || vistos.has(k)) continue;
    vistos.add(k);
    novos.push(f);
  }
  return {
    novos,
    vazios: escolhidos.filter((f) => f.size === 0),
    naoAceitos: escolhidos.filter((f) => f.size > 0 && !tipoAceito(f)),
    grandes: novos.filter((f) => f.size > TAMANHO_MAX_MB * 1024 * 1024),
  };
}

/** Avisos da escolha, em português de gente (null = nada a avisar). */
export function avisosDaEscolha(r: { vazios: { name: string }[]; naoAceitos: { name: string }[] }): string | null {
  const avisos: string[] = [];
  if (r.vazios.length > 0) {
    avisos.push(
      `${r.vazios.map((f) => f.name).join(', ')} ${r.vazios.length === 1 ? 'está vazio' : 'estão vazios'} (0 KB). Se estiver no iCloud ou no Google Fotos, baixa pro aparelho antes de escolher.`,
    );
  }
  if (r.naoAceitos.length > 0) {
    avisos.push(`${r.naoAceitos.map((f) => f.name).join(', ')}: esse tipo de arquivo não sobe por aqui. Manda por link.`);
  }
  return avisos.length > 0 ? avisos.join(' ') : null;
}

/** Ordem de envio: o 1º arquivo sozinho (cria as pastas no Drive), o resto em lotes. */
export function lotesDeEnvio<T>(itens: T[], paralelos: number, primeiroSozinho: boolean): T[][] {
  const lotes: T[][] = [];
  let i = 0;
  if (primeiroSozinho && itens.length > 0) {
    lotes.push([itens[0]]);
    i = 1;
  }
  for (; i < itens.length; i += paralelos) lotes.push(itens.slice(i, i + paralelos));
  return lotes;
}
