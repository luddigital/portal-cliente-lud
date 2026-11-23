'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { upload as blobUpload } from '@vercel/blob/client';
import { GravarVoiceOver } from '@/app/_components/GravarVoiceOver';
import {
  TAMANHO_MAX_MB,
  avisosDaEscolha,
  erroAmigavel,
  lotesDeEnvio,
  nomeSeguroBlob,
  separarEscolhidos,
  tipoArquivo,
} from '@/lib/upload-arquivos';

// Limite por arquivo: Vercel funcoes serverless tem cap perto de 500MB de
// request body. Cortamos pouco antes pra deixar margem de overhead. Arquivos
// maiores que isso devem ir via "link externo" (Drive próprio do cliente).

// Concorrência: 2 uploads paralelos. Mais que isso, com vídeos grandes,
// disputa banda e aumenta chance de "Failed to fetch" por timeout na rede
// do cliente (celular, wifi instável). 2 é o sweet spot: rápido sem sobrecarregar.
const PARALELOS = 2;
// Retry por chunk. Cobre falha transiente (Wi-Fi cai por segundos, ISP hipa,
// Google devolve 5xx). Backoff exponencial (2s, 4s, 8s).
const CHUNK_RETRIES = 3;
// Retry da SESSÃO INTEIRA — cria uma sessão nova se a atual falhou tudo.
// Cobre o caso raro de a URL de sessão ter expirado no meio.
const RETRY = 1;
// Tamanho do chunk: 8 MB. Precisa ser múltiplo de 256 KB (regra do Google Drive).
// Pequeno o bastante pra dar retry rápido, grande o bastante pra manter throughput.
// Um vídeo de 200 MB vira 25 chunks — se rede cair em qualquer um, retenta só ele.
const CHUNK_SIZE = 8 * 1024 * 1024;
// Timeout por CHUNK, não por arquivo. 5 min é folgado até em 3G ruim.
const CHUNK_TIMEOUT_MS = 5 * 60 * 1000;

type StatusArquivo = 'pendente' | 'subindo' | 'ok' | 'erro';
type FilaItem = {
  file: File;
  /** Nome que vai pro Drive. Cliente pode editar antes de enviar.
   *  Default: file.name. Mantém extensão original. */
  nome: string;
  status: StatusArquivo;
  erro?: string;
  progresso?: number;
};

/**
 * Sobe UM chunk pro Google Drive via PUT com Content-Range.
 * Retorna o HTTP status: 308 = chunk aceito, continua; 200/201 = upload final ok.
 */
function putChunk(
  uploadUrl: string,
  chunk: Blob,
  contentRange: string,
  mime: string,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.timeout = CHUNK_TIMEOUT_MS;
    xhr.setRequestHeader('Content-Type', mime || 'application/octet-stream');
    xhr.setRequestHeader('Content-Range', contentRange);
    xhr.onload = () => resolve(xhr.status);
    xhr.onerror = () => reject(new Error('rede caiu'));
    xhr.ontimeout = () => reject(new Error('timeout'));
    xhr.send(chunk);
  });
}

/**
 * Pergunta pro Google Drive quantos bytes já foram confirmados nessa sessão.
 * Usa PUT com Content-Range: bytes STAR/TOTAL e body vazio (spec do resumable).
 * Response 308 traz header Range: bytes=0-N indicando o último byte aceito.
 * Ou 200/201 se, entre chunks, o Google reconheceu que o arquivo completou.
 */
function queryStatus(
  uploadUrl: string,
  total: number,
): Promise<{ status: number; byteConfirmado: number | null }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.timeout = 30 * 1000;
    xhr.setRequestHeader('Content-Range', `bytes */${total}`);
    xhr.onload = () => {
      let byteConfirmado: number | null = null;
      const range = xhr.getResponseHeader('Range');
      if (range) {
        const m = range.match(/bytes=0-(\d+)/);
        if (m) byteConfirmado = parseInt(m[1], 10);
      }
      resolve({ status: xhr.status, byteConfirmado });
    };
    xhr.onerror = () => reject(new Error('query rede'));
    xhr.ontimeout = () => reject(new Error('query timeout'));
    xhr.send();
  });
}

/**
 * PUT direto pro Google Drive em CHUNKS de 8 MB via resumable upload protocol.
 *
 * Por que chunked: um PUT gigante de 200 MB numa rede instável (wifi doméstico,
 * 4G) sofre. Qualquer soluço de 2 segundos derruba a request inteira e o cliente
 * perde tudo. Em chunks de 8 MB, cada request dura segundos — se cair, retenta
 * só o pedaço. Se rede cair no meio, query o Google, descobre onde parou, e
 * continua daquele byte.
 *
 * Docs: https://developers.google.com/drive/api/guides/manage-uploads#resumable
 */
function putArquivoNoDrive(
  uploadUrl: string,
  file: File,
  onProgress?: (frac: number) => void,
): Promise<void> {
  const mime = file.type || 'application/octet-stream';
  const total = file.size;

  async function run() {
    let cursor = 0;
    while (cursor < total) {
      const chunkEnd = Math.min(cursor + CHUNK_SIZE, total);
      const chunk = file.slice(cursor, chunkEnd);
      const contentRange = `bytes ${cursor}-${chunkEnd - 1}/${total}`;

      let ultimaErro: Error | null = null;
      let subiu = false;

      for (let tent = 0; tent < CHUNK_RETRIES; tent++) {
        try {
          const status = await putChunk(uploadUrl, chunk, contentRange, mime);
          if (status === 200 || status === 201) {
            // Última chunk aceita, upload terminou.
            onProgress?.(1);
            return;
          }
          if (status === 308) {
            // Chunk aceito, continua próximo.
            cursor = chunkEnd;
            onProgress?.(cursor / total);
            subiu = true;
            break;
          }
          throw new Error(`Google devolveu HTTP ${status}`);
        } catch (err: any) {
          ultimaErro = err;
          if (tent < CHUNK_RETRIES - 1) {
            // Backoff exponencial: 2s, 4s, 8s.
            await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, tent)));
            // Query pro Google: já confirmou parte? Continua de onde parou.
            try {
              const q = await queryStatus(uploadUrl, total);
              if (q.status === 200 || q.status === 201) {
                onProgress?.(1);
                return;
              }
              if (q.byteConfirmado != null) {
                cursor = q.byteConfirmado + 1;
                onProgress?.(cursor / total);
                // Se avançou dentro do chunk atual, refaz o chunk desse ponto.
                if (cursor >= chunkEnd) {
                  subiu = true;
                  break;
                }
              }
            } catch {
              // Query falhou, continua retentando o chunk mesmo.
            }
          }
        }
      }

      if (!subiu) {
        throw ultimaErro ?? new Error('Falha ao subir chunk após retentativas');
      }
    }
  }

  return run();
}

/** Classifica o arquivo pelo tipo pra decidir qual preview mostrar. */
/**
 * Card de 1 arquivo na galeria antes do envio.
 * Mostra preview visual (imagem/vídeo), nome editável e botão X pra remover.
 * Enquanto sobe: overlay com %. Depois: status check/erro.
 */
function CardArquivo({
  item,
  podeEditar,
  onRemover,
  onRenomear,
}: {
  item: FilaItem;
  podeEditar: boolean;
  onRemover: () => void;
  onRenomear: (novoNomeBase: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const ext = item.file.name.includes('.')
    ? item.file.name.slice(item.file.name.lastIndexOf('.'))
    : '';
  const baseAtual = item.nome.endsWith(ext)
    ? item.nome.slice(0, item.nome.length - ext.length)
    : item.nome;
  const [valor, setValor] = useState(baseAtual);
  const grande = item.file.size > TAMANHO_MAX_MB * 1024 * 1024;
  const pct = item.progresso ? Math.round(item.progresso * 100) : null;
  const tipo = tipoArquivo(item.file);

  // Blob URL pra preview local. Revoga no cleanup pra não vazar memória.
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (tipo === 'imagem' || tipo === 'video' || tipo === 'audio') {
      const url = URL.createObjectURL(item.file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    return undefined;
  }, [item.file, tipo]);

  function confirmar() {
    onRenomear(valor);
    setEditando(false);
  }

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border bg-white transition ${
        item.status === 'erro' || grande
          ? 'border-[var(--prazo-atrasado)]/30'
          : item.status === 'ok'
            ? 'border-[var(--prazo-em-dia)]/40'
            : item.status === 'subindo'
              ? 'border-navy/30'
              : 'border-[rgba(21,21,33,0.1)] hover:border-navy/40'
      }`}
    >
      {/* Preview visual */}
      <div className="relative aspect-square w-full overflow-hidden bg-bgSoft">
        {tipo === 'imagem' && preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt={item.nome}
            className="h-full w-full object-cover"
          />
        )}
        {tipo === 'video' && preview && (
          <video
            src={preview}
            preload="metadata"
            muted
            playsInline
            className="h-full w-full object-cover"
          />
        )}
        {tipo === 'audio' && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-mauve/15 px-3 text-mauve">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[28px] leading-none">🎙</span>
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.08em]">
                áudio
              </span>
            </div>
            {preview && (
              <audio
                src={preview}
                controls
                preload="metadata"
                className="h-8 w-full max-w-full"
              />
            )}
          </div>
        )}
        {tipo === 'outro' && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-t3">
            <span className="text-[32px] leading-none">📎</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">
              arquivo
            </span>
          </div>
        )}

        {/* Botão X — só antes do envio */}
        {podeEditar && (
          <button
            type="button"
            onClick={onRemover}
            title="Remover da lista"
            aria-label="Remover arquivo"
            className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink/80 text-[14px] font-bold text-white opacity-90 transition hover:bg-ink hover:opacity-100"
          >
            ×
          </button>
        )}

        {/* Overlay de progresso durante upload */}
        {item.status === 'subindo' && pct != null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink/60 text-white">
            <div className="font-mono text-[20px] font-semibold">{pct}%</div>
            <div className="mt-2 h-1 w-3/4 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full bg-white transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Badge de status final */}
        {item.status === 'ok' && (
          <div className="absolute left-1.5 top-1.5 inline-flex h-6 items-center justify-center rounded-full bg-[var(--prazo-em-dia)] px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-white">
            ✓ enviado
          </div>
        )}
        {(item.status === 'erro' || grande) && (
          <div className="absolute left-1.5 top-1.5 inline-flex h-6 items-center justify-center rounded-full bg-[var(--prazo-atrasado)] px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-white">
            ⚠ {grande ? 'muito grande' : 'erro'}
          </div>
        )}
      </div>

      {/* Nome + tamanho */}
      <div className="p-2.5">
        {editando ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              onBlur={confirmar}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmar();
                if (e.key === 'Escape') {
                  setValor(baseAtual);
                  setEditando(false);
                }
              }}
              autoFocus
              className="min-w-0 flex-1 rounded border border-navy/40 bg-white px-1.5 py-0.5 font-mono text-[11px] text-ink focus:outline-none"
            />
            <span className="shrink-0 font-mono text-[10px] text-t3">
              {ext}
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => podeEditar && setEditando(true)}
            disabled={!podeEditar}
            title={podeEditar ? 'Clique pra renomear' : item.nome}
            className={`block w-full truncate text-left font-mono text-[11px] text-ink ${
              podeEditar ? 'hover:underline' : 'cursor-default'
            }`}
          >
            {item.nome}
          </button>
        )}
        <div className="mt-0.5 flex items-center justify-between text-[10px] text-t3">
          <span className="font-mono">
            {(item.file.size / 1024 / 1024).toFixed(1)} MB
          </span>
          {podeEditar && !editando && (
            <span className="text-[9.5px] italic opacity-70">
              clique no nome pra renomear
            </span>
          )}
        </div>
        {item.status === 'erro' && item.erro && (
          <div className="mt-1 text-[10px] leading-tight text-[var(--prazo-atrasado)]">
            {item.erro}
          </div>
        )}
      </div>
    </div>
  );
}

export function TarefaForm({
  tarefaId,
  voltarPara = '/',
  mostrarTexto = true,
  aceitarComentario = false,
  aceitarLink = false,
  aceitarTipos = 'image/*,video/*,audio/*,application/pdf',
  textoBotao = 'Enviar materiais',
  tituloUpload = 'Fotos, vídeos e áudios',
  ajudaUpload = 'Pode mandar quantos arquivos quiser, inclusive áudios.',
  textoVoiceOver,
  permitirGravarVoz = false,
  naoFinalizarTarefa = false,
}: {
  tarefaId: string;
  voltarPara?: string;
  mostrarTexto?: boolean;
  aceitarComentario?: boolean;
  aceitarLink?: boolean;
  aceitarTipos?: string;
  textoBotao?: string;
  tituloUpload?: string;
  ajudaUpload?: string;
  textoVoiceOver?: string;
  /** Quando true, mostra o gravador mesmo sem roteiro — modo "mensagem de voz". */
  permitirGravarVoz?: boolean;
  /** Quando true, envia arquivos + comentários mas NÃO fecha a tarefa
   *  (uso: adiantar materiais na etapa de pauta — quem fecha é o Aprovar). */
  naoFinalizarTarefa?: boolean;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState('');
  const [comentario, setComentario] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [fila, setFila] = useState<FilaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<{ feitos: number; total: number } | null>(null);
  const [done, setDone] = useState<{ arquivos: number } | null>(null);
  const [popupGrandes, setPopupGrandes] = useState<File[]>([]);

  function escolherArquivos(escolhidos: File[]) {
    // Soma à lista: no celular a cliente costuma escolher em várias rodadas
    // (um álbum de cada vez). Antes a segunda escolha apagava a primeira.
    const r = separarEscolhidos(fila.map((it) => it.file), escolhidos);
    setFila((prev) => [...prev, ...r.novos.map((f) => ({ file: f, nome: f.name, status: 'pendente' as const }))]);
    setError(avisosDaEscolha(r));
    // Abre popup pra qualquer arquivo que exceda o limite — assim o cliente
    // não descobre só quando tenta enviar.
    if (r.grandes.length > 0) setPopupGrandes(r.grandes);
  }

  function adicionarGravacao(file: File) {
    setFila((prev) => [
      // Remove gravação anterior (se a pessoa regravou) e adiciona a nova
      ...prev.filter((it) => !it.file.name.startsWith('voice-over-')),
      { file, nome: file.name, status: 'pendente' as const },
    ]);
    setError(null);
  }

  function removerDaFila(item: FilaItem) {
    setFila((prev) => prev.filter((it) => it !== item));
  }

  function renomearItem(item: FilaItem, novoNomeBase: string) {
    // Preserva a extensão original — cliente só edita a parte do nome.
    const ext = item.file.name.includes('.')
      ? item.file.name.slice(item.file.name.lastIndexOf('.'))
      : '';
    const base = novoNomeBase.trim().replace(/\.[^./]*$/, ''); // tira ext se o cliente digitou
    const nome = (base || 'arquivo') + ext;
    setFila((prev) =>
      prev.map((it) => (it === item ? { ...it, nome } : it)),
    );
  }

  // Fechar a aba no meio do envio perde os arquivos que faltam: o navegador pergunta antes.
  useEffect(() => {
    if (!loading) return;
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [loading]);

  const arquivosGrandes = fila.filter((it) => it.file.size > TAMANHO_MAX_MB * 1024 * 1024);
  const tamanhoTotalMB = fila.reduce((s, it) => s + it.file.size, 0) / (1024 * 1024);

  async function subirArquivo(item: FilaItem): Promise<void> {
    // Estratégia: sobe pro Vercel Blob (edge, geograficamente perto do
    // cliente, muito mais estável que googleapis.com em redes oscilantes),
    // depois o servidor (com conexão de datacenter) transfere pro Drive.
    //
    // O @vercel/blob/client faz multipart chunked internamente e cuida de
    // retry a nível de pedaço. Rede caindo por segundos não derruba tudo.
    const blob = await blobUpload(nomeSeguroBlob(item.nome), item.file, {
      access: 'public',
      contentType: item.file.type || 'application/octet-stream',
      handleUploadUrl: `/api/tarefas/${tarefaId}/blob-token`,
      multipart: true, // ativa chunks paralelos com retry embutido
      // addRandomSuffix é configurado no server (/blob-token) — a flag
      // só vale em onBeforeGenerateToken, não aqui no client.
      onUploadProgress: ({ percentage }) => {
        const frac = percentage / 100;
        setFila((prev) =>
          prev.map((it) =>
            it === item ? { ...it, progresso: frac } : it,
          ),
        );
      },
    });

    // Blob upload terminou. Logs no console pra debug.
    // eslint-disable-next-line no-console
    console.log('[upload] blob criado:', {
      arquivo: item.file.name,
      url: blob.url,
      pathname: blob.pathname,
    });

    // Agora o servidor puxa do Blob e sobe pro Drive definitivo.
    const transferRes = await fetch(
      `/api/tarefas/${tarefaId}/blob-para-drive`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          blobUrl: blob.url,
          nome: item.nome, // nome editado pelo cliente, vai pro Drive assim
          mimeType: item.file.type || 'application/octet-stream',
          tamanho: item.file.size,
        }),
      },
    );
    if (!transferRes.ok) {
      let msg = `Erro ${transferRes.status} ao mover pro Drive`;
      try {
        const d = await transferRes.json();
        msg = d.error ?? msg;
      } catch {}
      throw new Error(msg);
    }
  }

  async function finalizar(totalArquivos: number) {
    const fd = new FormData();
    fd.set('finalize', 'true');
    fd.set('totalAcumulado', String(totalArquivos));
    if (mostrarTexto && texto.trim()) fd.set('texto', texto.trim());
    if (aceitarComentario && comentario.trim()) fd.set('comentario', comentario.trim());
    if (aceitarLink && linkUrl.trim()) fd.set('linkUrl', linkUrl.trim());
    if (naoFinalizarTarefa) fd.set('naoConcluirTarefa', 'true');
    const res = await fetch(`/api/tarefas/${tarefaId}/submit`, {
      method: 'POST',
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
    return data;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const linkLimpo = linkUrl.trim();
    if (linkLimpo && !/^https?:\/\//i.test(linkLimpo)) {
      setError('O link precisa começar com https:// (é só copiar o endereço completo).');
      return;
    }
    if (arquivosGrandes.length > 0) {
      setError(
        `${arquivosGrandes.length === 1 ? 'Um arquivo passa' : `${arquivosGrandes.length} arquivos passam`} de ${TAMANHO_MAX_MB} MB e não sobe${arquivosGrandes.length === 1 ? '' : 'm'} por aqui. Tira da lista e manda pelo Google Drive, Dropbox ou WeTransfer, colando o link em "Ou mande por link".`,
      );
      return;
    }

    setLoading(true);
    setProgresso({ feitos: 0, total: fila.length });

    try {
      // Sobe arquivos em lotes paralelos. Cada upload vai DIRETO pro Drive
      // via resumable session — não passa pelo Vercel.
      //
      // Só processa itens 'pendente' ou 'erro' (permite re-clicar Enviar
      // pra retentar só os que faltam, mantendo os já 'ok').
      const paraSubir = fila.filter(
        (it) => it.status === 'pendente' || it.status === 'erro',
      );
      let feitos = fila.filter((it) => it.status === 'ok').length;
      // Situação de cada arquivo NESTE envio. A `fila` do React aqui dentro é a do clique
      // (não muda durante o envio): antes, um arquivo que deu erro na 1ª tentativa e subiu
      // na 2ª continuava contado como erro e o envio nunca era finalizado.
      const falhouAgora = new Set<FilaItem>();
      setProgresso({ feitos, total: fila.length });
      // O 1º arquivo sobe sozinho: ele cria as pastas no Drive. Se 2 subirem
      // juntos numa pasta que ainda não existe, o Drive pode criar pasta duplicada.
      for (const lote of lotesDeEnvio(paraSubir, PARALELOS, feitos === 0)) {
        // Marca como subindo
        setFila((prev) =>
          prev.map((it) =>
            lote.includes(it) ? { ...it, status: 'subindo' as const } : it,
          ),
        );
        // Sobe em paralelo
        const resultados = await Promise.allSettled(
          lote.map((it) => subirArquivo(it)),
        );
        // Atualiza status individual
        setFila((prev) =>
          prev.map((it) => {
            const idx = lote.indexOf(it);
            if (idx === -1) return it;
            const r = resultados[idx];
            if (r.status === 'fulfilled') return { ...it, status: 'ok' as const };
            return { ...it, status: 'erro' as const, erro: erroAmigavel(r.reason?.message) };
          }),
        );
        lote.forEach((it, i) => {
          if (resultados[i].status === 'rejected') falhouAgora.add(it);
        });
        feitos += resultados.filter((r) => r.status === 'fulfilled').length;
        setProgresso({ feitos, total: fila.length });

        // Se TODOS desse lote falharam, aborta (provavelmente erro de
        // rede/auth — não adianta continuar).
        if (resultados.every((r) => r.status === 'rejected')) {
          throw new Error(erroAmigavel((resultados[0] as PromiseRejectedResult).reason?.message));
        }
      }

      // Depois de rodar tudo, checa quantos falharam mesmo com retry.
      // Se sobrou algum com erro, avisa o cliente do que precisa fazer
      // (retentar apenas os que faltam, ou mandar por link externo).
      const falhados = [...falhouAgora];
      if (falhados.length > 0) {
        setError(
          `${falhados.length} de ${fila.length} arquivos não subiram (${falhados
            .slice(0, 3)
            .map((f) => f.file.name)
            .join(', ')}${falhados.length > 3 ? '…' : ''}). ` +
            `Clica em enviar de novo que a gente tenta só os que faltaram. ` +
            `Se continuar dando erro, manda por link.`,
        );
        setLoading(false);
        return; // não finaliza a tarefa enquanto tem falha
      }

      // Última chamada — finaliza (fecha tarefa OU só sobe, dependendo de naoFinalizarTarefa)
      const ret = await finalizar(feitos);
      setDone({ arquivos: ret.arquivos ?? feitos });
      // Só redireciona quando REALMENTE fechou a tarefa. No modo "adiantar
      // materiais" (naoFinalizarTarefa), o cliente continua na página pra
      // clicar Aprovar/Pedir alteração logo abaixo.
      if (!naoFinalizarTarefa) {
        setTimeout(() => router.push(voltarPara), 2000);
      }
    } catch (err: any) {
      setError(erroAmigavel(err?.message));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    if (naoFinalizarTarefa) {
      return (
        <div className="card p-5 text-center">
          <div className="text-[14px] font-semibold text-ink">
            ✓ Materiais recebidos
          </div>
          <p className="mt-1 text-[12px] text-t2">
            {done.arquivos > 0
              ? `${done.arquivos} arquivo${done.arquivos > 1 ? 's' : ''} já ${done.arquivos > 1 ? 'estão' : 'está'} com a equipe. `
              : ''}
            Agora é só aprovar a pauta aqui embaixo pra gente seguir.
          </p>
        </div>
      );
    }
    return (
      <div className="card p-8 text-center">
        <div className="text-[16px] font-semibold text-ink">Recebemos! ✨</div>
        <p className="mt-2 text-[13px] text-mauve">
          {done.arquivos > 0
            ? `${done.arquivos} arquivo${done.arquivos > 1 ? 's' : ''} já ${done.arquivos > 1 ? 'estão' : 'está'} com a equipe. Obrigada!`
            : 'Já está tudo com a equipe. Obrigada!'}
        </p>
        <p className="mt-4 text-[11px] text-t3">
          {voltarPara === '/' ? 'Voltando pro início…' : 'Voltando…'}
        </p>
      </div>
    );
  }

  const algumConteudo =
    (mostrarTexto && !!texto.trim()) ||
    (aceitarComentario && !!comentario.trim()) ||
    (aceitarLink && !!linkUrl.trim()) ||
    fila.length > 0;
  const semConteudo = !algumConteudo;

  return (
    <form onSubmit={submit} className="space-y-6">
      {mostrarTexto && (
        <div className="card p-5">
          <label className="label">Conta pra gente</label>
          <textarea
            rows={8}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escreve aqui tudo o que ajuda a montar esse post: contexto, detalhes, datas, nomes…"
            className="input resize-y"
          />
        </div>
      )}

      {(textoVoiceOver && textoVoiceOver.trim().length > 0) || permitirGravarVoz ? (
        <GravarVoiceOver
          texto={textoVoiceOver?.trim() || undefined}
          onGravacao={adicionarGravacao}
        />
      ) : null}

      <div className="card p-5">
        <label className="label">{tituloUpload}</label>
        <div className="relative rounded-[10px] border-2 border-dashed border-[rgba(21,21,33,0.1)] bg-[#FAFAFB] p-10 text-center transition hover:border-navy/40">
          <input
            type="file"
            multiple
            accept={aceitarTipos}
            onChange={(e) => {
              escolherArquivos(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
            disabled={loading}
          />
          <svg
            className="mx-auto mb-3 h-8 w-8 text-mauve"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="5" width="18" height="14" rx="2.5" />
            <circle cx="8.5" cy="10" r="1.5" />
            <path d="M21 15l-4.5-4.5L8 19" />
          </svg>
          <div className="text-[13px] font-medium text-ink">
            {fila.length > 0
              ? `${fila.length} arquivo${fila.length > 1 ? 's' : ''} selecionado${fila.length > 1 ? 's' : ''} · ${tamanhoTotalMB.toFixed(1)} MB`
              : 'Clique aqui ou arraste os arquivos'}
          </div>
          <div className="mt-1 text-[12px] text-t2">{ajudaUpload}</div>
        </div>

        {/* Link: alternativa ao upload, no mesmo box (arquivo grande ou pasta pronta) */}
        {aceitarLink ? (
          <div className="mt-4">
            <label htmlFor="link-externo" className="block text-[12.5px] font-semibold text-ink">
              Ou mande por link
            </label>
            <p className="mt-0.5 text-[12px] text-t2">
              Arquivo com mais de {TAMANHO_MAX_MB} MB, ou já está tudo numa pasta? Cola o link do Google Drive,
              Dropbox ou WeTransfer. Só confere se ele está aberto pra quem tiver o link.
            </p>
            <input
              id="link-externo"
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://drive.google.com/…"
              className="input mt-2 text-[13px]"
            />
          </div>
        ) : (
          <p className="mt-3 text-[12px] text-t2">
            Cada arquivo pode ter até {TAMANHO_MAX_MB} MB. Se algum for maior, manda o link pra gente no WhatsApp.
          </p>
        )}

        {fila.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-[11.5px] text-t2">
                <b className="text-ink">{fila.length}</b>{' '}
                {fila.length === 1 ? 'arquivo escolhido' : 'arquivos escolhidos'}
                <span className="ml-1 text-t3">
                  · {(fila.reduce((s, it) => s + it.file.size, 0) / 1024 / 1024).toFixed(1)} MB
                </span>
              </div>
              {!loading && (
                <span className="text-[10.5px] italic text-t3">
                  Clique no nome pra renomear ou no X pra tirar da lista.
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {fila.map((it, i) => (
                <CardArquivo
                  key={i}
                  item={it}
                  podeEditar={!loading && it.status !== 'ok' && it.status !== 'subindo'}
                  onRemover={() => removerDaFila(it)}
                  onRenomear={(novo) => renomearItem(it, novo)}
                />
              ))}
            </div>
          </div>
        )}

        {progresso && loading && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] text-t2">
              <span>
                Enviando… {progresso.feitos} de {progresso.total} arquivos
              </span>
              <span className="font-mono">
                {Math.round((progresso.feitos / progresso.total) * 100)}%
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bgSoft">
              <div
                className="h-full transition-all"
                style={{
                  width: `${(progresso.feitos / progresso.total) * 100}%`,
                  background: 'var(--navyHub, #2C3E66)',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {aceitarComentario && (
        <div className="card p-5">
          <label htmlFor="recado-equipe" className="label">
            Recado pra equipe (opcional)
          </label>
          <p className="-mt-1 mb-2 text-[12px] text-t2">Quer explicar alguma coisa sobre os arquivos? Escreve aqui.</p>
          <textarea
            id="recado-equipe"
            rows={3}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Ex.: a foto 3 é a minha preferida. Os vídeos do jantar já mandei no WhatsApp."
            className="input resize-y text-[13px]"
          />
        </div>
      )}

      {error && <p className="text-[12px] font-medium text-crimson">{error}</p>}

      <div className="flex items-center justify-end gap-3">
        <button type="submit" disabled={loading || semConteudo} className="btn-primary">
          {loading ? 'Enviando…' : textoBotao}
        </button>
      </div>

      {popupGrandes.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setPopupGrandes([])}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start gap-3">
              <span className="text-[24px]" aria-hidden>⚠️</span>
              <div>
                <h3 className="text-[16px] font-semibold text-ink">
                  {popupGrandes.length === 1
                    ? 'Esse arquivo é grande demais'
                    : `${popupGrandes.length} arquivos são grandes demais`}
                </h3>
                <p className="mt-1 text-[13px] text-t2">
                  Aqui no portal cada arquivo pode ter até <b>{TAMANHO_MAX_MB} MB</b>. Pra esses, o
                  caminho mais rápido é mandar por link.
                </p>
              </div>
            </div>

            <ul className="mb-4 max-h-32 space-y-1 overflow-y-auto rounded-lg bg-bgSoft p-2 text-[12px] font-mono">
              {popupGrandes.map((f, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="truncate">{f.name}</span>
                  <span className="shrink-0 text-[var(--prazo-atrasado)]">
                    {(f.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                </li>
              ))}
            </ul>

            <div className="mb-4 rounded-lg bg-bgSoft/60 p-3 text-[12px] text-t1">
              <b>É rapidinho:</b>
              <ol className="mt-1.5 list-decimal space-y-1 pl-4">
                <li>Sobe o arquivo no Google Drive, Dropbox ou WeTransfer</li>
                <li>Deixa o link aberto pra qualquer pessoa que tiver ele</li>
                <li>
                  {aceitarLink
                    ? 'Cola o link em "Ou mande por link", aqui na página'
                    : 'Manda o link pra gente no WhatsApp'}
                </li>
              </ol>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPopupGrandes([])}
                className="btn-primary"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
