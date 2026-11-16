'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { rotas } from '@/lib/rotas';
import { Trilha } from '../../_components/Trilha';
import { PreviaPostModal } from '../../aprovacoes/PreviaPostModal';
import { BotaoLembreteWpp } from '../../aprovacoes/BotaoLembreteWpp';
import { ModalMensagem, type ItemPendenciaUi } from '@/app/admin/projetos/[id]/PendenciasCliente';
import { grupoDaTarefa, montarMensagemPendencias } from '@/lib/pendencias-cliente';
import { montarMensagemRegua } from '@/lib/regua-mensagens';
import {
  BotaoEnviarSoEste,
  MOMENTO_CURTO,
  ModalEnvioAprovacao,
  PilulaRodada,
  PilulaTarefaAtual,
  clientePronto,
  mensagensDe,
  quandoFoi,
  type GrupoEntrega,
  type ItemEntrega,
  type TipoEntrega,
} from './EntregaPorCliente';

/**
 * Página da entrega de UM projeto (layout "NOVO · Página da entrega" do mapa
 * do portal). Abre quando o clique vem da página do projeto
 * (/admin/projetos/[id]/entregas/[entregaId]); a página geral da entrega mostra
 * todos os clientes. Os envios usam os mesmos popups da página geral: a
 * mensagem vai só pro grupo do cliente.
 */

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function ddmm(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}
function utc(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}
function diasEntre(de: string, ate: string): number {
  return Math.round((utc(ate) - utc(de)) / 86_400_000);
}
function diaSemana(iso: string): string {
  return SEMANA[new Date(utc(iso)).getUTCDay()];
}
/** Dia (YYYY-MM-DD) de um instante, no fuso de São Paulo. */
function diaSp(iso: string): string {
  if (iso.length <= 10) return iso;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso));
}
function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}
/** "posts de dezembro", "posts de novembro e dezembro". */
function rotuloMeses(datas: string[]): string | null {
  const meses = [...new Set(datas.map((d) => d.slice(0, 7)))].sort();
  if (meses.length === 0) return null;
  const nomes = meses.map((m) => MESES[Number(m.slice(5, 7)) - 1]);
  return `posts de ${nomes.length === 1 ? nomes[0] : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`}`;
}
/** "@turismoemchicago" quando o nome do projeto tem o @; senão o nome. */
function nomeCurtoDoProjeto(g: GrupoEntrega): string {
  return g.projetoNome.match(/@[\w.]+/)?.[0] ?? (g.projetoNome || g.nome);
}
/** "AUTOMAÇÃO ROTEIRO | Vai pra Chicago…" → etiqueta + título. */
function separarTag(titulo: string): { tag: string | null; titulo: string } {
  const i = titulo.indexOf(' | ');
  return i > -1 && i < 32 ? { tag: titulo.slice(0, i), titulo: titulo.slice(i + 3) } : { tag: null, titulo };
}

type Tom = 'atrasado' | 'hoje' | 'chegando' | 'ok' | 'neutro';
const TOM: Record<Tom, { fundo: string; texto: string; rotulo: string; detalhe: string }> = {
  atrasado: { fundo: 'var(--prazo-atrasado)', texto: '#FFFFFF', rotulo: 'rgba(255,255,255,0.8)', detalhe: 'rgba(255,255,255,0.85)' },
  hoje: { fundo: 'var(--prazo-hoje)', texto: '#FFFFFF', rotulo: 'rgba(255,255,255,0.8)', detalhe: 'rgba(255,255,255,0.85)' },
  // Cor cheia, sem pastel. Amarelo é claro: texto escuro.
  chegando: { fundo: 'var(--prazo-chegando)', texto: '#151521', rotulo: 'rgba(21,21,33,0.72)', detalhe: 'rgba(21,21,33,0.72)' },
  ok: { fundo: 'var(--prazo-em-dia)', texto: '#FFFFFF', rotulo: 'rgba(255,255,255,0.8)', detalhe: 'rgba(255,255,255,0.85)' },
  neutro: { fundo: '#FFFFFF', texto: 'var(--ink)', rotulo: 'var(--t2)', detalhe: 'var(--t2)' },
};

function Numero({
  rotulo,
  valor,
  detalhe,
  tom = 'neutro',
  valorVermelho = false,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
  tom?: Tom;
  valorVermelho?: boolean;
}) {
  const t = TOM[tom];
  return (
    <div className="flex flex-col gap-1 rounded-[18px] p-[18px]" style={{ background: t.fundo }}>
      <span className="text-[12px] font-bold uppercase tracking-[0.05em]" style={{ color: t.rotulo }}>
        {rotulo}
      </span>
      <span
        className="text-[30px] font-extrabold leading-tight tracking-[-0.02em]"
        style={{ color: valorVermelho ? 'var(--prazo-atrasado)' : t.texto }}
      >
        {valor}
      </span>
      <span className="text-[13px]" style={{ color: t.detalhe }}>
        {detalhe}
      </span>
    </div>
  );
}

type Evento = { quando: string; texto: string; detalhe: string; cor: string; destaque?: boolean };

export function EntregaDoProjeto({
  entregaId,
  entregaNome,
  frequencia,
  tipo,
  grupo: grupoDoServidor,
  textos,
  baseUrl,
  hojeIso,
  notaInicial,
}: {
  entregaId: string;
  entregaNome: string;
  frequencia: string | null;
  tipo: TipoEntrega;
  grupo: GrupoEntrega;
  textos: Record<string, string>;
  baseUrl: string;
  hojeIso: string;
  notaInicial: { texto: string; atualizadoPor: string | null; atualizadoEm: string } | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [previa, setPrevia] = useState<{ postId: string; tarefaId: string } | null>(null);
  const [envio, setEnvio] = useState<{ grupo: GrupoEntrega; separado: boolean } | null>(null);
  const [mensagemAberta, setMensagemAberta] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  // Mesma lógica da página geral: o que sai agora muda na tela sem recarregar.
  const [enviadosAgora, setEnviadosAgora] = useState<Record<string, string>>({});
  const [mensagensAgora, setMensagensAgora] = useState<Record<string, { momento: string; enviadoEm: string }[]>>({});
  const registrarMensagem = (postIds: (string | null)[], momento: string) => {
    const agora = new Date().toISOString();
    setMensagensAgora((m) => {
      const n = { ...m };
      for (const id of postIds) if (id) n[id] = [{ momento, enviadoEm: agora }, ...(n[id] ?? [])];
      return n;
    });
  };
  const grupo = useMemo<GrupoEntrega>(
    () => ({
      ...grupoDoServidor,
      itens: grupoDoServidor.itens
        .map((i) => {
          const comMsg =
            i.postId && mensagensAgora[i.postId] ? { ...i, mensagens: [...mensagensAgora[i.postId], ...i.mensagens] } : i;
          return enviadosAgora[i.tarefaId] && !comMsg.enviado
            ? { ...comMsg, enviado: true, enviadoEm: enviadosAgora[i.tarefaId] }
            : comMsg;
        })
        .sort(
          (a, b) =>
            (a.postData ?? '9999').localeCompare(b.postData ?? '9999') || (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999'),
        ),
    }),
    [grupoDoServidor, enviadosAgora, mensagensAgora],
  );

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 8000);
    return () => clearTimeout(t);
  }, [aviso]);

  const itens = grupo.itens;
  const [verFeitos, setVerFeitos] = useState(false);
  // Na "Aprovação | Post" a linha mostra a régua Arte → Aprov. arte → Enviar → Cliente aprova.
  const ehAprovacaoPost = /aprova[çc][ãa]o\s*\|\s*post/i.test(entregaNome ?? '');
  const abertos = itens.filter((i) => !i.enviado);
  const feitos = itens.filter((i) => i.enviado);
  const prontos = abertos.filter((i) => i.relacao === 'aqui' && i.postId);
  const travados = abertos.filter((i) => i.relacao === 'antes');
  const prazo = abertos.map((i) => i.prazo).filter((x): x is string => !!x).sort()[0] ?? null;
  const diasPrazo = prazo ? diasEntre(hojeIso, prazo) : null;
  const atraso = diasPrazo !== null && diasPrazo < 0 ? -diasPrazo : 0;
  const msgs = mensagensDe(itens);
  const vistos = itens.filter((i) => i.visto);
  const ultimaVista = vistos.map((i) => i.visto!.ultima).sort().reverse()[0] ?? null;
  const datasPosts = itens.map((i) => i.postData).filter((x): x is string => !!x).sort();
  const primeiroPost = datasPosts.find((d) => d >= hojeIso) ?? null;
  const folga = primeiroPost ? diasEntre(hojeIso, primeiroPost) : null;
  const responsaveis = [...new Set(itens.map((i) => i.pessoa).filter((x): x is string => !!x))];
  const comCliente = tipo === 'cliente';
  const apelido = grupo.gruposWpp[0]?.apelido || grupo.nome;
  const handle = nomeCurtoDoProjeto(grupo);
  const meses = rotuloMeses(datasPosts);
  const rotuloFeito = tipo === 'envio' ? 'enviados' : comCliente ? 'aprovados' : 'concluídos';

  // ── Mensagem: o que dá pra mandar agora ──
  const loteLiberado = tipo === 'envio' && clientePronto(itens);
  const podeMandar = (comCliente && prontos.length > 0) || loteLiberado;
  const itensPendencia: ItemPendenciaUi[] = prontos.map((i) => ({
    tarefaId: i.tarefaId,
    tarefaTitulo: i.titulo,
    postId: i.postId!,
    postTitulo: i.postTitulo,
    postData: i.postData,
    prazo: i.prazo,
    link: `${baseUrl}/post/${i.postId}?tarefa=${i.tarefaId}`,
    grupo: grupoDaTarefa(i.titulo),
    reaprovacao: i.reaprovacao,
    visto: i.visto,
  }));
  const sugerida = useMemo(() => {
    if (comCliente && itensPendencia.length) {
      return montarMensagemPendencias({ apelido, itens: itensPendencia, textos, hoje: hojeIso });
    }
    if (loteLiberado && prontos.length) {
      const prazoCliente = prontos.map((i) => i.prazoCliente).filter((p): p is string => !!p).sort()[0] ?? null;
      return montarMensagemRegua({
        momento: 'quinta',
        variante: 'unica',
        apelido,
        posts: prontos.map((i) => ({
          titulo: i.postTitulo,
          link: `${baseUrl}/post/${i.postId}${i.aprovacaoTarefaId ? `?tarefa=${i.aprovacaoTarefaId}` : ''}`,
        })),
        prazo: prazoCliente,
        textos,
      });
    }
    return '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comCliente, loteLiberado, prontos.map((i) => i.tarefaId).join(','), apelido, textos, hojeIso, baseUrl]);

  function abrirMensagem() {
    if (comCliente && prontos.length) setMensagemAberta(true);
    else if (loteLiberado) setEnvio({ grupo, separado: false });
  }

  // ── Mudar prazo das tarefas em aberto dessa entrega ──
  const [prazoAberto, setPrazoAberto] = useState(false);
  const [novoPrazo, setNovoPrazo] = useState(prazo ?? hojeIso);
  const [salvandoPrazo, setSalvandoPrazo] = useState(false);
  const [erroPrazo, setErroPrazo] = useState<string | null>(null);
  async function salvarPrazo() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(novoPrazo)) return;
    setSalvandoPrazo(true);
    setErroPrazo(null);
    let falhas = 0;
    // Uma por vez: o Notion limita as requisições por segundo.
    for (const i of abertos) {
      const r = await fetch(`/api/admin/tarefas/${i.tarefaId}/prazo`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prazo: novoPrazo }),
      }).catch(() => null);
      if (!r?.ok) falhas++;
    }
    setSalvandoPrazo(false);
    if (falhas) {
      setErroPrazo(`Não consegui mudar ${plural(falhas, 'tarefa', 'tarefas')}. Tente de novo.`);
      return;
    }
    setPrazoAberto(false);
    setAviso(`Prazo mudado pra ${diaSemana(novoPrazo)}, ${ddmm(novoPrazo)} em ${plural(abertos.length, 'tarefa', 'tarefas')}.`);
    startTransition(() => router.refresh());
  }

  // ── Nota interna ──
  const [nota, setNota] = useState(notaInicial?.texto ?? '');
  const [notaSalva, setNotaSalva] = useState(notaInicial);
  const [salvandoNota, setSalvandoNota] = useState(false);
  const [erroNota, setErroNota] = useState(false);
  async function salvarNota() {
    if (nota === (notaSalva?.texto ?? '')) return;
    setSalvandoNota(true);
    setErroNota(false);
    try {
      const r = await fetch(`/api/admin/entregas/${entregaId}/nota`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projetoId: grupo.projetoId, texto: nota }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error();
      setNotaSalva(j.nota);
    } catch {
      setErroNota(true);
    } finally {
      setSalvandoNota(false);
    }
  }

  // ── Card do prazo ──
  const cardPrazo = (() => {
    if (abertos.length === 0) {
      return <Numero rotulo="Feito" valor="Tudo certo" detalhe={`${plural(feitos.length, 'post', 'posts')} ${rotuloFeito}`} tom="ok" />;
    }
    if (!prazo) return <Numero rotulo="Prazo" valor="Sem data" detalhe="nenhuma tarefa com prazo" />;
    if (atraso > 0) {
      return (
        <Numero rotulo="Atraso" valor={plural(atraso, 'dia', 'dias')} detalhe={`venceu ${diaSemana(prazo)}, ${ddmm(prazo)}`} tom="atrasado" />
      );
    }
    if (diasPrazo === 0) return <Numero rotulo="Prazo" valor="Hoje" detalhe={`vence hoje, ${ddmm(prazo)}`} tom="hoje" />;
    return (
      <Numero
        rotulo="Prazo"
        valor={diasPrazo === 1 ? 'Amanhã' : `Em ${diasPrazo} dias`}
        detalhe={`até ${diaSemana(prazo)}, ${ddmm(prazo)}`}
        tom={diasPrazo! <= 2 ? 'chegando' : 'neutro'}
      />
    );
  })();

  // ── Linha do prazo: do envio até a postagem ──
  const primeiraMsg = msgs.length ? diaSp(msgs[msgs.length - 1].enviadoEm) : null;
  const marcos: { dia: string; titulo: string; sub: string; vermelho?: boolean }[] = [];
  if (primeiraMsg && comCliente) marcos.push({ dia: primeiraMsg, titulo: `${ddmm(primeiraMsg)} · enviada`, sub: 'mensagem no grupo' });
  if (prazo)
    marcos.push({
      dia: prazo,
      titulo: `${ddmm(prazo)} · prazo`,
      sub: atraso > 0 ? `+${plural(atraso, 'dia', 'dias')}` : diasPrazo === 0 ? 'é hoje' : `em ${plural(diasPrazo!, 'dia', 'dias')}`,
      vermelho: atraso > 0,
    });
  if (prazo !== hojeIso)
    marcos.push({
      dia: hojeIso,
      titulo: `${ddmm(hojeIso)} · hoje`,
      sub: comCliente
        ? vistos.length
          ? `${vistos.length} de ${itens.length} vistos`
          : 'sem resposta'
        : `${plural(abertos.length, 'em aberto', 'em aberto')}`,
    });
  if (datasPosts.length) {
    const a = datasPosts[0];
    const b = datasPosts[datasPosts.length - 1];
    marcos.push({
      dia: a,
      titulo: a === b ? ddmm(a) : a.slice(5, 7) === b.slice(5, 7) ? `${a.slice(8, 10)} a ${ddmm(b)}` : `${ddmm(a)} a ${ddmm(b)}`,
      sub: datasPosts.length === 1 ? 'post vai ao ar' : 'posts vão ao ar',
    });
  }
  marcos.sort((x, y) => x.dia.localeCompare(y.dia));
  const inicio = marcos[0]?.dia ?? hojeIso;
  const fim = datasPosts[datasPosts.length - 1] ?? marcos[marcos.length - 1]?.dia ?? hojeIso;
  const total = Math.max(1, diasEntre(inicio, fim));
  const pos = (d: string) => Math.min(100, Math.max(0, (diasEntre(inicio, d) / total) * 100));

  // ── Histórico ──
  const eventos: Evento[] = [];
  if (atraso > 0 && abertos.length) {
    eventos.push({
      quando: hojeIso,
      texto: `Hoje · ${plural(atraso, 'dia', 'dias')} de atraso${comCliente && vistos.length === 0 ? ', sem resposta' : ''}`,
      detalhe: `${diaSemana(hojeIso)}, ${ddmm(hojeIso)}`,
      cor: 'var(--prazo-atrasado)',
      destaque: true,
    });
    eventos.push({
      quando: prazo!,
      texto: comCliente ? 'Prazo venceu sem aprovação' : tipo === 'envio' ? 'Prazo do envio venceu' : 'Prazo venceu',
      detalhe: `${diaSemana(prazo!)}, ${ddmm(prazo!)}`,
      cor: 'var(--prazo-hoje)',
    });
  }
  for (const m of msgs) {
    eventos.push({
      quando: m.enviadoEm,
      texto: `Mensagem no grupo · ${MOMENTO_CURTO[m.momento] ?? m.momento}`,
      detalhe: quandoFoi(m.enviadoEm, hojeIso),
      cor: 'var(--prazo-em-dia)',
    });
  }
  for (const i of vistos) {
    eventos.push({
      quando: i.visto!.ultima,
      texto: `${grupo.nome} abriu “${separarTag(i.postTitulo).titulo}”`,
      detalhe: quandoFoi(i.visto!.ultima, hojeIso),
      cor: 'var(--cal-conferir)',
    });
  }
  for (const i of feitos) {
    if (!i.enviadoEm) continue;
    eventos.push({
      quando: i.enviadoEm,
      texto: `“${separarTag(i.postTitulo).titulo}” ${tipo === 'envio' ? 'enviado pro cliente' : comCliente ? 'aprovado' : 'concluído'}`,
      detalhe: i.enviadoEm.length > 10 ? quandoFoi(i.enviadoEm, hojeIso) : `${diaSemana(i.enviadoEm)}, ${ddmm(i.enviadoEm)}`,
      cor: 'var(--cal-publicado)',
    });
  }
  eventos.sort((a, b) => b.quando.localeCompare(a.quando));

  // ── Próximo passo ──
  const proximoPasso = (() => {
    if (abertos.length === 0) return `Nada pendente aqui. Todos os ${plural(feitos.length, 'post', 'posts')} já foram ${rotuloFeito}.`;
    if (tipo === 'envio') {
      if (loteLiberado) return `Enviar ${prontos.length === 1 ? 'o post' : `os ${prontos.length} posts`} pro cliente aprovar.`;
      return `Faltam ${plural(travados.length, 'post chegar', 'posts chegarem')} nessa etapa pra enviar o lote. Dá pra mandar um post de cada vez na lista.`;
    }
    if (comCliente) {
      if (msgs.length === 0) {
        return atraso > 0 || diasPrazo === 0
          ? 'Mandar a primeira mensagem no grupo hoje. Se não houver resposta em 2 dias, ligar ou levar pra reunião do mês.'
          : 'Mandar a mensagem no grupo avisando que os posts estão no portal.';
      }
      if (atraso > 0) {
        return `Já mandamos mensagem ${quandoFoi(msgs[0].enviadoEm, hojeIso)}. Sem resposta: cobrar de novo no grupo ou ligar.`;
      }
      return `Esperar ${grupo.nome}. O prazo é ${prazo ? `${diaSemana(prazo)}, ${ddmm(prazo)}` : 'sem data'}.`;
    }
    const quem = responsaveis.length ? responsaveis.join(' e ') : 'a equipe';
    return `${quem} faz ${entregaNome.toLowerCase()} de ${plural(abertos.length, 'post', 'posts')}${prazo ? ` até ${diaSemana(prazo)}, ${ddmm(prazo)}` : ''}.`;
  })();


  return (
    <div className="space-y-5">
      {/* ─── Caminho + filtro ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Trilha
          itens={[
            { rotulo: 'Projetos', href: rotas.projetos() },
            { rotulo: handle, href: rotas.projeto(grupo.projetoId) },
            { rotulo: 'Entregas', href: rotas.entregasDoProjeto(grupo.projetoId) },
            { rotulo: entregaNome },
          ]}
        />
        <div className="flex rounded-[10px] bg-[#E9E9EC] p-[3px] text-[13px]" role="group" aria-label="Filtro de projeto">
          <span className="rounded-lg bg-white px-3 py-1.5 font-semibold text-ink shadow-sm">Só {handle}</span>
          <Link href={rotas.entrega(entregaId)} className="rounded-lg px-3 py-1.5 font-medium text-t2 hover:text-ink">
            Todos os clientes
          </Link>
        </div>
      </div>

      {aviso && (
        <div role="status" className="rounded-xl bg-[var(--prazo-em-dia-soft)] px-4 py-2.5 text-[13px] text-ink">
          {aviso}
        </div>
      )}

      {/* ─── Título ─── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-t2">
            Entrega · {comCliente ? `com ${grupo.nome}` : tipo === 'envio' ? 'envio pro cliente' : 'com a Lud.'}
            {meses ? ` · ${meses}` : ''}
          </span>
          <h1 className="text-[34px] font-bold leading-[1.1] tracking-[-0.02em] text-ink">{entregaNome}</h1>
          <div className="flex flex-wrap gap-2 text-[13px] font-semibold text-ink">
            <span className="rounded-full border border-[#E6E6EA] bg-white px-3 py-1.5">{plural(itens.length, 'post', 'posts')}</span>
            <span className="rounded-full border border-[#E6E6EA] bg-white px-3 py-1.5">{grupo.nome} · cliente</span>
            {responsaveis.length > 0 && (
              <span className="rounded-full border border-[#E6E6EA] bg-white px-3 py-1.5">
                Responsável Lud.: {responsaveis.join(', ')}
              </span>
            )}
            {frequencia && (
              <span className="rounded-full border border-[#E6E6EA] bg-white px-3 py-1.5 font-medium text-t2">{frequencia}</span>
            )}
          </div>
        </div>
        <div className="relative flex flex-wrap gap-2.5">
          {abertos.length > 0 && (
            <button
              type="button"
              onClick={() => setPrazoAberto((v) => !v)}
              className="rounded-xl border border-[#DCDCE0] bg-white px-4 py-3 text-[14px] font-semibold text-ink transition hover:bg-bgSoft"
            >
              Mudar prazo
            </button>
          )}
          {podeMandar && (
            <button type="button" onClick={abrirMensagem} className="btn-enviar !rounded-xl !px-[18px] !py-3 !text-[14px] !font-bold">
              Enviar mensagem no grupo
            </button>
          )}
          {prazoAberto && (
            <div className="absolute right-0 top-full z-20 mt-2 w-[300px] space-y-3 rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white p-4 shadow-[0_12px_32px_rgba(21,21,33,0.14)]">
              <div className="text-[14px] font-semibold text-ink">Novo prazo</div>
              <p className="text-[12.5px] text-t2">
                Muda a data das {plural(abertos.length, 'tarefa', 'tarefas')} em aberto dessa entrega. Fica no histórico de cada post.
              </p>
              <input
                type="date"
                value={novoPrazo}
                onChange={(e) => setNovoPrazo(e.target.value)}
                className="w-full rounded-xl border border-[#DCDCE0] px-3 py-2 text-[14px] text-ink"
              />
              {erroPrazo && <p className="text-[12px] text-[var(--prazo-atrasado)]">{erroPrazo}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPrazoAberto(false)} className="rounded-lg px-3 py-2 text-[13px] text-t2 hover:text-ink">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={salvarPrazo}
                  disabled={salvandoPrazo || novoPrazo === prazo}
                  className="rounded-lg bg-ink px-3.5 py-2 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                >
                  {salvandoPrazo ? 'Salvando…' : 'Salvar prazo'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Números ─── */}
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        {cardPrazo}
        {tipo === 'interna' ? (
          <Numero
            rotulo="Nessa etapa"
            valor={`${prontos.length} de ${abertos.length}`}
            detalhe={travados.length ? `${plural(travados.length, 'ainda não chegou', 'ainda não chegaram')} aqui` : 'tudo liberado pra fazer'}
          />
        ) : (
          <Numero
            rotulo="Mensagens"
            valor={String(msgs.length)}
            detalhe={msgs[0] ? `última ${quandoFoi(msgs[0].enviadoEm, hojeIso)}` : 'nenhuma sobre essa entrega'}
            valorVermelho={msgs.length === 0 && abertos.length > 0 && (atraso > 0 || diasPrazo === 0)}
          />
        )}
        {tipo === 'interna' ? (
          <Numero
            rotulo={rotuloFeito.charAt(0).toUpperCase() + rotuloFeito.slice(1)}
            valor={`${feitos.length} de ${itens.length}`}
            detalhe={feitos.length ? 'já passaram dessa etapa' : 'nenhum ainda'}
          />
        ) : (
          <Numero
            rotulo="Cliente viu"
            valor={`${vistos.length} de ${itens.length}`}
            detalhe={ultimaVista ? `última abertura ${quandoFoi(ultimaVista, hojeIso)}` : 'nenhum post aberto'}
          />
        )}
        <Numero
          rotulo="Folga"
          valor={folga === null ? '—' : plural(folga, 'dia', 'dias')}
          detalhe={primeiroPost ? `até o 1º post, em ${ddmm(primeiroPost)}` : 'sem post com data pela frente'}
        />
      </div>

      {/* ─── Do envio até a postagem ─── */}
      {marcos.length > 1 && (
        <section aria-label="Linha do prazo" className="space-y-3.5 rounded-[20px] bg-white px-6 py-[22px]">
          <h2 className="text-[16px] font-bold text-ink">{comCliente ? 'Do envio até a postagem' : 'Do prazo até a postagem'}</h2>
          <div className="relative h-3.5 rounded-full bg-[#EEEEF1]">
            {prazo && (
              <div
                className="absolute inset-y-0 left-0 rounded-l-full bg-[var(--cal-agendado)]"
                style={{ width: `${pos(prazo)}%` }}
              />
            )}
            {prazo && atraso > 0 && (
              <div
                className="absolute inset-y-0 bg-[var(--prazo-atrasado)]"
                style={{ left: `${pos(prazo)}%`, width: `${Math.max(1, pos(hojeIso) - pos(prazo))}%` }}
              />
            )}
            {datasPosts.length > 0 && (
              <div
                className="absolute inset-y-0 rounded-r-full bg-[var(--prazo-em-dia)]"
                style={{ left: `${pos(datasPosts[0])}%`, right: 0 }}
              />
            )}
            <span
              aria-hidden
              className="absolute -top-[5px] h-6 w-1 -translate-x-1/2 rounded bg-ink"
              style={{ left: `${pos(hojeIso)}%` }}
            />
          </div>
          <div className="flex flex-wrap justify-between gap-x-6 gap-y-2 text-[12px]">
            {marcos.map((m, idx) => (
              <div key={`${m.dia}-${idx}`} className={`flex flex-col gap-0.5 ${idx === marcos.length - 1 ? 'text-right' : ''}`}>
                <span className={`font-bold ${m.vermelho ? 'text-[var(--prazo-atrasado)]' : 'text-ink'}`}>{m.titulo}</span>
                <span className={m.vermelho ? 'text-[var(--prazo-atrasado)]' : 'text-t2'}>{m.sub}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
          {/* ─── Mensagens ─── */}
          {tipo !== 'interna' && (
            <section aria-label="Mensagens" className="flex flex-col gap-3.5 rounded-[20px] bg-white p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[16px] font-bold text-ink">Mensagens ao cliente</h2>
                <span
                  className={`text-[12px] font-bold ${grupo.gruposWpp.length ? 'text-t2' : 'text-[var(--prazo-atrasado)]'}`}
                >
                  {grupo.gruposWpp.length ? `grupo do WhatsApp${grupo.gruposWpp[0]?.nome ? ` · ${grupo.gruposWpp[0].nome}` : ''}` : 'sem grupo do WhatsApp'}
                </span>
              </div>
              {msgs.length === 0 ? (
                <div
                  className={`rounded-[14px] px-4 py-3.5 text-[14px] font-semibold ${
                    abertos.length && (atraso > 0 || diasPrazo === 0)
                      ? 'bg-[var(--prazo-atrasado)] text-white'
                      : 'bg-bgSoft text-t2'
                  }`}
                >
                  Ainda não mandamos nada sobre essa entrega.
                </div>
              ) : (
                <ul className="divide-y divide-[rgba(21,21,33,0.06)] rounded-[14px] bg-bgSoft/70 px-4">
                  {msgs.slice(0, 5).map((m) => (
                    <li key={`${m.momento}-${m.enviadoEm}`} className="flex items-center justify-between gap-3 py-2.5 text-[13.5px]">
                      <span className="font-semibold text-ink">📱 {MOMENTO_CURTO[m.momento] ?? m.momento}</span>
                      <span className="text-t2">{quandoFoi(m.enviadoEm, hojeIso)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {sugerida ? (
                <>
                  <span className="text-[13px] font-semibold text-t2">Mensagem sugerida</span>
                  <div className="max-h-[260px] overflow-y-auto whitespace-pre-wrap rounded-[14px] border border-[#DCDCE0] bg-bgSoft p-3.5 text-[15px] leading-[1.55] text-ink">
                    {sugerida}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <span className="text-[12px] text-t2">Dá pra editar e escolher os posts antes de enviar. Vai com o link de cada post.</span>
                    <button type="button" onClick={abrirMensagem} className="btn-enviar !rounded-xl !px-[18px] !py-3 !text-[14px] !font-bold">
                      Enviar no grupo
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-[13px] text-t2">
                  {abertos.length === 0
                    ? 'Tudo dessa entrega já foi resolvido.'
                    : tipo === 'envio'
                      ? `O lote sai quando os ${plural(abertos.length, 'post estiver pronto', 'posts estiverem prontos')}. Enquanto isso, dá pra mandar um post de cada vez na lista abaixo.`
                      : 'Nenhum post chegou nessa etapa ainda.'}
                </p>
              )}
            </section>
          )}

          {/* ─── Posts da entrega ─── */}
          <section aria-label="Posts da entrega" className="flex flex-col gap-1 rounded-[20px] bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5">
              <h2 className="text-[16px] font-bold text-ink">Posts pela data de {comCliente ? 'aprovação' : 'entrega'}</h2>
              <span className="text-[13px] text-t2">
                {feitos.length} {feitos.length === 1 ? rotuloFeito.replace(/s$/, '') : rotuloFeito} · {vistos.length}{' '}
                {vistos.length === 1 ? 'visto' : 'vistos'} · {abertos.length} em aberto
              </span>
            </div>
            <div className="flex flex-col gap-5">
              {gruposAprovacao(abertos, hojeIso).map((g) => (
                <div key={g.chave} className="flex flex-col gap-2">
                  <div
                    className="flex flex-wrap items-center justify-between gap-2 border-b-2 px-0.5 pb-1.5"
                    style={{ borderColor: g.linha }}
                  >
                    <div className="flex flex-wrap items-baseline gap-2.5">
                      <span className="text-[17px] font-extrabold" style={{ color: g.cor }}>
                        {g.titulo}
                      </span>
                      <span className="text-[13px] text-t2">{g.periodo}</span>
                    </div>
                    <span className="text-[12.5px] font-semibold text-t2">{g.resumo}</span>
                  </div>
                  {g.itens.map((i) => (
                    <LinhaAprovacao
                      key={i.tarefaId}
                      i={i}
                      tipo={tipo}
                      hojeIso={hojeIso}
                      fundoData={g.dataBg}
                      corData={g.dataFg}
                      ehPost={ehAprovacaoPost}
                      abrir={() => i.postId && setPrevia({ postId: i.postId, tarefaId: i.aprovacaoTarefaId ?? i.tarefaId })}
                      acao={
                        !i.enviado && i.relacao === 'aqui' && i.postId ? (
                          tipo === 'envio' ? (
                            <BotaoEnviarSoEste onClick={() => setEnvio({ grupo: { ...grupo, itens: [i] }, separado: true })} />
                          ) : comCliente ? (
                            <BotaoLembreteWpp
                              tarefaId={i.tarefaId}
                              clienteNome={grupo.nome}
                              rotulo="Enviar post"
                              compacto
                              aoEnviar={() => registrarMensagem([i.postId], 'avulso')}
                            />
                          ) : null
                        ) : null
                      }
                    />
                  ))}
                </div>
              ))}
              {abertos.length === 0 && (
                <div className="rounded-xl bg-bgSoft py-6 text-center text-[13px] text-t2">
                  Nenhum post em aberto nessa entrega.
                </div>
              )}
              {feitos.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[var(--prazo-em-dia-soft)] px-0.5 pb-1.5">
                    <div className="flex flex-wrap items-baseline gap-2.5">
                      <span className="text-[17px] font-extrabold text-[var(--prazo-em-dia)]">Já feitos</span>
                      <span className="text-[13px] text-t2">{rotuloFeito}</span>
                    </div>
                    <span className="text-[12.5px] font-semibold text-t2">
                      {feitos.length} {feitos.length === 1 ? rotuloFeito.replace(/s$/, '') : rotuloFeito}
                    </span>
                  </div>
                  {[...feitos]
                    .sort((x, y) => (y.enviadoEm ?? '').localeCompare(x.enviadoEm ?? ''))
                    .slice(0, verFeitos ? feitos.length : 3)
                    .map((i) => (
                      <LinhaAprovacao
                        key={i.tarefaId}
                        i={i}
                        tipo={tipo}
                        hojeIso={hojeIso}
                        fundoData="var(--prazo-em-dia-soft)"
                        corData="var(--prazo-em-dia)"
                        ehPost={ehAprovacaoPost}
                        feito
                        abrir={() => i.postId && setPrevia({ postId: i.postId, tarefaId: i.aprovacaoTarefaId ?? i.tarefaId })}
                        acao={null}
                      />
                    ))}
                  {feitos.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setVerFeitos((v) => !v)}
                      className="self-start px-1 text-[12.5px] font-semibold text-t2 transition hover:text-ink"
                    >
                      {verFeitos ? 'Mostrar menos' : `e mais ${feitos.length - 3} →`}
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
          <section className="flex flex-col gap-3 rounded-[20px] bg-white p-[22px]">
            <h2 className="text-[15px] font-bold text-ink">Próximo passo</h2>
            <p className="text-[14px] leading-[1.5] text-ink">{proximoPasso}</p>
          </section>

          <section className="flex flex-col gap-1 rounded-[20px] bg-white p-[22px]">
            <div className="flex items-center justify-between pb-2">
              <h2 className="text-[15px] font-bold text-ink">Histórico</h2>
              <span className="text-[12px] text-t2">mais recente primeiro</span>
            </div>
            {eventos.length === 0 ? (
              <p className="text-[13px] text-t2">Nada registrado ainda.</p>
            ) : (
              eventos.slice(0, 10).map((e, idx) => (
                <div key={`${e.quando}-${idx}`} className="flex gap-3">
                  <div className="flex flex-none flex-col items-center pt-1">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: e.cor }} />
                    {idx < Math.min(eventos.length, 10) - 1 && <span className="min-h-[20px] w-0.5 flex-1 bg-[#EEEEF1]" />}
                  </div>
                  <div className="flex min-w-0 flex-col gap-0.5 pb-4">
                    <span
                      className={`text-[14px] font-semibold ${e.destaque ? 'text-[var(--prazo-atrasado)]' : 'text-ink'}`}
                    >
                      {e.texto}
                    </span>
                    <span className="text-[12px] text-t2">{e.detalhe}</span>
                  </div>
                </div>
              ))
            )}
          </section>

          <section className="flex flex-col gap-2.5 rounded-[20px] bg-white p-[22px]">
            <h2 className="text-[15px] font-bold text-ink">Nota interna</h2>
            <label htmlFor="nota-entrega" className="text-[12px] text-t2">
              Só a equipe vê
            </label>
            <textarea
              id="nota-entrega"
              rows={3}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              onBlur={salvarNota}
              placeholder={`Ex.: ${grupo.nome} viaja até dia 22, cobrar depois.`}
              className="w-full rounded-xl border border-[#DCDCE0] p-3 text-[14px] text-ink"
            />
            <span className={`text-[11.5px] ${erroNota ? 'text-[var(--prazo-atrasado)]' : 'text-t3'}`}>
              {erroNota
                ? 'Não consegui salvar. Tente de novo.'
                : salvandoNota
                  ? 'Salvando…'
                  : nota !== (notaSalva?.texto ?? '')
                    ? 'Salva quando você clicar fora.'
                    : notaSalva?.atualizadoEm
                      ? `Salva ${quandoFoi(notaSalva.atualizadoEm, hojeIso)}${notaSalva.atualizadoPor ? ` · ${notaSalva.atualizadoPor}` : ''}`
                      : ''}
            </span>
          </section>
        </aside>
      </div>

      {previa && <PreviaPostModal postId={previa.postId} tarefaId={previa.tarefaId} fechar={() => setPrevia(null)} />}

      {envio && (
        <ModalEnvioAprovacao
          grupo={envio.grupo}
          separado={envio.separado}
          textos={textos}
          baseUrl={baseUrl}
          hojeIso={hojeIso}
          fechar={() => setEnvio(null)}
          aoEnviar={(msg, tarefaIds) => {
            registrarMensagem(
              envio.grupo.itens.filter((i) => tarefaIds.includes(i.tarefaId)).map((i) => i.postId),
              envio.separado ? 'separado' : 'quinta',
            );
            const agora = new Date().toISOString();
            setEnviadosAgora((e) => ({ ...e, ...Object.fromEntries(tarefaIds.map((id) => [id, agora])) }));
            setEnvio(null);
            setAviso(msg);
          }}
        />
      )}

      {mensagemAberta && (
        <ModalMensagem
          projetoId={grupo.projetoId}
          clienteNome={grupo.nome}
          gruposWpp={grupo.gruposWpp}
          titulo={entregaNome}
          itens={itensPendencia}
          textos={textos}
          hojeIso={hojeIso}
          fechar={() => setMensagemAberta(false)}
          aoEnviar={(nomeGrupo) => {
            registrarMensagem(
              prontos.map((i) => i.postId),
              'geral',
            );
            setMensagemAberta(false);
            setAviso(`Mensagem enviada no grupo ${nomeGrupo ?? grupo.gruposWpp[0]?.nome ?? 'do cliente'}.`);
          }}
        />
      )}
    </div>
  );
}

const DIAS_CURTOS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

function utcDe(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}
function segundaDe(iso: string): string {
  const t = utcDe(iso);
  const dow = (new Date(t).getUTCDay() + 6) % 7;
  return new Date(t - dow * 86_400_000).toISOString().slice(0, 10);
}
function somarDiasIso(iso: string, n: number): string {
  return new Date(utcDe(iso) + n * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Posts em aberto agrupados pela semana da data de aprovação/entrega (o prazo
 * da tarefa desta entrega): Atrasadas, Esta semana, Próxima semana e depois.
 */
function gruposAprovacao(
  itens: ItemEntrega[],
  hojeIso: string,
): {
  chave: string;
  titulo: string;
  periodo: string;
  resumo: string;
  cor: string;
  linha: string;
  dataBg: string;
  dataFg: string;
  itens: ItemEntrega[];
}[] {
  const esta = segundaDe(hojeIso);
  const proxima = somarDiasIso(esta, 7);
  const mapa = new Map<string, ItemEntrega[]>();
  for (const i of itens) {
    const k = !i.prazo ? 'sem-data' : segundaDe(i.prazo) < esta ? 'atrasadas' : segundaDe(i.prazo);
    mapa.set(k, [...(mapa.get(k) ?? []), i]);
  }
  const ordem = (k: string) => (k === 'atrasadas' ? '0' : k === 'sem-data' ? '9' : k);
  return [...mapa.entries()]
    .sort(([x], [y]) => ordem(x).localeCompare(ordem(y)))
    .map(([k, lista]) => {
      const ord = [...lista].sort(
        (x, y) => (x.prazo ?? '9').localeCompare(y.prazo ?? '9') || (x.postData ?? '9').localeCompare(y.postData ?? '9'),
      );
      const comCli = ord.filter((i) => i.relacao === 'aqui').length;
      const naLud = ord.length - comCli;
      const resumo = [
        `${ord.length} ${ord.length === 1 ? 'post' : 'posts'}`,
        comCli ? `${comCli} pronto${comCli > 1 ? 's' : ''} nessa etapa` : null,
        naLud ? `${naLud} ainda antes dessa etapa` : null,
      ]
        .filter(Boolean)
        .join(' · ');
      if (k === 'atrasadas')
        return { chave: k, titulo: 'Atrasadas', periodo: 'semanas que já passaram', resumo, cor: 'var(--prazo-atrasado)', linha: 'var(--prazo-atrasado)', dataBg: 'var(--prazo-atrasado)', dataFg: '#FFFFFF', itens: ord };
      if (k === 'sem-data')
        return { chave: k, titulo: 'Sem data', periodo: 'sem prazo no Notion', resumo, cor: '#5C5C61', linha: '#E6E6EA', dataBg: '#F2F2F4', dataFg: '#5C5C61', itens: ord };
      const periodo = `${ddmm(k)} a ${ddmm(somarDiasIso(k, 6))}`;
      if (k === esta)
        return { chave: k, titulo: 'Esta semana', periodo, resumo, cor: '#313D65', linha: '#313D65', dataBg: '#313D65', dataFg: '#FFFFFF', itens: ord };
      if (k === proxima)
        return { chave: k, titulo: 'Próxima semana', periodo, resumo, cor: 'var(--ink)', linha: '#E6E6EA', dataBg: '#EEF1F8', dataFg: '#313D65', itens: ord };
      return { chave: k, titulo: `Semana de ${ddmm(k)}`, periodo, resumo, cor: 'var(--ink)', linha: '#E6E6EA', dataBg: '#F2F2F4', dataFg: '#3A3A3C', itens: ord };
    });
}

/** Passo da régua Arte → Aprov. arte → Enviar → Cliente aprova, pela tarefa atual do post. */
function passoDaRegua(i: ItemEntrega, feito: boolean): number {
  if (feito || i.relacao === 'depois' || i.relacao === 'concluido') return 4;
  if (i.relacao === 'aqui') return 3;
  const t = (i.atualTitulo ?? '').toLowerCase();
  if (/aprova[çc][ãa]o\s*\|\s*arte/.test(t)) return 1;
  if (/enviar post|aprova[çc][ãa]o\s*\|\s*geral/.test(t)) return 2;
  if (/aprova[çc][ãa]o\s*\|\s*post|altera[çc][ãa]o\s*\|\s*post/.test(t)) return 3;
  if (/\barte\b/.test(t)) return 0;
  return -1; // ainda antes da arte (pauta, briefing, materiais…)
}

function LinhaAprovacao({
  i,
  tipo,
  hojeIso,
  fundoData,
  corData,
  ehPost,
  feito = false,
  abrir,
  acao,
}: {
  i: ItemEntrega;
  tipo: TipoEntrega;
  hojeIso: string;
  fundoData: string;
  corData: string;
  ehPost: boolean;
  feito?: boolean;
  abrir: () => void;
  acao: React.ReactNode;
}) {
  const { tag, titulo } = separarTag(i.postTitulo);
  const dataGrande = feito ? (i.enviadoEm ? diaSp(i.enviadoEm) : null) : i.prazo;
  const passo = passoDaRegua(i, feito);
  const etapas = ['Arte', 'Aprov. arte', 'Enviar', 'Cliente aprova'];
  const agora = feito
    ? i.rodada > 1
      ? `Feito depois de ${i.rodada - 1} ${i.rodada - 1 === 1 ? 'alteração' : 'alterações'}`
      : 'Feito na 1ª rodada'
    : [i.relacao === 'aqui' && tipo === 'envio' ? 'Pronto pra enviar' : i.rotulo, i.responsavel, i.atualPrazo ? `até ${ddmm(i.atualPrazo)}` : null]
        .filter(Boolean)
        .join(' · ');
  return (
    <div
      role={i.postId ? 'button' : undefined}
      tabIndex={i.postId ? 0 : undefined}
      onClick={() => i.postId && abrir()}
      onKeyDown={(e) => {
        if (i.postId && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          abrir();
        }
      }}
      className={`grid grid-cols-[84px_minmax(0,1fr)] items-center gap-3.5 rounded-[14px] border border-[#EFEFF2] p-2.5 transition sm:grid-cols-[84px_minmax(0,1.5fr)_minmax(0,1.3fr)_auto] ${
        feito ? 'bg-[#FAFAFB]' : 'bg-white'
      } ${i.postId ? 'cursor-pointer hover:border-[rgba(39,50,77,0.3)]' : ''}`}
    >
      <span
        className="flex flex-col items-center rounded-xl px-1.5 py-2 leading-[1.1]"
        style={{ background: fundoData, color: corData }}
      >
        <span className="text-[9.5px] font-extrabold tracking-[0.06em] opacity-85">
          {feito ? 'FEITO' : tipo === 'cliente' || ehPost ? 'APROVAÇÃO' : 'ENTREGA'}
        </span>
        <span className="text-[21px] font-extrabold tracking-[-0.02em]">{dataGrande ? ddmm(dataGrande) : '—'}</span>
        <span className="text-[10.5px] font-bold opacity-85">{dataGrande ? DIAS_CURTOS[new Date(utcDe(dataGrande)).getUTCDay()] : ''}</span>
      </span>
      <span className="flex min-w-0 flex-col items-start gap-1">
        <span className="text-[14.5px] font-semibold leading-[1.3] text-ink">{titulo}</span>
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11.5px] text-t2">{i.postData ? `posta ${ddmm(i.postData)}` : 'sem data de postagem'}</span>
          {tag && (
            <span className="rounded-md bg-[#EEF0F5] px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-[#3E4A66]">{tag}</span>
          )}
          {!feito && <PilulaRodada item={i} tipo={tipo} />}
          <span className={`rounded-full bg-[#F2F2F4] px-2 py-0.5 text-[11px] font-semibold ${i.visto ? 'text-ink' : 'text-t2'}`}>
            {i.visto ? `👁 viu ${ddmm(diaSp(i.visto.ultima))}` : 'não visto'}
          </span>
        </span>
      </span>
      <span className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
        {ehPost ? (
          <span className="grid grid-cols-4 gap-[3px]">
            {etapas.map((t, k) => (
              <span key={t} className="flex flex-col gap-1">
                <span
                  className="h-[5px] rounded-full"
                  style={{ background: k < passo ? 'var(--ink)' : k === passo ? '#642223' : '#E6E6EA' }}
                />
                <span
                  className={`text-[10.5px] leading-[1.2] ${
                    k < passo ? 'font-semibold text-ink' : k === passo ? 'font-extrabold text-ink' : 'text-t3'
                  }`}
                >
                  {t}
                </span>
              </span>
            ))}
          </span>
        ) : (
          !feito && <PilulaTarefaAtual item={i} tipo={tipo} hoje={hojeIso} />
        )}
        <span className="text-[12px] text-t2">
          {passo === -1 && ehPost ? `Ainda antes da arte · ${agora}` : agora}
        </span>
      </span>
      <span
        className="col-span-2 justify-self-end sm:col-span-1"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {acao}
      </span>
    </div>
  );
}

function LinhaPost({
  i,
  tipo,
  hojeIso,
  abrir,
  acao,
}: {
  i: ItemEntrega;
  tipo: TipoEntrega;
  hojeIso: string;
  abrir: () => void;
  acao: React.ReactNode;
}) {
  const { tag, titulo } = separarTag(i.postTitulo);
  return (
    // A linha inteira abre a prévia do post; o botão de envio não deixa o clique subir.
    <div
      role={i.postId ? 'button' : undefined}
      tabIndex={i.postId ? 0 : undefined}
      onClick={() => i.postId && abrir()}
      onKeyDown={(e) => {
        if (i.postId && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          abrir();
        }
      }}
      className={`grid grid-cols-[56px_minmax(0,1fr)_86px_264px] items-center gap-3 border-t border-[#F0F0F3] py-2.5 ${
        i.postId ? 'cursor-pointer transition hover:bg-bgSoft/60' : ''
      }`}
    >
        <span className="text-[14px] font-extrabold text-ink">{i.postData ? ddmm(i.postData) : '—'}</span>
        <span className="flex min-w-0 flex-col items-start gap-1">
          <span className="text-[14px] font-semibold leading-[1.3] text-ink hover:underline">{titulo}</span>
          <span className="flex flex-wrap gap-1.5">
            {tag && (
              <span className="rounded-md bg-[#EEF0F5] px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-[#3E4A66]">{tag}</span>
            )}
            <PilulaRodada item={i} tipo={tipo} />
          </span>
        </span>
        <span className={`text-[12px] font-semibold ${i.visto ? 'text-[var(--cal-conferir)]' : 'text-t2'}`}>
          {i.visto ? `👁 ${ddmm(diaSp(i.visto.ultima))}` : 'não visto'}
        </span>
      <span className="flex flex-wrap items-center justify-start gap-2">
        <PilulaTarefaAtual item={i} tipo={tipo} hoje={hojeIso} />
        {acao && (
          <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            {acao}
          </span>
        )}
      </span>
    </div>
  );
}
