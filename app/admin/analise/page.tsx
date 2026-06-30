import { igConfigured, listIgAccounts } from '@/lib/instagram';
import { env } from '@/lib/env';
import { AnaliseAdmin } from './AnaliseAdmin';

export const dynamic = 'force-dynamic';

function NaoConfigurado() {
  return (
    <div className="card p-6">
      <h2 className="text-[15px] font-semibold text-ink">
        Integração com o Instagram ainda não conectada
      </h2>
      <p className="mt-2 text-[13px] text-t2">
        Pra ligar essa página, falta configurar no ambiente:
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-t2">
        <li>
          <span className="font-mono text-[12px]">IG_GRAPH_TOKEN</span> — token
          long-lived do System User do Business Manager da Lud.
        </li>
        <li>
          <span className="font-mono text-[12px]">IG_ACCOUNTS</span> — mapa JSON de
          projeto pra conta do Instagram (usado na área do cliente).
        </li>
      </ul>
      <p className="mt-3 text-[12px] text-t3">
        Permissões necessárias no app da Meta: instagram_basic,
        instagram_manage_insights, pages_show_list, pages_read_engagement,
        business_management.
      </p>
    </div>
  );
}

async function Conteudo() {
  let accounts;
  try {
    accounts = await listIgAccounts();
  } catch (err: any) {
    return (
      <p className="rounded-lg bg-redSoft px-4 py-3 text-[13px] text-crimson">
        Erro ao conectar na Graph API: {err?.message ?? 'desconhecido'}
      </p>
    );
  }
  // Reverse map: igUserId → projetoId. Usado pelo botão "Gerar relatório"
  // — o relatório precisa de projetoId (chave do banco + permissão).
  const projetoPorIg: Record<string, string> = {};
  for (const [projetoId, igUserId] of Object.entries(env.instagram.accounts)) {
    projetoPorIg[igUserId] = projetoId;
  }
  return <AnaliseAdmin accounts={accounts} projetoPorIg={projetoPorIg} />;
}

export default async function AnalisePage() {
  return (
    <main className="mx-auto max-w-4xl lg:max-w-7xl px-6 py-10">
      <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-ink">
        Análise do Instagram
      </h1>
      <p className="mt-1 text-[14px] text-t2">
        Métricas de alcance, engajamento e crescimento puxadas direto da conta.
      </p>
      <div className="mt-6">
        {igConfigured() ? <Conteudo /> : <NaoConfigurado />}
      </div>
    </main>
  );
}
