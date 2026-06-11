import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import {
  getProjetoDetalhe,
  type ProjetoConfig,
  type ProjetoDetalhe,
} from '@/lib/notion';
import { EditarProjeto } from '../EditarProjeto';

/**
 * Classifica uma tarefa pelo título — ordem importa (mais específico primeiro).
 * O agrupamento ajuda o admin a ver "X Materiais para Produção pendentes" sem
 * vasculhar uma lista enorme de 200+ tarefas (caso projetos como Ste Travels).
 */
function tipoTarefa(titulo: string): string {
  const t = titulo.toLowerCase();
  if (/aprova/i.test(t)) {
    if (/pauta/i.test(t)) return 'Aprovação | Pauta';
    if (/briefing|copy/i.test(t)) return 'Aprovação | Briefing & Copy';
    if (/arte/i.test(t)) return 'Aprovação | Arte';
    if (/post/i.test(t)) return 'Aprovação | Post';
    if (/materiais/i.test(t)) return 'Aprovação | Materiais';
    if (/criação/i.test(t)) return 'Aprovação | Criação de Pauta';
    return 'Aprovação | Outros';
  }
  if (/materiais para produção/i.test(t)) return 'Materiais para Produção';
  if (/envio.*(prévi|conte[uú]do)/i.test(t)) return 'Envio de Conteúdos Prévios';
  if (/direcionamento.*stories/i.test(t)) return 'Direcionamento de Stories';
  if (/^post\b/i.test(t)) return 'Posts em produção';
  if (/^arte\b/i.test(t)) return 'Arte';
  if (/^briefing|copy/i.test(t)) return 'Briefing & Copy';
  if (/calendário/i.test(t)) return 'Calendário';
  if (/conferir postagem/i.test(t)) return 'Conferir Postagem';
  if (/programar/i.test(t)) return 'Programar';
  if (/marcar reuni/i.test(t)) return 'Reuniões';
  return 'Outras';
}

const ORDEM_TIPOS = [
  'Materiais para Produção',
  'Envio de Conteúdos Prévios',
  'Aprovação | Pauta',
  'Aprovação | Briefing & Copy',
  'Aprovação | Arte',
  'Aprovação | Materiais',
  'Aprovação | Post',
  'Aprovação | Criação de Pauta',
  'Aprovação | Outros',
  'Briefing & Copy',
  'Arte',
  'Posts em produção',
  'Direcionamento de Stories',
  'Conferir Postagem',
  'Programar',
  'Calendário',
  'Reuniões',
  'Outras',
];

function TarefasAgrupadas({ tarefas }: { tarefas: ProjetoDetalhe['tarefas'] }) {
  const grupos = new Map<string, ProjetoDetalhe['tarefas']>();
  for (const t of tarefas) {
    const tipo = tipoTarefa(t.titulo);
    if (!grupos.has(tipo)) grupos.set(tipo, []);
    grupos.get(tipo)!.push(t);
  }
  const ordenados = ORDEM_TIPOS.filter((tipo) => grupos.has(tipo)).concat(
    [...grupos.keys()].filter((k) => !ORDEM_TIPOS.includes(k)),
  );
  return (
    <div className="mt-3 space-y-4">
      {ordenados.map((tipo) => {
        const lista = grupos.get(tipo) ?? [];
        const ehDestaque =
          tipo === 'Materiais para Produção' ||
          tipo === 'Envio de Conteúdos Prévios';
        return (
          <div key={tipo}>
            <div className="flex items-center gap-2">
              <h3
                className={`text-[12px] font-semibold uppercase tracking-[0.08em] ${
                  ehDestaque ? 'text-ink' : 'text-t3'
                }`}
              >
                {tipo}
              </h3>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={
                  ehDestaque
                    ? {
                        background: 'var(--prazo-hoje-soft)',
                        color: 'var(--prazo-hoje)',
                      }
                    : { background: 'var(--bgSoft)', color: 'var(--t2)' }
                }
              >
                {lista.length}
              </span>
            </div>
            <ul className="mt-1.5 divide-y divide-[rgba(21,21,33,0.05)]">
              {lista.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2">
                  <span className="h-4 w-4 shrink-0 rounded-[5px] border-[1.5px] border-[rgba(21,21,33,0.2)]" />
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
          </div>
        );
      })}
    </div>
  );
}

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

          {/* tarefas — agrupadas por tipo */}
          <div className="card p-6">
            <SecTitle>Tarefas pendentes</SecTitle>
            {d.tarefas.length === 0 ? (
              <p className="mt-3 text-[13px] text-t3">
                Nenhuma tarefa pendente.
              </p>
            ) : (
              <TarefasAgrupadas tarefas={d.tarefas} />
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
