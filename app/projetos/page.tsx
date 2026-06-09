import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  clearProjetoAtivo,
  getSession,
} from '@/lib/auth';
import {
  findProjetosByEmail,
  getNomeDoCliente,
  getResumoTarefasCliente,
  type CategoriaTarefa,
} from '@/lib/notion';

export const dynamic = 'force-dynamic';

const ORDEM: CategoriaTarefa[] = ['pauta', 'previas', 'materiais', 'post'];
const ETAPA_ABREV: Record<CategoriaTarefa, string> = {
  pauta: 'Pauta',
  previas: 'Info',
  materiais: 'Material',
  post: 'Post',
  stories: 'Stories',
};

export default async function EscolheProjetoPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const projetos = await findProjetosByEmail(session.email);
  if (projetos.length === 0) redirect('/login?err=notfound');

  // Se só tem 1 projeto, não faz sentido escolher — limpa cookie e vai pra home
  if (projetos.length === 1) {
    clearProjetoAtivo();
    redirect('/');
  }

  const primeiroNome = (await getNomeDoCliente(session.email))?.split(/\s+/)[0] ?? null;

  return (
    <div className="min-h-screen bg-bgSoft/50">
      <header className="border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div>
            <div className="text-[20px] font-bold tracking-[-0.02em] text-ink">
              Lud<span className="font-light text-mauve">.</span>
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
              Portal do cliente
            </div>
          </div>
          <form action="/api/auth/logout" method="post">
            <button className="text-[12px] text-mauve transition hover:text-ink">
              Sair
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-8">
          <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-ink">
            {primeiroNome ? `Olá, ${primeiroNome} 👋` : 'Olá 👋'}
          </h1>
          <p className="mt-1 text-[14px] text-t2">
            Você tem {projetos.length} projetos com a gente. Escolhe qual quer
            acessar agora — dá pra trocar a qualquer momento pelo menu.
          </p>
        </div>

        <div className="space-y-3">
          {projetos.map((p) => (
            <ProjetoCard key={p.id} projetoId={p.id} nome={p.nome} />
          ))}
        </div>
      </main>
    </div>
  );
}

async function ProjetoCard({
  projetoId,
  nome,
}: {
  projetoId: string;
  nome: string;
}) {
  const resumo = await getResumoTarefasCliente([projetoId]);
  const total = ORDEM.reduce((s, c) => s + resumo[c], 0);

  return (
    <Link
      href={`/api/projetos/escolher?id=${projetoId}`}
      className="group flex items-center gap-5 rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white p-5 transition hover:border-navy/40 hover:shadow-[0_4px_20px_rgba(21,21,33,0.06)]"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-bgSoft text-[20px]">
        📁
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
          {nome}
        </div>
        <div className="mt-1 text-[12px] text-t2">
          {total === 0 ? (
            <span className="text-[var(--prazo-em-dia)]">
              ✓ tudo em dia
            </span>
          ) : (
            <>
              <b>
                {total} {total === 1 ? 'pendência' : 'pendências'}
              </b>{' '}
              {detalharPendencias(resumo)}
            </>
          )}
        </div>
      </div>

      <div className="shrink-0 text-t3 transition group-hover:text-navy">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </div>
    </Link>
  );
}

function detalharPendencias(
  resumo: Record<CategoriaTarefa, number>,
): string {
  const detalhes: string[] = [];
  for (const cat of ORDEM) {
    if (resumo[cat] > 0)
      detalhes.push(`${resumo[cat]} de ${ETAPA_ABREV[cat]}`);
  }
  return detalhes.length > 0 ? `· ${detalhes.join(' · ')}` : '';
}
