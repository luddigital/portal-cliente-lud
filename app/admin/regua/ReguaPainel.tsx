'use client';

import { useMemo, useState } from 'react';
import { PreviaPostModal } from '../aprovacoes/PreviaPostModal';
import { useRouter } from 'next/navigation';
import type { Regua } from '@/lib/regua';
import type { ClienteRegua, EstadoArte, EstadoCliente, PostRegua } from '@/lib/regua-ciclo';
import {
  MOMENTOS_REGUA,
  VARIANTES_REGUA,
  montarMensagemRegua,
  type MomentoRegua,
  type VarianteRegua,
} from '@/lib/regua-mensagens';

const BORDA = 'border-[rgba(21,21,33,0.09)]';
// Antes disso o portal não registrava quando o cliente abria o post.
const RASTREIO_DESDE = '2026-10-06';
const SUAVE = 'bg-[rgba(55,53,47,0.04)]';

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const AGENDA_DO_DIA = [
  'Prazo de Materiais para Produção. Lud. off.',
  'Arte da semana e último dia de aprovação dos clientes.',
  'Aprovação interna de arte. Tudo precisa estar pronto pro envio de quinta.',
  'Último dia pra deixar a arte pronta pro envio de amanhã.',
  'Envio dos posts da semana pros clientes.',
  'Lembrete pros clientes e programação dos aprovados.',
  'Lud. off.',
];

const ARTE_LABEL: Record<EstadoArte, string> = {
  aprovada: 'Arte aprovada',
  aguardando_aprovacao: 'Aguardando aprovação de arte',
  alteracao: 'Arte em alteração',
  em_producao: 'Arte em produção',
  sem_tarefa: 'Sem tarefa de arte',
};

const CLIENTE_LABEL: Record<EstadoCliente, string> = {
  aprovado: 'Aprovado',
  alteracao: 'Pediu alteração',
  pendente: 'Falta aprovar',
  sem_tarefa: 'Sem tarefa de aprovação',
};

function ddmm(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
}

function horaCurta(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type StatusItem = 'pronto' | 'bloqueado' | 'enviado' | 'sem_grupo' | 'aprovou';

type ItemFila = {
  cliente: ClienteRegua;
  status: StatusItem;
  variante: VarianteRegua;
  posts: PostRegua[];
  bloqueios: PostRegua[];
  textoPadrao: string;
  enviadoEm: string | null;
};

export function ReguaPainel({
  regua,
  textos,
  baseUrl,
}: {
  regua: Regua;
  textos: Record<string, string>;
  baseUrl: string;
}) {
  const router = useRouter();
  const [momento, setMomento] = useState<MomentoRegua>(regua.momentoHoje ?? 'quinta');
  const [editados, setEditados] = useState<Record<string, string>>({});
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [desmarcados, setDesmarcados] = useState<Set<string>>(new Set());
  const [marcadosManual, setMarcadosManual] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: number; erros: string[] } | null>(null);

  const ciclo = momento === 'quinta' ? regua.proximo : regua.anterior;
  const infoMomento = MOMENTOS_REGUA.find((m) => m.id === momento)!;

  const fila: ItemFila[] = useMemo(() => {
    return ciclo.clientes.map((c) => {
      const link = (p: PostRegua) =>
        `${baseUrl}/post/${p.postId}${p.aprovacaoTarefaId ? `?tarefa=${p.aprovacaoTarefaId}` : ''}`;
      const enviado = regua.envios.find(
        (e) => e.projetoId === c.projetoId && e.ciclo === ciclo.quinta && e.momento === momento,
      );
      const apelido = c.apelido || c.clienteNome;

      if (momento === 'quinta') {
        const aEnviar = c.posts.filter((p) => !p.envioConcluido);
        const bloqueios = aEnviar.filter((p) => p.arte !== 'aprovada');
        const jaFoi = !!enviado || aEnviar.length === 0;
        const status: StatusItem = jaFoi
          ? 'enviado'
          : !c.grupoNome
            ? 'sem_grupo'
            : bloqueios.length
              ? 'bloqueado'
              : 'pronto';
        return {
          cliente: c,
          status,
          variante: 'unica' as VarianteRegua,
          posts: aEnviar,
          bloqueios,
          textoPadrao: montarMensagemRegua({
            momento,
            variante: 'unica',
            apelido,
            posts: aEnviar.map((p) => ({ titulo: p.titulo, link: link(p) })),
            prazo: ciclo.prazo,
            textos,
          }),
          enviadoEm: enviado?.enviadoEm ?? null,
        };
      }

      const pendentes = c.posts.filter((p) => p.cliente === 'pendente');
      const variante: VarianteRegua =
        pendentes.length > 0 && pendentes.every((p) => p.vistoDesdeEnvio) ? 'viu' : 'nao_viu';
      const status: StatusItem = pendentes.length === 0
        ? 'aprovou'
        : enviado
          ? 'enviado'
          : !c.grupoNome
            ? 'sem_grupo'
            : 'pronto';
      return {
        cliente: c,
        status,
        variante,
        posts: pendentes,
        bloqueios: [],
        textoPadrao: montarMensagemRegua({
          momento,
          variante,
          apelido,
          posts: pendentes.map((p) => ({ titulo: p.titulo, link: link(p) })),
          prazo: ciclo.prazo,
          textos,
        }),
        enviadoEm: enviado?.enviadoEm ?? null,
      };
    });
  }, [ciclo, momento, regua.envios, textos, baseUrl]);

  const chave = (projetoId: string) => `${momento}:${projetoId}`;
  const semRastreio = momento !== 'quinta' && ciclo.quinta < RASTREIO_DESDE;
  const estaMarcado = (k: string) => (semRastreio ? marcadosManual.has(k) : !desmarcados.has(k));
  const selecionados = fila.filter(
    (i) => i.status === 'pronto' && estaMarcado(chave(i.cliente.projetoId)),
  );

  function alternar(set: Set<string>, k: string): Set<string> {
    const n = new Set(set);
    if (n.has(k)) n.delete(k);
    else n.add(k);
    return n;
  }

  async function enviar() {
    if (selecionados.length === 0) return;
    const ok = window.confirm(
      `Enviar ${selecionados.length} ${selecionados.length === 1 ? 'mensagem' : 'mensagens'} nos grupos dos clientes?`,
    );
    if (!ok) return;
    setEnviando(true);
    setResultado(null);
    try {
      const res = await fetch('/api/admin/regua/enviar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          itens: selecionados.map((i) => ({
            projetoId: i.cliente.projetoId,
            ciclo: ciclo.quinta,
            momento,
            variante: i.variante,
            texto: editados[chave(i.cliente.projetoId)] ?? i.textoPadrao,
            postIds: i.posts.map((p) => p.postId),
            tarefasEnvio:
              momento === 'quinta'
                ? i.posts.filter((p) => !p.envioConcluido && p.envioTarefaId).map((p) => p.envioTarefaId)
                : undefined,
          })),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `Erro ${res.status}`);
      const rs = j.resultados as { projetoId: string; ok: boolean; erro?: string }[];
      const nome = (id: string) => fila.find((i) => i.cliente.projetoId === id)?.cliente.clienteNome ?? id;
      setResultado({
        ok: rs.filter((r) => r.ok).length,
        erros: rs.filter((r) => r.erro).map((r) => `${nome(r.projetoId)}: ${r.erro}`),
      });
      router.refresh();
    } catch (e: any) {
      setResultado({ ok: 0, erros: [e?.message ?? 'erro ao enviar'] });
    } finally {
      setEnviando(false);
    }
  }

  const contagem = {
    pronto: fila.filter((i) => i.status === 'pronto').length,
    bloqueado: fila.filter((i) => i.status === 'bloqueado').length,
    enviado: fila.filter((i) => i.status === 'enviado').length,
    aprovou: fila.filter((i) => i.status === 'aprovou').length,
    sem_grupo: fila.filter((i) => i.status === 'sem_grupo').length,
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[22px] font-bold tracking-[-0.02em] text-ink">Régua da semana</h1>
        <p className="mt-0.5 text-[13px] text-t3">
          Hoje é {DIAS[regua.diaSemana]}, {ddmm(regua.hoje)}. {AGENDA_DO_DIA[regua.diaSemana]}
        </p>
      </header>

      {/* FILA */}
      <section className={`rounded-xl border ${BORDA} bg-white`}>
        <div className="border-b border-[rgba(21,21,33,0.07)] px-5 pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[15px] font-semibold text-ink">Fila de mensagens</h2>
            <a href="/admin/configuracoes/mensagens" className="text-[11.5px] text-t3 underline hover:text-ink">
              Editar textos
            </a>
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            {MOMENTOS_REGUA.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setMomento(m.id);
                  setResultado(null);
                }}
                className={`-mb-px border-b-2 px-3 py-2 text-[12.5px] transition ${
                  momento === m.id
                    ? 'border-ink font-semibold text-ink'
                    : 'border-transparent text-t3 hover:text-ink'
                }`}
              >
                {m.dia} · {m.nome}
                {regua.momentoHoje === m.id && <span className="ml-1 text-[10px] font-semibold uppercase">hoje</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className={`rounded-lg ${SUAVE} px-3 py-2 text-[12px] leading-[1.5] text-t2`}>
            <span className="font-semibold text-ink">Quando:</span> {infoMomento.quando}{' '}
            {momento === 'quinta'
              ? `Posts com envio na quinta ${ddmm(ciclo.quinta)}, prazo do cliente ${ddmm(ciclo.prazo)}.`
              : `Posts enviados na quinta ${ddmm(ciclo.quinta)}, prazo do cliente ${ddmm(ciclo.prazo)}.`}
            {semRastreio && (
              <div className="mt-1 font-semibold text-ink">
                Nesse ciclo o portal ainda não registrava quando o cliente abria o post, então a régua
                não sabe se ele viu. Nada vem marcado: abre cada mensagem, ajusta o texto e marca só
                o que quiser enviar.
              </div>
            )}
            {regua.momentoHoje !== momento && (
              <div className="mt-1 font-semibold text-ink">
                Hoje não é o dia desse momento. Dá pra enviar mesmo assim, se precisar.
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-t3">
            <span>
              <b className="text-ink">{contagem.pronto}</b> prontos pra enviar
            </span>
            {momento === 'quinta' && (
              <span>
                <b className="text-ink">{contagem.bloqueado}</b> segurados (falta arte)
              </span>
            )}
            {momento !== 'quinta' && (
              <span>
                <b className="text-ink">{contagem.aprovou}</b> já aprovaram tudo
              </span>
            )}
            <span>
              <b className="text-ink">{contagem.enviado}</b> já enviados
            </span>
            {contagem.sem_grupo > 0 && (
              <span>
                <b className="text-ink">{contagem.sem_grupo}</b> sem grupo vinculado
              </span>
            )}
          </div>

          {fila.length === 0 ? (
            <div className={`rounded-lg ${SUAVE} p-6 text-center text-[13px] text-t3`}>
              Nenhum post nesse ciclo.
            </div>
          ) : (
            <ul className={`divide-y divide-[rgba(21,21,33,0.06)] rounded-lg border ${BORDA}`}>
              {fila.map((i) => {
                const k = chave(i.cliente.projetoId);
                const marcado = i.status === 'pronto' && estaMarcado(k);
                const aberto = abertos.has(k);
                return (
                  <li key={k} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={marcado}
                        disabled={i.status !== 'pronto' || enviando}
                        onChange={() =>
                          semRastreio
                            ? setMarcadosManual((s) => alternar(s, k))
                            : setDesmarcados((s) => alternar(s, k))
                        }
                        className="mt-1 h-4 w-4 accent-[#37352F]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-[13.5px] font-semibold text-ink">{i.cliente.clienteNome}</span>
                          <span className="text-[11.5px] text-t3">
                            {i.cliente.apelido ? `"${i.cliente.apelido}"` : 'sem apelido'} ·{' '}
                            {i.cliente.grupoNome ?? 'sem grupo'}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[12px] text-t2">
                          {i.status === 'enviado' && `✓ Enviado ${i.enviadoEm ? horaCurta(i.enviadoEm) : 'pelo Notion'}`}
                          {i.status === 'aprovou' && '✓ Aprovou tudo, não precisa de mensagem'}
                          {i.status === 'sem_grupo' && (
                            <>
                              Sem grupo do WhatsApp vinculado.{' '}
                              <a href="/admin/whatsapp" className="underline hover:text-ink">
                                Vincular
                              </a>
                            </>
                          )}
                          {i.status === 'bloqueado' &&
                            `Segurado: ${i.bloqueios.length} de ${i.posts.length} ${i.posts.length === 1 ? 'post' : 'posts'} sem arte aprovada`}
                          {i.status === 'pronto' &&
                            `${i.posts.length} ${i.posts.length === 1 ? 'post' : 'posts'} · ${
                              momento === 'quinta' ? 'todos com arte aprovada' : VARIANTES_REGUA[i.variante].nome.toLowerCase()
                            }`}
                        </div>
                        {i.status === 'bloqueado' && (
                          <ul className="mt-1.5 space-y-0.5">
                            {i.bloqueios.map((p) => (
                              <li key={p.postId} className="text-[11.5px] text-t3">
                                • {p.titulo} <span className="text-t2">({ARTE_LABEL[p.arte].toLowerCase()})</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {i.status !== 'aprovou' && (
                          <button
                            type="button"
                            onClick={() => setAbertos((s) => alternar(s, k))}
                            className="mt-1.5 text-[11.5px] text-t3 underline hover:text-ink"
                          >
                            {aberto ? 'esconder mensagem' : 'ver mensagem'}
                          </button>
                        )}
                        {aberto && (
                          <div className="mt-2">
                            <textarea
                              value={editados[k] ?? i.textoPadrao}
                              onChange={(e) => setEditados((s) => ({ ...s, [k]: e.target.value }))}
                              rows={Math.min(18, (editados[k] ?? i.textoPadrao).split('\n').length + 1)}
                              disabled={i.status !== 'pronto'}
                              className={`w-full resize-y rounded-lg border ${BORDA} bg-white p-3 text-[12.5px] leading-[1.5] text-ink outline-none focus:border-[rgba(21,21,33,0.35)] disabled:bg-[rgba(55,53,47,0.03)]`}
                            />
                            {editados[k] !== undefined && editados[k] !== i.textoPadrao && (
                              <button
                                type="button"
                                onClick={() =>
                                  setEditados((s) => {
                                    const n = { ...s };
                                    delete n[k];
                                    return n;
                                  })
                                }
                                className="text-[11px] text-t3 underline hover:text-ink"
                              >
                                voltar ao texto padrão
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
            {resultado && (
              <div className="text-[12px] text-t2">
                {resultado.ok > 0 && <span>✓ {resultado.ok} enviadas. </span>}
                {resultado.erros.map((e) => (
                  <div key={e} className="font-semibold text-ink">
                    {e}
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={enviar}
              disabled={enviando || selecionados.length === 0}
              className="rounded-full bg-ink px-5 py-2 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-30"
            >
              {enviando
                ? 'Enviando…'
                : `Enviar ${selecionados.length} ${selecionados.length === 1 ? 'mensagem' : 'mensagens'}`}
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* PREPARAR QUINTA */}
        <section className={`rounded-xl border ${BORDA} bg-white p-5`}>
          <h2 className="text-[15px] font-semibold text-ink">Preparar envio de quinta {ddmm(regua.proximo.quinta)}</h2>
          <p className="mt-0.5 text-[12px] text-t3">
            Equipe: o post só vai pro cliente com a Aprovação | Arte concluída no Notion.
          </p>
          <ListaClientes
            clientes={regua.proximo.clientes}
            resumo={(c) => {
              const aEnviar = c.posts.filter((p) => !p.envioConcluido);
              if (aEnviar.length === 0) return '✓ Enviado';
              const faltam = aEnviar.filter((p) => p.arte !== 'aprovada').length;
              return faltam === 0 ? '✓ Pronto' : `Faltam ${faltam}`;
            }}
            estadoPost={(p) => (p.envioConcluido ? 'Enviado' : ARTE_LABEL[p.arte])}
            ok={(p) => p.envioConcluido || p.arte === 'aprovada'}
          />
        </section>

        {/* APROVAÇÃO DOS CLIENTES */}
        <section className={`rounded-xl border ${BORDA} bg-white p-5`}>
          <h2 className="text-[15px] font-semibold text-ink">
            Aprovação dos clientes · prazo {ddmm(regua.anterior.prazo)}
          </h2>
          <p className="mt-0.5 text-[12px] text-t3">
            Posts enviados na quinta {ddmm(regua.anterior.quinta)}. &quot;Visto&quot; conta a partir de 06/10.
          </p>
          <ListaClientes
            clientes={regua.anterior.clientes}
            resumo={(c) => {
              const faltam = c.posts.filter((p) => p.cliente === 'pendente').length;
              return faltam === 0 ? '✓ Respondeu tudo' : `Faltam ${faltam}`;
            }}
            estadoPost={(p) =>
              `${CLIENTE_LABEL[p.cliente]}${p.cliente === 'pendente' ? (p.vistoDesdeEnvio ? ' · visto' : ' · não visto') : ''}`
            }
            ok={(p) => p.cliente === 'aprovado' || p.cliente === 'alteracao'}
          />
        </section>
      </div>
    </div>
  );
}

function ListaClientes({
  clientes,
  resumo,
  estadoPost,
  ok,
}: {
  clientes: ClienteRegua[];
  resumo: (c: ClienteRegua) => string;
  estadoPost: (p: PostRegua) => string;
  ok: (p: PostRegua) => boolean;
}) {
  const [previa, setPrevia] = useState<{ postId: string; tarefaId: string | null } | null>(null);
  if (clientes.length === 0) {
    return <p className="mt-4 text-[12.5px] text-t3">Nenhum post nesse ciclo.</p>;
  }
  return (
    <>
    {previa && (
      <PreviaPostModal postId={previa.postId} tarefaId={previa.tarefaId} fechar={() => setPrevia(null)} />
    )}
    <ul className="mt-4 space-y-4">
      {clientes.map((c) => (
        <li key={c.projetoId}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-semibold text-ink">{c.clienteNome}</span>
            <span className="text-[11.5px] font-semibold text-t2">{resumo(c)}</span>
          </div>
          <ul className="mt-1 space-y-0.5">
            {c.posts.map((p) => (
              <li key={p.postId} className="flex items-baseline gap-2 text-[12px]">
                <span className={`shrink-0 ${ok(p) ? 'text-ink' : 'text-t3'}`}>{ok(p) ? '✓' : '○'}</span>
                <button
                  type="button"
                  onClick={() => setPrevia({ postId: p.postId, tarefaId: p.aprovacaoTarefaId })}
                  className="min-w-0 flex-1 truncate text-left text-t1 hover:underline"
                  title={p.titulo}
                >
                  {p.titulo}
                </button>
                <span className={`shrink-0 text-[11px] ${ok(p) ? 'text-t3' : 'font-semibold text-ink'}`}>
                  {estadoPost(p)}
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
    </>
  );
}
