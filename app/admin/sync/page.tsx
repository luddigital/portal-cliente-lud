import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { getProjetoNome } from '@/lib/notion';
import { statusSync } from '@/lib/sync';
import { SyncControles } from './SyncControles';

export const dynamic = 'force-dynamic';

export default async function AdminSyncPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    redirect('/');
  }

  const projetoIds = env.supabase.projetosViaSupabase;
  const [projetos, status] = await Promise.all([
    Promise.all(
      projetoIds.map(async (id) => ({
        id,
        nome: (await getProjetoNome(id)) ?? '(nome desconhecido)',
      })),
    ),
    statusSync().catch(() => null),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/admin" className="text-[12px] text-mauve hover:text-ink">
        ← Admin
      </Link>
      <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.03em] text-ink">
        Sync Notion → Supabase
      </h1>
      <p className="mt-1 text-[13px] text-t2">
        Espelha postagens e tarefas dos projetos abaixo. Source of truth segue
        sendo Notion — Supabase é só cache rápido pra leitura do portal.
      </p>

      <section className="card mt-6 p-5">
        <h2 className="text-[14px] font-semibold text-ink">
          Projetos sincronizados ({projetos.length})
        </h2>
        {projetos.length === 0 ? (
          <p className="mt-2 text-[13px] text-t3">
            Nenhum projeto configurado. Adiciona o env var{' '}
            <code className="rounded bg-bgSoft px-1.5 py-0.5 text-[12px]">
              PROJETOS_VIA_SUPABASE
            </code>{' '}
            no Vercel com os IDs do Notion separados por vírgula e redeploya.
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5 text-[13px]">
            {projetos.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-md bg-bgSoft px-3 py-2"
              >
                <span className="text-ink">{p.nome}</span>
                <span className="font-mono text-[10px] text-t3">
                  {p.id.slice(0, 8)}…
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {projetos.length > 0 && (
        <SyncControles
          projetoIds={projetoIds}
          statusInicial={status}
        />
      )}

      <section className="card mt-6 p-5">
        <h2 className="text-[14px] font-semibold text-ink">Onde estamos</h2>
        <ol className="mt-2 space-y-1.5 text-[12px] leading-[1.6] text-t2">
          <li>
            <b>✓ Fase 2A — Sync ligado:</b> botão acima escreve os dados do
            Notion no Supabase. Upsert por ID, idempotente — pode rodar quantas
            vezes quiser. Hoje é manual, sem cron.
          </li>
          <li>
            <b>○ Fase 2B — Leitura via Supabase (próxima):</b> trocar o
            calendário e tarefas pendentes pra ler do Supabase quando o projeto
            está na lista acima. ~10× mais rápido que Notion. Fallback automático
            pro Notion se Supabase tá vazio ou der erro.
          </li>
          <li>
            <b>○ Fase 2C — Cron automático (depois):</b> Vercel Cron dispara
            sync a cada N min sozinho, sem precisar do botão.
          </li>
        </ol>
        <p className="mt-3 text-[11px] text-t3">
          Por ora o cliente continua vendo dados via Notion. O botão valida que
          o pipeline de sync funciona — depois ligamos a leitura.
        </p>
      </section>
    </div>
  );
}
