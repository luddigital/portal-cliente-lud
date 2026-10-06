'use client';

import { useState } from 'react';
import type { TarefaDaEntrega } from '@/lib/notion';
import type { Visualizacao } from '@/lib/supabase';
import { BotaoLembreteWpp } from './BotaoLembreteWpp';
import { PreviaPostModal } from './PreviaPostModal';

/** Formata o prazo em algo humano. */
function fmtPrazo(
  prazoISO: string | null,
): { texto: string; tone: 'atrasado' | 'hoje' | 'proximo' | 'futuro' } | null {
  if (!prazoISO) return null;
  const prazo = new Date(prazoISO.split('T')[0] + 'T00:00:00');
  if (Number.isNaN(prazo.getTime())) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dias = Math.round((prazo.getTime() - hoje.getTime()) / 86_400_000);
  const dd = String(prazo.getDate()).padStart(2, '0');
  const mm = String(prazo.getMonth() + 1).padStart(2, '0');
  const dataCurta = `${dd}/${mm}`;

  if (dias < 0) {
    const atraso = Math.abs(dias);
    return {
      texto: atraso === 1 ? 'atrasado 1 dia' : `atrasado ${atraso} dias`,
      tone: 'atrasado',
    };
  }
  if (dias === 0) return { texto: 'hoje', tone: 'hoje' };
  if (dias === 1) return { texto: 'amanhã', tone: 'proximo' };
  if (dias <= 7) return { texto: `em ${dias} dias`, tone: 'proximo' };
  return { texto: dataCurta, tone: 'futuro' };
}

const PRAZO_TONE_COR: Record<
  'atrasado' | 'hoje' | 'proximo' | 'futuro',
  { bg: string; fg: string }
> = {
  atrasado: {
    bg: 'var(--prazo-atrasado-soft)',
    fg: 'var(--prazo-atrasado)',
  },
  hoje: { bg: 'var(--prazo-hoje-soft)', fg: 'var(--prazo-hoje)' },
  proximo: { bg: 'var(--cal-agendado-soft)', fg: 'var(--cal-agendado)' },
  futuro: { bg: 'rgba(21,21,33,0.05)', fg: 'var(--t3)' },
};

/**
 * Row da tabela de aprovações. Clicar NÃO navega direto — abre primeiro um
 * modal com preview rápido do post (imagens, legenda) pra decidir sem sair
 * da página. Dentro do modal tem botão "abrir completo" se precisar da
 * página inteira.
 */
function textoVisto(v: Visualizacao): string {
  const d = new Date(v.ultima);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dia = new Date(d);
  dia.setHours(0, 0, 0, 0);
  const dias = Math.round((hoje.getTime() - dia.getTime()) / 86_400_000);
  if (dias === 0) return 'visto hoje';
  if (dias === 1) return 'visto ontem';
  return `visto ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function TarefaRow({
  tarefa: t,
  mostrarBotaoWpp = false,
  visto,
}: {
  tarefa: TarefaDaEntrega;
  mostrarBotaoWpp?: boolean;
  /** undefined = não mostrar; null = cliente ainda não abriu. */
  visto?: Visualizacao | null;
}) {
  const [modalAberto, setModalAberto] = useState(false);
  const prazo = fmtPrazo(t.prazo);
  const corPrazo = prazo ? PRAZO_TONE_COR[prazo.tone] : null;

  // Se não existe postId (ex.: tarefa avulsa sem post vinculado), cai direto
  // na navegação pra página da tarefa, sem modal.
  const temPreview = Boolean(t.postId);
  const hrefFallback = t.postId
    ? `/post/${t.postId}?tarefa=${t.tarefaId}`
    : `/tarefa/${t.tarefaId}`;

  const conteudoInterno = (
    <>
      <div className="min-w-0 flex-1 text-left">
        <div className="truncate text-[13px] text-ink">
          {t.postTitulo || t.titulo}
        </div>
        <div className="mt-0.5 truncate text-[10px] uppercase tracking-[0.06em] text-t3">
          {t.clienteNome ?? t.projetoNome ?? '(sem cliente)'} · {t.titulo}
        </div>
      </div>
      {visto !== undefined && (
        <span
          className={`shrink-0 text-[10.5px] ${visto ? 'font-semibold text-ink' : 'text-t3'}`}
          title={
            visto
              ? `Cliente abriu ${visto.total}x no portal`
              : 'Cliente ainda não abriu no portal (contagem desde 06/10)'
          }
        >
          {visto ? `👁 ${textoVisto(visto)}` : 'não visto'}
        </span>
      )}
      {prazo && corPrazo ? (
        <span
          className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
          style={{ background: corPrazo.bg, color: corPrazo.fg }}
          title={t.prazo ?? undefined}
        >
          {prazo.texto}
        </span>
      ) : (
        <span className="shrink-0 rounded bg-bgSoft px-2 py-0.5 text-[10px] font-semibold text-t3">
          sem prazo
        </span>
      )}
      <span className="shrink-0 text-[16px] text-t3">
        {temPreview ? '👁' : '›'}
      </span>
    </>
  );

  return (
    <>
      <div className="flex items-center gap-2 px-4 py-2.5 transition hover:bg-bgSoft/60">
        {temPreview ? (
          <button
            type="button"
            onClick={() => setModalAberto(true)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
            title="Ver prévia do post"
          >
            {conteudoInterno}
          </button>
        ) : (
          <a
            href={hrefFallback}
            className="flex min-w-0 flex-1 items-center gap-3"
          >
            {conteudoInterno}
          </a>
        )}
        {mostrarBotaoWpp && (
          <BotaoLembreteWpp
            tarefaId={t.tarefaId}
            clienteNome={t.clienteNome ?? t.projetoNome ?? 'cliente'}
          />
        )}
      </div>

      {modalAberto && temPreview && t.postId && (
        <PreviaPostModal
          postId={t.postId}
          tarefaId={t.tarefaId}
          fechar={() => setModalAberto(false)}
        />
      )}
    </>
  );
}
