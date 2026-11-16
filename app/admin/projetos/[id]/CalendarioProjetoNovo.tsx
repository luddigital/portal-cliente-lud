'use client';

/**
 * Calendário da página do projeto (proposta NOVA), com as visões Semana, Mês
 * e Lista no padrão do calendário da Dashboard. Trocar de mês ou semana busca
 * só os posts do mês que falta (/api/admin/projetos/[id]/posts). Clicar num
 * post abre a prévia (PreviaPostModal).
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { PostCalendario } from '@/lib/notion';
import { PreviaPostModal } from '../../aprovacoes/PreviaPostModal';
import { ST, Tag, Vazio, type St } from '../../_ui/lud';
import { statusDoPost } from './statusPost';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];

function somaDias(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const dow = (iso: string) => (new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7;
const chaveMes = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, '0')}`;

type Visao = 'semana' | 'mes' | 'lista';

export function CalendarioProjetoNovo({
  projetoId,
  ano,
  mes,
  postsIniciais,
  hojeIso,
}: {
  projetoId: string;
  ano: number;
  mes: number;
  postsIniciais: PostCalendario[];
  hojeIso: string;
}) {
  const [visao, setVisao] = useState<Visao>('semana');
  const [atual, setAtual] = useState({ ano, mes });
  const [semanaSeg, setSemanaSeg] = useState(() => somaDias(hojeIso, -dow(hojeIso)));
  const [porMes, setPorMes] = useState<Record<string, PostCalendario[]>>({ [chaveMes(ano, mes)]: postsIniciais });
  const [carregando, setCarregando] = useState(0);
  const [erro, setErro] = useState(false);
  const [previa, setPrevia] = useState<string | null>(null);

  async function garantirMes(a: number, m: number) {
    const k = chaveMes(a, m);
    if (porMes[k]) return;
    setCarregando((c) => c + 1);
    setErro(false);
    try {
      const r = await fetch(`/api/admin/projetos/${projetoId}/posts?mes=${k}`);
      if (!r.ok) throw new Error();
      const j = (await r.json()) as { posts: PostCalendario[] };
      setPorMes((s) => ({ ...s, [k]: j.posts }));
    } catch {
      setErro(true);
    } finally {
      setCarregando((c) => c - 1);
    }
  }

  // Semana pode cair em dois meses: busca os dois.
  const semana = useMemo(() => Array.from({ length: 7 }, (_, k) => somaDias(semanaSeg, k)), [semanaSeg]);
  useEffect(() => {
    if (visao !== 'semana') return;
    for (const d of [semana[0], semana[6]]) garantirMes(Number(d.slice(0, 4)), Number(d.slice(5, 7)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semana, visao]);
  useEffect(() => {
    if (visao === 'semana') return;
    garantirMes(atual.ano, atual.mes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atual, visao]);

  const todos = useMemo(() => Object.values(porMes).flat(), [porMes]);
  const doDia = (iso: string) => todos.filter((p) => p.data?.slice(0, 10) === iso);
  const doMes = (porMes[chaveMes(atual.ano, atual.mes)] ?? []).slice().sort((a, b) => a.data.localeCompare(b.data));

  function andar(delta: number) {
    if (visao === 'semana') setSemanaSeg((s) => somaDias(s, 7 * delta));
    else {
      const idx = atual.ano * 12 + (atual.mes - 1) + delta;
      setAtual({ ano: Math.floor(idx / 12), mes: (idx % 12) + 1 });
    }
  }
  function voltarHoje() {
    setSemanaSeg(somaDias(hojeIso, -dow(hojeIso)));
    setAtual({ ano: Number(hojeIso.slice(0, 4)), mes: Number(hojeIso.slice(5, 7)) });
  }

  const rotulo =
    visao === 'semana'
      ? `${Number(semana[0].slice(8))} a ${Number(semana[6].slice(8))} de ${MESES[Number(semana[6].slice(5, 7)) - 1]}`
      : `${MESES[atual.mes - 1]} ${atual.ano}`;
  const nPosts = visao === 'semana' ? semana.reduce((s, d) => s + doDia(d).length, 0) : doMes.length;

  function Chip({ p, curto = false }: { p: PostCalendario; curto?: boolean }) {
    const { rotulo: r, st } = statusDoPost(p);
    return (
      <button
        type="button"
        onClick={() => setPrevia(p.id)}
        title={`${p.titulo} · ${r}`}
        className="flex w-full min-w-0 flex-col gap-0.5 rounded-[10px] p-1.5 text-left"
        style={{ background: ST[st][0], color: ST[st][1] }}
      >
        <b className={`${curto ? 'truncate text-[10.5px]' : 'line-clamp-2 text-[12px]'} leading-tight`}>{p.titulo}</b>
        {!curto && <span className="text-[10.5px] font-bold">{r}</span>}
      </button>
    );
  }

  const legenda: [St, string][] = [
    ['ok', 'postado'],
    ['info', 'programado ou conferir'],
    ['cli', 'com o cliente'],
    ['atr', 'em alteração'],
    ['cheg', 'em produção'],
  ];

  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-[20px] border border-[#E9E9EB] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <b className="text-[16px] font-bold">Calendário</b>
          <button type="button" aria-label="Anterior" onClick={() => andar(-1)} className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-[#E9E9EB] text-[15px] font-bold hover:bg-[#F4F4F5]">‹</button>
          <button type="button" onClick={voltarHoje} className="text-[13.5px] font-bold capitalize text-[#46464B] hover:text-[#111113]" title="Voltar pra hoje">
            {rotulo} · {nPosts} {nPosts === 1 ? 'post' : 'posts'}
          </button>
          <button type="button" aria-label="Próximo" onClick={() => andar(1)} className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-[#E9E9EB] text-[15px] font-bold hover:bg-[#F4F4F5]">›</button>
          {carregando > 0 && <span className="text-[12px] text-[#8A8A90]">carregando…</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-[12px] bg-[#F4F4F5] p-1">
            {([
              ['semana', 'Semana'],
              ['mes', 'Mês'],
              ['lista', 'Lista'],
            ] as const).map(([k, r]) => (
              <button
                key={k}
                type="button"
                onClick={() => setVisao(k)}
                className={`rounded-[9px] px-3 py-1.5 text-[12.5px] font-bold ${visao === k ? 'bg-white text-[#111113] shadow-sm' : 'text-[#636369]'}`}
              >
                {r}
              </button>
            ))}
          </div>
          <Link href={`/admin/projetos/${projetoId}/calendario-workspace`} className="rounded-[11px] border border-[#D6D6D9] bg-white px-3 py-1.5 text-[12.5px] font-extrabold hover:bg-[#F4F4F5]">
            + Criar calendário
          </Link>
        </div>
      </div>

      {erro && <p className="rounded-[10px] px-3 py-2 text-[12px]" style={{ background: ST.atr[0], color: ST.atr[1] }}>Não consegui carregar esse período. Tente de novo.</p>}

      <div className={carregando > 0 ? 'opacity-60 transition' : 'transition'}>
        {visao === 'semana' && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
            {semana.map((d, k) => {
              const ehHoje = d === hojeIso;
              const lista = doDia(d);
              return (
                <div key={d} className={`flex min-h-[150px] min-w-0 flex-col gap-1.5 rounded-[14px] border-2 p-2 ${ehHoje ? 'border-[#111113] bg-white' : 'border-[#E9E9EB] bg-[#FAFAFA]'}`}>
                  <div className="flex justify-between">
                    <span className={`text-[12px] font-extrabold ${ehHoje ? 'text-[#111113]' : 'text-[#636369]'}`}>{ehHoje ? 'HOJE' : DIAS[k]}</span>
                    <b className="text-[16px]">{Number(d.slice(8))}</b>
                  </div>
                  {lista.length === 0 && <span className="text-[11.5px] text-[#8A8A90]">sem post</span>}
                  {lista.map((p) => (
                    <Chip key={p.id} p={p} />
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {visao === 'mes' && (
          <div className="overflow-x-auto min-h-fit">
            <div className="grid min-w-[640px] grid-cols-7 gap-1.5">
              {DIAS.map((d) => (
                <span key={d} className="px-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#636369]">{d}</span>
              ))}
              {Array.from({ length: dow(`${chaveMes(atual.ano, atual.mes)}-01`) }, (_, i) => (
                <span key={`v${i}`} />
              ))}
              {Array.from({ length: new Date(Date.UTC(atual.ano, atual.mes, 0)).getUTCDate() }, (_, i) => {
                const d = `${chaveMes(atual.ano, atual.mes)}-${String(i + 1).padStart(2, '0')}`;
                const ehHoje = d === hojeIso;
                const lista = doDia(d);
                return (
                  <div key={d} className={`flex min-h-[92px] min-w-0 flex-col gap-1 rounded-[10px] border p-1.5 ${ehHoje ? 'border-2 border-[#111113] bg-white' : 'border-[#E9E9EB] bg-[#FAFAFA]'}`}>
                    <b className="text-[12px]">{i + 1}{ehHoje && ' · HOJE'}</b>
                    {lista.slice(0, 3).map((p) => (
                      <Chip key={p.id} p={p} curto />
                    ))}
                    {lista.length > 3 && <span className="text-[10.5px] font-bold text-[#636369]">+{lista.length - 3}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {visao === 'lista' && (
          <div className="flex flex-col">
            {doMes.length === 0 && <Vazio>Nenhum post nesse mês.</Vazio>}
            {doMes.map((p) => {
              const iso = p.data.slice(0, 10);
              const { rotulo: r, st } = statusDoPost(p);
              const passado = iso < hojeIso;
              return (
                <button key={p.id} type="button" onClick={() => setPrevia(p.id)} className="flex items-center gap-3 border-t border-[#F4F4F5] py-2.5 text-left first:border-t-0">
                  <span className={`w-[52px] shrink-0 text-[13px] font-extrabold ${passado ? 'text-[#8A8A90]' : ''}`}>{iso.slice(8)}/{iso.slice(5, 7)}</span>
                  <span className="w-[34px] shrink-0 text-[12px] font-bold text-[#636369]">{iso === hojeIso ? 'HOJE' : DIAS[dow(iso)]}</span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold">{p.titulo}</span>
                  <span className="hidden w-[90px] truncate text-[12px] text-[#636369] sm:block">{p.formatoNome ?? (p.tipo === 'reels' ? 'Reels' : p.tipo === 'story' ? 'Story' : 'Post')}</span>
                  <Tag st={st} className="max-w-[160px] truncate">{r}</Tag>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3.5 text-[12px] text-[#46464B]">
        {legenda.map(([st, t]) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: ST[st][2] }} />
            {t}
          </span>
        ))}
      </div>
      {previa && <PreviaPostModal postId={previa} fechar={() => setPrevia(null)} />}
    </section>
  );
}
