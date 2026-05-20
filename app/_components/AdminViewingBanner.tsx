import { getSession, getAdminOrigem } from '@/lib/auth';
import { env } from '@/lib/env';

/**
 * Aparece no topo de TODAS as páginas quando o admin tá "vendo como cliente".
 * Mostra qual cliente tá sendo visualizado + botão pra restaurar sessão admin.
 */
export async function AdminViewingBanner() {
  const session = await getSession();
  const origem = await getAdminOrigem();
  if (!session || !origem) return null;
  // só mostra se a origem é admin de verdade e a session atual é diferente
  if (
    !env.auth.adminEmails.includes(origem.email.trim().toLowerCase()) ||
    origem.email === session.email
  ) {
    return null;
  }
  return (
    <div
      className="sticky top-0 z-50 flex items-center justify-between gap-3 px-4 py-2 text-[12px]"
      style={{
        background: 'var(--prazo-hoje)',
        color: 'white',
      }}
    >
      <div className="min-w-0 flex-1 truncate">
        👀 Você tá vendo como <b>{session.email}</b>
      </div>
      <a
        href="/api/admin/voltar-admin"
        className="shrink-0 rounded-full bg-white px-3 py-1 text-[11px] font-semibold transition hover:bg-bgSoft"
        style={{ color: 'var(--prazo-hoje)' }}
      >
        ← Voltar pra central
      </a>
    </div>
  );
}
