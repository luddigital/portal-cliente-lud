'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PainelTeste } from './PainelTeste';

type Opcao = { id: string; nome: string };
type OpcaoSelect = { nome: string; cor?: string | null };
type RascunhoPauta = {
  ideia_texto: string;
  atualizado_em: string;
  publicado_em: string | null;
} | null;

type Props = {
  postId: string;
  titulo: string;
  data: string;
  projetoNome: string;
  ideia: string;
  rascunhoPauta: RascunhoPauta;
  formatos: Opcao[];
  funis: Opcao[];
  objetivos: Opcao[];
  demandas: OpcaoSelect[];
  formatoIdAtual: string | null;
  funilIdAtual: string | null;
  objetivoIdAtual: string | null;
  demandaAtual: string | null;
};

/** Envolve PainelTeste num overlay modal, mantendo o calendário renderizado
 *  atrás. Fechar (X, click no backdrop, Esc) só remove ?postId da URL — o
 *  resto do estado (cliente/projeto/mês) fica preservado. */
export function ConstrucaoModal(props: Props) {
  const router = useRouter();

  function fechar() {
    const params = new URLSearchParams(window.location.search);
    params.delete('postId');
    const qs = params.toString();
    router.push(`/admin/teste-edicao${qs ? '?' + qs : ''}`, { scroll: false });
    router.refresh();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') fechar();
    }
    document.addEventListener('keydown', onKey);
    // Trava o scroll do body enquanto modal está aberto
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-6 px-3"
      style={{ background: 'rgba(21,21,33,0.45)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) fechar();
      }}
    >
      <div className="w-full max-w-2xl bg-bg rounded-2xl shadow-2xl relative">
        <button
          type="button"
          onClick={fechar}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white border border-[rgba(21,21,33,0.1)] flex items-center justify-center text-t2 hover:text-ink z-10 text-[14px]"
          title="Fechar (Esc)"
          aria-label="Fechar"
        >
          ✕
        </button>
        <PainelTeste {...props} emModal />
      </div>
    </div>
  );
}
