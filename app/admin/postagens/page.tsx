import { SemPiscar as Suspense } from '@/app/_ui/SemPiscar';
import { listPostsNoIntervalo } from '@/lib/notion';
import { PostagensView } from './PostagensView';

export const dynamic = 'force-dynamic';
// Sem a reserva do cache (logo depois de concluir) a leitura do Notion pode passar de 15s.
export const maxDuration = 60;

const MESES = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

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

async function Conteudo({ semana }: { semana?: string }) {
  const base = semana ? new Date(semana + 'T00:00:00') : new Date();
  const baseOk = Number.isNaN(base.getTime()) ? new Date() : base;
  const inicio = inicioDaSemana(baseOk);
  const fim = new Date(inicio);
  fim.setDate(inicio.getDate() + 6);

  const posts = await listPostsNoIntervalo(ymd(inicio), ymd(fim));

  const prev = new Date(inicio);
  prev.setDate(inicio.getDate() - 7);
  const next = new Date(inicio);
  next.setDate(inicio.getDate() + 7);

  const rotulo = `${inicio.getDate()} de ${MESES[inicio.getMonth()]} – ${fim.getDate()} de ${MESES[fim.getMonth()]}`;

  return (
    <PostagensView
      inicioISO={ymd(inicio)}
      posts={posts}
      rotuloSemana={rotulo}
      prevSemana={ymd(prev)}
      nextSemana={ymd(next)}
    />
  );
}

export default function PostagensPage({
  searchParams,
}: {
  searchParams: { semana?: string };
}) {
  return (
    <main className="mx-auto max-w-4xl lg:max-w-7xl px-6 py-10">
      <Suspense
        key={searchParams.semana ?? 'atual'}
        fallback={
          <div className="space-y-4">
            <div className="h-8 w-48 animate-pulse rounded bg-bgSoft" />
            <div className="h-[480px] animate-pulse rounded-2xl bg-bgSoft" />
          </div>
        }
      >
        <Conteudo semana={searchParams.semana} />
      </Suspense>
    </main>
  );
}
