import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getSession } from '@/lib/auth';
import {
  listAllProjetos,
  getResumoTarefasCliente,
  listEntregas,
  getEntregasDoDia,
  listPostsNoIntervalo,
  ehEntregaDeAprovacao,
  CATEGORIA_LABEL,
  type ProjetoListItem,
  type CategoriaTarefa,
  type ResumoTarefasCliente,
  type EntregaItem,
  type PostCalendario,
} from '@/lib/notion';
import { env } from '@/lib/env';
import { AdminAvisarPanel } from './AdminAvisarPanel';
import { EntregaCard } from './EntregaCard';
import { CalendarSemana, type DiaSemana } from './_components/CalendarSemana';
import { AtualizacoesCompacto } from './_components/AtualizacoesCompacto';
import { ProjetosTabs, type ItemProjeto } from './_components/ProjetosTabs';

/**
 * Classifica o projeto por serviço pelo prefixo do nome.
 * Padrões da Lud:
 *   IG | @x          → Instagram
 *   TTK | x          → TikTok
 *   Stories | x      → Stories
 *   Tráfego Pago x   → Tráfego Pago
 *   Site x           → Site
 *   LP | x           → Landing Page
 *   E-book x         → E-book
 *   Mentoria x       → Mentoria
 *   Consultoria | x  → Consultoria
 *   Grupo / Grupos   → Grupos
 *   ID | x           → Identidade visual
 *   Processo Sel.    → Interno
 *   resto            → Outros
 */
function classificarProjeto(nome: string): string {
  const n = nome.trim();
  if (/^ig\s*\|/i.test(n)) return 'Instagram';
  if (/^ttk\s*\|/i.test(n)) return 'TikTok';
  if (/^stories\s*\|/i.test(n)) return 'Stories';
  if (/^tr[áa]fego\s+pago/i.test(n)) return 'Tráfego Pago';
  if (/^site\b/i.test(n)) return 'Site';
  if (/^lp\s*\|/i.test(n)) return 'Landing Page';
  if (/^e-?book/i.test(n)) return 'E-book';
  if (/^mentoria\b/i.test(n)) return 'Mentoria';
  if (/^consultoria/i.test(n)) return 'Consultoria';
  if (/^grupos?\b/i.test(n)) return 'Grupos';
  if (/^id\s*\|/i.test(n)) return 'Identidade visual';
  if (/^processo\s+seletivo/i.test(n) || /^reestrutura/i.test(n) || /^tudo no lugar/i.test(n) || /^portif[óo]lio/i.test(n)) {
    return 'Interno';
  }
  return 'Outros';
}

const DIAS_ABREV = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function inicioDaSemana(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (x.getDay() + 6) % 7; // dias desde a segunda
  x.setDate(x.getDate() - diff);
  return x;
}

const ORDEM_CATEGORIAS: CategoriaTarefa[] = [
  'pauta',
  'previas',
  'materiais',
  'post',
  'stories',
];

const ETAPA_ABREV: Record<CategoriaTarefa, string> = {
  pauta: 'Tema',
  previas: 'Info',
  materiais: 'Material',
  post: 'Post',
  stories: 'Stories',
};

export const dynamic = 'force-dynamic';

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { semana?: string };
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    redirect('/');
  }
  const semanaParam = searchParams.semana;
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="mx-auto flex max-w-4xl lg:max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <div className="text-[20px] font-bold tracking-[-0.02em] text-ink">
              Portal da Lud<span className="font-light text-mauve">.</span>
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
              admin
            </div>
          </div>
          <form action="/api/auth/logout" method="post">
            <button className="text-[12px] text-mauve transition hover:text-ink">
              Sair
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-4xl lg:max-w-7xl px-6 py-10 space-y-10">
        <Suspense
          fallback={
            <div className="h-[120px] rounded-2xl bg-bgSoft animate-pulse" />
          }
        >
          <BannerHoje />
        </Suspense>

        <section className="space-y-4">
          <div>
            <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-ink">
              Calendário da semana
            </h2>
            <p className="mt-1 text-[14px] text-t2">
              Todas as postagens da semana, de todos os clientes.
            </p>
          </div>
          <Suspense
            key={semanaParam ?? 'atual'}
            fallback={
              <div className="h-[220px] rounded-2xl bg-bgSoft animate-pulse" />
            }
          >
            <SemanaCalendario semanaParam={semanaParam} />
          </Suspense>
        </section>

        <section>
          <Suspense
            fallback={
              <div className="overflow-hidden rounded-xl border border-[rgba(21,21,33,0.06)] bg-white">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-[42px] bg-bgSoft/40 animate-pulse ${
                      i > 0 ? 'border-t border-[rgba(21,21,33,0.05)]' : ''
                    }`}
                  />
                ))}
              </div>
            }
          >
            <AtualizacoesCompacto />
          </Suspense>
        </section>

        <section className="space-y-4">
          <div>
            <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-ink">
              Entregas pendentes
            </h1>
            <p className="mt-1 text-[14px] text-t2">
              Status de cada tipo de entrega vindo direto do banco do Notion.
            </p>
          </div>
          <Suspense
            fallback={
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[58px] rounded-xl border border-[rgba(21,21,33,0.06)] bg-bgSoft animate-pulse"
                  />
                ))}
              </div>
            }
          >
            <EntregasGrid />
          </Suspense>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-ink">
              Projetos
            </h2>
            <p className="mt-1 text-[14px] text-t2">
              Clica num card pra ver o projeto, suas pendências e o cliente dono.
            </p>
          </div>
          <Suspense
            fallback={
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[100px] rounded-2xl border border-[rgba(21,21,33,0.08)] bg-bgSoft animate-pulse"
                  />
                ))}
              </div>
            }
          >
            <ListaProjetos />
          </Suspense>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-ink">
              Avisar clientes
            </h2>
            <p className="mt-1 text-[13px] text-t2">
              Dispara email + push pra cada cliente com tarefa pendente.
            </p>
          </div>
          <AdminAvisarPanel />
        </section>
      </main>
    </div>
  );
}

async function ListaProjetos() {
  const projetos = await listAllProjetos();
  if (projetos.length === 0) {
    return (
      <p className="text-[13px] text-t3">
        Nenhum projeto cadastrado.
      </p>
    );
  }
  const itens: ItemProjeto[] = projetos.map((p) => ({
    id: p.id,
    servico: classificarProjeto(p.nome),
    card: <ProjetoCard projeto={p} />,
  }));
  return <ProjetosTabs itens={itens} />;
}

function ProjetoCard({ projeto }: { projeto: ProjetoListItem }) {
  const detalheHref = `/admin/projetos/${projeto.id}`;
  return (
    <div className="group rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white p-4 transition hover:border-navy/40 hover:shadow-[0_4px_20px_rgba(21,21,33,0.06)]">
      <a href={detalheHref} className="block">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold tracking-[-0.01em] text-ink truncate">
              {projeto.nome}
            </div>
            <div className="mt-1 text-[11px] text-t3 truncate">
              {projeto.clienteNome || 'sem cliente'}
            </div>
          </div>
          {projeto.status && (
            <span className="shrink-0 rounded-full bg-bgSoft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-t2">
              {projeto.status}
            </span>
          )}
        </div>

        <Suspense fallback={<ResumoSkeleton />}>
          <ResumoEtapasProjeto projetoId={projeto.id} />
        </Suspense>
      </a>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[rgba(21,21,33,0.06)] pt-2.5">
        <a
          href={detalheHref}
          className="text-[11px] font-medium text-ink underline-offset-4 hover:underline"
        >
          Ver detalhes
        </a>
        <div className="flex items-center gap-3">
          {projeto.clienteId && (
            <a
              href={`/api/admin/login-as-cliente?id=${projeto.clienteId}`}
              className="text-[11px] font-medium text-navy hover:underline"
            >
              👁 Ver como cliente
            </a>
          )}
          {projeto.clienteId && (
            <a
              href={`/admin/clientes/${projeto.clienteId}`}
              className="text-[11px] text-mauve hover:text-ink"
            >
              Cliente →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

async function ResumoEtapasProjeto({ projetoId }: { projetoId: string }) {
  const resumo = await getResumoTarefasCliente([projetoId]);
  return <ResumoChips resumo={resumo} />;
}

function ResumoChips({ resumo }: { resumo: ResumoTarefasCliente }) {
  const total = ORDEM_CATEGORIAS.reduce((s, c) => s + resumo[c], 0);
  if (total === 0) {
    return (
      <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--prazo-em-dia-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--prazo-em-dia)]">
        ✓ tudo em dia
      </div>
    );
  }
  return (
    <div className="mt-3 grid grid-cols-5 gap-1">
      {ORDEM_CATEGORIAS.map((cat) => {
        const n = resumo[cat];
        const active = n > 0;
        return (
          <div
            key={cat}
            className={`rounded-md px-1 py-1 text-center ${
              active ? 'bg-[var(--prazo-hoje-soft)]' : 'bg-bgSoft'
            }`}
            title={CATEGORIA_LABEL[cat].label}
          >
            <div
              className={`text-[14px] font-semibold leading-none tracking-[-0.02em] ${
                active ? 'text-[var(--prazo-hoje)]' : 'text-t3'
              }`}
            >
              {n}
            </div>
            <div
              className={`mt-0.5 text-[8.5px] font-semibold uppercase tracking-[0.04em] ${
                active ? 'text-[var(--prazo-hoje)]' : 'text-t3'
              }`}
            >
              {ETAPA_ABREV[cat]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ResumoSkeleton() {
  return (
    <div className="mt-3 grid grid-cols-5 gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-9 rounded-md bg-bgSoft animate-pulse" />
      ))}
    </div>
  );
}

const DIAS_SEMANA = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

async function SemanaCalendario({ semanaParam }: { semanaParam?: string }) {
  const base = semanaParam ? new Date(semanaParam + 'T00:00:00') : new Date();
  const baseValida = Number.isNaN(base.getTime()) ? new Date() : base;
  const inicio = inicioDaSemana(baseValida);
  const fim = new Date(inicio);
  fim.setDate(inicio.getDate() + 6);

  const posts = await listPostsNoIntervalo(ymd(inicio), ymd(fim));

  const hojeISO = ymd(new Date());
  const porDia = new Map<string, PostCalendario[]>();
  for (const p of posts) {
    const iso = p.data.slice(0, 10);
    if (!porDia.has(iso)) porDia.set(iso, []);
    porDia.get(iso)!.push(p);
  }

  const dias: DiaSemana[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    const iso = ymd(d);
    dias.push({
      iso,
      nomeDia: DIAS_ABREV[d.getDay()],
      num: d.getDate(),
      hoje: iso === hojeISO,
      posts: porDia.get(iso) ?? [],
    });
  }

  const prev = new Date(inicio);
  prev.setDate(inicio.getDate() - 7);
  const next = new Date(inicio);
  next.setDate(inicio.getDate() + 7);
  const rotulo = `${inicio.getDate()} de ${MESES[inicio.getMonth()]} – ${fim.getDate()} de ${MESES[fim.getMonth()]}`;

  return (
    <CalendarSemana
      dias={dias}
      rotulo={rotulo}
      prevHref={`/admin?semana=${ymd(prev)}`}
      nextHref={`/admin?semana=${ymd(next)}`}
      hojeHref="/admin"
    />
  );
}

async function BannerHoje() {
  const hoje = new Date();
  const entregas = await getEntregasDoDia(hoje);
  const diaNome = DIAS_SEMANA[hoje.getDay()];
  const dataLabel = `${hoje.getDate()} de ${MESES[hoje.getMonth()]}`;
  const totalTarefas = entregas.reduce((s, e) => s + (e.atrasadas || 0), 0);

  if (entregas.length === 0) {
    return (
      <div
        className="rounded-2xl px-6 py-5"
        style={{
          background: 'linear-gradient(135deg, #EBEFE9 0%, #F8F1D9 100%)',
        }}
      >
        <div
          className="text-[11px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: 'var(--prazo-em-dia)' }}
        >
          📅 hoje · {dataLabel}
        </div>
        <div className="mt-2 text-[20px] font-semibold tracking-[-0.02em] text-ink">
          {diaNome} sem entregas marcadas
        </div>
        <div className="mt-1 text-[13px] text-t2">
          Nenhuma entrega tem prazo pra hoje. ✨
        </div>
      </div>
    );
  }

  const nomes = entregas.map((e) => e.nome).join(' · ');
  const banner = (
    <div
      className="rounded-2xl px-6 py-5 flex items-center justify-between gap-6 flex-wrap transition group-hover:shadow-[0_4px_20px_rgba(187,107,58,0.15)]"
      style={{
        background: 'linear-gradient(135deg, #F4E8DD 0%, #F8F1D9 100%)',
      }}
    >
      <div className="min-w-0 flex-1">
        <div
          className="text-[11px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: 'var(--cal-aguardando)' }}
        >
          📅 hoje · {dataLabel}
        </div>
        <div className="mt-2 text-[20px] font-semibold tracking-[-0.02em] text-ink">
          {diaNome} é dia de{' '}
          <span style={{ color: 'var(--cal-aguardando)' }}>
            {entregas.length === 1 ? entregas[0].nome : `${entregas.length} entregas`}
          </span>
        </div>
        <div className="mt-1 line-clamp-2 text-[13px] text-t2">
          {entregas.length > 1
            ? nomes
            : `${totalTarefas} ${totalTarefas === 1 ? 'tarefa pendente' : 'tarefas pendentes'} pra essa entrega.`}
        </div>
      </div>
      <div
        className="rounded-xl bg-white px-5 py-3 text-center min-w-[110px]"
        style={{ border: '1px solid rgba(21,21,33,0.08)' }}
      >
        <div
          className="text-[32px] font-semibold leading-none tracking-[-0.03em]"
          style={{ color: 'var(--cal-aguardando)' }}
        >
          {totalTarefas}
        </div>
        <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
          {totalTarefas === 1 ? 'tarefa pendente' : 'tarefas pendentes'}
        </div>
      </div>
    </div>
  );

  // 1 entrega → linka direto pra ela. Várias → mantém estático (cards abaixo já são clicáveis)
  if (entregas.length === 1) {
    return (
      <a href={`/admin/entrega/${entregas[0].id}`} className="group block">
        {banner}
      </a>
    );
  }
  return banner;
}

async function EntregasGrid() {
  const entregas = await listEntregas();
  if (entregas.length === 0) {
    return <p className="text-[13px] text-t3">Nenhuma entrega no banco.</p>;
  }

  // Junta todas as entregas de "Aprovação" num card único "Aprovações".
  const aprovacoes = entregas.filter((e) => ehEntregaDeAprovacao(e.nome));
  const outras = entregas.filter((e) => !ehEntregaDeAprovacao(e.nome));

  let lista = outras;
  if (aprovacoes.length > 0) {
    const totalTarefas = aprovacoes.reduce((s, e) => s + e.totalTarefas, 0);
    const atrasadas = aprovacoes.reduce((s, e) => s + e.atrasadas, 0);
    const cardAprovacoes: EntregaItem = {
      id: 'aprovacoes',
      nome: 'Aprovações',
      statusTexto: null,
      proximaEntregaTexto: `${totalTarefas} em aberto`,
      proximaData: null,
      frequencia: `${aprovacoes.length} tipos`,
      totalTarefas,
      atrasadas,
    };
    lista = [cardAprovacoes, ...outras];
  }

  const comAtraso = lista.filter((e) => e.atrasadas > 0);
  return (
    <div className="space-y-3">
      {comAtraso.length > 0 && (
        <div
          className="rounded-lg px-3 py-2 text-[12px] font-semibold"
          style={{
            background: 'var(--prazo-atrasado-soft)',
            color: 'var(--prazo-atrasado)',
          }}
        >
          🚨 {comAtraso.length} entrega{comAtraso.length === 1 ? '' : 's'} com tarefas em atraso
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {lista.map((e) => (
          <EntregaCard
            key={e.id}
            entrega={e}
            href={e.id === 'aprovacoes' ? '/admin/aprovacoes' : undefined}
          />
        ))}
      </div>
    </div>
  );
}
