'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { rotas } from '@/lib/rotas';

export type DiaPauta = { data: string; postId: string | null; comTema: boolean; titulo: string | null; formato: string | null };
type Opcao = { id: string; nome: string };

const SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const ETAPAS = ['Pauta', 'Briefing e copy', 'Materiais', 'Arte', 'Aprovação', 'Programar'];
const diaSemana = (iso: string) => SEM[new Date(iso + 'T12:00:00Z').getUTCDay()];
const dm = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}`;
const INP = 'w-full rounded-[12px] border border-[#D6D6D9] bg-white px-3.5 py-2.5 text-[14px] text-[#111113] outline-none focus:border-[#111113]';
const LAB = 'text-[12px] font-extrabold text-[#46464B]';

/** Chips de escolha única (Formato, Funil, Objetivo). */
function Chips({ opcoes, valor, onTroca }: { opcoes: Opcao[]; valor: string | null; onTroca: (id: string | null) => void }) {
  if (opcoes.length === 0) return <span className="text-[12.5px] text-[#8A8A90]">sem opções no Notion</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {opcoes.map((o) => {
        const ativo = o.id === valor;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onTroca(ativo ? null : o.id)}
            className={`inline-flex h-[34px] items-center rounded-[10px] border px-3 text-[13px] font-bold ${
              ativo ? 'border-[#111113] bg-[#111113] text-white' : 'border-[#D6D6D9] bg-white text-[#46464B] hover:border-[#B4B4B9]'
            }`}
          >
            {o.nome}
          </button>
        );
      })}
    </span>
  );
}

export function NovaPautaForm({
  projetoId,
  projetoCurto,
  hoje,
  ano,
  mes,
  dias,
  postsPorMes,
  temDiasFixos,
  objetivosPorFunil,
  postIdInicial,
  dataInicial,
  horario,
  mix,
  formatos,
  funis,
  objetivos,
  demandas,
}: {
  projetoId: string;
  projetoCurto: string;
  hoje: string;
  ano: number;
  mes: number;
  dias: DiaPauta[];
  postsPorMes: number | null;
  temDiasFixos: boolean;
  objetivosPorFunil: Record<string, string[]>;
  postIdInicial: string | null;
  dataInicial: string | null;
  horario: string | null;
  mix: { formato: string | null }[];
  formatos: Opcao[];
  funis: Opcao[];
  objetivos: Opcao[];
  demandas: string[];
}) {
  const router = useRouter();
  const [data, setData] = useState<string | null>(dataInicial);
  const [postId, setPostId] = useState<string | null>(postIdInicial);
  const [titulo, setTitulo] = useState('');
  const [formatoId, setFormatoId] = useState<string | null>(null);
  const [funilId, setFunilId] = useState<string | null>(null);
  const [objetivoId, setObjetivoId] = useState<string | null>(null);
  const [demanda, setDemanda] = useState<string>('');
  const [ideia, setIdeia] = useState('');
  const [referencia, setReferencia] = useState('');
  const [verTodos, setVerTodos] = useState(false);
  const [salvando, setSalvando] = useState<null | 'uma' | 'proxima'>(null);
  const [erro, setErro] = useState<string | null>(null);

  const comTema = dias.filter((d) => d.comTema).length;
  // Total do mês: o combinado (posts por mês) quando preenchido; senão os dias que aparecem.
  const total = postsPorMes ?? dias.length;
  const semTraco = (x: string) => x.replace(/-/g, '');
  const objetivosVisiveis = funilId && objetivosPorFunil[semTraco(funilId)]
    ? objetivos.filter((o) => objetivosPorFunil[semTraco(funilId)].includes(semTraco(o.id)) || o.id === objetivoId)
    : objetivos;
  const mesVizinho = (soma: number) => {
    const d = new Date(Date.UTC(ano, mes - 1 + soma, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  };
  const visiveis = verTodos ? dias : dias.filter((d) => d.data >= hoje || d.data === data).slice(0, 7);
  const proximaLivre = dias.find((d) => !d.comTema && d.data !== data && (!data || d.data > data)) ?? null;
  const formatoNome = formatos.find((f) => f.id === formatoId)?.nome ?? null;
  const funilNome = funis.find((f) => f.id === funilId)?.nome ?? null;

  // Mix do mês contando esta pauta.
  const mixFormato = useMemo(() => {
    if (!formatoNome) return null;
    const antes = mix.filter((m) => (m.formato ?? '').toLowerCase() === formatoNome.toLowerCase()).length;
    return { nome: formatoNome, antes, depois: antes + 1 };
  }, [mix, formatoNome]);

  function escolherDia(d: DiaPauta) {
    setData(d.data);
    setPostId(d.comTema ? null : d.postId);
  }

  async function salvar(modo: 'uma' | 'proxima') {
    setErro(null);
    if (!data) return setErro('Escolha o dia do post.');
    if (!titulo.trim()) return setErro('Escreva o tema.');
    setSalvando(modo);
    try {
      const r = await fetch('/api/admin/pauta/criar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projetoId,
          postId,
          data,
          titulo: titulo.trim(),
          formatoId,
          funilId,
          objetivoId,
          demanda: demanda || null,
          ideia,
          referencia,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? `Erro ${r.status}`);
      if (modo === 'proxima' && proximaLivre) {
        router.push(rotas.novaPauta(projetoId, proximaLivre.data));
        router.refresh();
        // limpa o formulário pro próximo dia
        setTitulo('');
        setIdeia('');
        setReferencia('');
        setFormatoId(null);
        setFunilId(null);
        setObjetivoId(null);
        setDemanda('');
        setData(proximaLivre.data);
        setPostId(proximaLivre.postId);
      } else {
        router.push(rotas.projeto(projetoId));
      }
    } catch (e: any) {
      setErro(e?.message ?? 'Não deu pra salvar.');
    } finally {
      setSalvando(null);
    }
  }

  // Mini calendário (semana começando na segunda).
  const primeiro = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const offset = (new Date(primeiro + 'T12:00:00Z').getUTCDay() + 6) % 7;
  const nDias = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const porData = new Map(dias.map((d) => [d.data, d]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-bold text-[#636369]">
            Passo 1 de 6 · {projetoCurto} · pautas de {MESES[mes - 1]}
          </span>
          <h1 className="text-[30px] font-extrabold leading-tight tracking-[-0.02em]">Nova pauta</h1>
        </div>
        {total > 0 && (
          <span className="inline-flex h-[30px] items-center rounded-full bg-[#F4F4F5] px-3 text-[12.5px] font-bold" title={postsPorMes != null ? 'combinado: posts por mês' : undefined}>
            {comTema} de {total} pautas de {MESES[mes - 1]} com tema
          </span>
        )}
      </div>

      {/* etapas do post */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-[20px] border border-[#E9E9EB] bg-white px-5 py-4">
        {ETAPAS.map((e, k) => (
          <span key={e} className="contents">
            <span className="flex shrink-0 items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-extrabold ${
                  k === 0 ? 'bg-[#111113] text-white' : 'bg-[#F4F4F5] text-[#8A8A90]'
                }`}
              >
                {k + 1}
              </span>
              <span className={`text-[13px] ${k === 0 ? 'font-extrabold' : 'font-semibold text-[#8A8A90]'}`}>{e}</span>
            </span>
            {k < ETAPAS.length - 1 && <span className="hidden h-[2px] min-w-3 flex-1 bg-[#E9E9EB] sm:block" />}
          </span>
        ))}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-3.5">
          <section className="flex min-w-0 flex-col gap-[18px] rounded-[20px] border border-[#E9E9EB] bg-white p-[22px]">
            <b className="text-[17px]">O que é esse post</b>

            <div className="flex flex-col gap-1.5">
              <span className={LAB}>Dia do post</span>
              {dias.length > 0 ? (
                <span className="flex flex-wrap items-center gap-2">
                  {visiveis.map((d) => {
                    const ativo = d.data === data;
                    return (
                      <button
                        key={d.data}
                        type="button"
                        onClick={() => escolherDia(d)}
                        title={d.comTema ? `Já tem tema: ${d.titulo ?? ''}` : 'Dia livre'}
                        className={`flex w-[58px] flex-col items-center gap-px rounded-[12px] py-[7px] ${
                          ativo
                            ? 'bg-[#111113] text-white'
                            : d.comTema
                              ? 'bg-[#D8EDCF] text-[#2E5520]'
                              : 'border border-[#D6D6D9] bg-white text-[#111113] hover:border-[#B4B4B9]'
                        }`}
                      >
                        <span className="text-[10.5px] font-bold opacity-80">{diaSemana(d.data)}</span>
                        <b className="text-[16px] leading-none">{d.data.slice(8)}</b>
                        <span className="text-[9.5px] font-bold opacity-80">{ativo ? 'esta' : d.comTema ? 'com tema' : 'livre'}</span>
                      </button>
                    );
                  })}
                  {!verTodos && dias.length > visiveis.length && (
                    <button type="button" onClick={() => setVerTodos(true)} className="text-[12.5px] font-bold text-[#46464B] hover:text-[#111113]">
                      + {dias.length - visiveis.length} dias ▾
                    </button>
                  )}
                  <label className="flex items-center gap-1.5 text-[12.5px] text-[#636369]">
                    ou outro dia
                    <input
                      type="date"
                      value={data && !porData.has(data) ? data : ''}
                      onChange={(e) => {
                        setData(e.target.value || null);
                        setPostId(null);
                      }}
                      className="rounded-[8px] border border-[#D6D6D9] px-2 py-1 text-[12.5px]"
                    />
                  </label>
                </span>
              ) : (
                <input
                  type="date"
                  value={data ?? ''}
                  onChange={(e) => {
                    setData(e.target.value || null);
                    setPostId(null);
                  }}
                  className={`${INP} max-w-[220px]`}
                />
              )}
              <span className="text-[11.5px] text-[#8A8A90]">
                {temDiasFixos
                  ? 'os dias fixos combinados e os que já têm post no mês'
                  : dias.length > 0
                    ? 'os dias que já têm post no calendário do mês (preencha os dias fixos no Editar projeto)'
                    : 'esse mês ainda não tem dias de post no calendário'}
                {horario ? ` · sempre às ${horario} (horário de Brasília)` : ''}
                {postId ? ' · vai preencher o post que já existe nesse dia' : data ? ' · vai criar um post novo nesse dia' : ''}
              </span>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className={LAB}>Tema</span>
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Natal em NY: as vitrines que valem a caminhada" className={`${INP} font-bold`} />
              <span className="text-[11.5px] text-[#8A8A90]">é o título que a cliente vê na aprovação da pauta</span>
            </label>

            <div className="flex flex-col gap-1.5">
              <span className={LAB}>Formato</span>
              <Chips opcoes={formatos} valor={formatoId} onTroca={setFormatoId} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <span className={LAB}>Funil</span>
                <Chips opcoes={funis} valor={funilId} onTroca={setFunilId} />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className={LAB}>Objetivo</span>
                <Chips opcoes={objetivosVisiveis} valor={objetivoId} onTroca={setObjetivoId} />
              </div>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className={LAB}>Tipo de conteúdo</span>
              <select value={demanda} onChange={(e) => setDemanda(e.target.value)} className={INP}>
                <option value="">Escolher…</option>
                {demandas.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={LAB}>Ideia do post</span>
              <textarea value={ideia} onChange={(e) => setIdeia(e.target.value)} rows={4} className={`${INP} leading-[1.5]`} placeholder="O que precisa ficar claro pra quem vai escrever o briefing" />
              <span className="text-[11.5px] text-[#8A8A90]">o que precisa ficar claro pra quem vai escrever o briefing</span>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={LAB}>Referências</span>
              <input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Cole um link do Instagram, TikTok ou Drive" className={INP} />
            </label>
          </section>

          {erro && <p className="rounded-[10px] bg-[#F6CFCB] px-3 py-2 text-[13px] font-bold text-[#7E211C]">{erro}</p>}

          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
            <button type="button" onClick={() => router.back()} className="text-[13px] font-bold text-[#636369] hover:text-[#111113]">
              Cancelar
            </button>
            <span className="flex flex-wrap gap-2">
              {proximaLivre && (
                <button
                  type="button"
                  disabled={!!salvando}
                  onClick={() => salvar('proxima')}
                  className="rounded-[12px] border border-[#D6D6D9] bg-white px-4 py-2.5 text-[13.5px] font-extrabold hover:bg-[#F4F4F5] disabled:opacity-50"
                >
                  {salvando === 'proxima' ? 'Salvando…' : `Criar e fazer a próxima (${diaSemana(proximaLivre.data)}, ${dm(proximaLivre.data)})`}
                </button>
              )}
              <button
                type="button"
                disabled={!!salvando}
                onClick={() => salvar('uma')}
                className="rounded-[12px] bg-[#111113] px-4 py-2.5 text-[13.5px] font-extrabold text-white hover:bg-[#2C2C30] disabled:opacity-50"
              >
                {salvando === 'uma' ? 'Salvando…' : 'Criar pauta'}
              </button>
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-3 rounded-[20px] border border-[#E9E9EB] bg-white p-[22px]">
            <b className="text-[16px]">Como fica no calendário</b>
            <div className="overflow-hidden rounded-[12px] bg-[#F4F4F5]">
              <span className="flex flex-col gap-[3px] px-3 py-2.5">
                <b className="text-[13px] leading-[1.3]">{titulo.trim() || 'Tema da pauta'}</b>
                <span className="text-[11px] font-bold text-[#46464B]">
                  Pauta{data ? ` · ${diaSemana(data)}, ${dm(data)}` : ''}
                  {formatoNome ? ` · ${formatoNome}` : ''}
                </span>
              </span>
              <span className="flex items-center gap-1.5 bg-[rgba(17,17,19,0.06)] px-3 py-[5px]">
                <span className="flex h-[14px] w-[14px] items-center justify-center rounded-full bg-[#111113] text-[8px] font-extrabold text-white">
                  {projetoCurto.replace(/^@/, '').charAt(0).toUpperCase()}
                </span>
                <span className="truncate text-[11px] font-semibold">{projetoCurto}</span>
              </span>
            </div>
          </section>

          <section className="flex flex-col gap-2.5 rounded-[20px] border border-[#E9E9EB] bg-white p-[22px]">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Mês anterior"
                  onClick={() => router.push(`${rotas.novaPauta(projetoId)}?mes=${mesVizinho(-1)}`)}
                  className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[14px] font-extrabold text-[#46464B] hover:bg-[#F4F4F5]"
                >
                  ‹
                </button>
                <b className="text-[16px] capitalize">{MESES[mes - 1]}</b>
                <button
                  type="button"
                  aria-label="Próximo mês"
                  onClick={() => router.push(`${rotas.novaPauta(projetoId)}?mes=${mesVizinho(1)}`)}
                  className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[14px] font-extrabold text-[#46464B] hover:bg-[#F4F4F5]"
                >
                  ›
                </button>
              </span>
              {total > 0 && (
                <span className="text-[12px] text-[#636369]">
                  {comTema} de {total} com tema
                </span>
              )}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((s, i) => (
                <span key={i} className="text-center text-[9.5px] font-extrabold text-[#8A8A90]">
                  {s}
                </span>
              ))}
              {Array.from({ length: offset }).map((_, i) => (
                <span key={`v${i}`} />
              ))}
              {Array.from({ length: nDias }).map((_, i) => {
                const iso = `${ano}-${String(mes).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
                const d = porData.get(iso);
                const ativo = iso === data;
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={!d}
                    onClick={() => d && escolherDia(d)}
                    className={`flex aspect-square items-center justify-center rounded-[6px] text-[10px] font-extrabold ${
                      ativo
                        ? 'bg-[#111113] text-white'
                        : d?.comTema
                          ? 'bg-[#D8EDCF] text-[#2E5520]'
                          : d
                            ? 'border-[1.5px] border-dashed border-[#B4B4B9] bg-white text-[#46464B]'
                            : 'text-[#B4B4B9]'
                    }`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <span className="flex flex-wrap gap-2.5 text-[11px] text-[#46464B]">
              <span>■ esta</span>
              <span className="text-[#2E5520]">■ com tema</span>
              <span>⬚ livre</span>
            </span>
          </section>

          <section className="flex flex-col gap-2 rounded-[20px] border border-[#E9E9EB] bg-white p-[22px]">
            <b className="text-[16px]">Mix do mês</b>
            {mixFormato ? (
              <span className="flex justify-between text-[13px]">
                <span>{mixFormato.nome}</span>
                <b>
                  {mixFormato.antes} → {mixFormato.depois}
                </b>
              </span>
            ) : (
              <span className="text-[12.5px] text-[#636369]">Escolha o formato pra ver como fica o mês.</span>
            )}
            {funilNome && <span className="text-[13px]">Funil: <b>{funilNome}</b></span>}
            <span className="text-[11.5px] text-[#636369]">{mix.length} pautas com tema no mês, contando sem esta</span>
          </section>
        </div>
      </div>
    </div>
  );
}
