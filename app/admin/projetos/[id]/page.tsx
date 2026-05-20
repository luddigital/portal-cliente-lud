import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { getProjetoDetalhe, type ProjetoConfig } from '@/lib/notion';
import { EditarProjeto } from '../EditarProjeto';

export const dynamic = 'force-dynamic';

function SecTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-t3">
      <span className="h-3 w-0.5 rounded-full bg-navy" />
      {children}
    </div>
  );
}

function temAlgumaMeta(m: ProjetoConfig['metas'][keyof ProjetoConfig['metas']]) {
  return !!(m.inicio || m.atual || m.meta);
}

const METRICAS: {
  chave: keyof ProjetoConfig['metas'];
  label: string;
}[] = [
  { chave: 'seguidores', label: 'Seguidores' },
  { chave: 'engajamento', label: 'Engajamento' },
  { chave: 'alcance', label: 'Alcance' },
];

async function Conteudo({ id }: { id: string }) {
  const d = await getProjetoDetalhe(id);
  if (!d) notFound();

  const { config } = d;
  const temMetas = METRICAS.some((m) => temAlgumaMeta(config.metas[m.chave]));

  return (
    <div className="mx-auto -mt-16 max-w-7xl px-6">
      {/* cabeçalho */}
      <div className="rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white p-6">
        <Link
          href="/admin/projetos"
          className="text-[12px] text-t3 transition hover:text-ink"
        >
          ← Projetos
        </Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-ink">
              {d.nome}
            </h1>
            <div className="mt-2 flex flex-wrap gap-2">
              {d.status && (
                <span
                  className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em]"
                  style={{
                    background: 'var(--prazo-em-dia-soft)',
                    color: 'var(--prazo-em-dia)',
                  }}
                >
                  {d.status}
                </span>
              )}
              {d.clienteNome && (
                <span className="rounded-full bg-bgSoft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-t2">
                  {d.clienteNome}
                </span>
              )}
            </div>
          </div>
          <EditarProjeto
            projetoId={d.id}
            projetoNome={d.nome}
            configInicial={config}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          {/* objetivo */}
          <div className="card p-6">
            <SecTitle>Objetivo principal</SecTitle>
            {config.objetivo ? (
              <>
                <p className="mt-3 whitespace-pre-line text-[14px] leading-[1.55] text-ink">
                  {config.objetivo}
                </p>
                {config.foco.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {config.foco.map((f) => (
                      <span
                        key={f}
                        className="rounded-full bg-bgSoft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-t2"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="mt-3 text-[13px] text-t3">
                Sem objetivo cadastrado. Clique em "Editar projeto" pra
                preencher.
              </p>
            )}
          </div>

          {/* metas */}
          {temMetas && (
            <div className="card p-6">
              <SecTitle>Metas</SecTitle>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {METRICAS.filter((m) => temAlgumaMeta(config.metas[m.chave])).map(
                  (m) => {
                    const v = config.metas[m.chave];
                    return (
                      <div key={m.chave} className="rounded-xl bg-bgSoft p-4">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
                          {m.label}
                        </div>
                        <div className="mt-2 flex items-baseline gap-1.5">
                          {v.inicio && (
                            <span className="text-[12px] text-t3">
                              {v.inicio}
                            </span>
                          )}
                          <span className="text-[18px] font-semibold tracking-[-0.02em] text-ink">
                            {v.atual || '—'}
                          </span>
                          {v.meta && (
                            <span className="text-[12px] text-t3">
                              → {v.meta}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          )}

          {/* tarefas */}
          <div className="card p-6">
            <SecTitle>Tarefas pendentes</SecTitle>
            {d.tarefas.length === 0 ? (
              <p className="mt-3 text-[13px] text-t3">
                Nenhuma tarefa pendente.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-[rgba(21,21,33,0.06)]">
                {d.tarefas.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-2.5">
                    <span className="h-4 w-4 shrink-0 rounded-[5px] border-[1.5px] border-[rgba(21,21,33,0.25)]" />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                      {t.titulo}
                    </span>
                    {t.pessoa && (
                      <span className="flex shrink-0 items-center gap-1.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-navy text-[9px] font-bold text-white">
                          {t.pessoa[0]}
                        </span>
                        <span className="text-[11px] text-t2">{t.pessoa}</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* sidebar */}
        <aside className="space-y-4">
          <div className="card p-5">
            <SecTitle>Informações</SecTitle>
            <dl className="mt-3 divide-y divide-[rgba(21,21,33,0.06)]">
              <div className="flex items-center justify-between gap-3 py-2">
                <dt className="text-[12px] text-t3">Cliente</dt>
                <dd className="text-[12px] font-medium text-ink">
                  {d.clienteNome ?? '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2">
                <dt className="text-[12px] text-t3">Gestor</dt>
                <dd className="text-[12px] font-medium text-ink">
                  {d.gestor ?? '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2">
                <dt className="text-[12px] text-t3">Status</dt>
                <dd className="text-[12px] font-medium text-ink">
                  {d.status ?? '—'}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function ProjetoPage({ params }: { params: { id: string } }) {
  return (
    <div className="pb-14">
      <div
        className="h-44 w-full"
        style={{
          background:
            'linear-gradient(135deg, #BAC4E6 0%, #8485A3 55%, #313D65 100%)',
        }}
      />
      <Suspense
        fallback={
          <div className="mx-auto -mt-16 max-w-7xl px-6">
            <div className="h-[120px] rounded-2xl bg-white" />
            <div className="mt-6 h-[300px] rounded-2xl bg-bgSoft animate-pulse" />
          </div>
        }
      >
        <Conteudo id={params.id} />
      </Suspense>
    </div>
  );
}
