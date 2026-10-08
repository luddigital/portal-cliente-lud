'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PreviaPostModal } from '../../aprovacoes/PreviaPostModal';
import {
  ModalMensagem,
  type GrupoWpp,
  type ItemPendenciaUi,
} from '@/app/admin/projetos/[id]/PendenciasCliente';
import { grupoDaTarefa } from '@/lib/pendencias-cliente';
import { montarMensagemRegua } from '@/lib/regua-mensagens';
import { ChipData } from '@/app/_components/ChipData';

export type TipoEntrega = 'envio' | 'cliente' | 'interna';

export type ItemEntrega = {
  tarefaId: string;
  titulo: string;
  prazo: string | null;
  pronto: boolean;
  postId: string | null;
  postTitulo: string;
  /** Onde o post está em relação a essa entrega. */
  relacao: 'aqui' | 'antes' | 'depois' | 'concluido';
  rotulo: string;
  comCliente: boolean;
  atualTitulo: string | null;
  atualPrazo: string | null;
  responsavel: string | null;
  /** Tarefa "Aprovação | Post" do post (link da mensagem pro cliente). */
  aprovacaoTarefaId: string | null;
  prazoCliente: string | null;
  visto: { ultima: string; total: number } | null;
  /** Já feito nessa entrega (enviado ao cliente, no caso do envio de quinta). */
  enviado: boolean;
  enviadoEm: string | null;
};

export type GrupoEntrega = {
  projetoId: string;
  nome: string;
  projetoNome: string;
  gruposWpp: GrupoWpp[];
  itens: ItemEntrega[];
};

function ddmm(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
}

function diasEntre(deIso: string, ateIso: string): number {
  const t = (s: string) => {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((t(ateIso) - t(deIso)) / 86_400_000);
}

/** Segunda-feira da semana da data (chave da aba). Sem data → 'sem-data'. */
function semanaDe(iso: string | null): string {
  if (!iso) return 'sem-data';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return dt.toISOString().slice(0, 10);
}

function somarDiasIso(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

function rotuloSemana(chave: string, atual: string): { titulo: string; datas: string } {
  if (chave === 'sem-data') return { titulo: 'Sem data', datas: '' };
  const datas = `${ddmm(chave)} a ${ddmm(somarDiasIso(chave, 6))}`;
  const dif = Math.round(diasEntre(atual, chave) / 7);
  const titulo =
    dif === 0 ? 'Esta semana' : dif === 1 ? 'Próxima semana' : dif === -1 ? 'Semana passada' : datas;
  return { titulo, datas: dif >= -1 && dif <= 1 ? datas : '' };
}

/** Cor semântica do design system (mesmas do calendário) pelo que está acontecendo com o post. */
function corDoStatus(item: ItemEntrega, tipo: TipoEntrega): { bg: string; fg: string } {
  const par = (nome: string) => ({ bg: `var(--${nome}-soft)`, fg: `var(--${nome})` });
  if (item.relacao === 'aqui' && tipo === 'envio') return par('prazo-em-dia');
  if (item.relacao === 'concluido') return par('cal-publicado');
  const t = (item.atualTitulo ?? '').toLowerCase();
  if (/altera/.test(t)) return par('cal-alteracao');
  if (/enviar post/.test(t)) return par('prazo-em-dia');
  if (/programar/.test(t)) return par('cal-programar');
  if (/conferir/.test(t)) return par('cal-conferir');
  if (/aprova/.test(t)) return par('cal-aprovacao');
  if (item.comCliente) return par('cal-aguardando');
  return par('cal-agendado');
}

function ChipStatus({ item, tipo }: { item: ItemEntrega; tipo: TipoEntrega }) {
  const cor = corDoStatus(item, tipo);
  const texto = item.relacao === 'aqui' && tipo === 'envio' ? 'Pronto pra enviar' : item.rotulo;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ background: cor.bg, color: cor.fg }}
      title={item.atualTitulo ?? undefined}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {texto}
    </span>
  );
}

function PilulaVisto({ visto }: { visto: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
        visto ? 'bg-[var(--cal-conferir-soft)] text-[var(--cal-conferir)]' : 'bg-bgSoft text-t3'
      }`}
    >
      {visto ? '👁 visto' : 'não visto'}
    </span>
  );
}

/** Responsável (inicial) + prazo da etapa atual, vermelho se atrasado. */
function MetaAtual({ item, hoje }: { item: ItemEntrega; hoje: string }) {
  if (!item.atualPrazo && !item.responsavel) return null;
  const atrasada = item.atualPrazo ? diasEntre(hoje, item.atualPrazo) < 0 : false;
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-[11px]">
      {item.responsavel && (
        <span
          title={item.responsavel}
          className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E9E9E7] text-[9.5px] font-semibold text-ink"
        >
          {item.responsavel.trim()[0]?.toUpperCase()}
        </span>
      )}
      {item.atualPrazo && (
        <span className={atrasada ? 'font-semibold text-[var(--prazo-atrasado)]' : 'text-t3'}>
          {atrasada ? `atrasada · ${ddmm(item.atualPrazo)}` : `até ${ddmm(item.atualPrazo)}`}
        </span>
      )}
    </span>
  );
}

/**
 * Página de entrega: um card por cliente, com o status real de cada post e,
 * conforme a entrega, o botão de envio pro grupo do cliente.
 */
export function EntregaPorCliente({
  entregaNome,
  tipo,
  grupos,
  textos,
  baseUrl,
  hojeIso,
}: {
  entregaNome: string;
  tipo: TipoEntrega;
  grupos: GrupoEntrega[];
  textos: Record<string, string>;
  baseUrl: string;
  hojeIso: string;
}) {
  const [previa, setPrevia] = useState<{ postId: string; tarefaId: string } | null>(null);
  const [envio, setEnvio] = useState<GrupoEntrega | null>(null);
  const [mensagem, setMensagem] = useState<GrupoEntrega | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Uma aba por semana de envio (pela data da tarefa da entrega).
  const semanaAtual = semanaDe(hojeIso);
  // Semanas que já passaram entram em "Esta semana": o atrasado é prioridade dela.
  const abaDe = (prazo: string | null) => {
    const k = semanaDe(prazo);
    return k !== 'sem-data' && k < semanaAtual ? semanaAtual : k;
  };
  // Enviados ficam na semana do envio; envios de semanas passadas saem de cena.
  const abaDoItem = (i: ItemEntrega): string | null => {
    if (!i.enviado) return abaDe(i.prazo);
    const k = semanaDe(i.enviadoEm ?? i.prazo);
    return k !== 'sem-data' && k < semanaAtual ? null : k;
  };
  const semanas = useMemo(() => {
    const set = new Set<string>();
    for (const g of grupos)
      for (const i of g.itens) {
        const k = abaDoItem(i);
        if (k) set.add(k);
      }
    return [...set].sort();
  }, [grupos]);
  const [semana, setSemana] = useState<string>(() =>
    semanas.includes(semanaAtual)
      ? semanaAtual
      : semanas.find((k) => k !== 'sem-data' && k > semanaAtual) ?? semanas[semanas.length - 1] ?? '',
  );
  const daSemana = (filtro: (i: ItemEntrega) => boolean) =>
    grupos
      .map((g) => ({ ...g, itens: g.itens.filter((i) => abaDoItem(i) === semana && filtro(i)) }))
      .filter((g) => g.itens.length > 0);
  const gruposDaSemana = daSemana((i) => !i.enviado);
  const enviadosDaSemana = daSemana((i) => i.enviado);
  const contar = (k: string) => {
    let total = 0;
    let atrasados = 0;
    for (const g of grupos)
      for (const i of g.itens) {
        if (i.enviado || abaDoItem(i) !== k) continue;
        total++;
        if (i.prazo && diasEntre(hojeIso, i.prazo) < 0) atrasados++;
      }
    return { total, atrasados };
  };
  const itensSemana = gruposDaSemana.flatMap((g) => g.itens);
  const nProntos = itensSemana.filter((i) => i.relacao === 'aqui').length;
  const nAtrasados = itensSemana.filter((i) => i.prazo && diasEntre(hojeIso, i.prazo) < 0).length;
  const nEnviados = enviadosDaSemana.reduce((n, g) => n + g.itens.length, 0);
  const rotuloFeitos = tipo === 'envio' ? 'Enviados' : 'Concluídos';

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 8000);
    return () => clearTimeout(t);
  }, [aviso]);

  return (
    <div className="space-y-4">
      {aviso && (
        <div role="status" className="rounded-xl bg-bgSoft px-4 py-2.5 text-[12.5px] text-ink">
          {aviso}
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto border-b border-[rgba(21,21,33,0.08)]">
        {semanas.map((k) => {
          const r = rotuloSemana(k, semanaAtual);
          const c = contar(k);
          const ativa = k === semana;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setSemana(k)}
              className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-left transition ${
                ativa ? 'border-ink' : 'border-transparent hover:border-[rgba(21,21,33,0.2)]'
              }`}
            >
              <div className={`flex items-center gap-1.5 text-[13px] ${ativa ? 'font-semibold text-ink' : 'text-t2'}`}>
                {r.titulo}
                <span
                  className={`rounded-full px-1.5 text-[10px] font-bold ${
                    c.atrasados > 0 ? 'bg-[var(--prazo-atrasado)] text-white' : 'bg-bgSoft text-t2'
                  }`}
                >
                  {c.total}
                </span>
              </div>
              {r.datas && <div className="text-[11px] text-t3">{r.datas}</div>}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-t2">
        <span>
          <b className="text-ink">{itensSemana.length}</b> posts
        </span>
        <span>
          <b className="text-[var(--prazo-em-dia)]">{nProntos}</b>{' '}
          {tipo === 'envio' ? 'prontos pra enviar' : 'nessa etapa'}
        </span>
        {nAtrasados > 0 && (
          <span>
            <b className="text-[var(--prazo-atrasado)]">{nAtrasados}</b> atrasados
          </span>
        )}
        {nEnviados > 0 && (
          <span>
            <b className="text-ink">{nEnviados}</b> {rotuloFeitos.toLowerCase()}
          </span>
        )}
      </div>

      {gruposDaSemana.length === 0 && (
        <p className="rounded-2xl border border-dashed border-[rgba(21,21,33,0.12)] px-4 py-6 text-center text-[12.5px] text-t3">
          {nEnviados > 0 ? `Tudo dessa semana já foi ${tipo === 'envio' ? 'enviado' : 'concluído'} ✨` : 'Nada nessa semana.'}
        </p>
      )}

      {gruposDaSemana.map((g) => {
        const prontos = g.itens.filter((i) => i.relacao === 'aqui');
        const travados = g.itens.filter((i) => i.relacao === 'antes');
        const atrasados = g.itens.filter((i) => i.prazo && diasEntre(hojeIso, i.prazo) < 0).length;
        const temCliente = g.itens.some((i) => i.comCliente);
        return (
          <section
            key={g.projetoId || g.nome}
            className={`overflow-hidden rounded-2xl border bg-white ${
              atrasados > 0 ? 'border-[rgba(110,42,44,0.25)]' : 'border-[rgba(21,21,33,0.08)]'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(21,21,33,0.06)] px-5 py-3.5">
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{g.nome}</h2>
                <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11.5px] text-t3">
                  {g.projetoNome && g.projetoNome !== g.nome && <span>{g.projetoNome}</span>}
                  <span>
                    {prontos.length} de {g.itens.length}{' '}
                    {tipo === 'envio' ? 'prontos pra enviar' : 'nessa etapa'}
                  </span>
                  {travados.length > 0 && <span>· {travados.length} ainda não chegaram aqui</span>}
                  {atrasados > 0 && (
                    <span className="font-semibold text-[var(--prazo-atrasado)]">· {atrasados} atrasados</span>
                  )}
                  {g.gruposWpp.length === 0 && <span>· sem grupo do WhatsApp</span>}
                </div>
              </div>
              {tipo === 'envio' && (
                // Só libera com TODOS os posts do cliente prontos (o lote não sai pela metade).
                <div className="flex flex-col items-end gap-1">
                  <button
                    type="button"
                    onClick={() => setEnvio(g)}
                    disabled={prontos.length === 0 || travados.length > 0}
                    title={
                      travados.length > 0
                        ? 'Libera quando todos os posts desse cliente estiverem prontos'
                        : prontos.length === 0
                          ? 'Nenhum post pronto pra enviar'
                          : undefined
                    }
                    className="rounded-full bg-ink px-4 py-2 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-30"
                  >
                    📱 Enviar para aprovação{prontos.length > 0 && travados.length === 0 ? ` (${prontos.length})` : ''}
                  </button>
                  {travados.length > 0 && (
                    <span className="text-[11px] text-t3">
                      Falta{travados.length > 1 ? 'm' : ''} {travados.length} {travados.length === 1 ? 'post' : 'posts'} ficar
                      {travados.length > 1 ? 'em' : ''} pronto{travados.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )}
              {tipo === 'cliente' && (
                <button
                  type="button"
                  onClick={() => setMensagem(g)}
                  disabled={prontos.filter((i) => i.postId).length === 0}
                  className="rounded-full border border-[rgba(21,21,33,0.12)] bg-white px-4 py-2 text-[12.5px] font-semibold text-ink transition hover:bg-bgSoft disabled:opacity-40"
                >
                  📱 Mensagem da entrega{prontos.length > 0 ? ` (${prontos.length})` : ''}
                </button>
              )}
            </div>
            <ul className="divide-y divide-[rgba(21,21,33,0.05)]">
              {g.itens.map((i) => (
                <li key={i.tarefaId}>
                  <button
                    type="button"
                    onClick={() => i.postId && setPrevia({ postId: i.postId, tarefaId: i.aprovacaoTarefaId ?? i.tarefaId })}
                    disabled={!i.postId}
                    className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-left transition hover:bg-bgSoft/60 disabled:cursor-default"
                  >
                    <ChipData prazo={i.prazo} hoje={hojeIso} className="w-[56px]" />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{i.postTitulo}</span>
                    {/* colunas fixas: a tag de status fica sempre alinhada na direita */}
                    <span className="hidden w-[132px] shrink-0 justify-end sm:flex">
                      {i.relacao !== 'aqui' && <MetaAtual item={i} hoje={hojeIso} />}
                    </span>
                    {temCliente && (
                      <span className="hidden w-[68px] shrink-0 justify-end sm:flex">
                        {i.comCliente && <PilulaVisto visto={!!i.visto} />}
                      </span>
                    )}
                    <span className="flex w-full justify-end sm:w-[210px] sm:shrink-0">
                      <ChipStatus item={i} tipo={tipo} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {enviadosDaSemana.length > 0 && (
        <section className="space-y-2 pt-2">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
            {rotuloFeitos} <span className="ml-1 rounded-full bg-bgSoft px-2 py-0.5 text-[11px] font-semibold text-t2">{nEnviados}</span>
          </h2>
          <div className="overflow-hidden rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white">
            {enviadosDaSemana.map((g) => (
              <div key={g.projetoId || g.nome} className="border-b border-[rgba(21,21,33,0.06)] last:border-b-0">
                <div className="px-5 pb-1 pt-3 text-[12px] font-semibold text-t2">{g.nome}</div>
                <ul>
                  {g.itens.map((i) => (
                    <li key={i.tarefaId}>
                      <button
                        type="button"
                        onClick={() => i.postId && setPrevia({ postId: i.postId, tarefaId: i.aprovacaoTarefaId ?? i.tarefaId })}
                        disabled={!i.postId}
                        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2 text-left transition hover:bg-bgSoft/60 disabled:cursor-default"
                      >
                        <span className="w-[86px] shrink-0 text-[11px] text-t3">
                          {i.enviadoEm ? `${tipo === 'envio' ? 'enviado' : 'feito'} ${i.enviadoEm.slice(8, 10)}/${i.enviadoEm.slice(5, 7)}` : '—'}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px] text-t1">{i.postTitulo}</span>
                        <span className="hidden w-[68px] shrink-0 justify-end sm:flex">
                          {i.comCliente && <PilulaVisto visto={!!i.visto} />}
                        </span>
                        <span className="flex w-full justify-end sm:w-[210px] sm:shrink-0">
                          <ChipStatus item={i} tipo={tipo} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {previa && (
        <PreviaPostModal postId={previa.postId} tarefaId={previa.tarefaId} fechar={() => setPrevia(null)} />
      )}

      {envio && (
        <ModalEnvioAprovacao
          grupo={envio}
          textos={textos}
          baseUrl={baseUrl}
          hojeIso={hojeIso}
          fechar={() => setEnvio(null)}
          aoEnviar={(msg) => {
            setEnvio(null);
            setAviso(msg);
          }}
        />
      )}

      {mensagem && (
        <ModalMensagem
          projetoId={mensagem.projetoId}
          clienteNome={mensagem.nome}
          gruposWpp={mensagem.gruposWpp}
          titulo={entregaNome}
          itens={mensagem.itens
            .filter((i) => i.relacao === 'aqui' && i.postId)
            .map(
              (i): ItemPendenciaUi => ({
                tarefaId: i.tarefaId,
                tarefaTitulo: i.titulo,
                postId: i.postId!,
                postTitulo: i.postTitulo,
                postData: null,
                prazo: i.prazo,
                link: `${baseUrl}/post/${i.postId}?tarefa=${i.tarefaId}`,
                grupo: grupoDaTarefa(i.titulo),
                visto: i.visto,
              }),
            )}
          textos={textos}
          hojeIso={hojeIso}
          fechar={() => setMensagem(null)}
          aoEnviar={(nomeGrupo) => {
            setMensagem(null);
            setAviso(`Mensagem enviada no grupo ${nomeGrupo ?? mensagem.gruposWpp[0]?.nome ?? 'do cliente'}.`);
          }}
        />
      )}
    </div>
  );
}

/** Envio de quinta: lote com os posts prontos do cliente (texto do envio da Régua). */
function ModalEnvioAprovacao({
  grupo,
  textos,
  baseUrl,
  hojeIso,
  fechar,
  aoEnviar,
}: {
  grupo: GrupoEntrega;
  textos: Record<string, string>;
  baseUrl: string;
  hojeIso: string;
  fechar: () => void;
  aoEnviar: (mensagem: string) => void;
}) {
  const router = useRouter();
  const prontos = grupo.itens.filter((i) => i.relacao === 'aqui' && i.postId);
  const travados = grupo.itens.filter((i) => i.relacao === 'antes');
  const [sel, setSel] = useState<Set<string>>(() => new Set(prontos.map((i) => i.tarefaId)));
  const [grupoId, setGrupoId] = useState<string | null>(grupo.gruposWpp[0]?.id ?? null);
  const [liberado, setLiberado] = useState(travados.length === 0);
  const [manual, setManual] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const grupoAtual = grupo.gruposWpp.find((g) => g.id === grupoId) ?? null;
  const selecionados = prontos.filter((i) => sel.has(i.tarefaId));
  const prazoCliente =
    selecionados.map((i) => i.prazoCliente).filter((p): p is string => !!p).sort()[0] ?? null;

  const gerado = useMemo(
    () =>
      selecionados.length === 0
        ? ''
        : montarMensagemRegua({
            momento: 'quinta',
            variante: 'unica',
            apelido: grupoAtual?.apelido || grupo.nome,
            posts: selecionados.map((i) => ({
              titulo: i.postTitulo,
              link: `${baseUrl}/post/${i.postId}${i.aprovacaoTarefaId ? `?tarefa=${i.aprovacaoTarefaId}` : ''}`,
            })),
            prazo: prazoCliente,
            textos,
          }),
    [selecionados, grupoAtual, grupo.nome, baseUrl, prazoCliente, textos],
  );
  const [texto, setTexto] = useState(gerado);
  useEffect(() => {
    if (!manual) setTexto(gerado);
  }, [gerado, manual]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !enviando) fechar();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fechar, enviando]);

  async function enviar() {
    setEnviando(true);
    setErro(null);
    const ciclo = selecionados.map((i) => i.prazo).filter((p): p is string => !!p).sort()[0] ?? hojeIso;
    try {
      const res = await fetch('/api/admin/regua/enviar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          itens: [
            {
              projetoId: grupo.projetoId,
              ciclo,
              momento: 'quinta',
              variante: 'unica',
              texto,
              postIds: selecionados.map((i) => i.postId),
              tarefasEnvio: selecionados.map((i) => i.tarefaId),
              grupoId,
            },
          ],
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `Erro ${res.status}`);
      const r = (j.resultados ?? [])[0];
      if (!r?.ok) throw new Error(r?.erro ?? 'Não consegui enviar.');
      router.refresh();
      aoEnviar(
        `Enviado no grupo ${grupoAtual?.nome ?? ''}: ${selecionados.length} ${
          selecionados.length === 1 ? 'post' : 'posts'
        } pra aprovação.${r.erro ? ` ${r.erro}` : ''}`,
      );
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao enviar.');
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => !enviando && fechar()}>
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white text-left shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[rgba(21,21,33,0.08)] px-5 py-3">
          <div className="min-w-0">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-t3">Enviar para aprovação</div>
            <h3 className="mt-0.5 truncate text-[15px] font-semibold text-ink">{grupo.nome}</h3>
          </div>
          <button
            type="button"
            onClick={fechar}
            disabled={enviando}
            aria-label="Fechar"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[18px] text-t3 hover:bg-bgSoft hover:text-ink"
          >
            ×
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {grupo.gruposWpp.length === 0 ? (
            <div className="rounded-lg border border-ink px-3 py-2 text-[12px] text-ink">
              Esse projeto não tem grupo do WhatsApp vinculado.{' '}
              <a href="/admin/whatsapp" className="font-semibold underline">
                Vincular grupo
              </a>
            </div>
          ) : grupo.gruposWpp.length > 1 ? (
            <label className="flex flex-wrap items-center gap-2 rounded-lg bg-bgSoft px-3 py-2 text-[12px] text-t2">
              Vai pro grupo
              <select
                value={grupoId ?? ''}
                onChange={(e) => {
                  setGrupoId(e.target.value);
                  setManual(false);
                }}
                className="rounded-md border border-[rgba(21,21,33,0.12)] bg-white px-2 py-1 text-[12px] font-semibold text-ink"
              >
                {grupo.gruposWpp.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.nome}
                    {w.apelido ? ` (${w.apelido})` : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="rounded-lg bg-bgSoft px-3 py-2 text-[12px] text-t2">
              Vai pro grupo <span className="font-semibold text-ink">{grupoAtual?.nome}</span>. Nunca no privado.
            </div>
          )}

          {travados.length > 0 && (
            <div className="rounded-lg border border-[rgba(110,42,44,0.3)] bg-[var(--prazo-atrasado-soft)] px-3 py-2.5 text-[12px] text-[var(--prazo-atrasado)]">
              <div className="font-semibold">
                {travados.length} {travados.length === 1 ? 'post ainda não está pronto' : 'posts ainda não estão prontos'}. O
                combinado é segurar o lote até todos ficarem prontos.
              </div>
              <ul className="mt-1 space-y-0.5">
                {travados.map((i) => (
                  <li key={i.tarefaId}>
                    • {i.postTitulo} <span className="opacity-80">({i.rotulo.toLowerCase()})</span>
                  </li>
                ))}
              </ul>
              <label className="mt-2 flex items-center gap-2 font-semibold">
                <input
                  type="checkbox"
                  checked={liberado}
                  onChange={(e) => setLiberado(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[#37352F]"
                />
                Enviar mesmo assim só os prontos
              </label>
            </div>
          )}

          <div>
            <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-t3">Posts no envio</div>
            <ul className="space-y-0.5">
              {prontos.map((i) => (
                <li key={i.tarefaId}>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-bgSoft">
                    <input
                      type="checkbox"
                      checked={sel.has(i.tarefaId)}
                      onChange={() =>
                        setSel((s) => {
                          const n = new Set(s);
                          if (n.has(i.tarefaId)) n.delete(i.tarefaId);
                          else n.add(i.tarefaId);
                          return n;
                        })
                      }
                      disabled={enviando}
                      className="h-3.5 w-3.5 accent-[#37352F]"
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{i.postTitulo}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-t3">Mensagem</div>
              {manual && texto !== gerado && (
                <button type="button" onClick={() => setManual(false)} className="text-[11px] text-t3 underline hover:text-ink">
                  voltar ao texto padrão
                </button>
              )}
            </div>
            <textarea
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                setManual(true);
              }}
              rows={14}
              disabled={enviando}
              className="w-full resize-y rounded-lg border border-[rgba(21,21,33,0.12)] bg-white px-3 py-2 text-[13px] leading-[1.55] text-ink outline-none focus:border-[rgba(21,21,33,0.35)]"
            />
            <p className="mt-1 text-[11px] text-t3">
              Ao enviar, a tarefa "Enviar Post Aprovação" desses posts é concluída no Notion.
            </p>
          </div>

          {erro && <p className="rounded-lg border border-ink px-3 py-2 text-[12px] font-semibold text-ink">{erro}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[rgba(21,21,33,0.08)] px-5 py-3">
          <button
            type="button"
            onClick={fechar}
            disabled={enviando}
            className="rounded-full px-4 py-2 text-[12px] font-semibold text-t2 hover:bg-bgSoft hover:text-ink"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={enviar}
            disabled={
              enviando || !grupoAtual || !liberado || selecionados.length === 0 || !texto.trim()
            }
            className="rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-30"
          >
            {enviando ? 'Enviando…' : `Enviar no grupo (${selecionados.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
