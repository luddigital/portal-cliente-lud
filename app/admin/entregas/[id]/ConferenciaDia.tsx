'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { nomeCurtoDoProjeto } from '@/lib/rotas';
import { minutosDoHorario, type Conferencia } from '@/lib/conferenciaTipos';
import { PreviaPostModal, prefetchPrevia } from '../../aprovacoes/PreviaPostModal';
import type { GrupoEntrega, ItemEntrega } from '../../entrega/[id]/EntregaPorCliente';

/**
 * Conferir Postagem, dia a dia. Espelha a tarefa agendada "Conferência de Posts":
 * o que já está no ar, o que ainda vai subir, o que deu erro e se o grupo do cliente foi avisado.
 */

type Situacao = 'no_ar' | 'subir' | 'erro';
type Card = {
  item: ItemEntrega;
  handle: string;
  foto: string | null;
  horario: string | null;
  min: number | null;
  dia: string;
  conf: Conferencia | null;
  situacao: Situacao;
  motivo: string | null;
};

const DIA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const utc = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const difDias = (de: string, ate: string) => Math.round((utc(ate) - utc(de)) / 86_400_000);
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const semTraco = (id: string) => id.replace(/-/g, '').toLowerCase();
const horaSp = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)).replace(':', 'h');
const agoraMinSp = () => {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false })
    .format(new Date())
    .split(':')
    .map(Number);
  return h * 60 + m;
};

const SIT: Record<Situacao, { rot: string; emoji: string; fg: string; bg: string }> = {
  no_ar: { rot: 'No ar', emoji: '✅', fg: 'var(--cal-publicado)', bg: 'var(--cal-publicado-soft)' },
  subir: { rot: 'Pra subir', emoji: '⏳', fg: 'var(--cal-agendado)', bg: 'var(--cal-agendado-soft)' },
  erro: { rot: 'Com erro', emoji: '⚠️', fg: 'var(--cal-alteracao)', bg: 'var(--cal-alteracao-soft)' },
};

export function ConferenciaDia({
  grupos,
  fotos,
  horarios,
  conferencias,
  hojeIso,
}: {
  grupos: GrupoEntrega[];
  fotos: Record<string, string | null>;
  horarios: Record<string, string | null>;
  conferencias: Record<string, Conferencia>;
  hojeIso: string;
}) {
  const router = useRouter();
  const [previa, setPrevia] = useState<{ postId: string; tarefaId: string } | null>(null);
  const [concluidos, setConcluidos] = useState<Record<string, true>>({});
  const agora = agoraMinSp();

  const cards = useMemo<Card[]>(() => {
    const out: Card[] = [];
    for (const g of grupos)
      for (const item of g.itens) {
        const dia = (item.postData ?? item.prazo ?? '').slice(0, 10);
        if (!dia) continue;
        const conf = item.postId ? conferencias[semTraco(item.postId)] ?? null : null;
        const horario = horarios[g.projetoId] ?? null;
        const min = minutosDoHorario(horario);
        const feito = item.enviado || !!concluidos[item.tarefaId] || conf?.resultado === 'no_ar';
        let situacao: Situacao = 'subir';
        let motivo: string | null = null;
        if (feito) situacao = 'no_ar';
        else if (conf?.resultado === 'nao_publicado') (situacao = 'erro'), (motivo = 'Não foi publicado');
        else if (conf?.resultado === 'divergencia') (situacao = 'erro'), (motivo = 'Legenda diferente do aprovado');
        // Passou do horário (com 1h de folga pra conferência rodar) e ninguém confirmou.
        else if (dia < hojeIso || (dia === hojeIso && min !== null && agora > min + 60))
          (situacao = 'erro'), (motivo = 'Sem confirmação da conferência');
        out.push({
          item,
          handle: nomeCurtoDoProjeto(g.projetoNome || g.nome),
          foto: fotos[g.projetoId] ?? null,
          horario,
          min,
          dia,
          conf,
          situacao,
          motivo,
        });
      }
    return out;
  }, [grupos, conferencias, horarios, fotos, hojeIso, concluidos, agora]);

  // Abas: dias com post, de 3 dias atrás até 6 à frente, mais os atrasados com erro.
  const diasComPost = useMemo(() => {
    const s = new Set(cards.filter((c) => difDias(hojeIso, c.dia) >= -3 && difDias(hojeIso, c.dia) <= 6).map((c) => c.dia));
    s.add(hojeIso);
    return [...s].sort();
  }, [cards, hojeIso]);
  const antigosComErro = cards.filter((c) => difDias(hojeIso, c.dia) < -3 && c.situacao === 'erro');
  const [aba, setAba] = useState<string>(hojeIso);

  const doDia = aba === 'antigos' ? antigosComErro : cards.filter((c) => c.dia === aba);
  const n = (s: Situacao) => doDia.filter((c) => c.situacao === s).length;
  const noAr = doDia.filter((c) => c.situacao === 'no_ar');
  const avisados = noAr.filter((c) => c.conf?.whatsappStatus === 'enviado').length;

  // Blocos por horário de postagem (9h, 10h, 12h…), erros primeiro dentro de cada um.
  const blocos = useMemo(() => {
    const m = new Map<string, Card[]>();
    for (const c of doDia) {
      const k = c.horario?.trim() || 'Sem horário';
      m.set(k, [...(m.get(k) ?? []), c]);
    }
    const ordem: Record<Situacao, number> = { erro: 0, subir: 1, no_ar: 2 };
    return [...m.entries()]
      .map(([k, lista]) => [k, lista.sort((a, b) => ordem[a.situacao] - ordem[b.situacao] || a.handle.localeCompare(b.handle))] as const)
      .sort((a, b) => (minutosDoHorario(a[0]) ?? 9999) - (minutosDoHorario(b[0]) ?? 9999));
  }, [doDia]);

  const rotuloDia = (d: string) => {
    const dif = difDias(hojeIso, d);
    if (dif === 0) return 'Hoje';
    if (dif === -1) return 'Ontem';
    if (dif === 1) return 'Amanhã';
    return `${DIA[new Date(utc(d)).getUTCDay()]}, ${ddmm(d)}`;
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Abas por dia */}
      <div className="flex flex-wrap gap-2">
        {antigosComErro.length > 0 && (
          <AbaDia ativo={aba === 'antigos'} onClick={() => setAba('antigos')} rotulo="Antigos" total={antigosComErro.length} erros={antigosComErro.length} />
        )}
        {diasComPost.map((d) => {
          const lista = cards.filter((c) => c.dia === d);
          return (
            <AbaDia
              key={d}
              ativo={aba === d}
              onClick={() => setAba(d)}
              rotulo={rotuloDia(d)}
              total={lista.length}
              erros={lista.filter((c) => c.situacao === 'erro').length}
              feitos={lista.filter((c) => c.situacao === 'no_ar').length}
            />
          );
        })}
      </div>

      {/* Placar do dia */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Placar sit="no_ar" num={n('no_ar')} sub={`de ${doDia.length} posts`} />
        <Placar sit="subir" num={n('subir')} sub={n('subir') ? 'ainda vão ao ar' : 'nada pendente'} />
        <Placar sit="erro" num={n('erro')} sub={n('erro') ? 'pedem atenção' : 'nenhum problema'} />
        <div className="flex min-h-fit flex-col gap-1 rounded-[18px] border border-[#E9E9EB] bg-white p-4">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#636369]">💬 Aviso no grupo</span>
          <b className="text-[30px] leading-none">
            {avisados}
            <span className="text-[16px] text-[#A1A1A8]">/{noAr.length}</span>
          </b>
          <span className="text-[12px] text-[#636369]">{noAr.length ? 'posts no ar avisados no WhatsApp' : 'nenhum post no ar ainda'}</span>
        </div>
      </div>

      {/* Posts do dia por horário */}
      {doDia.length === 0 ? (
        <div className="rounded-[18px] border border-[#E9E9EB] bg-white px-5 py-8 text-center text-[13px] text-[#636369]">Nenhum post marcado pra esse dia.</div>
      ) : (
        blocos.map(([hora, lista]) => (
          <section key={hora} className="flex flex-col gap-2.5">
            <div className="flex items-baseline gap-2">
              <b className="text-[17px]">🕘 {hora}</b>
              <span className="text-[12px] text-[#636369]">
                {lista.length} {lista.length === 1 ? 'post' : 'posts'} · {lista.filter((c) => c.situacao === 'no_ar').length} no ar
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {lista.map((c) => (
                <CardPost
                  key={c.item.tarefaId}
                  c={c}
                  abrir={() => c.item.postId && setPrevia({ postId: c.item.postId, tarefaId: c.item.tarefaId })}
                  onConcluido={() => (setConcluidos((x) => ({ ...x, [c.item.tarefaId]: true })), router.refresh())}
                />
              ))}
            </div>
          </section>
        ))
      )}
      {previa && <PreviaPostModal postId={previa.postId} tarefaId={previa.tarefaId} fechar={() => setPrevia(null)} />}
    </div>
  );
}

function AbaDia({ ativo, onClick, rotulo, total, erros, feitos }: { ativo: boolean; onClick: () => void; rotulo: string; total: number; erros: number; feitos?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-[14px] border px-3.5 py-2 text-[13px] font-extrabold ${ativo ? 'border-[#111113] bg-[#111113] text-white' : 'border-[#E9E9EB] bg-white hover:bg-[#F4F4F5]'}`}
    >
      {rotulo}
      <span className={`rounded-full px-2 text-[11px] ${ativo ? 'bg-white/20' : 'bg-[#F0F0F1] text-[#46464B]'}`}>
        {feitos !== undefined && total ? `${feitos}/${total}` : total}
      </span>
      {erros > 0 && <span className="rounded-full bg-[var(--cal-alteracao)] px-1.5 text-[11px] text-white">⚠️ {erros}</span>}
    </button>
  );
}

function Placar({ sit, num, sub }: { sit: Situacao; num: number; sub: string }) {
  const s = SIT[sit];
  return (
    <div className="flex min-h-fit flex-col gap-1 rounded-[18px] border p-4" style={{ background: num ? s.bg : '#fff', borderColor: num ? 'transparent' : '#E9E9EB' }}>
      <span className="text-[11px] font-extrabold uppercase tracking-[0.08em]" style={{ color: num ? s.fg : '#636369' }}>
        {s.emoji} {s.rot}
      </span>
      <b className="text-[30px] leading-none" style={{ color: num ? s.fg : '#111113' }}>
        {num}
      </b>
      <span className="text-[12px]" style={{ color: num ? s.fg : '#636369' }}>
        {sub}
      </span>
    </div>
  );
}

function CardPost({ c, abrir, onConcluido }: { c: Card; abrir: () => void; onConcluido: () => void }) {
  const s = SIT[c.situacao];
  const [salvando, setSalvando] = useState(false);
  const wpp = c.conf?.whatsappStatus;
  async function concluir() {
    setSalvando(true);
    const r = await fetch(`/api/tarefas/${c.item.atualTarefaId ?? c.item.tarefaId}/concluir`, { method: 'POST' }).catch(() => null);
    setSalvando(false);
    if (r?.ok) onConcluido();
  }
  return (
    <div className="flex min-h-fit flex-col gap-3 overflow-hidden rounded-[18px] border bg-white p-4" style={{ borderColor: c.situacao === 'erro' ? 'var(--cal-alteracao)' : '#E9E9EB' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          {c.foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.foto} alt="" className="h-7 w-7 shrink-0 rounded-full border border-[#E9E9EB] object-cover" />
          ) : (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#111113] text-[11px] font-extrabold text-white">
              {c.handle.replace(/^@/, '')[0]?.toUpperCase()}
            </span>
          )}
          <b className="truncate text-[13px]">{c.handle.startsWith('@') ? c.handle : `@${c.handle}`}</b>
        </span>
        <span className="shrink-0 rounded-full px-2.5 py-[3px] text-[11.5px] font-extrabold" style={{ background: s.bg, color: s.fg }}>
          {s.emoji} {s.rot}
        </span>
      </div>

      <button type="button" onMouseEnter={() => c.item.postId && prefetchPrevia(c.item.postId)} onClick={abrir} className="text-left text-[14px] font-bold leading-[1.35] hover:underline">
        {c.item.postTitulo}
      </button>

      {c.motivo && (
        <span className="rounded-[10px] px-3 py-2 text-[12px] font-bold" style={{ background: 'var(--cal-alteracao-soft)', color: 'var(--cal-alteracao)' }}>
          {c.motivo}
          {c.conf?.detalhe ? `: ${c.conf.detalhe}` : ''}
        </span>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-[#F0F0F2] pt-2.5 text-[12px] text-[#636369]">
        {c.situacao === 'no_ar' && (
          <span className={wpp === 'enviado' ? 'font-bold text-[var(--cal-publicado)]' : wpp === 'falhou' ? 'font-bold text-[var(--cal-alteracao)]' : ''}>
            💬 {wpp === 'enviado' ? `Grupo avisado${c.conf ? ` às ${horaSp(c.conf.conferidoEm)}` : ''}` : wpp === 'falhou' ? 'Aviso no grupo falhou' : c.conf ? 'Grupo não avisado' : 'Aviso sem registro'}
          </span>
        )}
        {c.situacao === 'subir' && <span>🕘 Sobe {c.horario ? `às ${c.horario}` : 'hoje'}</span>}
        {c.conf?.linkInstagram && (
          <a href={c.conf.linkInstagram} target="_blank" rel="noreferrer" className="font-bold text-[#111113] hover:underline">
            Ver no Instagram ↗
          </a>
        )}
        {c.situacao !== 'no_ar' && (
          <button
            type="button"
            onClick={concluir}
            disabled={salvando}
            className="ml-auto whitespace-nowrap rounded-full border border-[#D6D6D9] bg-white px-3 py-[4px] text-[12px] font-extrabold text-[#111113] hover:bg-[#F4F4F5] disabled:opacity-50"
            title="Marca o Conferir Postagem como concluído no Notion"
          >
            {salvando ? 'Concluindo…' : 'Confirmar no ar'}
          </button>
        )}
      </div>
    </div>
  );
}
