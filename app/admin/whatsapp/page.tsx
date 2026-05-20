import { supabaseAdmin } from '@/lib/supabase';
import { AdminWhatsappPanel } from './AdminWhatsappPanel';

export const dynamic = 'force-dynamic';

export default async function AdminWhatsapp() {
  const sb = await supabaseAdmin();

  const [{ data: grupos }, { data: permissoes }] = await Promise.all([
    sb.from('whatsapp_grupos').select('*').order('nome', { ascending: true }),
    sb.from('whatsapp_permissoes').select('*'),
  ]);

  return (
    <div className="px-6 py-8">
      <header className="mb-6">
        <h1 className="text-[22px] font-bold tracking-[-0.02em] text-ink">
          WhatsApp
        </h1>
        <p className="text-[13px] text-t3">
          Gerencie quais grupos do seu WhatsApp aparecem no Portal e quem pode ler/responder cada um.
        </p>
      </header>

      <AdminWhatsappPanel grupos={grupos ?? []} permissoes={permissoes ?? []} />
    </div>
  );
}
