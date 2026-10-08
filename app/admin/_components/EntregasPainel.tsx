import Link from 'next/link';
import { listEntregas, type EntregaItem } from '@/lib/notion';
import { hojeEmSaoPaulo } from '@/lib/lembrete-aprovacao';
import { ChipData } from '@/app/_components/ChipData';

/** "⏳ 13/05/2026" → "2026-05-13". */
function dataDaEntrega(e: EntregaItem): string | null {
  const m = (e.proximaData ?? '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function somarDias(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function ddmm(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

type Resumo = {
  entregas: EntregaItem[];
  hoje: string;
  totalAtrasadas: number;
  comAtraso: number;
  vencemHoje: number;
  agora: { e: EntregaItem; quando: 'hoje' | 'amanha' }[];
};

async function montarResumo(): Promise<Resumo> {
  const entregas = await listEntregas();
  const hoje = hojeEmSaoPaulo();
  const amanha = somarDias(hoje, 1);
  const agora = entregas
    .map((e) => {
      const d = dataDaEntrega(e);
      const quando = d === hoje ? ('hoje' as const) : d === amanha ? ('amanha' as const) : null;
      return quando ? { e, quando } : null;
    })
    .filter((x): x is { e: EntregaItem; quando: 'hoje' | 'amanha' } => !!x)
    .sort((a, b) =>
      a.quando !== b.quando ? (a.quando === 'hoje' ? -1 : 1) : b.e.atrasadas - a.e.atrasadas,
    );
  return {
    entregas,
    hoje,
    totalAtrasadas: entregas.reduce((s, e) => s + e.atrasadas, 0),
    comAtraso: entregas.filter((e) => e.atrasadas > 0).length,
    vencemHoje: agora.filter((a) => a.quando === 'hoje').length,
    agora,
  };
}

function Numero({ valor, rotulo, cor }: { valor: string; rotulo: string; cor?: string }) {
  return (
    <div className="min-w-[128px] rounded-2xl bg-white px-5 py-3.5">
      <div className="text-[26px] font-bold leading-none tracking-[-0.02em]" style={{ color: cor ?? 'var(--ink)' }}>
        {valor}
      </div>
      <div className="mt-1.5 text-[12.5px] text-t2">{rotulo}</div>
    </div>
  );
}

function CardAgora({ e, quando }: { e: EntregaItem; quando: 'hoje' | 'amanha' }) {
  const escuro = quando === 'hoje';
  const rotulo = [quando === 'hoje' ? 'Hoje' : 'Amanhã', e.frequencia].filter(Boolean).join(' · ');
  return (
    <Link
      href={`/admin/entrega/${e.id}`}
      className={`group flex min-h-[148px] flex-col justify-between rounded-[22px] px-6 py-5 transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(21,21,33,0.12)] ${
        escuro ? 'bg-ink text-white' : 'bg-white text-ink'
      }`}
    >
      <div>
        <div
          className="text-[11px] font-bold uppercase tracking-[0.14em]"
          style={{ color: escuro ? '#F2A877' : 'var(--cal-programar)' }}
        >
          {rotulo}
        </div>
        <div className="mt-2 text-[19px] font-semibold leading-tight tracking-[-0.01em]">{e.nome}</div>
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        {e.atrasadas > 0 ? (
          <>
            <span
              className="text-[40px] font-bold leading-none tracking-[-0.03em]"
              style={{ color: escuro ? '#fff' : 'var(--prazo-atrasado)' }}
            >
              {e.atrasadas}
            </span>
            <span className={`text-[13px] ${escuro ? 'text-white/75' : 'text-t2'}`}>
              {e.atrasadas === 1 ? 'atrasada' : 'atrasadas'}
            </span>
          </>
        ) : (
          <span className={`text-[14px] font-semibold ${escuro ? 'text-white/85' : 'text-[var(--prazo-em-dia)]'}`}>
            ✓ nada atrasado
          </span>
        )}
      </div>
    </Link>
  );
}

/**
 * Cabeçalho das entregas: totais + "Pra fazer agora" (entregas de hoje e de
 * amanhã). Usado na home e no topo da página de Entregas.
 */
export async function EntregasResumo({ titulo = 'Entregas pendentes', linkTodas = false }: { titulo?: string; linkTodas?: boolean }) {
  const r = await montarResumo();
  if (r.entregas.length === 0) {
    return <p className="text-[13px] text-t3">Nenhuma entrega no banco.</p>;
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-bold tracking-[-0.03em] text-ink">{titulo}</h1>
          <p className="mt-1 text-[14px] text-t2">Direto do banco do Notion · atualizado hoje, {ddmm(r.hoje)}</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Numero valor={String(r.totalAtrasadas)} rotulo="tarefas atrasadas" cor="var(--prazo-atrasado)" />
          <Numero valor={`${r.comAtraso} de ${r.entregas.length}`} rotulo="entregas com atraso" />
          <Numero valor={String(r.vencemHoje)} rotulo="vencem hoje" cor="var(--prazo-hoje)" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-ink">Pra fazer agora</h2>
          {linkTodas && (
            <Link href="/admin/entregas" className="text-[13px] font-semibold text-t2 transition hover:text-ink">
              Ver todas as entregas →
            </Link>
          )}
        </div>
        {r.agora.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {r.agora.map(({ e, quando }) => (
              <CardAgora key={e.id} e={e} quando={quando} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-white px-5 py-4 text-[13px] text-t2">
            Nenhuma entrega vence hoje ou amanhã. ✨
          </p>
        )}
      </div>
    </div>
  );
}

function LinhaEntrega({ e, hoje }: { e: EntregaItem; hoje: string }) {
  const data = dataDaEntrega(e);
  return (
    <li>
      <Link
        href={`/admin/entrega/${e.id}`}
        className="group flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 transition hover:bg-bgSoft/70"
      >
        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">{e.nome}</span>
        <span className="w-[84px] shrink-0 text-[12px] text-t3">{e.frequencia ?? '—'}</span>
        <span className="w-[86px] shrink-0">
          {data ? <ChipData prazo={data} hoje={hoje} /> : <span className="text-[12px] text-t3">sem data</span>}
        </span>
        <span className="w-[96px] shrink-0 text-right text-[12.5px]">
          {e.atrasadas > 0 ? (
            <span className="font-semibold text-[var(--prazo-atrasado)]">
              {e.atrasadas} {e.atrasadas === 1 ? 'atrasada' : 'atrasadas'}
            </span>
          ) : (
            <span className="text-[var(--prazo-em-dia)]">em dia</span>
          )}
        </span>
        <span className="w-[72px] shrink-0 text-right font-mono text-[11.5px] text-t3">
          {e.totalTarefas} {e.totalTarefas === 1 ? 'tarefa' : 'tarefas'}
        </span>
        <span className="shrink-0 text-[14px] text-t3 transition group-hover:text-ink">›</span>
      </Link>
    </li>
  );
}

function Grupo({ titulo, itens, hoje }: { titulo: string; itens: EntregaItem[]; hoje: string }) {
  if (itens.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-ink">
        {titulo}
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-t2">{itens.length}</span>
      </h2>
      <ul className="divide-y divide-[rgba(21,21,33,0.06)] overflow-hidden rounded-2xl bg-white">
        {itens.map((e) => (
          <LinhaEntrega key={e.id} e={e} hoje={hoje} />
        ))}
      </ul>
    </section>
  );
}

/** Todas as entregas do Notion: com atraso primeiro, depois pela próxima data. */
export async function EntregasLista() {
  const r = await montarResumo();
  const porData = (a: EntregaItem, b: EntregaItem) =>
    (dataDaEntrega(a) ?? '9999').localeCompare(dataDaEntrega(b) ?? '9999') || a.nome.localeCompare(b.nome, 'pt-BR');
  const comAtraso = r.entregas.filter((e) => e.atrasadas > 0).sort((a, b) => b.atrasadas - a.atrasadas);
  const emDia = r.entregas.filter((e) => e.atrasadas === 0).sort(porData);
  return (
    <div className="space-y-6">
      <Grupo titulo="Com atraso" itens={comAtraso} hoje={r.hoje} />
      <Grupo titulo="Em dia" itens={emDia} hoje={r.hoje} />
    </div>
  );
}
