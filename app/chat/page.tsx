import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { listarGruposDoUsuario } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function ChatHome() {
  const session = await getSession();
  if (!session) redirect('/login');

  let grupos: Awaited<ReturnType<typeof listarGruposDoUsuario>> = [];
  let erro: string | null = null;
  try {
    grupos = await listarGruposDoUsuario(session.email);
  } catch (e: any) {
    erro = e?.message ?? 'Erro carregando conversas';
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div>
            <div className="text-[20px] font-bold tracking-[-0.02em] text-ink">
              Lud<span className="font-light text-mauve">.</span>
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
              Conversas
            </div>
          </div>
          <Link href="/" className="text-[12px] text-mauve hover:text-ink">
            ← Voltar
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="hub-section-title mb-1">Suas conversas</h1>
        <p className="hub-section-sub mb-6">
          Acompanhe e responda direto pelo Portal — a mensagem sai pelo WhatsApp da Lud.
        </p>

        {erro && (
          <div className="rounded-lg border border-hubRed/30 bg-hubRed/5 px-4 py-3 text-[13px] text-hubRed">
            {erro}
          </div>
        )}

        {!erro && grupos.length === 0 && (
          <div className="rounded-lg border border-[rgba(21,21,33,0.08)] bg-bgSoft px-6 py-10 text-center">
            <div className="text-[14px] font-medium text-ink">
              Nenhuma conversa liberada
            </div>
            <div className="mt-1 text-[12px] text-t3">
              Peça pra Lud. liberar acesso aos grupos que você precisa acompanhar.
            </div>
          </div>
        )}

        <ul className="space-y-2">
          {grupos.map((g) => (
            <li key={g.id}>
              <Link
                href={`/chat/${encodeURIComponent(g.id)}`}
                className="flex items-center gap-3 rounded-lg border border-[rgba(21,21,33,0.08)] bg-white px-4 py-3 transition hover:border-navy/30 hover:bg-bgSoft"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy text-[12px] font-bold text-white">
                  {g.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={g.foto_url}
                      alt={g.nome}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    iniciais(g.nome)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium text-ink">{g.nome}</div>
                  <div className="text-[11px] text-t3">Toque pra abrir a conversa</div>
                </div>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="shrink-0 text-t3"
                >
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}

function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
