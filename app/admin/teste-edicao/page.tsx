import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { getPostComDetalhes } from '@/lib/notion';
import { PainelTeste } from './PainelTeste';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Sandbox pra testar edição inline do post no Notion sem tocar em post real.
 *  Uso: cria uma página de teste no Notion (qualquer projeto), copia o ID
 *  da URL, acessa /admin/teste-edicao?postId=<ID>. Só admin. */
export default async function TesteEdicaoPage({
  searchParams,
}: {
  searchParams: { postId?: string };
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  const ehAdmin = env.auth.adminEmails.includes(session.email.trim().toLowerCase());
  if (!ehAdmin) redirect('/');

  const postId = (searchParams.postId ?? '').trim();

  if (!postId) {
    return (
      <div className="min-h-screen bg-bgSoft/40 pb-16">
        <header className="border-b border-[rgba(21,21,33,0.08)] bg-white">
          <div className="mx-auto max-w-3xl px-6 py-4">
            <Link href="/admin" className="text-[11px] text-mauve hover:text-ink">
              ← Admin
            </Link>
            <h1 className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-ink">
              🧪 Sandbox — edição inline do post
            </h1>
            <p className="text-[11px] text-t3">
              Ambiente isolado pra testar edição direto no Notion sem risco.
            </p>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-6 py-8 space-y-5">
          <div className="card p-6 space-y-4">
            <div>
              <h2 className="text-[15px] font-semibold text-ink">Como usar</h2>
              <ol className="mt-3 space-y-2 text-[13px] leading-[1.6] text-t2">
                <li>
                  <b className="text-ink">1.</b> No Notion, crie (ou duplique) uma
                  página de post pra usar como teste. Sugestão: chama de
                  &quot;🧪 TESTE PORTAL — Padronização&quot;. Pode ser em qualquer
                  projeto seu.
                </li>
                <li>
                  <b className="text-ink">2.</b> Copie a URL da página no Notion.
                  O ID é a última parte (ex: em{' '}
                  <code className="rounded bg-bgSoft px-1 py-0.5 text-[11px]">
                    notion.so/luddigital/…-3aad04d23b4a809d96f9e6fa67aed21d
                  </code>{' '}
                  o ID é <code className="rounded bg-bgSoft px-1 py-0.5 text-[11px]">
                    3aad04d23b4a809d96f9e6fa67aed21d
                  </code>).
                </li>
                <li>
                  <b className="text-ink">3.</b> Cole abaixo. O painel vai carregar os
                  campos daquela página específica — cada save escreve na sua
                  página de teste (nunca em post real).
                </li>
              </ol>
            </div>

            <form className="flex gap-2">
              <input
                type="text"
                name="postId"
                placeholder="Cola o ID (ou URL) da página do Notion aqui"
                className="input flex-1 text-[13px]"
                required
              />
              <button type="submit" className="btn-primary">
                Abrir
              </button>
            </form>
            <p className="text-[10px] text-t3">
              Aceita ID puro OU URL completa (o portal extrai o ID).
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Extrai UUID puro se veio URL colada
  const idLimpo = postId.replace(/-/g, '').match(/[a-f0-9]{32}/i)?.[0];
  const idFinal = idLimpo
    ? `${idLimpo.slice(0, 8)}-${idLimpo.slice(8, 12)}-${idLimpo.slice(12, 16)}-${idLimpo.slice(16, 20)}-${idLimpo.slice(20)}`
    : postId;

  const post = await getPostComDetalhes(idFinal);

  if (!post) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-[18px] font-semibold text-ink">
          Página não encontrada no Notion
        </h1>
        <p className="mt-2 text-[13px] text-t2">
          Confere se o ID está certo e se a integração Lud. tem acesso à página
          (compartilhar a página com a integration se ainda não estiver).
        </p>
        <p className="mt-4 text-[11px] text-t3">
          ID tentado: <code className="rounded bg-bgSoft px-1 py-0.5">{idFinal}</code>
        </p>
        <Link
          href="/admin/teste-edicao"
          className="mt-6 inline-block text-[13px] font-medium text-mauve hover:text-ink"
        >
          ← Tentar outro
        </Link>
      </div>
    );
  }

  return (
    <PainelTeste
      postId={post.id}
      titulo={post.titulo}
      data={post.data ?? ''}
      formatoTipo={post.formatoTipo}
      projetoNome={post.projetoNome}
      ideia={post.ideiaDoPost ?? ''}
      legenda={post.legenda ?? ''}
    />
  );
}
