'use client';

/**
 * Peças da visão Lud. no visual novo (canvas NOVA · Post completo / Prévia):
 * bloco "Agora" enxuto, régua compacta de etapas e a caixa de Programação
 * (opção 6: grade do feed + Dia / Hora / Formato). Só equipe vê.
 */
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MudarPrazo } from '@/app/admin/_ui/MudarPrazo';
import { avisarConcluida } from '@/app/_ui/DesfazerConcluir';

export function hojeSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

function diasEntre(de: string, ate: string): number {
  const a = Date.UTC(+de.slice(0, 4), +de.slice(5, 7) - 1, +de.slice(8, 10));
  const b = Date.UTC(+ate.slice(0, 4), +ate.slice(5, 7) - 1, +ate.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/** Etapa atual: título + uma linha (com quem · prazo editável · atraso/situação). */
export function AgoraEtapa({
  titulo,
  pessoa,
  tarefaId,
  prazo,
  situacao,
  onMudouPrazo,
  acoes,
  podeEditar = true,
}: {
  podeEditar?: boolean;
  titulo: string;
  pessoa: string | null;
  tarefaId: string;
  prazo: string | null;
  /** Texto curto opcional ("viu 2 vezes, ainda não aprovou"). */
  situacao?: string | null;
  onMudouPrazo?: (novo: string) => void;
  acoes?: React.ReactNode;
}) {
  const router = useRouter();
  const hoje = hojeSaoPaulo();
  const [atual, setAtual] = useState(prazo);
  const p = atual?.slice(0, 10) ?? null;
  const atraso = p && p < hoje ? diasEntre(p, hoje) : 0;
  const texto = atraso > 0 ? `${atraso} ${atraso === 1 ? 'dia' : 'dias'} de atraso` : p === hoje ? 'vence hoje' : null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        <b className="text-[19px] font-extrabold tracking-[-0.01em] text-[#111113]">{titulo}</b>
        <span className="flex flex-wrap items-center gap-1.5">
          {pessoa && (
            <span className="inline-flex h-6 items-center rounded-full border border-[#E9E9EB] bg-white px-2.5 text-[12px] font-bold text-[#111113]">
              com {pessoa.split(' ')[0]}
            </span>
          )}
          {podeEditar ? (
            <MudarPrazo
              tarefaId={tarefaId}
              prazo={p}
              hoje={hoje}
              onMudou={(novo) => {
                setAtual(novo);
                if (onMudouPrazo) onMudouPrazo(novo);
                else router.refresh();
              }}
            />
          ) : (
            p && (
              <span className="inline-flex h-6 items-center rounded-full bg-white px-2.5 text-[12px] font-extrabold text-[#111113]">
                {p.slice(8)}/{p.slice(5, 7)}
              </span>
            )
          )}
          {texto && <span className={`text-[12.5px] font-bold ${atraso > 0 ? 'text-[#7E211C]' : 'text-[#7A1F4C]'}`}>{texto}</span>}
          {situacao && <span className="text-[12.5px] text-[#636369]">{situacao}</span>}
        </span>
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}

/** Botão "✓ Concluir etapa" (marca a tarefa como concluída no Notion). */
export function BotaoConcluirEtapa({ tarefaId, onConcluiu }: { tarefaId: string; onConcluiu?: () => void }) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(false);
  async function concluir() {
    setSalvando(true);
    setErro(false);
    try {
      const r = await fetch(`/api/tarefas/${tarefaId}/concluir`, { method: 'POST' });
      if (!r.ok) throw new Error();
      avisarConcluida(tarefaId);
      if (onConcluiu) onConcluiu();
      else router.refresh();
    } catch {
      setErro(true);
    } finally {
      setSalvando(false);
    }
  }
  return (
    <button
      type="button"
      onClick={concluir}
      disabled={salvando}
      className="rounded-[12px] border border-[#D6D6D9] bg-white px-4 py-2.5 text-[13px] font-extrabold text-[#111113] hover:bg-[#F4F4F5] disabled:opacity-50"
    >
      {salvando ? 'Concluindo…' : erro ? 'Tentar de novo' : '✓ Concluir etapa'}
    </button>
  );
}

export type EtapaRegua = { id: string; titulo: string; feito: boolean; prazo: string | null };

/**
 * Régua compacta: as etapas feitas viram UMA pílula verde (abre a lista),
 * depois a etapa de agora em destaque e as próximas com contorno.
 * Nunca passa da largura, então não precisa arrastar.
 */
export function ReguaCompacta({ etapas, agoraId }: { etapas: EtapaRegua[]; agoraId: string | null }) {
  if (etapas.length === 0) return null;
  const hoje = hojeSaoPaulo();
  const feitas = etapas.filter((e) => e.feito);
  const agora = etapas.find((e) => e.id === agoraId) ?? null;
  const proximas = etapas.filter((e) => !e.feito && e.id !== agoraId);
  const pAgora = agora?.prazo?.slice(0, 10) ?? null;
  const corAgora = !pAgora ? '#46464B' : pAgora < hoje ? '#B42318' : pAgora === hoje ? '#C2417E' : '#46464B';
  const traco = <span className="h-[2px] min-w-[12px] flex-1 bg-[#D6D6D9]" aria-hidden />;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {feitas.length > 0 && (
        <details className="group relative shrink-0">
          <summary className="inline-flex h-7 cursor-pointer list-none items-center gap-1.5 rounded-full bg-[#D8EDCF] px-3 text-[12px] font-extrabold text-[#2E5520] [&::-webkit-details-marker]:hidden">
            ✓ {feitas.length} {feitas.length === 1 ? 'etapa feita' : 'etapas feitas'}
            <span className="opacity-60 transition-transform group-open:rotate-180">▾</span>
          </summary>
          <div className="absolute left-0 top-[calc(100%+6px)] z-20 flex min-w-[220px] flex-col gap-1 rounded-[14px] border border-[#E9E9EB] bg-white p-2.5 shadow-[0_8px_24px_rgba(17,17,19,0.12)]">
            {feitas.map((e) => (
              <span key={e.id} className="flex items-center gap-2 text-[12.5px] text-[#46464B]">
                <span className="text-[#2E7D4F]">✓</span>
                {e.titulo}
              </span>
            ))}
          </div>
        </details>
      )}
      {agora && (
        <>
          {feitas.length > 0 && traco}
          <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-extrabold text-white" style={{ background: corAgora }}>
            ● {agora.titulo} · agora
          </span>
        </>
      )}
      {proximas.map((e) => (
        <span key={e.id} className="contents">
          {traco}
          <span className="inline-flex h-7 max-w-[180px] shrink-0 items-center truncate rounded-full border-[1.5px] border-[#B4B4B9] px-3 text-[12px] font-bold text-[#46464B]" title={e.titulo}>
            {e.titulo}
          </span>
        </span>
      ))}
    </div>
  );
}

export type VizinhoFeed = { id: string; titulo: string; data: string; esteAqui?: boolean };

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function diaCurto(iso: string | null): string {
  if (!iso) return 'sem data';
  const d = iso.slice(0, 10);
  const dow = new Date(d + 'T12:00:00Z').getUTCDay();
  return `${SEMANA[dow]}, ${d.slice(8)}/${d.slice(5, 7)}`;
}

export { horaCurta } from './horaCurta';

/**
 * Caixa de Programação (opção 6): grade "onde cai no feed" + Dia / Hora / Formato,
 * "Entra entre X e Y" e o botão de programar. Horário sempre de Brasília.
 */
export function CaixaProgramacao({
  postId,
  data,
  hora,
  formato,
  situacao,
  feed,
  semMoldura = false,
}: {
  postId: string;
  data: string | null;
  hora: string | null;
  formato: string | null;
  situacao: 'programado' | 'postado' | 'nao';
  /** Posts do feed (mais novo primeiro), com o deste post marcado. Vazio: grade genérica. */
  feed: VizinhoFeed[];
  semMoldura?: boolean;
}) {
  const idx = feed.findIndex((v) => v.esteAqui);
  const depois = idx > 0 ? feed[idx - 1] : null; // mais novo
  const antes = idx >= 0 && idx < feed.length - 1 ? feed[idx + 1] : null; // mais velho
  // Grade 3x2: até 6 posts ao redor deste (ou a posição genérica, 2ª casa).
  const celulas: (VizinhoFeed | null)[] =
    idx >= 0 ? feed.slice(Math.max(0, idx - 1), Math.max(0, idx - 1) + 6) : [null, { id: postId, titulo: '', data: '', esteAqui: true }, null, null, null, null];
  while (celulas.length < 6) celulas.push(null);
  const tons = ['#D6D6D9', '#B4B4B9', '#E9E9EB', '#D6D6D9', '#B4B4B9', '#E9E9EB'];
  const etiqueta =
    situacao === 'postado'
      ? { t: 'postado', bg: '#D8EDCF', fg: '#2E5520' }
      : situacao === 'programado'
        ? { t: 'programado', bg: '#D3E2F3', fg: '#24466B' }
        : { t: 'não programado', bg: '#F4F4F5', fg: '#46464B' };
  const caixa = (rot: string, valor: string) => (
    <span className="flex items-baseline justify-between gap-2 rounded-[12px] border border-[#E9E9EB] px-2.5 py-1.5">
      <span className="text-[10.5px] font-extrabold tracking-[0.06em] text-[#636369]">{rot}</span>
      <b className="truncate text-[14px] text-[#111113]">{valor}</b>
    </span>
  );
  return (
    <section className={`flex flex-col gap-3 ${semMoldura ? '' : 'rounded-[20px] border border-[#E9E9EB] bg-white p-5'}`}>
      <div className="flex items-center justify-between gap-2">
        <b className="text-[16px] text-[#111113]">Programação</b>
        <span className="rounded-full px-2 py-0.5 text-[11px] font-extrabold" style={{ background: etiqueta.bg, color: etiqueta.fg }}>
          {etiqueta.t}
        </span>
      </div>
      <div className="grid grid-cols-[120px_minmax(0,1fr)] items-stretch gap-2.5">
        <div className="flex flex-col gap-1.5 rounded-[14px] border border-[#E9E9EB] bg-[#FAFAFA] p-1.5">
          <div className="grid grid-cols-3 gap-[3px]">
            {celulas.map((c, i) => (
              <span
                key={i}
                title={c?.titulo || undefined}
                className="aspect-[4/5] rounded-[4px]"
                style={
                  c?.esteAqui
                    ? { background: '#F8D5E5', outline: '2px solid #111113', outlineOffset: 1 }
                    : { background: c ? tons[i] : '#F4F4F5' }
                }
              />
            ))}
          </div>
          <span className="text-center text-[10.5px] text-[#636369]">onde cai no feed</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {caixa('DIA', diaCurto(data))}
          {caixa('HORA', hora ?? 'a definir')}
          {caixa('FORMATO', formato || 'a definir')}
        </div>
      </div>
      {(antes || depois) && (
        <span className="text-[12.5px] text-[#46464B]">
          {antes && depois
            ? `Entra entre "${antes.titulo}" e "${depois.titulo}".`
            : antes
              ? `Entra depois de "${antes.titulo}".`
              : `Entra antes de "${depois!.titulo}".`}
        </span>
      )}
      <span className="text-[11.5px] text-[#8A8A90]">horário de Brasília</span>
      <Link
        href={`/programacao/${postId}`}
        className="flex justify-center rounded-[11px] bg-[#111113] px-3 py-2.5 text-[13px] font-extrabold text-white hover:bg-[#2C2C30]"
      >
        📅 Programar
      </Link>
      <Link href={`/programacao/${postId}`} className="text-center text-[12.5px] font-bold text-[#111113] hover:underline">
        configurar plataformas e legenda →
      </Link>
    </section>
  );
}
