'use client';
import { ComentariosLud } from '@/app/post/[id]/ComentariosLud';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { compararNoFluxo } from '@/lib/etapas-projeto';
import type { TarefaDoPost } from '@/lib/notion';
import { HistoricoResumo, TodasTarefasCard } from '@/app/post/[id]/PostSidebarLud';
import { ehTarefaDoCliente } from '@/lib/etapas-projeto';
import { BotaoLembreteWpp } from './BotaoLembreteWpp';
import { nomeCurtoDoProjeto } from '@/lib/rotas';
import type { EnvioHistorico, NotaHistorico, TarefaClienteHistorico } from '@/lib/historico-post';
import { CaixaProgramacao, ReguaCompacta } from '@/app/post/[id]/NovoLud';
import { horaCurta } from '@/app/post/[id]/horaCurta';
import { avisarConcluida } from '@/app/_ui/DesfazerConcluir';
import { emojiDoFormato } from '@/app/admin/esteira-copy/EsteiraNova';
import { SolicitarAlteracao } from '@/app/post/[id]/SolicitarAlteracao';

type Arquivo = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
};
type Tarefa = TarefaDoPost & { pessoa: string | null };
type Preview = {
  titulo: string;
  projetoNome?: string;
  hora?: string | null;
  legenda: string;
  formatoTipo: string;
  dataPostagem: string | null;
  formato: string;
  status: string | null;
  arquivos: Arquivo[];
  tarefas: Tarefa[];
  colaboradores?: Record<string, string>;
  /** Só pro admin: últimas atualizações do post. */
  historico?: { visualizacoes: { email: string; vistoEm: string }[]; envios: EnvioHistorico[] } | null;
  notas?: NotaHistorico[];
  tarefasCliente?: TarefaClienteHistorico[];
  ideia?: string | null;
  briefing?: string | null;
  roteiro?: string | null;
  cards?: string | null;
  /** Seções da página do Notion (ideia, briefing, referências, informações, materiais, voice over, roteiro…). */
  secoes?: { titulo: string; linhas: { tipo: 'p' | 'li' | 'ol'; texto: string; destaque?: boolean; negrito?: boolean }[] }[];
};

type Secao = NonNullable<Preview['secoes']>[number];
/** Linhas "Rótulo: valor" do Briefing do Post que viram etiquetas no topo do popup. */
const ROTULOS_TOPO: [RegExp, string][] = [
  [/^objetivo$/i, '🎯'],
  [/^funil$/i, '🔻'],
  [/^o que precisamos de voc[êe]$/i, '🎥'],
];
const separarRotulo = (t: string) => {
  const m = t.match(/^([^:]{2,40}):\s*(.*)$/);
  return m ? { rotulo: m[1].trim(), resto: m[2].trim() } : null;
};
const ehRotuloDoTopo = (t: string) => {
  const r = separarRotulo(t);
  return !!r && (/^formato$/i.test(r.rotulo) || ROTULOS_TOPO.some(([rx]) => rx.test(r.rotulo)));
};
function emojiDaSecao(t: string): string {
  if (/ideia/i.test(t)) return '💡';
  if (/briefing/i.test(t)) return '📋';
  if (/refer/i.test(t)) return '🔗';
  if (/informa/i.test(t)) return '❓';
  if (/materia/i.test(t)) return '🎥';
  if (/voice|voz|grava/i.test(t)) return '🎙️';
  if (/roteiro|take/i.test(t)) return '🎬';
  if (/card|carrossel|copy/i.test(t)) return '🗂️';
  return '📄';
}

/** Links do texto viram um link curto (só o site), em vez da URL inteira estourando o card. */
const RX_URL = /(https?:\/\/[^\s)]+)/g;
function comLinks(texto: string): React.ReactNode {
  if (!RX_URL.test(texto)) return texto;
  return texto.split(RX_URL).map((parte, k) => {
    if (!/^https?:\/\//.test(parte)) return parte.replace(/:\s*$/, ': ');
    let site = parte;
    try {
      site = new URL(parte).hostname.replace(/^www\./, '');
    } catch {}
    return (
      <a key={k} href={parte} target="_blank" rel="noreferrer" title={parte} className="font-semibold text-[#24466B] underline decoration-[#B9D3EC] underline-offset-2 hover:decoration-[#24466B]">
        {site} ↗
      </a>
    );
  });
}

/** Linhas que não entram na prévia: rótulos que já estão no topo, notas de atualização, subtítulo que repete a seção. */
function linhasVisiveis(s: Secao): Secao['linhas'] {
  return s.linhas.filter((l) => {
    if (/briefing do post/i.test(s.titulo) && ehRotuloDoTopo(l.texto)) return false;
    if (/^atualiza[çc][ãa]o\b/i.test(l.texto.trim())) return false;
    const t = l.texto.trim().replace(/:$/, '').toLowerCase();
    if (/briefing/i.test(s.titulo) && /^briefing (para|pra) (a )?equipe$/.test(t)) return false;
    return true;
  });
}

/** Seção do Notion sem moldura (a prévia é uma leitura só, separada por linhas finas). */
function SecaoPlana({ s, id }: { s: Secao; id: string }) {
  const linhas = linhasVisiveis(s);
  if (!linhas.length) return null;
  // Informações: cada pergunta num cartão numerado.
  if (/informa/i.test(s.titulo) && linhas.every((l) => l.tipo !== 'p' || /\?$/.test(l.texto.trim()))) {
    return (
      <section id={id} className="flex scroll-mt-4 flex-col gap-3 border-t border-[#F0F0F2] py-6 first:border-0 first:pt-0">
        <TituloSecao titulo={s.titulo} />
        <div className="grid gap-2.5 sm:grid-cols-2">
          {linhas.map((l, k) => (
            <div key={k} className="flex gap-2.5 rounded-[12px] border border-[#EDEDEF] px-3 py-2.5">
              <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[#F0F0F1] text-[11px] font-extrabold">{k + 1}</span>
              <span className="text-[13px] font-semibold leading-[1.45] text-[#111113]">{comLinks(l.texto)}</span>
            </div>
          ))}
        </div>
      </section>
    );
  }
  const blocos: React.ReactNode[] = [];
  for (let k = 0; k < linhas.length; k++) {
    const l = linhas[k];
    if (l.tipo === 'li' || l.tipo === 'ol') {
      const grupo = [l];
      while (k + 1 < linhas.length && linhas[k + 1].tipo === l.tipo) grupo.push(linhas[++k]);
      const Tag = l.tipo === 'ol' ? 'ol' : 'ul';
      blocos.push(
        <Tag key={k} className={`flex flex-col gap-1 pl-5 text-[13px] leading-[1.5] text-[#2C2C30] ${l.tipo === 'ol' ? 'list-decimal' : 'list-disc'}`}>
          {grupo.map((g, j) => (
            <li key={j}>{comLinks(g.texto)}</li>
          ))}
        </Tag>,
      );
      continue;
    }
    if (l.destaque) {
      blocos.push(
        <p key={k} className="rounded-[8px] bg-[#FBEFF4] px-2.5 py-1.5 text-[12.5px] leading-[1.45] text-[#A8476B]">
          {comLinks(l.texto)}
        </p>,
      );
      continue;
    }
    const r = separarRotulo(l.texto);
    if ((l.negrito && !r?.resto) || (r && !r.resto)) {
      blocos.push(
        <span key={k} className="mt-1 text-[13px] font-extrabold text-[#111113]">
          {(r?.rotulo ?? l.texto).replace(/:$/, '')}
        </span>,
      );
      continue;
    }
    // "Ideia do post:" dentro do Briefing repete o título da seção de cima: mostra só o texto.
    const repete = r && /ideia do post/i.test(r.rotulo) && !/ideia/i.test(s.titulo);
    blocos.push(
      <p key={k} className="text-[13.5px] leading-[1.55] text-[#2C2C30]">
        {r && r.rotulo.length <= 28 && !repete ? (
          <>
            <b className="font-bold text-[#111113]">{r.rotulo}:</b> {comLinks(r.resto)}
          </>
        ) : (
          comLinks(repete ? r!.resto : l.texto)
        )}
      </p>,
    );
  }
  return (
    <section id={id} className="flex min-w-0 scroll-mt-4 flex-col gap-2.5 break-words border-t border-[#F0F0F2] py-6 [overflow-wrap:anywhere] first:border-0 first:pt-0">
      <TituloSecao titulo={s.titulo} />
      {blocos}
    </section>
  );
}
function TituloSecao({ titulo, direita }: { titulo: string; direita?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-[16px] font-extrabold tracking-[-0.01em] text-[#111113]">
      <span className="w-5 text-center">{emojiDaSecao(titulo)}</span>
      {titulo}
      {direita && <span className="ml-auto text-[12.5px] font-semibold text-[#8A8A90]">{direita}</span>}
    </div>
  );
}
/** Materiais: o que pedimos vira quadradinho; enquanto a etapa de materiais estiver aberta, conta como não recebido. */
function SecaoMateriais({ s, id, recebidos, tarefaId }: { s: Secao; id: string; recebidos: boolean; tarefaId: string | null }) {
  const itens = linhasVisiveis(s).filter((l) => l.texto.trim().length > 1);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function anexar(files: FileList | null) {
    if (!files?.length || !tarefaId) return;
    setEnviando(true);
    setMsg(null);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append('arquivos', f));
      const r = await fetch(`/api/admin/tarefas/${tarefaId}/anexar`, { method: 'POST', body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? `Erro ${r.status}`);
      setMsg(`${files.length} ${files.length === 1 ? 'arquivo enviado' : 'arquivos enviados'} pro Drive do post`);
    } catch (e: any) {
      setMsg(e?.message ?? 'Não consegui enviar.');
    } finally {
      setEnviando(false);
    }
  }
  const icone = (t: string) => (/foto|imagem|print/i.test(t) ? '📸' : /v[íi]deo|reels/i.test(t) ? '🎬' : /[áa]udio|voz|voice/i.test(t) ? '🎙' : /link/i.test(t) ? '🔗' : '📎');
  return (
    <section id={id} className="flex scroll-mt-4 flex-col gap-3 border-t border-[#F0F0F2] py-6 first:border-0 first:pt-0">
      <TituloSecao titulo={s.titulo} direita={recebidos ? <span className="text-[#2E5520]">recebidos</span> : <span className="text-[#B42318]">nada recebido ainda</span>} />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {itens.map((l, k) => (
          <div key={k} className={`overflow-hidden rounded-[12px] border bg-white ${recebidos ? 'border-[#EDEDEF]' : 'border-[#EDEDEF]'}`}>
            <div className={`relative flex aspect-[4/3] items-center justify-center text-[24px] ${recebidos ? 'bg-[#EEF4EA]' : 'border-b-[1.5px] border-dashed border-[#E2E2E5] bg-[#FAFAFB]'}`}>
              {icone(l.texto)}
              {recebidos && <span className="absolute right-2 top-2 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#2E7D4F] text-[11px] text-white">✓</span>}
            </div>
            <div className="px-2.5 pb-2 pt-2 text-[12.5px] font-bold leading-[1.35] text-[#111113]">{l.texto}</div>
            <div className={`px-2.5 pb-2.5 text-[11.5px] ${recebidos ? 'text-[#2E5520]' : 'font-semibold text-[#B42318]'}`}>{recebidos ? 'recebido' : 'falta'}</div>
          </div>
        ))}
        {tarefaId && (
          <label className="flex cursor-pointer flex-col overflow-hidden rounded-[12px] border-[1.5px] border-dashed border-[#B9B9BE] bg-[#FAFAFB] hover:bg-[#F4F4F5]">
            <input type="file" multiple className="hidden" onChange={(e) => anexar(e.target.files)} disabled={enviando} />
            <span className="flex aspect-[4/3] items-center justify-center">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#111113] text-[20px] font-bold text-white">{enviando ? '…' : '+'}</span>
            </span>
            <span className="px-2.5 pt-2 text-[12.5px] font-bold text-[#111113]">Adicionar material</span>
            <span className="px-2.5 pb-2.5 text-[11.5px] text-[#8A8A90]">{msg ?? 'vai pro Drive do post'}</span>
          </label>
        )}
      </div>
    </section>
  );
}

/** Lê o "Briefing do Post": objetivo, funil e o que precisamos do cliente (vão pro topo). */
function categoriasDoBriefing(secoes: Secao[]) {
  const b = secoes.find((x) => /briefing do post/i.test(x.titulo));
  const valor = (rx: RegExp) => {
    const l = b?.linhas.find((x) => {
      const r = separarRotulo(x.texto);
      return r && rx.test(r.rotulo) && r.resto;
    });
    return l ? separarRotulo(l.texto)!.resto : null;
  };
  const curto = (t: string | null) => (t ? t.replace(/\s*\(.*\)\s*$/, '').trim() : null);
  return { objetivo: curto(valor(/^objetivo$/i)), funil: curto(valor(/^funil$/i)), precisamos: valor(/^o que precisamos de voc[êe]$/i) };
}
/** "Informações + materiais" → "Info + material" (o texto inteiro fica no title). */
const precisamosCurto = (t: string) =>
  t
    .replace(/informa[çc](ões|ão)/gi, 'Info')
    .replace(/materiais/gi, 'material')
    .replace(/\s*\(.*\)\s*$/, '')
    .trim()
    .slice(0, 28);

const DIA_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function dataPostagemTexto(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}


function prazoCurto(iso: string | null): { texto: string; atrasada: boolean } {
  if (!iso) return { texto: 'sem prazo', atrasada: false };
  const [y, m, d] = iso.split('T')[0].split('-').map(Number);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dias = Math.round((new Date(y, m - 1, d).getTime() - hoje.getTime()) / 86_400_000);
  const data = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
  if (dias === 0) return { texto: `${data} · hoje`, atrasada: false };
  if (dias === 1) return { texto: `${data} · amanhã`, atrasada: false };
  if (dias < 0) return { texto: data, atrasada: true };
  return { texto: data, atrasada: false };
}

function TarefasResumo({ tarefas: iniciais }: { tarefas: Tarefa[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [tarefas, setTarefas] = useState(iniciais);
  // Concluídas aqui no popup: guardam o status anterior pro "desfazer".
  const [agora, setAgora] = useState<Record<string, string | null>>({});
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Marca que houve alteração — o refresh da página de trás acontece no
  // CLEANUP (quando o modal fecha). Se fizesse router.refresh() no concluir,
  // o Suspense pai poderia remontar e fechar o modal no meio do fluxo.
  const houveMutacao = useRef(false);

  useEffect(() => setTarefas(iniciais), [iniciais]);

  useEffect(() => {
    return () => {
      // startTransition evita o Suspense pai disparar fallback (tela branca):
      // o UI atual fica visível enquanto o novo payload chega em background.
      if (houveMutacao.current) startTransition(() => router.refresh());
    };
  }, [router]);

  if (tarefas.length === 0) return null;
  const abertas = tarefas
    .filter((t) => t.aberta || t.tarefaId in agora)
    .sort((a, b) => compararNoFluxo(a as any, b as any));
  const concluidas = tarefas.filter((t) => !t.aberta).length;
  const pct = Math.round((concluidas / tarefas.length) * 100);
  const visiveis = abertas.slice(0, 6);

  async function concluir(t: Tarefa) {
    setSalvando(t.tarefaId);
    setErro(null);
    try {
      const res = await fetch(`/api/tarefas/${t.tarefaId}/concluir`, { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `Erro ${res.status}`);
      setTarefas((ts) => ts.map((x) => (x.tarefaId === t.tarefaId ? { ...x, aberta: false } : x)));
      avisarConcluida(t.tarefaId, t.titulo);
      setAgora((a) => ({ ...a, [t.tarefaId]: t.status }));
      // router.refresh() foi movido pro cleanup — a página de trás atualiza
      // quando o modal fecha, pra não desmontar o modal no meio do fluxo.
      houveMutacao.current = true;
    } catch (e: any) {
      setErro(e?.message ?? 'Não consegui concluir.');
    } finally {
      setSalvando(null);
    }
  }

  async function desfazer(t: Tarefa) {
    setSalvando(t.tarefaId);
    setErro(null);
    try {
      const res = await fetch(`/api/tarefas/${t.tarefaId}/reabrir`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: agora[t.tarefaId] }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `Erro ${res.status}`);
      setTarefas((ts) => ts.map((x) => (x.tarefaId === t.tarefaId ? { ...x, aberta: true } : x)));
      houveMutacao.current = true; // refresh roda quando o modal fecha
      setAgora((a) => {
        const n = { ...a };
        delete n[t.tarefaId];
        return n;
      });
    } catch (e: any) {
      setErro(e?.message ?? 'Não consegui desfazer.');
    } finally {
      setSalvando(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">Tarefas</div>
        <span className="font-mono text-[10.5px] text-t3">
          {concluidas}/{tarefas.length}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-bgSoft">
        <div className="h-full rounded-full bg-ink transition-all" style={{ width: `${pct}%` }} />
      </div>
      {visiveis.length > 0 ? (
        <ul className="space-y-0.5">
          {visiveis.map((t) => {
            const p = prazoCurto(t.prazo);
            const feita = !t.aberta;
            const ocupada = salvando === t.tarefaId;
            return (
              <li key={t.tarefaId} className="flex items-baseline gap-2 text-[12px]">
                <button
                  type="button"
                  onClick={() => (feita ? desfazer(t) : concluir(t))}
                  disabled={ocupada}
                  title={feita ? 'Desfazer' : 'Concluir tarefa'}
                  aria-label={feita ? `Desfazer conclusão de ${t.titulo}` : `Concluir ${t.titulo}`}
                  className={`group shrink-0 leading-none transition ${feita ? 'text-ink' : 'text-t3 hover:text-ink'} disabled:opacity-40`}
                >
                  {ocupada ? '…' : feita ? '✓' : (
                    <>
                      <span className="group-hover:hidden">○</span>
                      <span className="hidden group-hover:inline">✓</span>
                    </>
                  )}
                </button>
                <span
                  className={`min-w-0 flex-1 truncate ${feita ? 'text-t3 line-through' : 'text-ink'}`}
                  title={t.titulo}
                >
                  {t.titulo}
                </span>
                {feita ? (
                  <button
                    type="button"
                    onClick={() => desfazer(t)}
                    disabled={ocupada}
                    className="shrink-0 text-[11px] text-t3 underline hover:text-ink"
                  >
                    desfazer
                  </button>
                ) : (
                  <>
                    {t.pessoa && <span className="shrink-0 text-[11px] text-t3">{t.pessoa.split(' ')[0]}</span>}
                    <span
                      className={`shrink-0 font-mono text-[10.5px] ${
                        p.atrasada ? 'font-semibold text-[var(--prazo-atrasado)]' : 'text-t2'
                      }`}
                    >
                      {p.atrasada ? `atrasada · ${p.texto}` : p.texto}
                    </span>
                  </>
                )}
              </li>
            );
          })}
          {abertas.length > visiveis.length && (
            <li className="text-[11px] text-t3">+{abertas.length - visiveis.length} em aberto</li>
          )}
        </ul>
      ) : (
        <p className="text-[12px] text-t2">Tudo concluído ✓</p>
      )}
      {erro && <p className="text-[11px] font-semibold text-ink">{erro}</p>}
      {concluidas > 0 && visiveis.length > 0 && (
        <p className="text-[11px] text-t3">
          ✓ {concluidas} {concluidas === 1 ? 'concluída' : 'concluídas'}
        </p>
      )}
    </div>
  );
}

function tipoArquivo(mime: string, nome: string): 'imagem' | 'video' | 'audio' | 'outro' {
  const m = mime.toLowerCase();
  const n = nome.toLowerCase();
  if (m.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(n)) return 'imagem';
  if (m.startsWith('video/') || /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(n)) return 'video';
  if (m.startsWith('audio/') || /\.(mp3|m4a|wav|ogg|aac|flac)$/i.test(n)) return 'audio';
  return 'outro';
}

function hojeSP(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}
function somaDiasIso(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** "hoje, qua 21/10" / "amanhã, qui 22/10" / "seg 20/10". */
function prazoLongo(iso: string, hoje: string): string {
  const d = iso.slice(0, 10);
  const [y, m, dd] = d.split('-').map(Number);
  const sem = DIA_SEMANA[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()];
  const base = `${sem} ${String(dd).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
  if (d === hoje) return `hoje, ${base}`;
  if (d === somaDiasIso(hoje, 1)) return `amanhã, ${base}`;
  if (d === somaDiasIso(hoje, -1)) return `ontem, ${base}`;
  return base;
}

/** Rótulo curto da etapa na régua ("Aprovação | Arte" vira "Aprov. arte"). */
function rotuloRegua(titulo: string): string {
  const t = titulo.trim();
  const m = /^(aprovação|alteração)\s*\|\s*(.+)$/i.exec(t);
  if (m) {
    const resto = m[2].trim().toLowerCase();
    if (/^post$/.test(resto)) return m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
    return `${m[1].slice(0, 5)}. ${resto}`.replace(/^./, (c) => c.toUpperCase());
  }
  return t.length > 16 ? t.slice(0, 15) + '…' : t;
}

/** Linha discreta "Prazo desta etapa: X · mudar" (muda a Data Entrega no Notion). */
function PrazoDaEtapa({ tarefaId, prazo, hoje, onMudou }: { tarefaId: string; prazo: string | null; hoje: string; onMudou: (novo: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const dow = new Date(hoje + 'T12:00:00Z').getUTCDay();
  const proxSeg = somaDiasIso(hoje, ((8 - dow) % 7) || 7);
  async function salvar(novo: string) {
    if (!novo) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/admin/tarefas/${tarefaId}/prazo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prazo: novo }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'erro');
      onMudou(novo);
      setAberto(false);
    } catch (e: any) {
      setErro(e?.message ?? 'erro');
    } finally {
      setSalvando(false);
    }
  }
  const atrasada = !!prazo && prazo.slice(0, 10) < hoje;
  const cor = !prazo ? '#636369' : atrasada ? '#7E211C' : prazo.slice(0, 10) === hoje ? '#7A1F4C' : '#111113';
  return (
    <span className="relative flex flex-wrap items-center gap-1.5 text-[12.5px] text-[#46464B]">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: cor }} />
      Prazo desta etapa:
      <b style={{ color: cor }}>{salvando ? 'salvando…' : prazo ? prazoLongo(prazo, hoje) : 'sem prazo'}</b>
      {atrasada && <span className="text-[#7E211C]">· atrasada</span>}
      <span className="text-[#8A8A90]">·</span>
      <button type="button" onClick={() => setAberto(!aberto)} className="font-bold text-[#46464B] underline underline-offset-2 hover:text-[#111113]">
        mudar
      </button>
      {aberto && (
        <span className="absolute left-0 top-[calc(100%+6px)] z-20 flex w-[230px] flex-col gap-1.5 rounded-[14px] border border-[#E9E9EB] bg-white p-2.5 shadow-[0_8px_24px_rgba(17,17,19,0.12)]">
          <span className="grid grid-cols-2 gap-1.5">
            {[
              ['Hoje', hoje],
              ['Amanhã', somaDiasIso(hoje, 1)],
              ['Segunda', proxSeg],
              ['+1 semana', somaDiasIso(hoje, 7)],
            ].map(([l, d]) => (
              <button key={l} type="button" disabled={salvando} onClick={() => salvar(d)} className="rounded-[9px] border border-[#E9E9EB] px-2 py-1.5 text-[12px] font-bold hover:border-[#111113] disabled:opacity-50">
                {l}
              </button>
            ))}
          </span>
          <input type="date" defaultValue={prazo?.slice(0, 10) ?? hoje} onChange={(e) => salvar(e.target.value)} className="rounded-[9px] border border-[#D6D6D9] px-2 py-1.5 text-[12.5px] outline-none focus:border-[#111113]" />
          {erro && <span className="px-1 text-[11.5px] text-[#7E211C]">Não salvou: {erro}</span>}
          <button type="button" onClick={() => setAberto(false)} className="text-[11.5px] text-[#636369] hover:text-[#111113]">
            Fechar
          </button>
        </span>
      )}
    </span>
  );
}

/** Régua das etapas do post: feito claro, agora destacado, depois com contorno. */
function Regua({ tarefas, agoraId }: { tarefas: Tarefa[]; agoraId: string | null }) {
  if (tarefas.length === 0) return null;
  const idxAgora = tarefas.findIndex((t) => t.tarefaId === agoraId);
  return (
    <div className="overflow-x-auto min-h-fit pb-1">
      <ol className="flex min-w-max items-start">
        {tarefas.map((t, i) => {
          const agora = t.tarefaId === agoraId;
          const feito = !t.aberta;
          const depois = !feito && !agora;
          return (
            <li key={t.tarefaId} className="relative flex w-[92px] flex-col items-center gap-1.5" title={t.titulo}>
              {i > 0 && <span className={`absolute right-1/2 top-[9px] h-[2px] w-full ${idxAgora >= 0 && i <= idxAgora ? 'bg-[#D6D6D9]' : depois ? 'bg-[#46464B]' : 'bg-[#E9E9EB]'}`} />}
              <span
                className={`relative z-10 flex items-center justify-center rounded-full ${
                  agora ? 'h-[20px] w-[20px] border-[3px] border-[#B42318] bg-[#B42318] ring-4 ring-[#F6CFCB]' : feito ? 'h-[18px] w-[18px] bg-[#E9E9EB] text-[9px] text-[#8A8A90]' : 'h-[18px] w-[18px] border-2 border-[#46464B] bg-white'
                }`}
              >
                {feito ? '✓' : ''}
              </span>
              {agora ? (
                <span className="whitespace-nowrap rounded-full bg-[#F6CFCB] px-1.5 py-px text-[11px] font-extrabold text-[#7E211C]">{rotuloRegua(t.titulo)}</span>
              ) : (
                <span className={`max-w-[88px] truncate text-center text-[11px] ${feito ? 'text-[#8A8A90]' : 'font-extrabold text-[#111113]'}`}>{rotuloRegua(t.titulo)}</span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const TIPOS_COMENTARIO = new Set<NotaHistorico['tipo']>(['cliente_comentou', 'cliente_alteracao', 'equipe']);

function quandoNota(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
  const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(d).replace(':', 'h');
  const hoje = hojeSP();
  if (dia === hoje) return `hoje ${hora}`;
  if (dia === somaDiasIso(hoje, -1)) return `ontem ${hora}`;
  return `${dia.slice(8)}/${dia.slice(5, 7)} ${hora}`;
}

/* Cache da prévia no navegador: abrir de novo é na hora, e passar o mouse no post já começa a buscar. */
const cachePrevia = new Map<string, { em: number; p: Promise<any>; dado?: any }>();
function buscarPrevia(postId: string, forcar = false): Promise<any> {
  const c = cachePrevia.get(postId);
  if (!forcar && c && Date.now() - c.em < 20_000) return c.p;
  const p = fetch(`/api/post/${postId}/preview`, { cache: 'no-store' }).then(async (res) => {
    const j = await res.json();
    if (!res.ok) throw new Error(j.error ?? `Erro ${res.status}`);
    const atual = cachePrevia.get(postId);
    if (atual) atual.dado = j;
    return j;
  });
  cachePrevia.set(postId, { em: Date.now(), p, dado: c?.dado });
  p.catch(() => cachePrevia.delete(postId));
  return p;
}
/** Chame no onMouseEnter/onFocus de quem abre o popup: a prévia já vem pronta no clique. */
export function prefetchPrevia(postId: string | null | undefined) {
  if (postId) buscarPrevia(postId).catch(() => {});
}

export function PreviaPostModal({
  postId,
  tarefaId,
  fechar,
}: {
  postId: string;
  tarefaId?: string | null;
  fechar: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Se já tem a prévia no cache (aberta antes ou buscada no hover), mostra na hora e atualiza por trás.
  const [preview, setPreview] = useState<Preview | null>(() => (cachePrevia.get(postId)?.dado as Preview) ?? null);
  // Página completa volta pra onde o popup foi aberto (projeto, aprovações…).
  const hrefCompleto = (() => {
    const q = new URLSearchParams();
    if (tarefaId) q.set('tarefa', tarefaId);
    if (typeof window !== 'undefined') q.set('voltar', window.location.pathname + window.location.search);
    const qs = q.toString();
    return `/post/${postId}${qs ? `?${qs}` : ''}`;
  })();
  const [erro, setErro] = useState<string | null>(null);
  const [ativo, setAtivo] = useState(0);
  const [concluindo, setConcluindo] = useState(false);
  const [erroEtapa, setErroEtapa] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [aba, setAba] = useState<'post' | 'tarefas' | 'comentarios' | 'historico'>('post');
  const houveMutacao = useRef(false);
  const hoje = hojeSP();
  const [altAberto, setAltAberto] = useState(false);

  async function carregar() {
    return (await buscarPrevia(postId, true)) as Preview;
  }

  useEffect(() => {
    let cancelado = false;
    (buscarPrevia(postId) as Promise<Preview>)
      .then((j) => !cancelado && setPreview(j))
      .catch((e: any) => !cancelado && setErro(e?.message ?? 'erro'));
    return () => {
      cancelado = true;
    };
  }, [postId]); // eslint-disable-line react-hooks/exhaustive-deps

  // A tela de trás atualiza quando o popup fecha (não no meio do fluxo).
  useEffect(() => {
    return () => {
      if (houveMutacao.current) startTransition(() => router.refresh());
    };
  }, [router]);

  // ESC fecha; setas trocam a arte.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') fechar();
      if (preview && preview.arquivos.length > 1) {
        if (e.key === 'ArrowLeft') setAtivo((i) => Math.max(0, i - 1));
        if (e.key === 'ArrowRight') setAtivo((i) => Math.min(preview.arquivos.length - 1, i + 1));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fechar, preview]);

  const arquivoAtivo = preview?.arquivos[ativo] ?? null;
  const semArte = !!preview && preview.arquivos.length === 0;
  const tipo = arquivoAtivo ? tipoArquivo(arquivoAtivo.mimeType, arquivoAtivo.name) : null;

  // Etapas do post na ordem do Notion (Ordem → Ordem (1)); agora = primeira aberta.
  const fluxo = (preview?.tarefas ?? [])
    .filter((t) => t.status !== 'Cancelado' && t.status !== 'Excluída')
    .slice()
    .sort((a, b) => compararNoFluxo(a as any, b as any));
  const agora = fluxo.find((t) => t.aberta) ?? null;
  const handle = preview?.projetoNome ? nomeCurtoDoProjeto(preview.projetoNome) : null;
  const iniciais = (handle ?? '?').replace(/^@/, '').slice(0, 2).toUpperCase();
  const hashtags = (preview?.legenda.match(/#[\p{L}0-9_]+/gu) ?? []) as string[];

  function mudarPrazoLocal(novo: string) {
    if (!agora) return;
    houveMutacao.current = true;
    setPreview((p) => (p ? { ...p, tarefas: p.tarefas.map((t) => (t.tarefaId === agora.tarefaId ? { ...t, prazo: novo } : t)) } : p));
  }

  async function concluirEtapa() {
    if (!agora) return;
    setConcluindo(true);
    setErroEtapa(null);
    try {
      const res = await fetch(`/api/tarefas/${agora.tarefaId}/concluir`, { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `Erro ${res.status}`);
      avisarConcluida(agora.tarefaId);
      houveMutacao.current = true;
      setPreview((p) => (p ? { ...p, tarefas: p.tarefas.map((t) => (t.tarefaId === agora.tarefaId ? { ...t, aberta: false } : t)) } : p));
    } catch (e: any) {
      setErroEtapa(e?.message ?? 'Não consegui concluir.');
    } finally {
      setConcluindo(false);
    }
  }

  async function copiarLegenda() {
    try {
      await navigator.clipboard.writeText(preview?.legenda ?? '');
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      /* sem permissão */
    }
  }

  /** Pedir alteração de arte e/ou copy (o mesmo da página completa): no popover do topo e na aba Tarefas. */
  function blocoAlteracao() {
    if (!preview) return null;
    const pedido = preview.tarefas.find((t) => t.titulo.trim() === 'Alteração | Post' && t.aberta && !t.finalizada);
    const resp = (titulo: string) => preview.tarefas.filter((t) => t.titulo.trim() === titulo).find((t) => t.pessoaNome)?.pessoaNome ?? null;
    const comentarios = (preview.notas ?? [])
      .filter((n) => n.tipo === 'cliente_comentou' || n.tipo === 'cliente_alteracao')
      .map((n) => ({
        quando: n.quando,
        tipo: (n.tipo === 'cliente_alteracao' ? 'alteracao' : 'comentou') as 'alteracao' | 'comentou',
        autor: n.autor ?? null,
        trecho: n.corpo || n.titulo,
      }));
    return (
      <div onClickCapture={() => (houveMutacao.current = true)}>
        <SolicitarAlteracao
          key={postId}
          postId={postId}
          pedido={pedido ? { tarefaId: pedido.tarefaId, prazo: pedido.prazo } : null}
          comentarios={comentarios}
          responsaveis={{ arte: resp('Arte'), copy: resp('Briefing & Copy') }}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111113]/60 p-4" onClick={fechar}>
      <div className="relative flex max-h-[92vh] w-full max-w-[1180px] flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-3 border-b border-[#E9E9EB] px-6 py-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span
              className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[#F4F4F5] text-[22px] sm:flex"
              title={preview?.formato || 'Formato'}
            >
              {preview ? emojiDoFormato(preview.formato) ?? '📝' : ''}
            </span>
            <div className="min-w-0">
              {preview?.projetoNome && <div className="truncate text-[12px] font-bold text-[#636369]">{handle !== 'Projeto' ? handle : preview.projetoNome}</div>}
              <div className="truncate text-[18px] font-extrabold tracking-[-0.01em] text-[#111113]">{preview?.titulo ?? 'Carregando…'}</div>
              {preview &&
                (() => {
                  const c = categoriasDoBriefing(preview.secoes ?? []);
                  const nivel = c.funil ? (/topo/i.test(c.funil) ? 0 : /meio/i.test(c.funil) ? 1 : /fundo/i.test(c.funil) ? 2 : -1) : -1;
                  const sep = <span className="h-[18px] w-px bg-[#E2E2E5]" aria-hidden />;
                  return (
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      {/* Dados do post: texto cinza, sem caixa */}
                      {preview.dataPostagem && <span className="whitespace-nowrap text-[12.5px] font-semibold text-[#636369]">📅 {dataPostagemTexto(preview.dataPostagem)}</span>}
                      {preview.formato && <span className="whitespace-nowrap text-[12.5px] font-semibold text-[#636369]">{emojiDoFormato(preview.formato) ?? '📝'} {preview.formato}</span>}
                      {(c.objetivo || nivel >= 0) && sep}
                      {/* Categorias: etiqueta com o nome do campo */}
                      {c.objetivo && (
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[8px] bg-[#E8E4FA] px-2 py-[3px] text-[12px] font-extrabold text-[#3E2F8F]" title={`Objetivo: ${c.objetivo}`}>
                          <small className="text-[9.5px] uppercase tracking-[0.08em] opacity-65">Objetivo</small>
                          <span className="max-w-[160px] truncate">{c.objetivo}</span>
                        </span>
                      )}
                      {c.funil && (
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[8px] bg-[#F4F4F5] px-2 py-[3px] text-[12px] font-extrabold text-[#111113]" title="Funil: topo · meio · fundo">
                          <small className="text-[9.5px] uppercase tracking-[0.08em] opacity-65">Funil</small>
                          {nivel >= 0 && (
                            <span className="inline-flex items-center gap-[3px]">
                              {['#2E7D4F', '#D99A2B', '#D9564F'].map((cor, k) => (
                                <i key={k} className="inline-block h-[9px] w-[9px] rounded-full" style={{ background: k === nivel ? cor : '#D6D6D9' }} />
                              ))}
                            </span>
                          )}
                          {c.funil}
                        </span>
                      )}
                      {c.precisamos && (
                        <>
                          {sep}
                          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border-[1.5px] border-dashed border-[#E7B96A] bg-[#FFF8EC] px-2.5 py-[2px] text-[12px] font-extrabold text-[#7A4A0B]" title={`O que precisamos: ${c.precisamos}`}>
                            🙋 {precisamosCurto(c.precisamos)}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })()}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {preview && (
              <span className="relative">
                <button
                  type="button"
                  onClick={() => setAltAberto((v) => !v)}
                  aria-expanded={altAberto}
                  className={`inline-flex h-10 items-center gap-1.5 rounded-[12px] border px-3.5 text-[13px] font-extrabold text-[#111113] hover:bg-[#F4F4F5] ${altAberto ? 'border-[#111113] bg-[#F4F4F5]' : 'border-[#D6D6D9] bg-white'}`}
                >
                  ✏️ <span className="hidden sm:inline">Pedir alteração</span> <span className="text-[10px] opacity-60">▾</span>
                </button>
                {altAberto && (
                  <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-[380px] rounded-[16px] border border-[#E9E9EB] bg-white p-4 shadow-[0_14px_36px_rgba(17,17,19,0.16)]">
                    <b className="mb-2 flex items-center gap-2 text-[14px]">✏️ Pedir alteração</b>
                    {blocoAlteracao()}
                  </div>
                )}
              </span>
            )}
            <a href={hrefCompleto} className="inline-flex h-10 items-center gap-1.5 rounded-[12px] border border-[#D6D6D9] bg-white px-3.5 text-[13px] font-extrabold text-[#111113] hover:bg-[#F4F4F5]">
              ↗ <span className="hidden sm:inline">Abrir completo</span>
            </a>
            <button type="button" onClick={fechar} aria-label="Fechar" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F4F5] text-[18px] text-[#46464B] hover:bg-[#E9E9EB]">
              ×
            </button>
          </div>
        </div>

        {/* Abas */}
        {preview && (
          <nav aria-label="Abas da prévia" className="mx-6 mt-3 flex w-fit max-w-[calc(100%-48px)] gap-0.5 overflow-x-auto min-h-fit rounded-[12px] bg-[#F4F4F5] p-[3px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(
              [
                ['post', 'Post', null],
                ['tarefas', 'Tarefas', preview.tarefas.filter((t) => t.aberta).length],
                ['comentarios', 'Comentários', (preview.notas ?? []).filter((n) => TIPOS_COMENTARIO.has(n.tipo) || n.tipo === 'interna').length],
                ['historico', 'Histórico', null],
              ] as const
            ).map(([id, rot, n]) => (
              <button
                key={id}
                type="button"
                onClick={() => setAba(id)}
                className={`whitespace-nowrap rounded-[10px] px-3.5 py-1.5 text-[13px] ${aba === id ? 'bg-white font-extrabold text-[#111113] shadow-[0_1px_2px_rgba(17,17,19,0.08)]' : 'font-bold text-[#636369] hover:text-[#111113]'}`}
              >
                {rot}
                {n !== null && n > 0 && <b className={id === 'tarefas' ? 'text-[#7E211C]' : ''}> · {n}</b>}
              </button>
            ))}
          </nav>
        )}

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto">
          {erro && <div className="m-6 rounded-[12px] bg-[#F6CFCB] p-4 text-[13px] text-[#7E211C]">{erro}</div>}
          {!preview && !erro && (
            <div className="space-y-4 p-6">
              <div className="h-[120px] animate-pulse rounded-[18px] bg-[#F1F1F2]" />
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                <div className="h-[420px] animate-pulse rounded-[18px] bg-[#F1F1F2]" />
                <div className="h-[420px] animate-pulse rounded-[18px] bg-[#F1F1F2]" />
              </div>
            </div>
          )}
          {preview && (
            <div className="flex flex-col gap-5 p-6">
              {/* Onde o post está: uma linha só, etapas recolhidas */}
              {fluxo.length > 0 && (
                <section
                  className={`flex flex-col gap-2.5 rounded-[16px] border px-4 py-3 ${agora?.prazo && agora.prazo.slice(0, 10) < hoje ? 'border-[#F2B8B0] bg-[#FBE3E0]' : 'border-[#EDEDEF]'}`}
                >
                  {agora ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <b className="text-[14px] text-[#111113]">{agora.titulo}</b>
                      {agora.pessoa && <span className="text-[12.5px] text-[#636369]" title={`Com ${agora.pessoa}`}>{agora.pessoa.split(' ')[0]}</span>}
                      <PrazoDaEtapa key={agora.tarefaId} tarefaId={agora.tarefaId} prazo={agora.prazo} hoje={hoje} onMudou={mudarPrazoLocal} />
                      <span className="ml-auto flex items-center gap-2">
                        {ehTarefaDoCliente(agora.titulo) && (
                          <BotaoLembreteWpp tarefaId={agora.tarefaId} clienteNome={preview.projetoNome ?? 'cliente'} rotulo="Lembrar no grupo" compacto />
                        )}
                        <button
                          type="button"
                          onClick={concluirEtapa}
                          disabled={concluindo}
                          className="inline-flex h-8 items-center rounded-full bg-[#111113] px-3.5 text-[12.5px] font-extrabold text-white hover:bg-[#2C2C30] disabled:opacity-50"
                        >
                          {concluindo ? 'Concluindo…' : '✓ Concluir'}
                        </button>
                      </span>
                    </div>
                  ) : (
                    <span className="text-[13px] font-bold text-[#2E5520]">✓ Todas as etapas concluídas.</span>
                  )}
                  {erroEtapa && <span className="text-[12px] font-bold text-[#7E211C]">{erroEtapa}</span>}
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-2.5 [&::-webkit-details-marker]:hidden">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#F0F0F1]">
                        <span className="block h-full rounded-full bg-[#2E5520]" style={{ width: `${Math.round((fluxo.filter((t) => !t.aberta).length / fluxo.length) * 100)}%` }} />
                      </span>
                      <span className="whitespace-nowrap text-[12px] font-bold text-[#636369]">
                        {fluxo.filter((t) => !t.aberta).length} de {fluxo.length} etapas <span className="inline-block transition-transform group-open:rotate-90">›</span>
                      </span>
                    </summary>
                    <div className="mt-3">
                      <ReguaCompacta
                        etapas={fluxo.map((t) => ({ id: t.tarefaId, titulo: rotuloRegua(t.titulo), feito: !t.aberta, prazo: t.prazo }))}
                        agoraId={agora?.tarefaId ?? null}
                      />
                    </div>
                  </details>
                </section>
              )}

              {aba === 'tarefas' && (
                <div id="pedir-alteracao" className="order-last rounded-[18px] border border-[#E9E9EB] p-4">
                  <b className="mb-2 flex items-center gap-2 text-[14px]">
                    <span>✏️</span>Pedir alteração
                  </b>
                  {blocoAlteracao()}
                </div>
              )}

              {aba === 'tarefas' && (
                <div className="rounded-[18px] border border-[#E9E9EB] p-4">
                  <TodasTarefasCard tarefas={preview.tarefas} colaboradores={preview.colaboradores ?? {}} podeEditarPrazo semMoldura linkAdmin compacto />
                </div>
              )}
              {aba === 'comentarios' && <ComentariosLud postId={postId} notas={preview.notas ?? []} cronologico />}
              {aba === 'historico' &&
                (preview.historico ? (
                  <section className="rounded-[18px] border border-[#E9E9EB] p-4">
                    <HistoricoResumo historico={preview.historico} notas={preview.notas ?? []} tarefasCliente={preview.tarefasCliente ?? []} cronologico />
                  </section>
                ) : (
                  <p className="text-[13px] text-[#636369]">Sem histórico por aqui ainda.</p>
                ))}
              {aba === 'post' &&
                (() => {
                  const secoes = preview.secoes ?? [];
                  const idSec = (k: number) => `secao-${k}`;
                  const materiaisTarefa = fluxo.find((t) => /materia/i.test(t.titulo) && !/aprova/i.test(t.titulo)) ?? null;
                  const recebidos = !!materiaisTarefa && !materiaisTarefa.aberta;
                  const indice = [
                    ...secoes.map((sec, k) => ({ id: idSec(k), titulo: sec.titulo })),
                    { id: 'secao-legenda', titulo: 'Legenda' },
                  ];
                  const ir = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  return (
                    <div className="grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)_300px]">
                      {/* Índice: clicar rola até a seção */}
                      <nav className="hidden flex-col gap-0.5 lg:sticky lg:top-0 lg:flex lg:self-start">
                        <span className="px-3 pb-2 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-[#8A8A90]">Neste post</span>
                        {indice.map((it) => (
                          <button key={it.id} type="button" onClick={() => ir(it.id)} className="flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-[13.5px] font-medium text-[#46464B] hover:bg-[#F4F4F5] hover:text-[#111113]">
                            <span className="w-[18px] text-center">{it.titulo === 'Legenda' ? '✍️' : emojiDaSecao(it.titulo)}</span>
                            <span className="truncate">{it.titulo}</span>
                          </button>
                        ))}
                      </nav>

                      {/* Meio: tudo do Notion numa leitura só */}
                      <div className="flex min-w-0 flex-col">
                        {secoes.length === 0 && (preview.ideia || preview.briefing || preview.roteiro || preview.cards) && (
                          <section className="flex flex-col gap-3 pb-6">
                            {(
                              [
                                ['💡 Ideia do post', preview.ideia],
                                ['📋 Briefing', preview.briefing],
                                ['🎙️ Roteiro', preview.roteiro],
                                ['🗂️ Cards', preview.cards],
                              ] as const
                            )
                              .filter(([, t]) => !!t)
                              .map(([rot, t]) => (
                                <div key={rot} className="flex flex-col gap-1">
                                  <b className="text-[15px]">{rot}</b>
                                  <p className="whitespace-pre-line text-[13.5px] leading-[1.55] text-[#2C2C30]">{t}</p>
                                </div>
                              ))}
                          </section>
                        )}
                        {secoes.map((sec, k) =>
                          /materia/i.test(sec.titulo) ? (
                            <SecaoMateriais key={k} s={sec} id={idSec(k)} recebidos={recebidos} tarefaId={materiaisTarefa?.tarefaId ?? agora?.tarefaId ?? null} />
                          ) : (
                            <SecaoPlana key={k} s={sec} id={idSec(k)} />
                          ),
                        )}
                        <section id="secao-legenda" className="flex scroll-mt-4 flex-col gap-2.5 border-t border-[#F0F0F2] py-6 first:border-0 first:pt-0">
                          <div className="flex items-center gap-2.5 text-[16px] font-extrabold tracking-[-0.01em]">
                            <span className="w-5 text-center">✍️</span>Legenda
                            {preview.legenda && (
                              <button type="button" onClick={copiarLegenda} className="ml-auto text-[12.5px] font-extrabold hover:underline">
                                {copiado ? 'Copiada' : 'Copiar'}
                              </button>
                            )}
                          </div>
                          {preview.legenda ? (
                            <>
                              <p className="whitespace-pre-line text-[13.5px] leading-[1.55] text-[#111113]">{preview.legenda.replace(/(\s*#[\p{L}0-9_]+)+\s*$/u, '')}</p>
                              {hashtags.length > 0 && (
                                <span className="flex flex-wrap gap-1.5">
                                  {hashtags.map((h) => (
                                    <span key={h} className="rounded-full bg-[#E4EBDF] px-2 py-0.5 text-[11.5px] font-bold text-[#2E5520]">
                                      {h}
                                    </span>
                                  ))}
                                </span>
                              )}
                            </>
                          ) : (
                            <p className="text-[12.5px] text-[#636369]">Sem legenda definida.</p>
                          )}
                        </section>
                      </div>

                      {/* Direita: arte e programação, fixas */}
                      <div className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-0 lg:self-start">
                  {semArte ? (
                    <div className="flex aspect-[9/12] max-h-[420px] w-full flex-col items-center justify-center gap-1 rounded-[18px] bg-[#F7F7F8] text-center">
                      <span className="text-[28px]">{emojiDoFormato(preview.formato) ?? '📝'}</span>
                      <span className="text-[13px] font-bold text-[#46464B]">Arte ainda não anexada</span>
                      <span className="text-[12px] text-[#8A8A90]">As tarefas do post estão na aba Tarefas.</span>
                    </div>
                  ) : (
                    <>
                      <div className="relative overflow-hidden rounded-[18px] bg-[#111113]">
                        <div className={`relative w-full ${tipo === 'video' ? 'aspect-[4/5] max-h-[560px]' : 'aspect-[4/5]'}`}>
                          {arquivoAtivo && tipo === 'imagem' && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={`/api/drive/preview/${arquivoAtivo.id}`} alt={arquivoAtivo.name} className="absolute inset-0 h-full w-full object-contain" />
                          )}
                          {arquivoAtivo && tipo === 'video' && <video src={`/api/drive/preview/${arquivoAtivo.id}`} controls playsInline preload="metadata" className="absolute inset-0 h-full w-full" />}
                          {arquivoAtivo && tipo === 'audio' && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#2C2C30] px-6">
                              <span className="text-[13px] font-bold text-white/80">Áudio</span>
                              <audio src={`/api/drive/preview/${arquivoAtivo.id}`} controls preload="metadata" className="w-full max-w-md" />
                            </div>
                          )}
                          {arquivoAtivo && tipo === 'outro' && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70">
                              <span className="text-[12px]">{arquivoAtivo.name}</span>
                            </div>
                          )}
                        </div>
                        {preview.arquivos.length > 1 && (
                          <>
                            <button type="button" onClick={() => setAtivo((i) => Math.max(0, i - 1))} disabled={ativo === 0} className="absolute left-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[18px] font-bold text-[#111113] shadow disabled:opacity-30" aria-label="Anterior">
                              ‹
                            </button>
                            <button type="button" onClick={() => setAtivo((i) => Math.min(preview.arquivos.length - 1, i + 1))} disabled={ativo === preview.arquivos.length - 1} className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[18px] font-bold text-[#111113] shadow disabled:opacity-30" aria-label="Próximo">
                              ›
                            </button>
                            <div className="absolute right-3 top-3 rounded-full bg-[#111113]/80 px-2.5 py-0.5 text-[11px] font-extrabold text-white">
                              {ativo + 1} / {preview.arquivos.length}
                            </div>
                          </>
                        )}
                      </div>
                      {preview.arquivos.length > 1 && (
                        <div className="flex gap-1.5 overflow-x-auto min-h-fit">
                          {preview.arquivos.map((a, i) => {
                            const t = tipoArquivo(a.mimeType, a.name);
                            return (
                              <button key={a.id} type="button" onClick={() => setAtivo(i)} className={`relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-[10px] border-2 ${i === ativo ? 'border-[#111113]' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                                {t === 'imagem' ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={`/api/drive/preview/${a.id}`} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center bg-[#F4F4F5] text-[14px]">{t === 'video' ? '▶' : '·'}</div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {arquivoAtivo && (
                        <div className="flex flex-wrap gap-2">
                          <a href={arquivoAtivo.webViewLink} target="_blank" rel="noreferrer" className="rounded-[12px] border border-[#D6D6D9] bg-white px-4 py-2 text-[13px] font-extrabold hover:bg-[#F4F4F5]">
                            Abrir no Drive
                          </a>
                          <a href={`/api/drive/preview/${arquivoAtivo.id}`} download={arquivoAtivo.name} className="rounded-[12px] border border-[#D6D6D9] bg-white px-4 py-2 text-[13px] font-extrabold hover:bg-[#F4F4F5]">
                            Baixar arte
                          </a>
                        </div>
                      )}
                    </>
                  )}
                  <CaixaProgramacao
                    postId={postId}
                    data={preview.dataPostagem}
                    hora={horaCurta(preview?.hora)}
                    formato={preview.formato || null}
                    situacao={/postad|publicad/i.test(preview.status ?? '') ? 'postado' : /agendad|programad/i.test(preview.status ?? '') ? 'programado' : 'nao'}
                    feed={[]}
                  />
                      </div>
                    </div>
                  );
                })()}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
