import { Suspense } from 'react';
import { listMateriaisDoBanco, type MaterialBanco } from '@/lib/drive';

export const dynamic = 'force-dynamic';

function ehImagem(mime: string, nome: string): boolean {
  if (mime.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(nome);
}

function ehVideo(mime: string, nome: string): boolean {
  if (mime.startsWith('video/')) return true;
  return /\.(mp4|mov|webm|m4v)$/i.test(nome);
}

function Tile({
  arquivo,
}: {
  arquivo: MaterialBanco['arquivos'][number];
}) {
  const imagem = ehImagem(arquivo.mimeType, arquivo.name);
  const video = ehVideo(arquivo.mimeType, arquivo.name);
  return (
    <a
      href={arquivo.webViewLink}
      target="_blank"
      rel="noopener noreferrer"
      className="group block overflow-hidden rounded-xl border border-[rgba(21,21,33,0.08)] bg-white transition hover:border-navy/30 hover:shadow-sm"
    >
      <div className="flex aspect-square items-center justify-center bg-bgSoft">
        {imagem ? (
          <img
            src={`/api/drive/preview/${arquivo.id}`}
            alt={arquivo.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-[28px]">{video ? '🎬' : '📄'}</span>
        )}
      </div>
      <div className="truncate px-2 py-1.5 text-[11px] text-t2 group-hover:text-ink">
        {arquivo.name}
      </div>
    </a>
  );
}

async function Conteudo() {
  const banco = await listMateriaisDoBanco();
  const total = banco.reduce((s, b) => s + b.arquivos.length, 0);

  if (banco.length === 0) {
    return (
      <div
        className="rounded-2xl p-10 text-center"
        style={{ background: 'var(--prazo-em-dia-soft)' }}
      >
        <div className="text-[24px]">📂</div>
        <div
          className="mt-2 text-[14px] font-semibold"
          style={{ color: 'var(--prazo-em-dia)' }}
        >
          Nada por aqui ainda
        </div>
        <p className="mt-1 text-[12px] text-t2">
          Quando os clientes enviarem materiais pela central, eles aparecem aqui.
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="text-[13px] text-t2">
        {total} arquivo{total === 1 ? '' : 's'} de {banco.length} cliente
        {banco.length === 1 ? '' : 's'}.
      </p>
      <div className="mt-4 space-y-6">
        {banco.map((b) => (
          <section key={b.cliente}>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
                {b.cliente}
              </h2>
              <span className="rounded-full bg-bgSoft px-2 py-0.5 text-[10px] font-bold text-t2">
                {b.arquivos.length}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {b.arquivos.map((a) => (
                <Tile key={a.id} arquivo={a} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

export default function BancoDeMateriaisPage() {
  return (
    <main className="mx-auto max-w-4xl lg:max-w-7xl px-6 py-10">
      <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-ink">
        Banco de materiais
      </h1>
      <p className="mt-1 text-[14px] text-t2">
        Tudo que os clientes enviaram pela central, organizado por cliente.
      </p>
      <div className="mt-6">
        <Suspense
          fallback={
            <div className="h-[300px] animate-pulse rounded-2xl bg-bgSoft" />
          }
        >
          <Conteudo />
        </Suspense>
      </div>
    </main>
  );
}
