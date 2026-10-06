import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { getSession } from '@/lib/auth';
import { getAprovacoesAgrupadas, type TarefaDaEntrega } from '@/lib/notion';
import { env } from '@/lib/env';
import { lerVisualizacoes, type Visualizacao } from '@/lib/supabase';
import { TarefaRow } from './TarefaRow';

export const dynamic = 'force-dynamic';

type AbaValida = 'cliente' | 'interno';

export default async function AprovacoesAdminPage({
  searchParams,
}: {
  searchParams: { aba?: string };
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    redirect('/');
  }

  const abaAtiva: AbaValida =
    searchParams.aba === 'interno' ? 'interno' : 'cliente';

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
            aprovações
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl lg:max-w-7xl px-6 py-10 space-y-8">
        <Suspense
          fallback={
            <div className="space-y-4">
              <div className="h-[90px] rounded-2xl bg-bgSoft animate-pulse" />
              <div className="h-[300px] rounded-2xl bg-bgSoft animate-pulse" />
            </div>
          }
        >
          <Conteudo abaAtiva={abaAtiva} />
        </Suspense>
      </main>
    </div>
  );
}

/** Heurística: tarefas de aprovação cujo título referencia conteúdo que o
 *  CLIENTE revisa (pauta/post/stories/materiais/prévios). Outras aprovações
 *  são INTERNAS da equipe (briefing, copy, arte). */
function ehAprovacaoDoCliente(titulo: string): boolean {
  const t = titulo.toLowerCase();
  const palavrasCliente = [
    'pauta',
    'post',
    'stories',
    'story',
    'material',
    'conte', // "conteúdo" / "conteudo"
    'prévi', // "prévia" / "prévio"
    'previo',
    'previa',
  ];
  return palavrasCliente.some((p) => t.includes(p));
}

async function Conteudo({ abaAtiva }: { abaAtiva: AbaValida }) {
  const grupos = await getAprovacoesAgrupadas();
  const total = grupos.reduce((s, g) => s + g.tarefas.length, 0);

  // Separa cliente vs interno dentro de cada grupo.
  type GrupoSeparado = {
    categoria: string;
    cliente: TarefaDaEntrega[];
    interno: TarefaDaEntrega[];
  };
  const grupos2: GrupoSeparado[] = grupos.map((g) => {
    const cliente: TarefaDaEntrega[] = [];
    const interno: TarefaDaEntrega[] = [];
    for (const t of g.tarefas) {
      if (ehAprovacaoDoCliente(t.titulo)) cliente.push(t);
      else interno.push(t);
    }
    return { categoria: g.categoria, cliente, interno };
  });
  const totalCliente = grupos2.reduce((s, g) => s + g.cliente.length, 0);
  const totalInterno = grupos2.reduce((s, g) => s + g.interno.length, 0);
  const visualizacoes = await lerVisualizacoes(
    grupos2.flatMap((g) => g.cliente.map((t) => t.postId).filter((id): id is string => !!id)),
  );

  return (
    <>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
          entregas
        </div>
        <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.03em] text-ink">
          Aprovações
        </h1>
        <p className="mt-2 text-[14px] text-t2">
          Separadas por quem precisa agir. Alterna entre as abas abaixo.
        </p>
      </div>

      {total === 0 ? (
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: 'var(--prazo-em-dia-soft)' }}
        >
          <div className="text-[24px]">✨</div>
          <div
            className="mt-2 text-[14px] font-semibold"
            style={{ color: 'var(--prazo-em-dia)' }}
          >
            Nada pra aprovar
          </div>
          <p className="mt-1 text-[12px] text-t2">
            Nenhuma tarefa de aprovação em aberto no momento.
          </p>
        </div>
      ) : (
        <>
          {/* ABAS */}
          <div className="flex border-b border-[rgba(21,21,33,0.08)]">
            <AbaBotao
              href="/admin/aprovacoes?aba=cliente"
              ativa={abaAtiva === 'cliente'}
              label="Esperando o cliente"
              total={totalCliente}
              toneCor={{
                bg: 'var(--prazo-hoje-soft)',
                fg: 'var(--prazo-hoje)',
              }}
            />
            <AbaBotao
              href="/admin/aprovacoes?aba=interno"
              ativa={abaAtiva === 'interno'}
              label="Esperando a equipe Lud."
              total={totalInterno}
              toneCor={{
                bg: 'var(--cal-aprovacao-soft)',
                fg: 'var(--cal-aprovacao)',
              }}
            />
          </div>

          {/* CONTEÚDO DA ABA */}
          {abaAtiva === 'cliente' ? (
            totalCliente === 0 ? (
              <div className="rounded-2xl bg-bgSoft/50 p-8 text-center text-[13px] text-t3">
                Nenhuma aprovação de cliente pendente ✨
              </div>
            ) : (
              <SecaoAprovacoes
                descricao="Tarefas que o cliente precisa revisar. Clica no botão pra mandar lembrete pelo WhatsApp."
                toneCor={{
                  bg: 'var(--prazo-hoje-soft)',
                  fg: 'var(--prazo-hoje)',
                }}
                grupos={grupos2
                  .map((g) => ({ categoria: g.categoria, tarefas: g.cliente }))
                  .filter((g) => g.tarefas.length > 0)}
                mostrarBotaoWpp
                visualizacoes={visualizacoes}
              />
            )
          ) : totalInterno === 0 ? (
            <div className="rounded-2xl bg-bgSoft/50 p-8 text-center text-[13px] text-t3">
              Nenhuma aprovação interna pendente ✨
            </div>
          ) : (
            <SecaoAprovacoes
              descricao="Aprovações internas (briefing, copy, arte etc)."
              toneCor={{
                bg: 'var(--cal-aprovacao-soft)',
                fg: 'var(--cal-aprovacao)',
              }}
              grupos={grupos2
                .map((g) => ({ categoria: g.categoria, tarefas: g.interno }))
                .filter((g) => g.tarefas.length > 0)}
            />
          )}
        </>
      )}
    </>
  );
}

function AbaBotao({
  href,
  ativa,
  label,
  total,
  toneCor,
}: {
  href: string;
  ativa: boolean;
  label: string;
  total: number;
  toneCor: { bg: string; fg: string };
}) {
  return (
    <Link
      href={href}
      className={`relative flex items-center gap-2 px-5 py-3 text-[13px] transition ${
        ativa
          ? 'text-ink font-semibold'
          : 'text-t3 hover:text-ink'
      }`}
    >
      <span>{label}</span>
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-bold"
        style={{
          background: ativa ? toneCor.bg : 'rgba(21,21,33,0.06)',
          color: ativa ? toneCor.fg : 'var(--t3)',
        }}
      >
        {total}
      </span>
      {ativa && (
        <span
          className="absolute inset-x-0 bottom-[-1px] h-[2px]"
          style={{ background: toneCor.fg }}
        />
      )}
    </Link>
  );
}

function SecaoAprovacoes({
  descricao,
  toneCor,
  grupos,
  mostrarBotaoWpp = false,
  visualizacoes,
}: {
  descricao: string;
  toneCor: { bg: string; fg: string };
  grupos: { categoria: string; tarefas: TarefaDaEntrega[] }[];
  mostrarBotaoWpp?: boolean;
  visualizacoes?: Record<string, Visualizacao>;
}) {
  return (
    <section className="space-y-4">
      <p className="text-[12px] text-t2">{descricao}</p>
      <div className="space-y-5">
        {grupos.map((g) => (
          <div key={g.categoria} className="space-y-2.5">
            <div className="flex items-center gap-2">
              <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-ink">
                {g.categoria}
              </h3>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: toneCor.bg, color: toneCor.fg }}
              >
                {g.tarefas.length}
              </span>
            </div>
            <div className="card divide-y divide-[rgba(21,21,33,0.06)] overflow-hidden p-0">
              {g.tarefas.map((t) => (
                <TarefaRow
                  key={t.tarefaId}
                  tarefa={t}
                  mostrarBotaoWpp={mostrarBotaoWpp}
                  visto={
                    visualizacoes
                      ? (t.postId && visualizacoes[t.postId]) || null
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

