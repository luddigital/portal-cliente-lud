'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { GravarVoiceOver } from '@/app/_components/GravarVoiceOver';

// Limite por arquivo: Vercel funcoes serverless tem cap perto de 500MB de
// request body. Cortamos pouco antes pra deixar margem de overhead. Arquivos
// maiores que isso devem ir via "link externo" (Drive próprio do cliente).
const TAMANHO_MAX_MB = 450;

// Concorrência: subir 3 arquivos em paralelo é seguro pro Drive e bem mais
// rápido que sequencial. Mais que isso a Drive API começa a 503.
const PARALELOS = 3;

type StatusArquivo = 'pendente' | 'subindo' | 'ok' | 'erro';
type FilaItem = { file: File; status: StatusArquivo; erro?: string };

export function TarefaForm({
  tarefaId,
  voltarPara = '/',
  mostrarTexto = true,
  aceitarComentario = false,
  aceitarLink = false,
  aceitarTipos = 'image/*,video/*,audio/*',
  textoBotao = 'Enviar materiais',
  tituloUpload = 'Fotos, vídeos e áudios',
  ajudaUpload = 'Você pode anexar vários arquivos — incluindo gravações de voice over.',
  textoVoiceOver,
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

  function escolherArquivos(novos: File[]) {
    setFila((prev) => [
      // Mantém gravações de voice over que já estavam na fila — só substitui
      // o que veio do file picker.
      ...prev.filter((it) => it.file.name.startsWith('voice-over-')),
      ...novos.map((f) => ({ file: f, status: 'pendente' as const })),
    ]);
    setError(null);
  }

  function adicionarGravacao(file: File) {
    setFila((prev) => [
      // Remove gravação anterior (se a pessoa regravou) e adiciona a nova
      ...prev.filter((it) => !it.file.name.startsWith('voice-over-')),
      { file, status: 'pendente' as const },
    ]);
    setError(null);
  }

  const arquivosGrandes = fila.filter((it) => it.file.size > TAMANHO_MAX_MB * 1024 * 1024);
  const tamanhoTotalMB = fila.reduce((s, it) => s + it.file.size, 0) / (1024 * 1024);

  async function subirArquivo(item: FilaItem): Promise<void> {
    const fd = new FormData();
    fd.append('arquivos', item.file);
    const res = await fetch(`/api/tarefas/${tarefaId}/submit`, {
      method: 'POST',
      body: fd,
    });
    if (!res.ok) {
      let msg = `Erro ${res.status}`;
      try {
        const d = await res.json();
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
      setError('O link precisa começar com https://');
      return;
    }
    if (arquivosGrandes.length > 0) {
      setError(
        `${arquivosGrandes.length} arquivo(s) passam de ${TAMANHO_MAX_MB} MB e não vão subir aqui. Manda esses por Drive/Dropbox/WeTransfer e cola o link em "Link externo".`,
      );
      return;
    }

    setLoading(true);
    setProgresso({ feitos: 0, total: fila.length });

    try {
      // Sobe arquivos em chunks paralelos (3 por vez). Cada upload é 1
      // request — Vercel processa sem estourar limite.
      let cursor = 0;
      let feitos = 0;
      while (cursor < fila.length) {
        const lote = fila.slice(cursor, cursor + PARALELOS);
        cursor += PARALELOS;
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
            return { ...it, status: 'erro' as const, erro: r.reason?.message };
          }),
        );
        feitos += resultados.filter((r) => r.status === 'fulfilled').length;
        setProgresso({ feitos, total: fila.length });

        // Se TODOS desse lote falharam, aborta (provavelmente erro de
        // rede/auth — não adianta continuar).
        if (resultados.every((r) => r.status === 'rejected')) {
          throw new Error(
            (resultados[0] as PromiseRejectedResult).reason?.message ??
              'Falha geral no upload',
          );
        }
      }

      // Última chamada — finaliza tarefa
      const ret = await finalizar(feitos);
      setDone({ arquivos: ret.arquivos ?? feitos });
      setTimeout(() => router.push(voltarPara), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="card p-8 text-center">
        <div className="text-[16px] font-semibold text-ink">Enviado ✨</div>
        <p className="mt-2 text-[13px] text-mauve">
          {done.arquivos > 0
            ? `${done.arquivos} arquivo${done.arquivos > 1 ? 's' : ''} no Drive + `
            : ''}
          tarefa atualizada no Notion.
        </p>
        <p className="mt-4 text-[11px] text-t3">
          {voltarPara === '/' ? 'Voltando pro dashboard…' : 'Voltando pra etapa…'}
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
          <label className="label">Informações</label>
          <textarea
            rows={8}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escreva aqui tudo que a gente precisa saber pra montar esse post."
            className="input resize-y"
          />
        </div>
      )}

      {textoVoiceOver && textoVoiceOver.trim().length > 0 && (
        <GravarVoiceOver texto={textoVoiceOver} onGravacao={adicionarGravacao} />
      )}

      <div className="card p-5">
        <label className="label">{tituloUpload}</label>
        <div className="relative rounded-[10px] border-2 border-dashed border-[rgba(21,21,33,0.1)] bg-[#FAFAFB] p-10 text-center transition hover:border-navy/40">
          <input
            type="file"
            multiple
            accept={aceitarTipos}
            onChange={(e) => escolherArquivos(Array.from(e.target.files ?? []))}
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
              : 'Selecione os arquivos do seu computador ou celular'}
          </div>
          <div className="mt-1 text-[11px] text-t3">{ajudaUpload}</div>
          <div className="mt-1 text-[10px] text-t3">
            Cada arquivo até {TAMANHO_MAX_MB} MB. Acima disso, use "Link externo".
          </div>
        </div>

        {fila.length > 0 && (
          <ul className="mt-3 space-y-1 text-[12px]">
            {fila.map((it, i) => {
              const grande = it.file.size > TAMANHO_MAX_MB * 1024 * 1024;
              return (
                <li
                  key={i}
                  className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 font-mono ${
                    it.status === 'erro' || grande
                      ? 'bg-[var(--prazo-atrasado-soft)] text-[var(--prazo-atrasado)]'
                      : it.status === 'ok'
                        ? 'bg-[var(--prazo-em-dia-soft)] text-[var(--prazo-em-dia)]'
                        : it.status === 'subindo'
                          ? 'bg-bgSoft text-t2'
                          : 'text-t2'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0">
                      {it.status === 'ok'
                        ? '✓'
                        : it.status === 'erro'
                          ? '⚠'
                          : it.status === 'subindo'
                            ? '↑'
                            : grande
                              ? '✕'
                              : '·'}
                    </span>
                    <span className="truncate">{it.file.name}</span>
                  </span>
                  <span className="shrink-0 text-[11px]">
                    {(it.file.size / 1024 / 1024).toFixed(1)} MB
                    {grande && (
                      <span className="ml-1 not-italic">passa do limite</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {progresso && loading && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] text-t2">
              <span>
                Subindo arquivos… {progresso.feitos} de {progresso.total}
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

      {(aceitarComentario || aceitarLink) && (
        <div className="card space-y-4 p-5">
          <div>
            <div className="label">Algo a mais? (opcional)</div>
            <p className="-mt-1 mb-2 text-[11px] text-t3">
              Deixa um recado pra equipe ou cola um link de Drive / Dropbox /
              WeTransfer se preferir mandar os arquivos por fora.
            </p>
          </div>

          {aceitarComentario && (
            <div>
              <label className="block text-[11px] font-medium text-t2">
                Comentário
              </label>
              <textarea
                rows={3}
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Ex: prefiro usar a foto X, ou já mandei o material no WhatsApp."
                className="input mt-1 resize-y text-[13px]"
              />
            </div>
          )}

          {aceitarLink && (
            <div>
              <label className="block text-[11px] font-medium text-t2">
                Link externo
              </label>
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://drive.google.com/…"
                className="input mt-1 text-[13px]"
              />
            </div>
          )}
        </div>
      )}

      {error && <p className="text-[12px] font-medium text-crimson">{error}</p>}

      <div className="flex items-center justify-end gap-3">
        <button type="submit" disabled={loading || semConteudo} className="btn-primary">
          {loading ? 'Enviando…' : textoBotao}
        </button>
      </div>
    </form>
  );
}
