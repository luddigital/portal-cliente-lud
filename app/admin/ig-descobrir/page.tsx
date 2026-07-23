import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { igConfigured, listIgAccounts } from '@/lib/instagram';

export const dynamic = 'force-dynamic';

export default async function IgDescobrirPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    redirect('/');
  }

  if (!igConfigured()) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-[22px] font-semibold text-ink">
          Instagram não configurado
        </h1>
        <p className="mt-2 text-[13px] text-t2">
          Falta o env var <code>IG_GRAPH_TOKEN</code> no Vercel.
        </p>
      </main>
    );
  }

  let accounts;
  let erro: string | null = null;
  try {
    accounts = await listIgAccounts();
  } catch (e: any) {
    erro = e?.message ?? 'erro desconhecido';
    accounts = [];
  }

  const jaMapeadas = new Set(Object.values(env.instagram.accounts));

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">
        Contas Instagram visíveis pelo token
      </h1>
      <p className="mt-1 text-[13px] text-t2">
        Todas as contas que o System User da Lud. consegue ler agora. Pra plugar
        uma no portal do cliente, copia o <b>IG User ID</b> e adiciona no env{' '}
        <code className="rounded bg-bgSoft px-1 py-0.5 text-[12px]">IG_ACCOUNTS</code>{' '}
        no formato <code className="text-[12px]">projetoIdNotion:igUserId</code>,
        separados por vírgula.
      </p>

      {erro && (
        <p className="mt-4 rounded-lg bg-[var(--prazo-atrasado-soft)] px-4 py-3 text-[13px] text-[var(--prazo-atrasado)]">
          Erro na Graph API: {erro}
        </p>
      )}

      <div className="mt-6 space-y-3">
        {accounts.length === 0 && !erro && (
          <div className="card p-6 text-center text-[13px] text-t3">
            Nenhuma conta visível ainda. Confirme com o cliente que ele
            compartilhou a <b>Página do Facebook</b> (não só a conta do IG) com
            o BM da Lud.
          </div>
        )}
        {accounts.map((a) => {
          const mapeada = jaMapeadas.has(a.igUserId);
          return (
            <div key={a.igUserId} className="card flex items-center gap-4 p-4">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-bgSoft">
                {a.profilePicture && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.profilePicture}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold text-ink">
                  {a.name} <span className="text-t3">@{a.username}</span>
                </div>
                <div className="mt-0.5 text-[11px] text-t3">
                  Página FB: {a.pageName} · Seguidores:{' '}
                  {a.followersCount.toLocaleString('pt-BR')}
                </div>
                <div className="mt-1 font-mono text-[11px] text-t2">
                  IG User ID: <b className="text-ink">{a.igUserId}</b>
                </div>
              </div>
              {mapeada ? (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]"
                  style={{
                    background: 'var(--prazo-em-dia-soft)',
                    color: 'var(--prazo-em-dia)',
                  }}
                >
                  já mapeada
                </span>
              ) : (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]"
                  style={{
                    background: 'var(--prazo-chegando-soft)',
                    color: 'var(--prazo-chegando)',
                  }}
                >
                  falta mapear
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 card p-5 text-[12px] leading-[1.6] text-t2">
        <h3 className="text-[13px] font-semibold text-ink">
          Contas já mapeadas em IG_ACCOUNTS
        </h3>
        {Object.entries(env.instagram.accounts).length === 0 ? (
          <p className="mt-2 text-t3">Nenhuma. Adiciona a primeira via env var.</p>
        ) : (
          <ul className="mt-2 space-y-1 font-mono text-[11px]">
            {Object.entries(env.instagram.accounts).map(([projetoId, igUserId]) => (
              <li key={projetoId}>
                {projetoId} → {igUserId}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
