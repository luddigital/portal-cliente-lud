import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import {
  getColaboradorByEmail,
  listAllProjetos,
  listPostsDoMes,
} from '@/lib/notion';
import { classificarProjeto } from '@/lib/projetoServico';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Página do serviço "Social Media Instagram" — projetos ativos +
 *  atalhos pras ferramentas do portal. Reflete a estrutura da página do
 *  Notion (Projetos / Postagens / Entregas / Recursos). */
export default async function ServicoSocialMediaPage() {
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

  const todos = await listAllProjetos();
  const projetos = todos.filter((p) => classificarProjeto(p.nome) === 'Instagram');

  // Postagens do mês atual — só pra contar quantas cada projeto tem no mês.
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;
  const postsDoMes =
    projetos.length > 0
      ? await listPostsDoMes(
          projetos.map((p) => p.id),
          ano,
          mes,
        )
      : [];
  const postsPorProjeto = new Map<string, number>();
  for (const p of postsDoMes) {
    postsPorProjeto.set(p.projetoId, (postsPorProjeto.get(p.projetoId) ?? 0) + 1);
  }

  const MESES = [
    'janeiro','fevereiro','março','abril','maio','junho',
    'julho','agosto','setembro','outubro','novembro','dezembro',
  ];

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-10 border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-4">
          <div>
            <Link href="/servicos" className="text-[11px] text-mauve transition hover:text-ink">
              ← Serviços
            </Link>
            <h1 className="mt-1 flex items-center gap-2 text-[20px] font-semibold tracking-[-0.02em] text-ink">
              <span aria-hidden>📱</span> Social Media Instagram
            </h1>
            <p className="text-[11px] text-t3">
              Estratégia, calendário, produção e análise pro Instagram dos clientes.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6 space-y-8">
        {/* Atalhos pras ferramentas */}
        <section>
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.1em] text-t3">
            Ferramentas do serviço
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <AtalhoCard
              href="/programacao"
              emoji="📅"
              titulo="Programação"
              desc="Calendário mensal, drag & drop e preview do feed."
            />
            <AtalhoCard
              href="/admin/analise"
              emoji="📊"
              titulo="Análise"
              desc="Métricas do Instagram: alcance, engajamento, melhores e piores posts."
            />
            <AtalhoCard
              href="/admin/entrega"
              emoji="🚚"
              titulo="Entregas"
              desc="Tarefas por dia — o que a equipe entrega hoje / na semana."
            />
            <AtalhoCard
              href="/gestao"
              emoji="🎯"
              titulo="Gestão"
              desc="Objetivos da semana, postagens de hoje, saúde geral."
            />
          </div>
        </section>

        {/* Projetos ativos de IG */}
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-t3">
              Projetos ativos ({projetos.length})
            </h2>
            <span className="text-[11px] text-t3">
              {postsDoMes.length} {postsDoMes.length === 1 ? 'post' : 'posts'} em {MESES[mes - 1]}
            </span>
          </div>
          {projetos.length === 0 ? (
            <div className="card p-6 text-center text-[13px] text-t3">
              Nenhum projeto de Instagram ativo no momento.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {projetos.map((p) => {
                const posts = postsPorProjeto.get(p.id) ?? 0;
                return (
                  <Link
                    key={p.id}
                    href={`/admin/projetos/${p.id}`}
                    className="card group flex flex-col justify-between p-4 transition hover:shadow-[0_4px_20px_rgba(21,21,33,0.06)]"
                  >
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
                        {p.clienteNome}
                      </div>
                      <div className="mt-0.5 truncate text-[14px] font-semibold text-ink">
                        {p.nome}
                      </div>
                    </div>
                    <div className="mt-3 flex items-baseline justify-between">
                      <span className="text-[11px] text-t2">
                        {posts === 0
                          ? 'sem posts este mês'
                          : `${posts} ${posts === 1 ? 'post' : 'posts'} este mês`}
                      </span>
                      <span className="text-[11px] font-semibold text-ink transition group-hover:translate-x-0.5">
                        abrir →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Recursos */}
        <section>
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.1em] text-t3">
            Recursos
          </h2>
          <div className="card divide-y divide-[rgba(21,21,33,0.06)] p-0">
            <RecursoLinha
              emoji="📝"
              titulo="Playbooks"
              desc="Método de copy da Lud., processo de aprovação, guias de tom de voz."
              href="https://app.notion.com/p/0f18cae2b8544437901b46e8d8da1176"
              externo
            />
            <RecursoLinha
              emoji="🚀"
              titulo="Start Processo SM"
              desc="Checklist de onboarding de um novo projeto de social media."
              href="https://app.notion.com/p/180d04d23b4a8083837effdabc5d1536"
              externo
            />
            <RecursoLinha
              emoji="💬"
              titulo="Mensagens Padrão"
              desc="Templates prontos pra atendimento e follow-up."
              href="https://app.notion.com/p/15bd04d23b4a81fe84edfc53d7141115"
              externo
            />
            <RecursoLinha
              emoji="📥"
              titulo="Inbox de Briefing"
              desc="Onde entram os briefings pra transformar em pauta."
              href="https://app.notion.com/p/1d0d04d23b4a80c5b6fef532893a0c99"
              externo
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function AtalhoCard({
  href,
  emoji,
  titulo,
  desc,
}: {
  href: string;
  emoji: string;
  titulo: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="card group flex items-start gap-3 p-4 transition hover:shadow-[0_4px_20px_rgba(21,21,33,0.06)]"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-bgSoft text-[18px]">
        {emoji}
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-ink">{titulo}</div>
        <p className="mt-0.5 text-[11px] leading-[1.5] text-t3">{desc}</p>
      </div>
    </Link>
  );
}

function RecursoLinha({
  emoji,
  titulo,
  desc,
  href,
  externo = false,
}: {
  emoji: string;
  titulo: string;
  desc: string;
  href: string;
  externo?: boolean;
}) {
  const Wrap: any = externo ? 'a' : Link;
  const props = externo
    ? { href, target: '_blank', rel: 'noreferrer' }
    : { href };
  return (
    <Wrap
      {...props}
      className="group flex items-center gap-3 p-4 transition hover:bg-bgSoft/60"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-bgSoft text-[16px]">
        {emoji}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-ink">
          {titulo}
          {externo && (
            <span className="ml-1.5 text-[10px] font-normal text-t3">↗ Notion</span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] leading-[1.5] text-t3">{desc}</p>
      </div>
      <span className="text-[11px] font-semibold text-mauve transition group-hover:text-ink">
        abrir
      </span>
    </Wrap>
  );
}
