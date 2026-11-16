import { notFound } from 'next/navigation';
import Link from 'next/link';
import { SemPiscar as Suspense } from '@/app/_ui/SemPiscar';
import {
  getEmpresaDetalhe,
  listAcessosDoCliente,
  projetosOcultosDoCliente,
  type EmpresaDetalhe,
} from '@/lib/notion';
import { BotaoCopiarLink } from '../../BotaoCopiarLink';
import { AcessosManager } from './AcessosManager';
import { VisibilidadeProjeto } from './VisibilidadeProjeto';

export const dynamic = 'force-dynamic';

const PENDENCIA_LABEL: { chave: keyof EmpresaDetalhe['pendencias']; label: string }[] = [
  { chave: 'pauta', label: 'Tema' },
  { chave: 'previas', label: 'Prévias' },
  { chave: 'materiais', label: 'Materiais' },
  { chave: 'post', label: 'Post' },
];

function SecTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-t3">
      <span className="h-3 w-0.5 rounded-full bg-navy" />
      {children}
    </div>
  );
}

async function Conteudo({ id }: { id: string }) {
  const [empresa, acessos, ocultos] = await Promise.all([
    getEmpresaDetalhe(id),
    listAcessosDoCliente(id),
    projetosOcultosDoCliente(),
  ]);
  if (!empresa) notFound();

  return (
    <div className="mx-auto -mt-16 max-w-7xl px-6">
      {/* cabeçalho */}
      <div className="rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white p-6">
        <Link
          href="/admin/clientes"
          className="text-[12px] text-t3 transition hover:text-ink"
        >
          ← Clientes
        </Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-ink">
              {empresa.nome}
            </h1>
            <div className="mt-2 flex flex-wrap gap-2">
              {empresa.status && (
                <span
                  className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em]"
                  style={{
                    background: 'var(--prazo-em-dia-soft)',
                    color: 'var(--prazo-em-dia)',
                  }}
                >
                  {empresa.status}
                </span>
              )}
              <span className="rounded-full bg-bgSoft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-t2">
                {empresa.projetos.length}{' '}
                {empresa.projetos.length === 1 ? 'projeto' : 'projetos'}
              </span>
            </div>
          </div>
          {empresa.email && (
            <div className="flex items-center gap-3">
              <BotaoCopiarLink email={empresa.email} />
              <a
                href={`/api/admin/login-as?email=${encodeURIComponent(empresa.email)}`}
                className="btn-ghost text-[12px]"
              >
                Entrar como cliente →
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          {/* projetos */}
          <div className="card p-6">
            <SecTitle>Projetos</SecTitle>
            {empresa.projetos.length === 0 ? (
              <p className="mt-3 text-[13px] text-t3">
                Nenhum projeto vinculado.
              </p>
            ) : (
              <div className="mt-3 space-y-2.5">
                {empresa.projetos.map((p) => (
                  // Cliente › projeto (hierarquia do portal).
                  <Link
                    key={p.id}
                    href={`/admin/projetos/${p.id}`}
                    className="flex items-center gap-3.5 rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white px-4 py-3.5 transition hover:bg-bgSoft/60"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[18px]"
                      style={{ background: 'var(--cal-agendado-soft)' }}
                    >
                      📁
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-semibold text-ink">
                        {p.nome}
                      </div>
                      {p.status && (
                        <div className="mt-0.5 text-[11px] text-t3">
                          {p.status}
                        </div>
                      )}
                    </div>
                    {/* O que a cliente vê no portal: só projetos Ativos e com essa chave ligada. */}
                    {p.status === 'Ativo' && (
                      <VisibilidadeProjeto projetoId={p.id} visivelInicial={!ocultos.has(p.id.replace(/-/g, ''))} />
                    )}
                    <span className="shrink-0 text-[14px] text-t3">›</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* acessos extras */}
          <div className="card p-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <SecTitle>Acessos extras</SecTitle>
              <span className="text-[11px] text-t3">
                {acessos.length}{' '}
                {acessos.length === 1 ? 'pessoa' : 'pessoas'}
              </span>
            </div>
            <AcessosManager clienteId={empresa.id} iniciais={acessos} />
          </div>

          {/* pendências */}
          <div className="card p-6">
            <SecTitle>Pendências do cliente</SecTitle>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {PENDENCIA_LABEL.map(({ chave, label }) => {
                const n = empresa.pendencias[chave];
                const ativo = n > 0;
                return (
                  <div
                    key={chave}
                    className="rounded-xl p-3 text-center"
                    style={{
                      background: ativo
                        ? 'var(--prazo-hoje-soft)'
                        : 'var(--bgSoft)',
                    }}
                  >
                    <div
                      className="text-[20px] font-semibold tracking-[-0.02em]"
                      style={{ color: ativo ? 'var(--prazo-hoje)' : 'var(--t3)' }}
                    >
                      {n}
                    </div>
                    <div
                      className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.05em]"
                      style={{ color: ativo ? 'var(--prazo-hoje)' : 'var(--t3)' }}
                    >
                      {label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* sidebar */}
        <aside className="space-y-4">
          <div
            className="rounded-2xl p-5 text-white"
            style={{ background: 'var(--navyHub)' }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">
              Central do cliente
            </div>
            <div className="mt-2 text-[15px] font-semibold">{empresa.nome}</div>
            <div className="text-[12px] text-white/70">Área compartilhada</div>
            {empresa.email && (
              <a
                href={`/api/admin/login-as?email=${encodeURIComponent(empresa.email)}`}
                className="mt-3 inline-block rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-semibold"
              >
                Ver área →
              </a>
            )}
          </div>

          <div className="card p-5">
            <SecTitle>Contato</SecTitle>
            <dl className="mt-3 divide-y divide-[rgba(21,21,33,0.06)]">
              <div className="flex items-center justify-between gap-3 py-2">
                <dt className="text-[12px] text-t3">E-mail</dt>
                <dd className="min-w-0 truncate text-[12px] font-medium text-ink">
                  {empresa.email ?? '—'}
                </dd>
              </div>
              {empresa.whatsapp && (
                <div className="flex items-center justify-between gap-3 py-2">
                  <dt className="text-[12px] text-t3">WhatsApp</dt>
                  <dd className="text-[12px] font-medium text-ink">
                    {empresa.whatsapp}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function EmpresaPage({ params }: { params: { id: string } }) {
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
