'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { PostPortal } from '@/lib/conteudo-portal';
import { ChipData } from '@/app/_components/ChipData';
import { PreviaPostModal } from '@/app/admin/aprovacoes/PreviaPostModal';
import { ModalMensagem, type GrupoWpp, type ItemPendenciaUi } from '@/app/admin/projetos/[id]/PendenciasCliente';

export type PautaLinha = {
  post: PostPortal;
  /** Tarefa aberta mais cedo na ordem (onde o post está agora). */
  atual: { titulo: string; prazo: string | null } | null;
  emProducao: boolean;
  pautaAprovada: boolean;
};

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const FORMATOS = ['Carrossel', 'Reels', 'Post estático', 'Stories'];

function somarMes(mes: string, n: number): string {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function diaDaSemana(iso: string): string {
  return DIA[new Date(`${iso}T12:00:00Z`).getUTCDay()];
}

const diaSp = (v: string | null) =>
  !v ? null : v.length <= 10 ? v : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(v));

type Rascunho = {
  titulo: string;
  dataPostagem: string;
  horario: string;
  formato: string;
  editoria: string;
  funil: string;
  objetivo: string;
  ideia: string;
  informacoesNecessarias: string;
  materiaisNecessarios: string;
  referencias: string;
};

const vazio = (data = ''): Rascunho => ({
  titulo: '',
  dataPostagem: data,
  horario: '',
  formato: '',
  editoria: '',
  funil: '',
  objetivo: '',
  ideia: '',
  informacoesNecessarias: '',
  materiaisNecessarios: '',
  referencias: '',
});

const doPost = (p: PostPortal): Rascunho => ({
  titulo: p.titulo === 'Nova pauta' ? '' : p.titulo,
  dataPostagem: p.dataPostagem ?? '',
  horario: p.horario ?? '',
  formato: p.formato ?? '',
  editoria: p.editoria ?? '',
  funil: p.funil ?? '',
  objetivo: p.objetivo ?? '',
  ideia: p.ideia,
  informacoesNecessarias: p.informacoesNecessarias,
  materiaisNecessarios: p.materiaisNecessarios,
  referencias: p.referencias,
});

export function CalendarioConteudo({
  projetoId,
  projetoNome,
  mes,
  linhas,
  paraImportar,
  hojeIso,
  pendentesCliente,
  gruposWpp,
  textos,
}: {
  projetoId: string;
  projetoNome: string;
  mes: string;
  linhas: PautaLinha[];
  paraImportar: number;
  hojeIso: string;
  /** O que está com o cliente agora (aprovar pauta etc.). */
  pendentesCliente: ItemPendenciaUi[];
  gruposWpp: GrupoWpp[];
  textos: Record<string, string>;
}) {
  const router = useRouter();
  const [atualizando, iniciar] = useTransition();
  const [editando, setEditando] = useState<{ id: string | null; dados: Rascunho } | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [avisarCliente, setAvisarCliente] = useState(false);

  const [ano, m] = mes.split('-').map(Number);
  const recarregar = () => iniciar(() => router.refresh());

  async function chamar(url: string, init: RequestInit, chave: string, ok?: (j: any) => string | null) {
    setOcupado(chave);
    setErro(null);
    try {
      const res = await fetch(url, { headers: { 'content-type': 'application/json' }, ...init });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `Erro ${res.status}`);
      const msg = ok?.(j);
      if (msg) setAviso(msg);
      recarregar();
      return true;
    } catch (e: any) {
      setErro(e?.message ?? 'Não consegui salvar.');
      return false;
    } finally {
      setOcupado(null);
    }
  }

  async function salvar() {
    if (!editando) return;
    const d = editando.dados;
    const campos = {
      ...d,
      titulo: d.titulo.trim() || 'Nova pauta',
      dataPostagem: d.dataPostagem || null,
      horario: d.horario || null,
      formato: d.formato || null,
      editoria: d.editoria || null,
      funil: d.funil || null,
      objetivo: d.objetivo || null,
    };
    const ok = await chamar(
      editando.id ? `/api/conteudo/posts/${editando.id}` : `/api/conteudo/${projetoId}/posts`,
      { method: editando.id ? 'PATCH' : 'POST', body: JSON.stringify(campos) },
      'salvar',
    );
    if (ok) setEditando(null);
  }

  const campo = (k: keyof Rascunho) => ({
    value: editando?.dados[k] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setEditando((x) => (x ? { ...x, dados: { ...x.dados, [k]: e.target.value } } : x)),
  });

  const input =
    'mt-1 w-full rounded-lg border border-[rgba(21,21,33,0.15)] bg-white px-2.5 py-2 text-[13px] text-ink outline-none focus:border-ink';
  const rotulo = 'text-[10.5px] font-semibold uppercase tracking-[0.08em] text-t3';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">Conteúdo no portal</div>
          <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.03em] text-ink">{projetoNome}</h1>
          <p className="mt-0.5 text-[13px] text-t2">
            Pautas, tarefas e aprovação deste projeto rodam só no portal, sem Notion.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Link href={`?mes=${somarMes(mes, -1)}`} scroll={false} className="rounded-full bg-white px-3 py-1.5 text-[13px] text-t2 hover:text-ink" aria-label="Mês anterior">
            ‹
          </Link>
          <span className="min-w-[130px] text-center text-[14px] font-semibold capitalize text-ink">
            {MESES[m - 1]} {ano}
          </span>
          <Link href={`?mes=${somarMes(mes, 1)}`} scroll={false} className="rounded-full bg-white px-3 py-1.5 text-[13px] text-t2 hover:text-ink" aria-label="Próximo mês">
            ›
          </Link>
        </div>
      </div>

      {aviso && <div className="rounded-xl bg-[var(--prazo-em-dia-soft)] px-4 py-2.5 text-[12.5px] text-[var(--prazo-em-dia)]">{aviso}</div>}
      {erro && <div className="rounded-xl bg-[var(--prazo-atrasado-soft)] px-4 py-2.5 text-[12.5px] text-[var(--prazo-atrasado)]">{erro}</div>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setEditando({ id: null, dados: vazio(`${mes}-01`) })}
          className="rounded-full bg-ink px-4 py-2 text-[12.5px] font-semibold text-white transition hover:opacity-90"
        >
          + Nova pauta
        </button>
        {paraImportar > 0 && (
          <button
            type="button"
            disabled={ocupado === 'importar'}
            onClick={() =>
              chamar(
                `/api/conteudo/${projetoId}/importar`,
                { method: 'POST', body: JSON.stringify({ mes }) },
                'importar',
                (j) => `${j.criadas} datas trazidas do Notion. Agora é só preencher as pautas.`,
              )
            }
            className="rounded-full border border-[rgba(21,21,33,0.13)] bg-white px-4 py-2 text-[12.5px] font-semibold text-t2 transition hover:text-ink disabled:opacity-50"
          >
            {ocupado === 'importar' ? 'Trazendo…' : `Trazer ${paraImportar} datas do Notion`}
          </button>
        )}
        {pendentesCliente.length > 0 && (
          <button type="button" onClick={() => setAvisarCliente(true)} className="btn-enviar">
            📱 Avisar cliente no WhatsApp ({pendentesCliente.length})
          </button>
        )}
        {atualizando && <span className="text-[11.5px] text-t3">atualizando…</span>}
      </div>

      {linhas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[rgba(21,21,33,0.12)] bg-white px-4 py-8 text-center text-[13px] text-t3">
          Nenhuma pauta em {MESES[m - 1]} ainda.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white">
          <div className="hidden items-center gap-3 px-5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-t3 sm:flex">
            <span className="w-[92px] shrink-0">Postagem</span>
            <span className="min-w-0 flex-1">Pauta</span>
            <span className="w-[230px] shrink-0">Onde está</span>
            <span className="w-[150px] shrink-0 text-right">Ações</span>
          </div>
          <ul className="divide-y divide-[rgba(21,21,33,0.05)]">
            {linhas.map(({ post: p, atual, emProducao, pautaAprovada }) => {
              const vazia = p.titulo === 'Nova pauta' && !p.ideia.trim();
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3">
                  <span className="flex w-[92px] shrink-0 items-center gap-1.5">
                    <ChipData prazo={p.dataPostagem} hoje={hojeIso} />
                    {p.dataPostagem && <span className="text-[11px] text-t3">{diaDaSemana(p.dataPostagem)}</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPrevia(p.id)}
                    className="min-w-0 flex-1 text-left"
                    title="Abrir prévia"
                  >
                    <span className={`block truncate text-[13.5px] ${vazia ? 'italic text-t3' : 'font-medium text-ink'}`}>
                      {vazia ? 'Pauta a preencher' : p.titulo}
                    </span>
                    <span className="block truncate text-[11.5px] text-t3">
                      {[p.formato, p.editoria, p.funil, p.objetivo].filter(Boolean).join(' · ') || 'sem formato'}
                    </span>
                  </button>
                  <span className="flex w-full items-center gap-2 sm:w-[230px] sm:shrink-0">
                    {atual ? (
                      <>
                        <span className="truncate rounded-full bg-bgSoft px-2.5 py-0.5 text-[11px] font-semibold text-t1" title={atual.titulo}>
                          {atual.titulo}
                        </span>
                        {atual.prazo && <ChipData prazo={diaSp(atual.prazo)} hoje={hojeIso} />}
                      </>
                    ) : (
                      <span className="text-[11.5px] text-t3">sem tarefa aberta</span>
                    )}
                  </span>
                  <span className="flex w-full justify-end gap-1.5 sm:w-[150px] sm:shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditando({ id: p.id, dados: doPost(p) })}
                      className="rounded-full border border-[rgba(21,21,33,0.13)] bg-white px-3 py-1 text-[11.5px] font-semibold text-t2 transition hover:text-ink"
                    >
                      Editar
                    </button>
                    {!emProducao && pautaAprovada && (
                      <button
                        type="button"
                        disabled={ocupado === p.id}
                        onClick={() =>
                          chamar(`/api/conteudo/posts/${p.id}/produzir`, { method: 'POST' }, p.id, (j) => `Post em produção: ${j.tarefas} tarefas criadas com os prazos.`)
                        }
                        className="btn-enviar !px-3 !py-1 !text-[11.5px]"
                      >
                        {ocupado === p.id ? '…' : 'Produzir post'}
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="text-[11.5px] text-t3">
        Ao abrir uma pauta você vê as tarefas dela: conclua &quot;Criação de Pauta&quot; e a aprovação interna; o cliente aprova a pauta pelo portal; aí aparece &quot;Produzir post&quot;, que cria as tarefas de produção com os prazos da régua.
      </p>

      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4" onClick={() => setEditando(null)}>
          <div
            className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[rgba(21,21,33,0.08)] px-5 py-3">
              <h2 className="text-[15px] font-semibold text-ink">{editando.id ? 'Editar pauta' : 'Nova pauta'}</h2>
              <button type="button" onClick={() => setEditando(null)} aria-label="Fechar" className="text-[18px] text-t3 hover:text-ink">
                ×
              </button>
            </div>
            <div className="space-y-3 overflow-y-auto px-5 py-4">
              <label className="block">
                <span className={rotulo}>Título</span>
                <input {...campo('titulo')} className={input} placeholder="Ex.: Natal em Paris: o que ninguém te conta" />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className={rotulo}>Data de postagem</span>
                  <input type="date" {...campo('dataPostagem')} className={input} />
                </label>
                <label className="block">
                  <span className={rotulo}>Horário</span>
                  <input {...campo('horario')} className={input} placeholder="12h" />
                </label>
                <label className="block">
                  <span className={rotulo}>Formato</span>
                  <select {...campo('formato')} className={input}>
                    <option value="">—</option>
                    {FORMATOS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className={rotulo}>Editoria</span>
                  <input {...campo('editoria')} className={input} />
                </label>
                <label className="block">
                  <span className={rotulo}>Funil</span>
                  <input {...campo('funil')} className={input} list="funis" />
                  <datalist id="funis">
                    <option value="Topo" />
                    <option value="Meio" />
                    <option value="Fundo" />
                  </datalist>
                </label>
                <label className="block">
                  <span className={rotulo}>Objetivo</span>
                  <input {...campo('objetivo')} className={input} list="objetivos" />
                  <datalist id="objetivos">
                    <option value="Alcance" />
                    <option value="Engajamento" />
                    <option value="Autoridade" />
                    <option value="Conversão" />
                  </datalist>
                </label>
              </div>
              <label className="block">
                <span className={rotulo}>Ideia do post</span>
                <textarea {...campo('ideia')} rows={4} className={input} />
              </label>
              <label className="block">
                <span className={rotulo}>Informações que precisamos do cliente</span>
                <textarea {...campo('informacoesNecessarias')} rows={3} className={input} placeholder="Uma pergunta por parágrafo" />
              </label>
              <label className="block">
                <span className={rotulo}>Materiais que precisamos</span>
                <textarea {...campo('materiaisNecessarios')} rows={3} className={input} placeholder="Um material por parágrafo (fotos, vídeos, voice over…)" />
              </label>
              <label className="block">
                <span className={rotulo}>Referências</span>
                <textarea {...campo('referencias')} rows={2} className={input} placeholder="Links e notas" />
              </label>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-[rgba(21,21,33,0.08)] px-5 py-3">
              {editando.id ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm('Tirar essa pauta do calendário?')) return;
                    const ok = await chamar(`/api/conteudo/posts/${editando.id}`, { method: 'DELETE' }, 'remover');
                    if (ok) setEditando(null);
                  }}
                  className="text-[12px] text-t3 underline hover:text-[var(--prazo-atrasado)]"
                >
                  Tirar do calendário
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditando(null)} className="rounded-full px-4 py-2 text-[12.5px] text-t2 hover:text-ink">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={salvar}
                  disabled={ocupado === 'salvar'}
                  className="rounded-full bg-ink px-4 py-2 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {ocupado === 'salvar' ? 'Salvando…' : 'Salvar pauta'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {previa && <PreviaPostModal postId={previa} fechar={() => setPrevia(null)} />}

      {avisarCliente && (
        <ModalMensagem
          projetoId={projetoId}
          clienteNome={projetoNome}
          gruposWpp={gruposWpp}
          titulo="Avisar cliente no WhatsApp"
          itens={pendentesCliente}
          textos={textos}
          hojeIso={hojeIso}
          fechar={() => setAvisarCliente(false)}
          aoEnviar={(grupo) => {
            setAvisarCliente(false);
            setAviso(grupo ? `Mensagem enviada no grupo ${grupo}.` : 'Mensagem enviada.');
            recarregar();
          }}
        />
      )}
    </div>
  );
}
