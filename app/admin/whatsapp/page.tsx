import { supabaseAdmin } from '@/lib/supabase';
import { listAllProjetos } from '@/lib/notion';
import { AdminWhatsappPanel } from './AdminWhatsappPanel';

export const dynamic = 'force-dynamic';

export default async function AdminWhatsapp() {
  const sb = await supabaseAdmin();

  const [{ data: grupos }, { data: permissoes }, projetos] = await Promise.all([
    sb.from('whatsapp_grupos').select('*').order('nome', { ascending: true }),
    sb.from('whatsapp_permissoes').select('*'),
    listAllProjetos().catch(() => []),
  ]);

  // Projetos vêm com clienteNome — monta string "Cliente · Projeto" pro dropdown.
  const projetosOrdenados = projetos
    .map((p: any) => ({
      id: p.id,
      label:
        p.clienteNome && p.clienteNome !== p.nome
          ? `${p.clienteNome} · ${p.nome}`
          : p.nome,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));

  return (
    <div className="px-6 py-8">
      <header className="mb-6">
        <h1 className="text-[22px] font-bold tracking-[-0.02em] text-ink">
          WhatsApp
        </h1>
        <p className="text-[13px] text-t3">
          Sincroniza os grupos do seu WhatsApp e vincula cada um ao projeto
          correspondente do Notion — assim o botão &quot;📱 lembrar&quot; em
          /admin/aprovacoes sabe onde mandar o lembrete.
        </p>
      </header>

      <AdminWhatsappPanel
        grupos={grupos ?? []}
        permissoes={permissoes ?? []}
        projetos={projetosOrdenados}
      />
    </div>
  );
}
