import Link from 'next/link';

export function PlaceholderEmBreve({
  titulo,
  descricao,
  proximoPasso,
}: {
  titulo: string;
  descricao: string;
  proximoPasso?: string;
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-t3">
          em breve
        </div>
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-ink">
          {titulo}
        </h1>
        <p className="text-[14px] text-t2 leading-relaxed">{descricao}</p>
        {proximoPasso && (
          <div className="rounded-xl bg-bgSoft/60 p-4 text-[12px] text-t2 leading-relaxed">
            <b className="text-ink">Próximo passo:</b> {proximoPasso}
          </div>
        )}
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-[13px] text-mauve hover:text-ink transition"
        >
          ← Voltar pra Home
        </Link>
      </div>
    </div>
  );
}
