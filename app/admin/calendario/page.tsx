import { redirect } from 'next/navigation';
import { SemPiscar as Suspense } from '@/app/_ui/SemPiscar';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import {
  getColaboradorByEmail,
  listAllProjetos,
  listPostsNoIntervalo,
} from '@/lib/notion';
import { classificarProjeto } from '@/lib/projetoServico';
import { inicioDaSemana, ymd } from '@/lib/semana';
import { CalendarioAdminView } from './CalendarioAdminView';
import { MacroCalendarios, type LinhaMacro } from './MacroCalendarios';
import { ehStoriesDirecionamento, montarCelula } from '@/lib/macroCalendarios';
import { getFotoDoInstagramDoProjeto } from '@/lib/instagram';
import { hojeEmSaoPaulo } from '@/lib/lembrete-aprovacao';
import { nomeCurtoDoProjeto } from '@/lib/rotas';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SERVICOS_SOCIAL = new Set(['Instagram', 'TikTok', 'Stories']);

export default async function CalendarioAdminPage({
  searchParams,
}: {
  searchParams: { projetoId?: string; semana?: string; vista?: string };
}) {
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

  // Padrão: visão macro (este mês e os dois próximos). A semana antiga fica em ?vista=semana.
  if (searchParams.vista !== 'semana' && !searchParams.semana && !searchParams.projetoId) return <Macro />;

  // Base da semana: ?semana=YYYY-MM-DD (qualquer dia da semana desejada) ou hoje.
  const base = searchParams.semana ? new Date(searchParams.semana + 'T00:00:00') : new Date();
  const baseValida = Number.isNaN(base.getTime()) ? new Date() : base;
  const inicio = inicioDaSemana(baseValida);
  const fim = new Date(inicio);
  fim.setDate(inicio.getDate() + 6);

  // Projetos só pra popular o dropdown. Se demorar, roda em paralelo com posts.
  const [projetos, postsRaw] = await Promise.all([
    listAllProjetos().then((all) =>
      all.filter((p) => SERVICOS_SOCIAL.has(classificarProjeto(p.nome))),
    ),
    listPostsNoIntervalo(ymd(inicio), ymd(fim)),
  ]);

  const paramProjeto = searchParams.projetoId?.trim();
  const projetoIdSelecionado =
    !paramProjeto || paramProjeto === 'todos'
      ? 'todos'
      : projetos.find((p) => p.id === paramProjeto)?.id || 'todos';

  return (
    <Suspense>
      <div className="mx-auto max-w-7xl px-6 pt-6">
        <Link href="/admin/calendario" className="text-[12.5px] font-bold text-[#636369] hover:text-[#111113]">
          ← Visão geral dos calendários
        </Link>
      </div>
      <CalendarioAdminView
        projetos={projetos}
        projetoIdSelecionado={projetoIdSelecionado}
        inicioIso={ymd(inicio)}
        fimIso={ymd(fim)}
        posts={postsRaw}
      />
    </Suspense>
  );
}

const semTraco = (s: string) => s.replace(/-/g, '');

async function Macro() {
  const hoje = hojeEmSaoPaulo();
  const [a, m] = hoje.split('-').map(Number);
  const meses = [0, 1, 2].map((k) => {
    const d = new Date(Date.UTC(a, m - 1 + k, 1));
    return d.toISOString().slice(0, 7);
  });
  const fimUltimo = new Date(Date.UTC(a, m + 2, 0)).toISOString().slice(0, 10);
  const [projetos, posts] = await Promise.all([
    listAllProjetos()
      .then((all) => all.filter((p) => ['Instagram', 'TikTok'].includes(classificarProjeto(p.nome))))
      .catch(() => []),
    listPostsNoIntervalo(`${meses[0]}-01`, fimUltimo).catch(() => []),
  ]);
  const doFeed = posts.filter((p) => !ehStoriesDirecionamento(p));
  const fotos = new Map(
    await Promise.all(projetos.map(async (p) => [p.id, await getFotoDoInstagramDoProjeto(p.id, p.nome).catch(() => null)] as const)),
  );
  const linhas: LinhaMacro[] = projetos
    .map((p) => {
      const dele = doFeed.filter((x) => semTraco(x.projetoId) === semTraco(p.id));
      return {
        projetoId: p.id,
        handle: nomeCurtoDoProjeto(p.nome),
        foto: fotos.get(p.id) ?? null,
        celulas: Object.fromEntries(meses.map((mm) => [mm, montarCelula(dele.filter((x) => x.data.startsWith(mm)), mm, hoje)])),
        ativo: dele.length > 0 || !/conclu|cancel|pausa|encerr|inativ/i.test(p.status ?? ''),
      };
    })
    .filter((l) => l.ativo)
    // Quem está mais atrasado primeiro.
    .sort(
      (x, y) =>
        meses.reduce((s, mm) => s + y.celulas[mm].atrasados, 0) - meses.reduce((s, mm) => s + x.celulas[mm].atrasados, 0) ||
        x.handle.localeCompare(y.handle),
    );

  return (
    <main className="mx-auto max-w-7xl space-y-5 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-[30px] font-bold tracking-[-0.03em] text-ink">Calendários</h1>
          <p className="text-[13px] text-[#636369]">Como estão os calendários deste mês e dos próximos dois: em que fase os posts estão e onde agir.</p>
        </div>
        <Link href="/admin/calendario?vista=semana" className="rounded-full border border-[#D6D6D9] bg-white px-3.5 py-1.5 text-[12.5px] font-bold hover:bg-[#F4F4F5]">
          🗓 Ver posts da semana
        </Link>
      </div>
      <MacroCalendarios meses={meses} linhas={linhas} hoje={hoje} />
    </main>
  );
}
