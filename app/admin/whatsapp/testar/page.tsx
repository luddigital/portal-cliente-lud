import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabase';
import { TestarWppForm } from './TestarWppForm';

export const dynamic = 'force-dynamic';

export default async function TestarWppPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    redirect('/');
  }

  const sb = await supabaseAdmin();
  const { data: grupos } = await sb
    .from('whatsapp_grupos')
    .select('id, nome')
    .order('nome', { ascending: true });

  return (
    <div className="min-h-screen pb-16">
      <header className="border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div>
            <Link
              href="/admin/whatsapp"
              className="text-[11px] text-mauve transition hover:text-ink"
            >
              ← WhatsApp
            </Link>
            <h1 className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-ink">
              Testar envio
            </h1>
            <p className="text-[11px] text-t3">
              Manda uma mensagem de teste pra qualquer número ou grupo seu —
              serve pra validar formatação antes de disparar pra cliente real.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-6 space-y-6">
        <div className="card p-4 text-[12.5px] leading-[1.6] text-t2">
          <p>
            <b>Dica:</b> cria um grupo WhatsApp só com você mesma (ou com um
            amigo) pra testar lembretes em contexto de grupo sem bagunçar o
            grupo oficial dos clientes.
          </p>
        </div>

        <TestarWppForm grupos={grupos ?? []} />
      </main>
    </div>
  );
}
