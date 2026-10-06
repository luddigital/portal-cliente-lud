import type { PreviewArquivo } from './PostPreview';

/**
 * Galeria de MATÉRIA-PRIMA que o cliente já enviou pra equipe usar num post.
 * Diferente do PostPreview (que é o carrossel pronto pra aprovação de arte),
 * aqui mostra os arquivos brutos como thumbnails de galeria — imagens abrem
 * a preview, vídeos e áudios ficam com ícone + nome + link pro Drive.
 *
 * Usada nas etapas de "materiais pra produção" / "conteúdos prévios" —
 * quando NÃO tem sentido mostrar carrossel porque a arte ainda vai ser
 * produzida pela equipe.
 */
export function GaleriaMateriais({
  arquivos,
  titulo = 'Materiais que você já enviou',
  legenda,
}: {
  arquivos: PreviewArquivo[];
  titulo?: string;
  legenda?: string;
}) {
  if (arquivos.length === 0) {
    return (
      <div className="card p-6 text-center text-[13px] text-t3">
        Nada enviado ainda. Use o formulário abaixo pra mandar fotos, vídeos ou áudios.
      </div>
    );
  }

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
          {titulo}
        </div>
        <span className="text-[10px] text-t3">
          {arquivos.length} {arquivos.length === 1 ? 'arquivo' : 'arquivos'}
        </span>
      </div>
      {legenda && (
        <p className="mb-3 text-[12px] leading-[1.5] text-t2">{legenda}</p>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {arquivos.map((a) => (
          <ItemGaleria key={a.id} a={a} />
        ))}
      </div>
    </section>
  );
}

function ItemGaleria({ a }: { a: PreviewArquivo }) {
  const tipo = classificar(a);
  const proxySrc = `/api/drive/preview/${a.id}`;

  // Áudio tem player inline — fica num card SEM `<a>` wrapper pra não
  // interferir com os controles de play/pause/seek do browser.
  if (tipo === 'audio') {
    return (
      <div
        title={a.name}
        className="flex flex-col overflow-hidden rounded-xl border border-[rgba(21,21,33,0.08)] bg-bgSoft"
      >
        <div className="flex min-h-[120px] items-center justify-center bg-mauve/15 text-mauve">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[32px] leading-none">🎙</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">
              áudio
            </span>
          </div>
        </div>
        <div className="space-y-1.5 p-2">
          <audio
            src={proxySrc}
            controls
            preload="metadata"
            className="h-9 w-full"
          />
          <div className="truncate text-[11px] text-ink" title={a.name}>
            {a.name}
          </div>
          <a
            href={a.webViewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-mauve transition hover:text-ink"
          >
            abrir no Drive ↗
          </a>
        </div>
      </div>
    );
  }

  return (
    <a
      href={a.webViewLink}
      target="_blank"
      rel="noopener noreferrer"
      title={a.name}
      className="group block overflow-hidden rounded-xl border border-[rgba(21,21,33,0.08)] bg-bgSoft transition hover:border-navy/40 hover:shadow-sm"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-bgSoft">
        {tipo === 'imagem' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={proxySrc}
            alt={a.name}
            className="h-full w-full object-cover transition group-hover:scale-105"
            loading="lazy"
          />
        ) : tipo === 'video' ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-ink/90 text-white">
            <span className="text-[32px] leading-none">▶</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] opacity-70">
              vídeo
            </span>
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-bgSoft text-t3">
            <span className="text-[24px] leading-none">📎</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">
              arquivo
            </span>
          </div>
        )}
      </div>
      <div className="p-2">
        <div className="truncate text-[11px] text-ink" title={a.name}>
          {a.name}
        </div>
        <div className="mt-0.5 text-[10px] text-t3">abrir no Drive ↗</div>
      </div>
    </a>
  );
}

function classificar(a: PreviewArquivo): 'imagem' | 'video' | 'audio' | 'outro' {
  const mime = (a.mimeType || '').toLowerCase();
  const nome = a.name.toLowerCase();
  if (mime.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(nome))
    return 'imagem';
  if (mime.startsWith('video/') || /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(nome))
    return 'video';
  if (mime.startsWith('audio/') || /\.(mp3|m4a|wav|ogg|aac|flac)$/i.test(nome))
    return 'audio';
  return 'outro';
}
