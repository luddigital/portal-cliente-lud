'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PreviaPostModal } from '../aprovacoes/PreviaPostModal';

const ID = '([0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})';
const RE_POST = new RegExp(`^/post/${ID}/?$`, 'i');
const RE_TAREFA = new RegExp(`^/admin/tarefas/${ID}/?$`, 'i');

/**
 * Em todo o admin: clicar num link de post (/post/…) ou de tarefa (/admin/tarefas/…)
 * abre a prévia do post em popup, em vez da página completa (que demora mais).
 * Ctrl/Cmd+clique, nova aba e o "Abrir completo" do popup continuam abrindo a página.
 * Tarefa sem post abre a página da tarefa normalmente.
 */
export function AbrirPostEmPopup() {
  const router = useRouter();
  const [previa, setPrevia] = useState<{ postId: string; tarefaId: string | null } | null>(null);

  useEffect(() => {
    function aoClicar(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.hasAttribute('data-completo') || a.hasAttribute('download')) return;
      let url: URL;
      try {
        url = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      const p = url.pathname.match(RE_POST);
      if (p) {
        e.preventDefault();
        setPrevia({ postId: p[1], tarefaId: url.searchParams.get('tarefa') });
        return;
      }
      const t = url.pathname.match(RE_TAREFA);
      if (t) {
        e.preventDefault();
        const tarefaId = t[1];
        fetch(`/api/admin/tarefas/${tarefaId}/post`)
          .then((r) => (r.ok ? r.json() : { postId: null }))
          .then(({ postId }: { postId: string | null }) => {
            if (postId) setPrevia({ postId, tarefaId });
            else router.push(url.pathname + url.search);
          })
          .catch(() => router.push(url.pathname + url.search));
      }
    }
    document.addEventListener('click', aoClicar, true);
    return () => document.removeEventListener('click', aoClicar, true);
  }, [router]);

  return previa ? <PreviaPostModal postId={previa.postId} tarefaId={previa.tarefaId ?? undefined} fechar={() => setPrevia(null)} /> : null;
}
