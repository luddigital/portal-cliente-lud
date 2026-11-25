'use client';

/**
 * "Tarefas do dia" do Dashboard: escolhe a pessoa e vê atrasadas, pra hoje e
 * pra amanhã. Concluir aqui marca a tarefa como concluída no Notion também.
 */
import Link from 'next/link';
import { useState } from 'react';
import { MudarPrazo } from './MudarPrazo';
import { avisarConcluida, useConcluidaAgora } from '@/app/_ui/DesfazerConcluir';

export type TarefaDia = {
  id: string;
  titulo: string;
  post: string | null;
  prazo: string | null;
  pessoa: string;
  projeto: string | null;
};

const ini = (n: string) => {
  const p = n.trim().split(/\s+/);
  return (p.length > 1 ? p[0][0] + p[p.length - 1][0] : n.slice(0, 2)).toUpperCase();
};

function somaDias(iso: string, n: number) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function TarefasDoDia({ tarefas, hoje, rotuloHoje }: { tarefas: TarefaDia[]; hoje: string; rotuloHoje: string }) {
  const amanha = somaDias(hoje, 1);
  const concluidaAgora = useConcluidaAgora();
  const relevantes = tarefas.filter((t) => t.prazo && t.prazo <= amanha && !concluidaAgora(t.id));
  const pessoas = Array.from(new Set(relevantes.map((t) => t.pessoa)))
    .map((p) => ({ p, n: relevantes.filter((t) => t.pessoa === p).length }))
    .sort((a, b) => b.n - a.n);
  const [pessoa, setPessoa] = useState<string>('');
  const [feitas, setFeitas] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [prazos, setPrazos] = useState<Record<string, string>>({});
  const prazoDe = (t: TarefaDia) => prazos[t.id] ?? t.prazo;

  const daPessoa = relevantes.filter((t) => (!pessoa || t.pessoa === pessoa) && !feitas.has(t.id));
  const atr = daPessoa.filter((t) => prazoDe(t)! < hoje);
  const doDia = daPessoa.filter((t) => prazoDe(t) === hoje);
  const deAmanha = daPessoa.filter((t) => prazoDe(t) === amanha);
  const feitasHoje = relevantes.filter((t) => feitas.has(t.id) && (!pessoa || t.pessoa === pessoa)).length;
  const totalHoje = doDia.length + feitasHoje;
  const pct = totalHoje ? Math.round((100 * feitasHoje) / totalHoje) : 0;

  async function concluir(id: string) {
    setEnviando(id);
    setErro(null);
    try {
      const r = await fetch(`/api/tarefas/${id}/concluir`, { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'erro');
      setFeitas(new Set([...feitas, id]));
      avisarConcluida(id);
    } catch (e: any) {
      setErro(`Não consegui concluir: ${e?.message ?? 'erro'}`);
    } finally {
      setEnviando(null);
    }
  }

  const Bloco = ({ titulo, cor, lista }: { titulo: string; cor: string; lista: TarefaDia[] }) =>
    lista.length === 0 ? null : (
      <details open className="group flex flex-col">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 pb-1.5 pt-3 text-[11px] font-extrabold uppercase tracking-[0.08em] [&::-webkit-details-marker]:hidden" style={{ color: cor }}>
          <span className="text-[9px] text-[#8A8A90] transition-transform group-open:rotate-90">▶</span>
          {titulo} · {lista.length}
        </summary>
        {lista.map((t) => (
          <div key={t.id} className="grid grid-cols-[22px_auto_minmax(0,1fr)_auto] items-center gap-3 border-t border-[#F4F4F5] py-2.5 sm:grid-cols-[22px_auto_minmax(0,1fr)_180px_auto]">
            <button
              onClick={() => concluir(t.id)}
              disabled={enviando === t.id}
              aria-label="Concluir tarefa"
              className="h-[18px] w-[18px] rounded-full border-[1.5px] border-dashed border-[#B4B4B9] hover:border-[#2E7D4F] disabled:opacity-40"
            />
            <MudarPrazo tarefaId={t.id} prazo={prazoDe(t)} hoje={hoje} onMudou={(novo) => setPrazos({ ...prazos, [t.id]: novo })} />
            <Link href={`/admin/tarefas/${t.id}`} className="flex min-w-0 flex-col">
              <b className="truncate text-[13.5px]">{t.titulo}</b>
              {t.post && <span className="truncate text-[12px] text-[#636369]">{t.post}</span>}
            </Link>
            <span className="hidden truncate text-[12px] font-bold text-[#46464B] sm:block">{t.projeto ?? ''}</span>
            <button
              onClick={() => concluir(t.id)}
              disabled={enviando === t.id}
              className="inline-flex h-[30px] min-w-[112px] items-center justify-center whitespace-nowrap rounded-[10px] border border-[#2E7D4F] bg-white px-3 text-[12px] font-extrabold text-[#2E5520] hover:bg-[#F1F8EE] disabled:opacity-50"
            >
              {enviando === t.id ? 'Concluindo…' : '✓ Concluir'}
            </button>
          </div>
        ))}
      </details>
    );

  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-[20px] border border-[#E9E9EB] bg-white p-5">
      <div className="flex flex-col gap-0.5">
        <b className="text-[18px] font-extrabold">Tarefas do dia</b>
        <span className="text-[12.5px] text-[#636369]">Escolha a pessoa. Concluir aqui marca a tarefa no Notion também.</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setPessoa('')}
          className={`rounded-full px-3 py-1.5 text-[12.5px] font-bold ${!pessoa ? 'bg-[#111113] text-white' : 'border border-[#E9E9EB] bg-white text-[#46464B]'}`}
        >
          Todos <span className="opacity-60">{relevantes.length}</span>
        </button>
        {pessoas.map(({ p, n }) => (
          <button
            key={p}
            onClick={() => setPessoa(p)}
            className={`flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-[12.5px] font-bold ${pessoa === p ? 'bg-[#111113] text-white' : 'border border-[#E9E9EB] bg-white text-[#46464B]'}`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#46464B] text-[8.5px] font-extrabold text-white">{ini(p)}</span>
            {p.split(' ')[0]} <span className="opacity-60">{n}</span>
          </button>
        ))}
      </div>
      {erro && <div className="rounded-[10px] bg-[#F6CFCB] px-3 py-2 text-[12.5px] text-[#7E211C]">{erro}</div>}
      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="flex flex-col items-center gap-3 rounded-[16px] bg-[#FAFAFA] p-4">
          <div className="flex items-center gap-2.5 self-start">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#46464B] text-[11px] font-extrabold text-white">{pessoa ? ini(pessoa) : 'LD'}</span>
            <span className="flex flex-col">
              <b className="text-[14px]">{pessoa || 'Todos'}</b>
              <span className="text-[12px] text-[#636369]">{rotuloHoje}</span>
            </span>
          </div>
          <span className="flex h-[130px] w-[130px] items-center justify-center rounded-full" style={{ background: totalHoje ? `conic-gradient(#2E7D4F 0 ${pct}%, #C2417E ${pct}% 100%)` : '#E9E9EB' }}>
            <span className="flex h-[98px] w-[98px] flex-col items-center justify-center rounded-full bg-white">
              <b className="text-[24px] leading-none">
                {feitasHoje}/{totalHoje}
              </b>
              <span className="text-[11px] text-[#636369]">feitas hoje</span>
            </span>
          </span>
          <div className="flex w-full flex-col gap-1 text-[12.5px]">
            {[
              ['#2E7D4F', 'Feitas aqui', feitasHoje],
              ['#C2417E', 'Pra hoje', doDia.length],
              ['#B42318', 'Atrasadas', atr.length],
              ['#7462D6', 'Amanhã', deAmanha.length],
            ].map(([c, l, n]) => (
              <span key={l as string} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: c as string }} />
                  {l}
                </span>
                <b>{n}</b>
              </span>
            ))}
          </div>
        </div>
        <div className="min-w-0">
          {daPessoa.length === 0 && <div className="py-6 text-center text-[13px] text-[#636369]">Nada pra hoje nem atrasado. Bom sinal.</div>}
          <Bloco titulo="Atrasadas" cor="#7E211C" lista={atr} />
          <Bloco titulo="Pra hoje" cor="#7A1F4C" lista={doDia} />
          <Bloco titulo="Pra amanhã" cor="#3D3478" lista={deAmanha} />
        </div>
      </div>
    </section>
  );
}
