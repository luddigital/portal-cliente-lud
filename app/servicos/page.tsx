import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { getColaboradorByEmail } from '@/lib/notion';

export const dynamic = 'force-dynamic';

/** Serviços prestados pela Lud., no mesmo modelo da página do Notion. Cada
 *  card leva pra rota de detalhe do serviço quando existe — os que ainda
 *  não têm página no portal ficam marcados como "em breve". */
type ServicoCard = {
  slug: string | null;
  nome: string;
  emoji: string;
  descricao: string;
  cor: string;
};

const SERVICOS: ServicoCard[] = [
  {
    slug: 'social-media',
    nome: 'Social Media Instagram',
    emoji: '📱',
    descricao: 'Estratégia, calendário, produção e análise de conteúdo pro Instagram.',
    cor: 'var(--cal-agendado)',
  },
  {
    slug: null,
    nome: 'Social Media TikTok',
    emoji: '🎵',
    descricao: 'Formatos e distribuição pensados pra dinâmica do TikTok.',
    cor: 'var(--cal-aprovacao)',
  },
  {
    slug: null,
    nome: 'Social Media LinkedIn',
    emoji: '💼',
    descricao: 'Conteúdo profissional focado em autoridade e conversão B2B.',
    cor: 'var(--cal-rascunho)',
  },
  {
    slug: null,
    nome: 'Produção de Stories',
    emoji: '📸',
    descricao: 'Direcionamento e produção de stories no ritmo do cliente.',
    cor: 'var(--cal-alteracao)',
  },
  {
    slug: null,
    nome: 'Tráfego Pago',
    emoji: '📊',
    descricao: 'Gestão de campanhas Meta Ads / Google Ads focadas em resultado.',
    cor: 'var(--prazo-em-dia)',
  },
  {
    slug: null,
    nome: 'Identidade Visual',
    emoji: '🎨',
    descricao: 'Construção ou refinamento da identidade visual da marca.',
    cor: 'var(--prazo-chegando)',
  },
  {
    slug: null,
    nome: 'Site / Landing Page',
    emoji: '🌐',
    descricao: 'Desenvolvimento de sites e landing pages otimizados.',
    cor: 'var(--cal-agendado)',
  },
  {
    slug: null,
    nome: 'Infoprodutos',
    emoji: '📚',
    descricao: 'Estrutura, arte e distribuição de infoprodutos e ebooks.',
    cor: 'var(--cal-aprovacao)',
  },
  {
    slug: null,
    nome: 'Consultoria',
    emoji: '💡',
    descricao: 'Sessões pontuais pra destravar estratégia ou execução.',
    cor: 'var(--prazo-atrasado)',
  },
  {
    slug: null,
    nome: 'Mentoria',
    emoji: '🎓',
    descricao: 'Acompanhamento contínuo pra pessoas e times.',
    cor: 'var(--cal-rascunho)',
  },
  {
    slug: null,
    nome: 'Suporte',
    emoji: '🛠',
    descricao: 'Apoio técnico e operacional em processos pontuais.',
    cor: 'var(--prazo-tranquilo)',
  },
];

export default async function ServicosPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const ehAdmin = env.auth.adminEmails.includes(session.email.trim().toLowerCase());
  let ehColaborador = !!session.colaboradorId;
  if (!ehColaborador && !ehAdmin) {
    try {
      const colab = await getColaboradorByEmail(session.email);
      ehColaborador = !!colab;
    } catch {
      /* mantém false */
    }
  }
  if (!ehAdmin && !ehColaborador) redirect('/');

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-10 border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-4">
          <div>
            <Link href="/admin" className="text-[11px] text-mauve transition hover:text-ink">
              ← Admin
            </Link>
            <h1 className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-ink">
              Serviços
            </h1>
            <p className="text-[11px] text-t3">
              Todos os serviços que a Lud. presta pros clientes.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {SERVICOS.map((s) => {
            const CardBody = (
              <>
                <div
                  className="flex h-24 items-center justify-center text-[42px]"
                  style={{ background: `${s.cor}22`, color: s.cor }}
                >
                  {s.emoji}
                </div>
                <div className="p-4">
                  <div className="text-[14px] font-semibold text-ink">{s.nome}</div>
                  <p className="mt-1 text-[12px] leading-[1.5] text-t2">
                    {s.descricao}
                  </p>
                  {s.slug ? (
                    <span className="mt-3 inline-flex items-center text-[11px] font-semibold text-ink">
                      Ver detalhes →
                    </span>
                  ) : (
                    <span className="mt-3 inline-flex items-center rounded-full bg-bgSoft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-t3">
                      Em breve
                    </span>
                  )}
                </div>
              </>
            );
            if (s.slug) {
              return (
                <Link
                  key={s.nome}
                  href={`/servicos/${s.slug}`}
                  className="card group overflow-hidden p-0 transition hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(21,21,33,0.10)]"
                >
                  {CardBody}
                </Link>
              );
            }
            return (
              <div key={s.nome} className="card overflow-hidden p-0 opacity-70">
                {CardBody}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
