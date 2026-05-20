import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { igConfigured } from '@/lib/instagram';
import { getProjetoNome } from '@/lib/notion';
import { AnaliseCliente } from './AnaliseCliente';

export const dynamic = 'force-dynamic';

export default async function AnaliseClientePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const mapeados = session.projetoIds.filter((id) => env.instagram.accounts[id]);
  const projetos = await Promise.all(
    mapeados.map(async (id) => ({ id, nome: await getProjetoNome(id) })),
  );

  return (
    <main className="mx-auto max-w-4xl lg:max-w-6xl px-6 py-10">
      <Link href="/" className="text-[12px] text-mauve hover:text-ink">
        ← Voltar
      </Link>
      <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.03em] text-ink">
        Análise do Instagram
      </h1>
      <p className="mt-1 text-[14px] text-t2">
        Como o perfil performou nos últimos períodos.
      </p>
      <div className="mt-6">
        {!igConfigured() || projetos.length === 0 ? (
          <p className="text-[13px] text-t3">
            A análise do Instagram ainda não está disponível pra sua conta. A
            equipe da Lud. vai liberar em breve.
          </p>
        ) : (
          <AnaliseCliente projetos={projetos} />
        )}
      </div>
    </main>
  );
}
