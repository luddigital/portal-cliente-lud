'use client';

/**
 * Parte interativa da aba geral do projeto (proposta NOVA): "hoje no
 * projeto" compacto, entregas pendentes em cards coloridos e a lista de
 * tarefas (check conclui no Notion). Clicar num post abre a prévia.
 * Card que junta várias tarefas = a entrega do projeto; uma tarefa = a
 * página da tarefa (lib/rotas.ts). Não repete o @ do projeto: já estamos nele.
 */
import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { rotas } from '@/lib/rotas';
import type { TarefaDoProjeto } from '@/lib/notion';
import type { CardEntrega, NivelPrazo } from '@/lib/visao-projeto';
import { ModalMensagem, type GrupoWpp, type ItemPendenciaUi } from './PendenciasCliente';
import { PreviaPostModal, prefetchPrevia } from '../../aprovacoes/PreviaPostModal';
import { Avatar, ST, Tag, Vazio, type St } from '../../_ui/lud';
import { MudarPrazo } from '../../_ui/MudarPrazo';
import { avisarConcluida } from '@/app/_ui/DesfazerConcluir';

function somaDias(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

const ST_DO_NIVEL: Record<NivelPrazo, St> = { atrasado: 'atr', hoje: 'hoje', chegando: 'hoje', 'em-dia': 'cheg', sem: 'neu' };
const ROT_NIVEL: Record<NivelPrazo, string> = { atrasado: 'Atrasada', hoje: 'Vence hoje', chegando: 'Vence logo', 'em-dia': 'Chegando', sem: 'Sem data' };

/** Anel em fatias (sem degradê): cada fatia na cor do estado. */
function Anel({ partes, centro, sub }: { partes: { st: St; n: number }[]; centro: string; sub: string }) {
  const tam = 104;
  const r = tam / 2 - 9;
  const c = 2 * Math.PI * r;
  const tot = partes.reduce((s, p) => s + p.n, 0);
  let acc = 0;
  return (
    <span className="relative flex shrink-0 items-center justify-center" style={{ width: tam, height: tam }}>
      <svg width={tam} height={tam} className="-rotate-90">
        <circle cx={tam / 2} cy={tam / 2} r={r} fill="none" stroke="#E9E9EB" strokeWidth={10} />
        {tot > 0 &&
          partes
            .filter((p) => p.n > 0)
            .map((p) => {
              const len = (c * p.n) / tot;
              const el = (
                <circle key={p.st} cx={tam / 2} cy={tam / 2} r={r} fill="none" stroke={ST[p.st][2]} strokeWidth={10} strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-acc} />
              );
              acc += len;
              return el;
            })}
      </svg>
      <span className="absolute flex flex-col items-center leading-none">
        <b className="text-[22px] font-extrabold tabular-nums">{centro}</b>
        <span className="mt-1 text-[10.5px] text-[#636369]">{sub}</span>
      </span>
    </span>
  );
}

export function VisaoProjetoNova({
  projetoId,
  clienteNome,
  rotuloCliente,
  cards,
  tarefas,
  itensCliente,
  gruposWpp,
  textos,
  hojeIso,
  calendario,
}: {
  calendario?: React.ReactNode;
  projetoId: string;
  clienteNome: string;
  rotuloCliente: string;
  cards: CardEntrega[];
  /** Tarefa atual de cada post + tarefas fora do fluxo de posts. */
  tarefas: TarefaDoProjeto[];
  itensCliente: ItemPendenciaUi[];
  gruposWpp: GrupoWpp[];
  textos: Record<string, string>;
  hojeIso: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [previa, setPrevia] = useState<{ postId: string; tarefaId?: string } | null>(null);
  const [modal, setModal] = useState<{ titulo: string; itens: ItemPendenciaUi[] } | null>(null);
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);
  const [concluindo, setConcluindo] = useState<Set<string>>(new Set());
  const [feitas, setFeitas] = useState<Map<string, TarefaDoProjeto>>(new Map());
  const [erroTarefa, setErroTarefa] = useState<string | null>(null);
  const [abaHoje, setAbaHoje] = useState<'hoje' | 'atr'>('hoje');
  const [pessoa, setPessoa] = useState<string>('');
  const [verMais, setVerMais] = useState(false);

  useEffect(() => {
    if (!enviadoPara) return;
    const t = setTimeout(() => setEnviadoPara(null), 8000);
    return () => clearTimeout(t);
  }, [enviadoPara]);

  const liberadoPorTarefa = new Map(itensCliente.map((i) => [i.tarefaId, i]));
  const destino = (itens: { tarefaId: string; entregaId?: string | null }[]) => {
    const entregaId = itens.find((i) => i.entregaId)?.entregaId;
    if (itens.length === 1) return rotas.tarefa(itens[0].tarefaId);
    return entregaId ? rotas.entregaDoProjeto(projetoId, entregaId) : `${rotas.tarefas()}?projeto=${projetoId}`;
  };
  const destinoDoCard = (c: CardEntrega) => {
    const entregaId = c.itens.find((i) => i.entregaId)?.entregaId;
    return entregaId ? rotas.entregaDoProjeto(projetoId, entregaId) : destino(c.itens);
  };
  function lembrar(c: CardEntrega) {
    const itens = c.itens.map((i) => liberadoPorTarefa.get(i.tarefaId)).filter((x): x is ItemPendenciaUi => !!x);
    setModal({ titulo: c.titulo, itens: itens.length ? itens : itensCliente });
  }

  async function concluir(t: TarefaDoProjeto) {
    if (concluindo.has(t.id)) return;
    setErroTarefa(null);
    setConcluindo((s) => new Set(s).add(t.id));
    try {
      const r = await fetch(`/api/tarefas/${t.id}/concluir`, { method: 'POST' });
      if (!r.ok) throw new Error();
      setFeitas((m) => new Map(m).set(t.id, t));
      avisarConcluida(t.id, t.titulo);
      startTransition(() => router.refresh());
    } catch {
      setErroTarefa('Não consegui concluir essa tarefa no Notion. Tente de novo.');
    } finally {
      setConcluindo((s) => {
        const n = new Set(s);
        n.delete(t.id);
        return n;
      });
    }
  }

  // ---- tarefas abertas (sem as que concluímos agora)
  // Prazos mudados aqui (chip de data ou "Fazer hoje") valem na hora, sem recarregar.
  const [prazos, setPrazos] = useState<Record<string, string>>({});
  const [movendo, setMovendo] = useState<Set<string>>(new Set());
  const abertas = useMemo(
    () =>
      tarefas
        .filter((t) => !feitas.has(t.id) && !/^calend[aá]rio\b/i.test(t.titulo.trim()))
        .map((t) => (prazos[t.id] ? { ...t, prazo: prazos[t.id] } : t)),
    [tarefas, feitas, prazos],
  );
  async function fazerHoje(t: TarefaDoProjeto) {
    setMovendo(new Set([...movendo, t.id]));
    try {
      const r = await fetch(`/api/admin/tarefas/${t.id}/prazo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prazo: hojeIso }),
      });
      if (r.ok) setPrazos((p) => ({ ...p, [t.id]: hojeIso }));
    } finally {
      setMovendo((m) => {
        const n = new Set(m);
        n.delete(t.id);
        return n;
      });
    }
  }
  const atrasadas = abertas.filter((t) => t.prazo && t.prazo < hojeIso);
  const deHoje = abertas.filter((t) => t.prazo === hojeIso);

  /** Junta tarefas iguais (mesmo título) pra o "hoje" compacto. */
  function agrupar(lista: TarefaDoProjeto[]) {
    const m = new Map<string, TarefaDoProjeto[]>();
    for (const t of lista) {
      const k = t.titulo.trim().toLowerCase();
      m.set(k, [...(m.get(k) ?? []), t]);
    }
    return [...m.values()].sort((a, b) => b.length - a.length);
  }
  const gruposHoje = agrupar(abaHoje === 'hoje' ? deHoje : atrasadas);

  // ---- lista de tarefas por pessoa
  const pessoas = useMemo(() => {
    const c = new Map<string, number>();
    for (const t of abertas) if (t.prazo && t.prazo <= somaDias(hojeIso, 7)) c.set(t.pessoa ?? 'Sem pessoa', (c.get(t.pessoa ?? 'Sem pessoa') ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  }, [abertas, hojeIso]);
  const filtradas = abertas.filter((t) => !pessoa || (t.pessoa ?? 'Sem pessoa') === pessoa);
  const ord = (l: TarefaDoProjeto[]) => [...l].sort((a, b) => (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999') || a.titulo.localeCompare(b.titulo));
  const secoes: { rot: string; st: St; lista: TarefaDoProjeto[]; feitas?: boolean }[] = [
    { rot: 'ATRASADAS', st: 'atr', lista: ord(filtradas.filter((t) => t.prazo && t.prazo < hojeIso)) },
    { rot: 'PRA HOJE', st: 'hoje', lista: ord(filtradas.filter((t) => t.prazo === hojeIso)) },
    { rot: 'PRÓXIMOS 7 DIAS', st: 'cheg', lista: ord(filtradas.filter((t) => t.prazo && t.prazo > hojeIso && t.prazo <= somaDias(hojeIso, 7))) },
    { rot: 'FEITAS AGORA', st: 'ok', lista: [...feitas.values()].filter((t) => !pessoa || (t.pessoa ?? 'Sem pessoa') === pessoa), feitas: true },
  ];
  const depois = ord(filtradas.filter((t) => !t.prazo || t.prazo > somaDias(hojeIso, 7)));

  function LinhaTarefa({ t, feita = false }: { t: TarefaDoProjeto; feita?: boolean }) {
    const atr = !feita && t.prazo && t.prazo < hojeIso;
    return (
      <div data-tarefa-id={feita ? undefined : t.id} className="flex items-center gap-3 border-t border-[#F4F4F5] py-2.5">
        <button
          type="button"
          aria-label={feita ? 'Feita' : `Concluir ${t.titulo}`}
          title={feita ? 'Concluída no Notion' : 'Concluir no Notion'}
          onClick={() => !feita && concluir(t)}
          disabled={feita || concluindo.has(t.id)}
          className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] text-[10px] font-extrabold disabled:cursor-default"
          style={feita ? { background: ST.ok[0], borderColor: ST.ok[2], color: ST.ok[1] } : { borderColor: '#B4B4B9', borderStyle: 'dashed' }}
        >
          {feita ? '✓' : ''}
        </button>
        <span className="shrink-0">
          {feita ? (
            <span className="text-[12.5px] font-extrabold text-[#8A8A90]">{t.prazo ? dm(t.prazo) : '--'}</span>
          ) : (
            <MudarPrazo tarefaId={t.id} prazo={t.prazo} hoje={hojeIso} onMudou={(novo) => setPrazos((p) => ({ ...p, [t.id]: novo }))} />
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <Link href={rotas.tarefa(t.id)} className={`truncate text-[13.5px] font-bold hover:underline ${feita ? 'text-[#8A8A90] line-through' : ''}`}>
            {t.titulo}
          </Link>
          {t.postTitulo && (
            <button type="button" onMouseEnter={() => prefetchPrevia(t.postId)} onClick={() => t.postId && setPrevia({ postId: t.postId, tarefaId: t.id })} className="truncate text-left text-[12px] text-[#636369] hover:text-[#111113]">
              {t.postTitulo}
            </button>
          )}
        </div>
        {t.pessoa && <Avatar nome={t.pessoa} tam={22} />}
        {feita ? (
          <span className="shrink-0 whitespace-nowrap text-[12px] text-[#636369]">✓ feita agora</span>
        ) : atr ? (
          <button
            type="button"
            onClick={() => fazerHoje(t)}
            disabled={movendo.has(t.id)}
            className="inline-flex h-[30px] min-w-[112px] shrink-0 items-center justify-center gap-1 rounded-[10px] border border-[#D6D6D9] bg-white px-3 text-[12px] font-extrabold hover:bg-[#F4F4F5] disabled:opacity-50"
          >
            {movendo.has(t.id) ? 'Movendo…' : '↻ Fazer hoje'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => concluir(t)}
            disabled={concluindo.has(t.id)}
            className="inline-flex h-[30px] min-w-[112px] shrink-0 items-center justify-center gap-1 rounded-[10px] border border-[#2E7D4F] bg-white px-3 text-[12px] font-extrabold text-[#2E5520] hover:bg-[#F1F8EE] disabled:opacity-50"
          >
            {concluindo.has(t.id) ? 'Concluindo…' : '✓ Concluir'}
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      {enviadoPara && (
        <div role="status" className="rounded-[14px] px-4 py-2.5 text-[13px]" style={{ background: ST.ok[0], color: ST.ok[1] }}>
          Mensagem enviada no grupo <b>{enviadoPara}</b>.
        </div>
      )}

      {/* ---- hoje no projeto (compacto) */}
      <section className="grid gap-5 rounded-[20px] border border-[#E9E9EB] bg-white p-5 md:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex items-center gap-4">
          <Anel
            partes={[
              { st: 'ok', n: feitas.size },
              { st: 'hoje', n: deHoje.length },
              { st: 'atr', n: atrasadas.length },
            ]}
            centro={feitas.size ? `${feitas.size}/${feitas.size + deHoje.length + atrasadas.length}` : String(deHoje.length + atrasadas.length)}
            sub={feitas.size ? 'feitas' : 'pra fazer'}
          />
          <div className="flex flex-col gap-1 text-[12.5px]">
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-[#636369]">Hoje no projeto</span>
            {feitas.size > 0 && (
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: ST.ok[2] }} />{feitas.size} {feitas.size === 1 ? 'feita agora' : 'feitas agora'}</span>
            )}
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: ST.hoje[2] }} />{deHoje.length} pra hoje</span>
            <span className={`flex items-center gap-1.5 ${atrasadas.length ? 'font-extrabold text-[#7E211C]' : ''}`}><span className="h-2 w-2 rounded-full" style={{ background: ST.atr[2] }} />{atrasadas.length} {atrasadas.length === 1 ? 'atraso' : 'atrasos'} de antes</span>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex rounded-[12px] bg-[#F4F4F5] p-1">
              {([
                ['hoje', `Hoje · ${deHoje.length}`],
                ['atr', `Atrasos · ${atrasadas.length}`],
              ] as const).map(([k, r]) => (
                <button key={k} type="button" onClick={() => setAbaHoje(k)} className={`rounded-[9px] px-3 py-1 text-[12.5px] font-bold ${abaHoje === k ? 'bg-white text-[#111113] shadow-sm' : 'text-[#636369]'}`}>
                  {r}
                </button>
              ))}
            </div>
            <a href="#entregas" className="text-[12.5px] font-extrabold hover:underline">Ver entregas →</a>
          </div>
          {gruposHoje.length === 0 ? (
            <span className="rounded-[12px] border border-dashed border-[#D6D6D9] px-3 py-3 text-center text-[12.5px] text-[#636369]">
              {abaHoje === 'hoje' ? 'Nada vence hoje.' : 'Nenhum atraso. Tudo em dia.'}
            </span>
          ) : (
            <div className="grid gap-2 sm:grid-cols-3">
              {gruposHoje.slice(0, 3).map((g) => {
                const t = g[0];
                const st: St = abaHoje === 'hoje' ? 'hoje' : 'atr';
                return (
                  <Link key={t.id} data-tarefa-id={t.id} href={destino(g.map((x) => ({ tarefaId: x.id, entregaId: x.entregaId })))} className="flex min-w-0 flex-col gap-1.5 rounded-[14px] border border-[#E9E9EB] p-2.5 hover:border-[#B4B4B9]">
                    <span className="flex min-w-0 flex-col items-start gap-1.5">
                      <Tag st={st} className="!min-w-0 !px-2">{abaHoje === 'hoje' ? 'Pra hoje' : `desde ${dm(g.map((x) => x.prazo!).sort()[0])}`}</Tag>
                      <b className="line-clamp-2 text-[13px] leading-tight">{t.titulo}</b>
                    </span>
                    <span className="truncate text-[11.5px] text-[#636369]">
                      {g.length > 1 ? `${g.length} posts` : t.postTitulo ?? 'tarefa'}
                      {t.pessoa ? ` · ${t.pessoa.split(' ')[0]}` : ''}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
          {gruposHoje.length > 3 && <span className="text-[11.5px] text-[#636369]">e mais {gruposHoje.length - 3} tipos de tarefa na lista abaixo</span>}
        </div>
      </section>

      {/* ---- calendário (vem pronto do servidor) */}
      {calendario}

      {/* ---- entregas pendentes */}
      <section id="entregas" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-[20px] font-extrabold tracking-[-0.01em]">Entregas pendentes</h2>
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-[#636369]">só deste projeto</span>
            <button
              type="button"
              onClick={() => setModal({ titulo: 'Mensagem geral', itens: itensCliente })}
              disabled={itensCliente.length === 0}
              className="rounded-[11px] border border-[#2E7D4F] bg-[#2E7D4F] px-3.5 py-2 text-[13px] font-extrabold text-white hover:bg-[#256641] disabled:opacity-30"
            >
              Mensagem geral ao cliente
            </button>
          </div>
        </div>
        {cards.length === 0 ? (
          <Vazio>Nenhuma entrega pendente neste projeto.</Vazio>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((c) => {
              const st = ST_DO_NIVEL[c.nivel];
              const [bg, fg] = ST[st];
              const n = {
                atr: c.itens.filter((i) => i.prazo && i.prazo < hojeIso).length,
                hoje: c.itens.filter((i) => i.prazo === hojeIso).length,
                cheg: c.itens.filter((i) => i.prazo && i.prazo > hojeIso && i.prazo <= somaDias(hojeIso, 7)).length,
                dep: c.itens.filter((i) => !i.prazo || i.prazo > somaDias(hojeIso, 7)).length,
              };
              const nomes = c.itens.map((i) => i.postTitulo).filter(Boolean);
              return (
                <div key={c.chave} className="flex flex-col gap-2.5 rounded-[18px] p-4" style={{ background: bg, color: fg }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-white px-2.5 py-[3px] text-[11px] font-extrabold">{ROT_NIVEL[c.nivel]}</span>
                    <span className="text-[12px] font-bold">{c.itens.length} {c.itens.length === 1 ? 'post' : 'posts'}</span>
                  </div>
                  <b className="text-[17px] leading-snug">{c.titulo}</b>
                  <span className="line-clamp-2 text-[12px]">
                    {nomes.length ? `"${nomes[0]}"${nomes.length > 1 ? ` e mais ${nomes.length - 1}` : ''} · ` : ''}
                    {c.sub}
                    {c.comCliente ? ` · ${rotuloCliente.toLowerCase()}` : ''}
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      ['ATRASO', n.atr],
                      ['HOJE', n.hoje],
                      ['CHEGANDO', n.cheg],
                    ].map(([r, v]) => (
                      <span key={r} className="flex flex-col rounded-[10px] bg-white/60 px-2.5 py-1.5">
                        <span className="text-[10px] font-extrabold tracking-[0.06em]">{r}</span>
                        <b className="text-[17px] leading-tight tabular-nums">{v}</b>
                      </span>
                    ))}
                  </div>
                  <div className="mt-auto flex flex-wrap justify-end gap-1.5">
                    {c.comCliente && (
                      <button type="button" onClick={() => lembrar(c)} className="rounded-[11px] border border-[#2E7D4F] bg-[#2E7D4F] px-3.5 py-2 text-[13px] font-extrabold text-white hover:bg-[#256641]">
                        Lembrar no grupo
                      </button>
                    )}
                    <Link href={destinoDoCard(c)} className="rounded-[11px] border border-[#111113] bg-[#111113] px-3.5 py-2 text-[13px] font-extrabold text-white hover:bg-[#2C2C30]">
                      Abrir entrega
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ---- tarefas */}
      <section className="flex flex-col gap-2 rounded-[20px] border border-[#E9E9EB] bg-white p-5">
        <div className="flex flex-col gap-0.5">
          <b className="text-[16px] font-bold">Tarefas</b>
          <span className="text-[12.5px] text-[#636369]">só deste projeto · concluir aqui marca no Notion</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[['', `Todos · ${pessoas.reduce((s, [, n]) => s + n, 0)}`] as const, ...pessoas.map(([p, n]) => [p, `${p.split(' ')[0]} · ${n}`] as const)].map(([k, r]) => (
            <button
              key={k || 'todos'}
              type="button"
              onClick={() => setPessoa(k)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-bold ${pessoa === k ? 'bg-[#111113] text-white' : 'border border-[#E9E9EB] text-[#46464B] hover:border-[#B4B4B9]'}`}
            >
              {r}
            </button>
          ))}
        </div>
        {erroTarefa && <p className="rounded-[10px] px-3 py-2 text-[12px]" style={{ background: ST.atr[0], color: ST.atr[1] }}>{erroTarefa}</p>}
        {secoes.every((s) => s.lista.length === 0) && depois.length === 0 && <Vazio>Nenhuma tarefa aberta.</Vazio>}
        {secoes
          .filter((s) => s.lista.length > 0)
          .map((s) => (
            <details key={s.rot} open={!s.feitas} className="group flex flex-col pt-2">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 pb-1 text-[11px] font-extrabold tracking-[0.08em] [&::-webkit-details-marker]:hidden" style={{ color: ST[s.st][1] }}>
                <span className="text-[9px] text-[#8A8A90] transition-transform group-open:rotate-90">▶</span>
                <span className="h-2 w-2 rounded-full" style={{ background: ST[s.st][2] }} />
                {s.rot} · {s.lista.length}
              </summary>
              {s.lista.map((t) => (
                <LinhaTarefa key={t.id} t={t} feita={s.feitas} />
              ))}
            </details>
          ))}
        {depois.length > 0 && (
          <div className="flex flex-col pt-2">
            <button type="button" onClick={() => setVerMais((v) => !v)} className="flex items-center gap-1.5 pb-1 text-left text-[11px] font-extrabold tracking-[0.08em] text-[#46464B]">
              <span className="h-2 w-2 rounded-full bg-[#B4B4B9]" />
              DEPOIS · {depois.length} {verMais ? '▴' : '▾'}
            </button>
            {verMais && depois.map((t) => <LinhaTarefa key={t.id} t={t} />)}
          </div>
        )}
      </section>

      {previa && <PreviaPostModal postId={previa.postId} tarefaId={previa.tarefaId} fechar={() => setPrevia(null)} />}
      {modal && (
        <ModalMensagem
          projetoId={projetoId}
          clienteNome={clienteNome}
          gruposWpp={gruposWpp}
          titulo={modal.titulo}
          itens={modal.itens}
          textos={textos}
          hojeIso={hojeIso}
          fechar={() => setModal(null)}
          aoEnviar={(nomeGrupo) => {
            setModal(null);
            setEnviadoPara(nomeGrupo ?? gruposWpp[0]?.nome ?? 'do cliente');
          }}
        />
      )}
    </>
  );
}
