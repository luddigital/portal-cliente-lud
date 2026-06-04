import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { listColaboradores, type ColaboradorResumo } from '@/lib/notion';

export const dynamic = 'force-dynamic';

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function CardColaborador({ c }: { c: ColaboradorResumo }) {
  const linkavel = !!c.pessoaUserId;
  const card = (
    <div
      className={`group rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white p-4 transition ${
        linkavel
          ? 'hover:border-navy/40 hover:shadow-[0_4px_20px_rgba(21,21,33,0.06)]'
          : 'opacity-60'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-navy to-mauve text-[13px] font-bold text-white">
          {iniciais(c.nome)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold tracking-[-0.01em] text-ink">
            {c.nome}
          </div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
            {c.funcao ?? 'sem função'}
          </div>
        </div>
      </div>
      <div className="mt-3 space-y-1 text-[11px] text-t3">
        {c.email && (
          <div className="truncate font-mono">{c.email}</div>
        )}
        {c.whatsapp && <div className="truncate">{c.whatsapp}</div>}
      </div>
      {!linkavel && (
        <p className="mt-3 rounded-md bg-bgSoft px-2 py-1.5 text-[10px] leading-snug text-t3">
          ⚠️ Sem "Pessoa" vinculada no Notion — vincule pra ver a produção.
        </p>
      )}
    </div>
  );
  return linkavel ? (
    <Link href={`/admin/equipe/${c.id}`}>{card}</Link>
  ) : (
    card
  );
}

export default async function EquipePage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    redirect('/');
  }

  const colaboradores = await listColaboradores();
  const comPessoa = colaboradores.filter((c) => c.pessoaUserId);
  const semPessoa = colaboradores.filter((c) => !c.pessoaUserId);

  return (
    <main className="mx-auto max-w-4xl lg:max-w-7xl px-6 py-10 space-y-8">
      <div>
        <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-ink">
          Equipe
        </h1>
        <p className="mt-1 text-[14px] text-t2">
          Prestadores de serviço da Lud. Clica num card pra ver a produção do
          colaborador (tarefas atrasadas, do dia, próximas e concluídas).
        </p>
      </div>

      {colaboradores.length === 0 ? (
        <p className="text-[13px] text-t3">Nenhum colaborador cadastrado.</p>
      ) : (
        <>
          {comPessoa.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {comPessoa.map((c) => (
                <CardColaborador key={c.id} c={c} />
              ))}
            </div>
          )}
          {semPessoa.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-t3">
                Sem produção mapeada
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {semPessoa.map((c) => (
                  <CardColaborador key={c.id} c={c} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
