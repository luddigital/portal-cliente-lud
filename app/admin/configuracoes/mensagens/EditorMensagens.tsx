'use client';

import { useEffect, useMemo, useRef, useState, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ETAPAS,
  PADRAO,
  SITUACOES,
  VARIAVEIS,
  hojeEmSaoPaulo,
  montarLembrete,
  somarDias,
  type EtapaLembrete,
  type SituacaoLembrete,
} from '@/lib/lembrete-aprovacao';
import {
  MOMENTOS_REGUA,
  PADRAO_REGUA,
  VARIANTES_REGUA,
  VARIAVEIS_REGUA,
  chaveRegua,
  montarMensagemRegua,
  type MomentoRegua,
  type VarianteRegua,
} from '@/lib/regua-mensagens';

const BORDA = 'border-[rgba(21,21,33,0.09)]';
const TODOS: Record<string, string> = { ...PADRAO, ...PADRAO_REGUA };

const ESTRUTURA = [
  { nome: 'Saudação', origem: 'Início e fim' },
  { nome: 'Abertura + título do post em negrito', origem: 'Por etapa' },
  { nome: 'Linha do prazo', origem: 'Por situação do prazo (some se ficar vazia)' },
  { nome: 'Chamada + link do post', origem: 'Por etapa' },
  { nome: 'Regra', origem: 'Por etapa (some se ficar vazia)' },
  { nome: 'Fechamento', origem: 'Início e fim' },
];

const CAMPOS_ETAPA = [
  { campo: 'abertura', label: 'Abertura', dica: 'Vem logo depois da saudação, antes do título do post.' },
  { campo: 'acao', label: 'Chamada', dica: 'O link do post entra na linha de baixo.' },
  { campo: 'regra', label: 'Regra', dica: 'Lembrete da regra do Onboarding. Pode deixar vazio.' },
  { campo: 'verbo', label: 'Verbo', dica: 'Usado em {verbo} nas linhas de prazo vencido.' },
] as const;

function datasExemplo(s: SituacaoLembrete, hoje: string): { prazo: string | null; postData: string | null } {
  switch (s) {
    case 'no_prazo':
      return { prazo: somarDias(hoje, 4), postData: somarDias(hoje, 14) };
    case 'vence_amanha':
      return { prazo: somarDias(hoje, 1), postData: somarDias(hoje, 10) };
    case 'vence_hoje':
      return { prazo: hoje, postData: somarDias(hoje, 10) };
    case 'vencido':
      return { prazo: somarDias(hoje, -4), postData: somarDias(hoje, 10) };
    case 'data_passou':
      return { prazo: somarDias(hoje, -6), postData: somarDias(hoje, -1) };
    case 'sem_prazo':
      return { prazo: null, postData: somarDias(hoje, 10) };
  }
}

function TextoWhatsapp({ texto }: { texto: string }) {
  const partes = texto.split(/(\*[^*\n]+\*)/g);
  return (
    <>
      {partes.map((p, i) =>
        /^\*[^*\n]+\*$/.test(p) ? <strong key={i}>{p.slice(1, -1)}</strong> : <span key={i}>{p}</span>,
      )}
    </>
  );
}

export function EditorMensagens({ editadas }: { editadas: Record<string, string> }) {
  const router = useRouter();
  const inicial = useMemo(() => ({ ...TODOS, ...editadas }), [editadas]);
  const [aba, setAba] = useState<'regua' | 'lembrete'>('regua');
  const [momentoR, setMomentoR] = useState<MomentoRegua>('sexta');
  const [varianteR, setVarianteR] = useState<VarianteRegua>('viu');
  const [textos, setTextos] = useState<Record<string, string>>(inicial);
  const [salvos, setSalvos] = useState<Record<string, string>>(inicial);
  const [etapa, setEtapa] = useState<EtapaLembrete>('post');
  const [situacao, setSituacao] = useState<SituacaoLembrete>('vencido');
  const [apelido, setApelido] = useState('Re');
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const focoRef = useRef<{ chave: string; el: HTMLTextAreaElement | HTMLInputElement } | null>(null);

  const alteradas = Object.keys(TODOS).filter((k) => textos[k] !== salvos[k]);

  useEffect(() => {
    if (alteradas.length === 0) return;
    const onBefore = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBefore);
    return () => window.removeEventListener('beforeunload', onBefore);
  }, [alteradas.length]);

  const hoje = hojeEmSaoPaulo();
  const exemplo = datasExemplo(situacao, hoje);
  const previa = montarLembrete({
    apelido: apelido || 'cliente',
    tarefaTitulo: '',
    postTitulo: 'Título do post',
    prazo: exemplo.prazo,
    postData: exemplo.postData,
    link: 'https://portal-cliente-lud.vercel.app/post/…',
    textos,
    hoje,
    forcarEtapa: etapa,
  });
  const etapaInfo = ETAPAS.find((e) => e.id === etapa)!;
  const situacaoInfo = SITUACOES.find((s) => s.id === situacao)!;

  function mudar(chave: string, valor: string) {
    setTextos((t) => ({ ...t, [chave]: valor }));
    setAviso(null);
  }

  function inserirVariavel(nome: string) {
    const foco = focoRef.current;
    if (!foco) return;
    const { chave, el } = foco;
    const ini = el.selectionStart ?? el.value.length;
    const fim = el.selectionEnd ?? el.value.length;
    const novo = el.value.slice(0, ini) + nome + el.value.slice(fim);
    mudar(chave, novo);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(ini + nome.length, ini + nome.length);
    });
  }

  async function salvar() {
    setSalvando(true);
    setAviso(null);
    const payload: Record<string, string | null> = {};
    for (const k of alteradas) payload[k] = textos[k] === TODOS[k] ? null : textos[k];
    try {
      const res = await fetch('/api/admin/mensagens-padrao', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ textos: payload }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `Erro ${res.status}`);
      setSalvos(textos);
      setAviso({ tipo: 'ok', texto: 'Salvo. Os próximos lembretes já usam esse texto.' });
      startTransition(() => router.refresh());
    } catch (e: any) {
      setAviso({ tipo: 'erro', texto: e?.message ?? 'erro ao salvar' });
    } finally {
      setSalvando(false);
    }
  }

  function Campo({
    chave,
    label,
    dica,
    linhas = 2,
    curto = false,
    aoFocar,
  }: {
    chave: string;
    label: string;
    dica?: string;
    linhas?: number;
    curto?: boolean;
    aoFocar?: () => void;
  }) {
    const valor = textos[chave] ?? '';
    const difereDoPadrao = valor !== TODOS[chave];
    const naoSalvo = valor !== salvos[chave];
    const comum = {
      value: valor,
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) =>
        mudar(chave, e.target.value),
      onFocus: (e: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        focoRef.current = { chave, el: e.currentTarget };
        aoFocar?.();
      },
      onSelect: (e: React.SyntheticEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        focoRef.current = { chave, el: e.currentTarget };
      },
      className: `w-full rounded-lg border ${BORDA} bg-white px-3 py-2 text-[13px] leading-[1.5] text-ink outline-none focus:border-[rgba(21,21,33,0.35)]`,
    };
    return (
      <div>
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.07em] text-t2">
            {label}
            {naoSalvo && <span className="ml-1.5 normal-case tracking-normal text-t3">· não salvo</span>}
          </label>
          {difereDoPadrao && (
            <button
              type="button"
              onClick={() => mudar(chave, TODOS[chave])}
              className="text-[11px] text-t3 underline hover:text-ink"
            >
              restaurar padrão
            </button>
          )}
        </div>
        {curto ? (
          <input {...comum} className={`${comum.className} max-w-[220px]`} />
        ) : (
          <textarea {...comum} rows={linhas} className={`${comum.className} resize-y`} />
        )}
        {dica && <p className="mt-1 text-[11px] text-t3">{dica}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-ink">Mensagens padrão</h1>
          <p className="text-[13px] text-t3">
            Textos que o portal manda nos grupos dos clientes. Sempre no grupo, nunca no privado, e
            dá pra editar cada mensagem antes de enviar.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {aviso && (
            <span className={`text-[12px] ${aviso.tipo === 'erro' ? 'font-semibold text-ink' : 'text-t3'}`}>
              {aviso.texto}
            </span>
          )}
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || alteradas.length === 0}
            className="rounded-full bg-ink px-5 py-2 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-30"
          >
            {salvando
              ? 'Salvando…'
              : alteradas.length > 0
                ? `Salvar ${alteradas.length} ${alteradas.length === 1 ? 'alteração' : 'alterações'}`
                : 'Salvo'}
          </button>
        </div>
      </header>

      <div className="flex flex-wrap gap-1 border-b border-[rgba(21,21,33,0.08)]">
        {(
          [
            ['regua', 'Régua da semana', 'Usada na página Régua da semana'],
            ['lembrete', 'Lembrete avulso', 'Botão 📱 lembrar em Aprovações'],
          ] as const
        ).map(([id, nome, sub]) => (
          <button
            key={id}
            type="button"
            onClick={() => setAba(id)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-left transition ${
              aba === id ? 'border-ink' : 'border-transparent hover:border-[rgba(21,21,33,0.2)]'
            }`}
          >
            <div className={`text-[13px] ${aba === id ? 'font-semibold text-ink' : 'text-t2'}`}>{nome}</div>
            <div className="text-[11px] text-t3">{sub}</div>
          </button>
        ))}
      </div>

      {aba === 'regua' && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <section className={`rounded-xl border ${BORDA} bg-white p-5`}>
              <h2 className="text-[14px] font-semibold text-ink">Como a régua funciona</h2>
              <p className="mt-1 text-[12.5px] leading-[1.55] text-t2">
                Cada semana gira em torno da quinta do envio. O lote só sai pro cliente com todos os
                posts da semana com a Aprovação | Arte concluída. Depois, quem não aprovou recebe
                lembretes na sexta, na segunda (manhã e tarde) e na terça, quando o prazo venceu. A
                mensagem muda se o cliente já abriu os posts no portal (viu) ou não.
              </p>
              <div className="mt-4 border-t border-[rgba(21,21,33,0.06)] pt-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.07em] text-t2">
                  Variáveis
                </div>
                <p className="mt-0.5 text-[11px] text-t3">
                  Clica num campo e depois na variável pra inserir. *texto* fica em negrito no WhatsApp.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {VARIAVEIS_REGUA.map((v) => (
                    <button
                      key={v.nome}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => inserirVariavel(v.nome)}
                      title={v.descricao}
                      className={`rounded-md border ${BORDA} bg-[rgba(55,53,47,0.03)] px-2 py-1 font-mono text-[11px] text-ink transition hover:bg-[rgba(55,53,47,0.08)]`}
                    >
                      {v.nome}
                      <span className="ml-1.5 font-sans text-t3">{v.descricao}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {MOMENTOS_REGUA.map((m) => (
              <section key={m.id} className={`rounded-xl border ${BORDA} bg-white p-5`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-[14px] font-semibold text-ink">
                    {m.dia} · {m.nome}
                  </h2>
                  {momentoR === m.id && <span className="text-[11px] text-t3">na prévia</span>}
                </div>
                <div className="mt-2 rounded-lg bg-[rgba(55,53,47,0.04)] px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">Quando</div>
                  <div className="mt-0.5 text-[12.5px] text-ink">{m.quando}</div>
                </div>
                <div className="mt-4 space-y-4">
                  {m.variantes.map((v) => (
                    <div key={v}>
                      {m.variantes.length > 1 && (
                        <div className="mb-1.5 text-[12px] text-t2">
                          <span className="font-semibold text-ink">{VARIANTES_REGUA[v].nome}:</span>{' '}
                          {VARIANTES_REGUA[v].condicao}
                        </div>
                      )}
                      {Campo({
                        chave: chaveRegua(m.id, v),
                        label: 'Texto',
                        linhas: 7,
                        aoFocar: () => {
                          setMomentoR(m.id);
                          setVarianteR(v);
                        },
                      })}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className={`rounded-xl border ${BORDA} bg-white p-5`}>
              <h2 className="text-[14px] font-semibold text-ink">Prévia</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="text-[11px] text-t3">
                  Momento
                  <select
                    value={momentoR}
                    onChange={(e) => {
                      const novo = e.target.value as MomentoRegua;
                      setMomentoR(novo);
                      setVarianteR(novo === 'quinta' ? 'unica' : varianteR === 'unica' ? 'viu' : varianteR);
                    }}
                    className={`mt-1 w-full rounded-md border ${BORDA} bg-white px-2 py-1.5 text-[12px] text-ink`}
                  >
                    {MOMENTOS_REGUA.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.dia} · {m.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[11px] text-t3">
                  Situação
                  <select
                    value={varianteR}
                    onChange={(e) => setVarianteR(e.target.value as VarianteRegua)}
                    disabled={momentoR === 'quinta'}
                    className={`mt-1 w-full rounded-md border ${BORDA} bg-white px-2 py-1.5 text-[12px] text-ink disabled:opacity-50`}
                  >
                    {(MOMENTOS_REGUA.find((m) => m.id === momentoR)?.variantes ?? []).map((v) => (
                      <option key={v} value={v}>
                        {VARIANTES_REGUA[v].nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="col-span-2 text-[11px] text-t3">
                  Apelido de exemplo
                  <input
                    value={apelido}
                    onChange={(e) => setApelido(e.target.value)}
                    className={`mt-1 w-full rounded-md border ${BORDA} bg-white px-2 py-1.5 text-[12px] text-ink`}
                  />
                </label>
              </div>
              <div className="mt-3 whitespace-pre-wrap break-words rounded-xl rounded-tl-sm border border-[rgba(21,21,33,0.08)] bg-[rgba(55,53,47,0.05)] px-3.5 py-3 text-[13px] leading-[1.5] text-ink">
                <TextoWhatsapp
                  texto={montarMensagemRegua({
                    momento: momentoR,
                    variante: momentoR === 'quinta' ? 'unica' : varianteR,
                    apelido: apelido || 'cliente',
                    posts: [
                      { titulo: 'Título do primeiro post', link: 'https://portal-cliente-lud.vercel.app/post/…' },
                      { titulo: 'Título do segundo post', link: 'https://portal-cliente-lud.vercel.app/post/…' },
                    ],
                    prazo: somarDias(hoje, ((1 - new Date(`${hoje}T12:00:00Z`).getUTCDay() + 7) % 7) || 7),
                    textos,
                  })}
                />
              </div>
            </div>
          </aside>
        </div>
      )}

      {aba === 'lembrete' && (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          {/* Estrutura + variáveis */}
          <section className={`rounded-xl border ${BORDA} bg-white p-5`}>
            <h2 className="text-[14px] font-semibold text-ink">Como a mensagem é montada</h2>
            <ol className="mt-3 space-y-1.5">
              {ESTRUTURA.map((b, i) => (
                <li key={b.nome} className="flex gap-2.5 text-[12.5px]">
                  <span className="w-4 shrink-0 font-mono text-t3">{i + 1}.</span>
                  <span className="text-ink">{b.nome}</span>
                  <span className="text-t3">· {b.origem}</span>
                </li>
              ))}
            </ol>
            <div className="mt-4 border-t border-[rgba(21,21,33,0.06)] pt-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.07em] text-t2">
                Variáveis
              </div>
              <p className="mt-0.5 text-[11px] text-t3">
                Clica num campo e depois na variável pra inserir. *texto* fica em negrito no WhatsApp.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {VARIAVEIS.map((v) => (
                  <button
                    key={v.nome}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => inserirVariavel(v.nome)}
                    title={v.descricao}
                    className={`rounded-md border ${BORDA} bg-[rgba(55,53,47,0.03)] px-2 py-1 font-mono text-[11px] text-ink transition hover:bg-[rgba(55,53,47,0.08)]`}
                  >
                    {v.nome}
                    <span className="ml-1.5 font-sans text-t3">{v.descricao}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Início e fim */}
          <section className={`rounded-xl border ${BORDA} bg-white p-5`}>
            <h2 className="text-[14px] font-semibold text-ink">Início e fim</h2>
            <p className="mt-0.5 text-[12px] text-t3">Iguais em todos os lembretes.</p>
            <div className="mt-4 space-y-4">
              {Campo({ chave: 'lembrete.saudacao', label: 'Saudação', linhas: 1 })}
              {Campo({ chave: 'lembrete.fechamento', label: 'Fechamento', linhas: 1 })}
            </div>
          </section>

          {/* Por etapa */}
          <section className={`rounded-xl border ${BORDA} bg-white p-5`}>
            <h2 className="text-[14px] font-semibold text-ink">Por etapa</h2>
            <p className="mt-0.5 text-[12px] text-t3">
              A etapa sai do título da tarefa no Notion, nessa ordem de checagem.
            </p>
            <div className="mt-3 flex flex-wrap gap-1 border-b border-[rgba(21,21,33,0.08)]">
              {ETAPAS.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setEtapa(e.id)}
                  className={`-mb-px border-b-2 px-3 py-2 text-[12.5px] transition ${
                    etapa === e.id
                      ? 'border-ink font-semibold text-ink'
                      : 'border-transparent text-t3 hover:text-ink'
                  }`}
                >
                  {e.nome}
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg bg-[rgba(55,53,47,0.04)] px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
                  Condição
                </div>
                <div className="mt-0.5 text-[12.5px] text-ink">{etapaInfo.condicao}</div>
              </div>
              <div className="rounded-lg bg-[rgba(55,53,47,0.04)] px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
                  Regra do Onboarding
                </div>
                <div className="mt-0.5 text-[12.5px] text-ink">{etapaInfo.onboarding}</div>
              </div>
            </div>
            <div className="mt-4 space-y-4">
              {CAMPOS_ETAPA.map((c) => (
                <div key={c.campo}>
                  {Campo({
                    chave: `lembrete.etapa.${etapa}.${c.campo}`,
                    label: c.label,
                    dica: c.dica,
                    linhas: c.campo === 'regra' ? 2 : 1,
                    curto: c.campo === 'verbo',
                  })}
                </div>
              ))}
            </div>
          </section>

          {/* Por situação */}
          <section className={`rounded-xl border ${BORDA} bg-white p-5`}>
            <h2 className="text-[14px] font-semibold text-ink">Linha do prazo, por situação</h2>
            <p className="mt-0.5 text-[12px] text-t3">
              Comparando o prazo da tarefa (Data Entrega) e a data de publicação do post com hoje,
              no horário de Brasília. Se o texto ficar vazio, a linha some da mensagem.
            </p>
            <div className="mt-4 divide-y divide-[rgba(21,21,33,0.06)]">
              {SITUACOES.map((s) => (
                <div key={s.id} className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[200px_minmax(0,1fr)]">
                  <button
                    type="button"
                    onClick={() => setSituacao(s.id)}
                    className="text-left"
                  >
                    <div className={`text-[13px] ${situacao === s.id ? 'font-semibold text-ink' : 'text-ink'}`}>
                      {s.nome}
                      {situacao === s.id && <span className="ml-1.5 text-[11px] font-normal text-t3">· na prévia</span>}
                    </div>
                    <div className="mt-0.5 text-[11.5px] leading-[1.45] text-t3">{s.condicao}</div>
                  </button>
                  {Campo({
                    chave: `lembrete.prazo.${s.id}`,
                    label: 'Texto',
                    linhas: s.id === 'vencido' || s.id === 'data_passou' ? 3 : 1,
                    aoFocar: () => setSituacao(s.id),
                  })}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Prévia */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className={`rounded-xl border ${BORDA} bg-white p-5`}>
            <h2 className="text-[14px] font-semibold text-ink">Prévia</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="text-[11px] text-t3">
                Etapa
                <select
                  value={etapa}
                  onChange={(e) => setEtapa(e.target.value as EtapaLembrete)}
                  className={`mt-1 w-full rounded-md border ${BORDA} bg-white px-2 py-1.5 text-[12px] text-ink`}
                >
                  {ETAPAS.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] text-t3">
                Situação
                <select
                  value={situacao}
                  onChange={(e) => setSituacao(e.target.value as SituacaoLembrete)}
                  className={`mt-1 w-full rounded-md border ${BORDA} bg-white px-2 py-1.5 text-[12px] text-ink`}
                >
                  {SITUACOES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="col-span-2 text-[11px] text-t3">
                Apelido de exemplo
                <input
                  value={apelido}
                  onChange={(e) => setApelido(e.target.value)}
                  className={`mt-1 w-full rounded-md border ${BORDA} bg-white px-2 py-1.5 text-[12px] text-ink`}
                />
              </label>
            </div>

            <div className="mt-4 rounded-lg bg-[rgba(55,53,47,0.04)] px-3 py-2 text-[11.5px] leading-[1.5] text-t2">
              <div>
                <span className="font-semibold text-ink">Quando:</span> {etapaInfo.condicao.toLowerCase()} e{' '}
                {situacaoInfo.condicao.charAt(0).toLowerCase() + situacaoInfo.condicao.slice(1)}.
              </div>
              <div className="mt-0.5 text-t3">
                Exemplo com prazo {exemplo.prazo ? exemplo.prazo.split('-').reverse().slice(0, 2).join('/') : 'vazio'}
                {exemplo.postData && ` e post em ${exemplo.postData.split('-').reverse().slice(0, 2).join('/')}`}.
              </div>
            </div>

            <div className="mt-3 whitespace-pre-wrap break-words rounded-xl rounded-tl-sm border border-[rgba(21,21,33,0.08)] bg-[rgba(55,53,47,0.05)] px-3.5 py-3 text-[13px] leading-[1.5] text-ink">
              <TextoWhatsapp texto={previa.mensagem} />
            </div>
          </div>
        </aside>
      </div>
      )}
    </div>
  );
}
