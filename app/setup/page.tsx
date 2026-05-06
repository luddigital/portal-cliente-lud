import Link from 'next/link';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default function SetupPage({ searchParams }: { searchParams: { token?: string; err?: string } }) {
  const configured = Boolean(env.drive.refreshToken);
  const token = searchParams.token;
  const err = searchParams.err;

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
        Setup · admin only
      </div>
      <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-ink">Conexão com Google Drive</h1>
      <p className="mt-2 text-[14px] text-mauve">
        Essa página conecta a sua conta Google como a "dona" dos uploads do portal. Roda uma vez, no setup inicial.
      </p>

      {err && (
        <div className="mt-8 card p-5 border-crimson/30 bg-[rgba(144,24,26,0.04)]">
          <div className="text-[13px] font-semibold text-crimson">Deu ruim no callback</div>
          <p className="mt-1 text-[12px] text-t2">
            {err === 'unauthorized'
              ? 'Essa conta não tá na lista de ADMIN_EMAILS. Confira no .env.'
              : err === 'no_refresh_token'
              ? 'O Google não devolveu refresh_token. Remove o app em myaccount.google.com/permissions e tenta de novo.'
              : err === 'exchange_failed'
              ? 'Falhou trocar o code pelo token. Confira client ID/secret.'
              : err}
          </p>
        </div>
      )}

      {token && (
        <div className="mt-8 card p-6">
          <div className="text-[13px] font-semibold text-ink">Refresh token gerado ✨</div>
          <p className="mt-1 text-[12px] text-mauve">
            Cola esse valor na env var <code className="rounded bg-[rgba(21,21,33,0.06)] px-1 font-mono">GOOGLE_OAUTH_REFRESH_TOKEN</code> (local e na Vercel) e reinicia o app.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-ink p-4 font-mono text-[11px] text-[#F8F8F8]">
            {token}
          </pre>
          <p className="mt-3 text-[11px] text-t3">
            Essa tela só aparece uma vez. Se perder o token, clica em "Conectar" de novo pra gerar outro.
          </p>
        </div>
      )}

      {!configured && !token && (
        <div className="mt-8 card p-6">
          <div className="text-[13px] font-semibold text-ink">Status: não conectado</div>
          <p className="mt-1 text-[12px] text-mauve">
            Antes de clicar, confirma que você:
          </p>
          <ul className="mt-2 list-disc pl-5 text-[12px] text-t2 space-y-1">
            <li>Preencheu <code className="font-mono">GOOGLE_OAUTH_CLIENT_ID</code> e <code className="font-mono">GOOGLE_OAUTH_CLIENT_SECRET</code> no .env</li>
            <li>Configurou o Redirect URI no Google Cloud como <code className="font-mono">{env.app.url}/api/setup/google/callback</code></li>
            <li>Tem acesso à pasta raiz <code className="font-mono">{env.drive.rootFolderId}</code> na conta que vai conectar</li>
          </ul>
          <Link href="/api/setup/google/authorize" className="btn-primary mt-5 inline-flex">
            Conectar Google Drive
          </Link>
        </div>
      )}

      {configured && !token && (
        <div className="mt-8 card p-6">
          <div className="text-[13px] font-semibold text-sage">Status: conectado</div>
          <p className="mt-1 text-[12px] text-mauve">
            Refresh token está configurado. O portal consegue subir arquivos no Drive.
          </p>
          <Link href="/api/setup/google/authorize" className="btn-ghost mt-5 inline-flex text-[12px]">
            Reconectar (gerar novo token)
          </Link>
        </div>
      )}
    </div>
  );
}
