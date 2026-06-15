import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { getSession } from '@/lib/auth';
import { getEntregaDetalhe, type TarefaDaEntrega } from '@/lib/notion';
import { env } from '@/lib/env';
import { EntregaTarefas } from './EntregaTarefas';

export const dynamic = 'force-dynamic';

function diasAte(iso: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const d = new Date(iso.split('T')[0] + 'T00:00:00');
  return Math.round((d.getTime() - hoje.getTime()) / 86400000);
}

function fmtDataBR(iso: string): string {
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

const DIAS_SEMANA = [
  'domingo',
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
];
const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/** Título legível pro grupo do dia. Ex: "Hoje · 27/jun (terça)" */
function tituloDoDia(iso: string, dias: number): string {
  const [y, m, d] = iso.split('T')[0].split('-');
  const data = new Date(Number(y), Number(m) - 1, Number(d));
  const dia = data.getDate();
  const mes = MESES[data.getMonth()];
  const diaSemana = DIAS_SEMANA[data.getDay()];
  const base = `${dia} de ${mes} (${diaSemana})`;
  if (dias === 0) return `Hoje · ${base}`;
  if (dias === 1) return `Amanhã · ${base}`;
  return base;
}

export default async function EntregaAdminPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    redirect('/');
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="mx-auto flex max-w-4xl lg:max-w-7xl items-center justify-between px-6 py-4">
          <Link
            href="/admin"
            className="flex items-center gap-2 text-[13px] text-mauve transition hover:text-ink"
          >
            ← Voltar
          </Link>
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
            entrega
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl lg:max-w-7xl px-6 py-10 space-y-8">
        <Suspense
          fallback={
            <div className="space-y-4">
              <div className="h-[100px] rounded-2xl bg-bgSoft animate-pulse" />
              <div className="h-[400px] rounded-2xl bg-bgSoft animate-pulse" />
            </div>
          }
        >
          <Conteudo id={params.id} />
        </Suspense>
      </main>
    </div>
  );
}

async function Conteudo({ id }: { id: string }) {
  const entrega = await getEntregaDetalhe(id);
  if (!entrega) notFound();

  // Agrupa tarefas pelo dia do prazo (YYYY-MM-DD). Sem prazo cai num grupo
  // separado no fim. Atrasadas viram um único bloco no topo "Atrasadas".
  type Grupo = { titulo: string; tarefas: TarefaDaEntrega[]; chaveOrdem: string };
  const grupos = new Map<string, Grupo>();
  const addAo = (chave: string, titulo: string, chaveOrdem: string, t: TarefaDaEntrega) => {
    if (!grupos.has(chave)) grupos.set(chave, { titulo, tarefas: [], chaveOrdem });
    grupos.get(chave)!.tarefas.push(t);
  };

  for (const t of entrega.tarefasRelacionadas) {
    if (!t.prazo) {
      addAo('sem-prazo', 'Sem prazo', '9999-12-31', t);
      continue;
    }
    const dia = t.prazo.split('T')[0];
    const dias = diasAte(dia);
    if (dias < 0) {
      // Atrasada — junta num bloco só, ordenada por data dentro
      addAo('atrasadas', 'Atrasadas', '0000-00-00', t);
    } else {
      addAo(dia, tituloDoDia(dia, dias), dia, t);
    }
  }
  const gruposOrdenados = [...grupos.values()].sort((a, b) =>
    a.chaveOrdem.localeCompare(b.chaveOrdem),
  );
  // Dentro de cada grupo, ordena por prazo (mais antiga primeiro)
  for (const g of gruposOrdenados) {
    g.tarefas.sort((a, b) => (a.prazo ?? '').localeCompare(b.prazo ?? ''));
  }

  // Data da tarefa pendente mais antiga (a que está esperando há mais tempo).
  const prazoMaisAntigo =
    entrega.tarefasRelacionadas
      .map((t) => t.prazo)
      .filter((p): p is string => !!p)
      .sort()[0] ?? null;

  return (
    <>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
          entrega
        </div>
        <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.03em] text-ink">
          {entrega.nome}
        </h1>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
          {entrega.frequencia && (
            <span className="rounded-full bg-bgSoft px-2 py-0.5 text-t2">
              {entrega.frequencia}
            </span>
          )}
          {entrega.proximaData && (
            <span className="rounded-full bg-bgSoft px-2 py-0.5 text-t2">
              Próxima: {entrega.proximaData.replace(/^⏳\s*/, '')}
            </span>
          )}
          {prazoMaisAntigo &&
            (diasAte(prazoMaisAntigo) < 0 ? (
              <span
                className="rounded-full px-2 py-0.5 font-semibold"
                style={{
                  background: 'var(--prazo-atrasado-soft)',
                  color: 'var(--prazo-atrasado)',
                }}
              >
                ⚠ Mais antiga pendente: {fmtDataBR(prazoMaisAntigo)}
              </span>
            ) : (
              <span className="rounded-full bg-bgSoft px-2 py-0.5 text-t2">
                Mais antiga pendente: {fmtDataBR(prazoMaisAntigo)}
              </span>
            ))}
        </div>
      </div>

      <div
        className="rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white p-5 flex items-center justify-between gap-4 flex-wrap"
      >
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
            Tarefas em aberto
          </div>
          <div className="mt-1 text-[13px] text-t2">
            Tarefas prontas (check ativado) ainda não concluídas, agrupadas pelo dia do prazo.
          </div>
        </div>
        <div
          className="rounded-xl px-5 py-3 text-center min-w-[100px]"
          style={{
            background: 'var(--prazo-hoje-soft)',
            color: 'var(--prazo-hoje)',
          }}
        >
          <div className="text-[28px] font-semibold leading-none tracking-[-0.03em]">
            {entrega.tarefasRelacionadas.length}
          </div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em]">
            em aberto
          </div>
        </div>
      </div>

      {gruposOrdenados.length === 0 ? (
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: 'var(--prazo-em-dia-soft)' }}
        >
          <div className="text-[24px]">✨</div>
          <div
            className="mt-2 text-[14px] font-semibold"
            style={{ color: 'var(--prazo-em-dia)' }}
          >
            Entrega zerada
          </div>
          <p className="mt-1 text-[12px] text-t2">
            Nenhuma tarefa em aberto vinculada a essa entrega.
          </p>
        </div>
      ) : (
        <EntregaTarefas grupos={gruposOrdenados} />
      )}
    </>
  );
}
