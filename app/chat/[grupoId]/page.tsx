import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import {
  listarGruposDoUsuario,
  listarMensagens,
  podeResponderNoGrupo,
} from '@/lib/supabase';
import { ChatWindow } from '../_components/ChatWindow';

export const dynamic = 'force-dynamic';

export default async function ChatGrupo({ params }: { params: { grupoId: string } }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const grupoId = decodeURIComponent(params.grupoId);
  const grupos = await listarGruposDoUsuario(session.email);
  const grupo = grupos.find((g) => g.id === grupoId);
  if (!grupo) notFound();

  const [mensagens, podeResponder] = await Promise.all([
    listarMensagens(grupoId, 100),
    podeResponderNoGrupo(session.email, grupoId),
  ]);

  return (
    <div className="flex h-[100dvh] flex-col bg-bgSoft">
      <header className="sticky top-0 z-10 border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link href="/chat" className="text-[12px] text-mauve hover:text-ink">
            ←
          </Link>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-[11px] font-bold text-white">
            {grupo.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={grupo.foto_url}
                alt={grupo.nome}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              iniciais(grupo.nome)
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold text-ink">{grupo.nome}</div>
            <div className="text-[10px] text-t3">
              {podeResponder ? 'Você pode responder' : 'Somente leitura'}
            </div>
          </div>
        </div>
      </header>

      <ChatWindow
        grupoId={grupoId}
        mensagensIniciais={mensagens}
        podeResponder={podeResponder}
        emailLogado={session.email}
      />
    </div>
  );
}

function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
