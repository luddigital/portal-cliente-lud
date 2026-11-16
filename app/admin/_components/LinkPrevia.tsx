'use client';

import { useState } from 'react';
import { PreviaPostModal, prefetchPrevia } from '../aprovacoes/PreviaPostModal';

/**
 * Clique num post no admin: abre a prévia (popup) primeiro, com "Abrir
 * completo" dentro. Pra usar em telas de servidor no lugar de <Link href="/post/…">.
 */
export function LinkPrevia({
  postId,
  tarefaId,
  className = '',
  title,
  children,
}: {
  postId: string;
  tarefaId?: string | null;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" onMouseEnter={() => prefetchPrevia(postId)} onFocus={() => prefetchPrevia(postId)} onClick={() => setAberto(true)} title={title ?? 'Ver prévia do post'} className={`w-full text-left ${className}`}>
        {children}
      </button>
      {aberto && <PreviaPostModal postId={postId} tarefaId={tarefaId ?? undefined} fechar={() => setAberto(false)} />}
    </>
  );
}
