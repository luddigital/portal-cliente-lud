'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { nomeCurtoDoProjeto, rotas } from '@/lib/rotas';
import { Trilha } from '../../../../_components/Trilha';
import { PreviaPostModal } from '../../../../aprovacoes/PreviaPostModal';
import { BotaoLembreteWpp } from '../../../../aprovacoes/BotaoLembreteWpp';
import { ModalMensagem, type ItemPendenciaUi } from '@/app/admin/projetos/[id]/PendenciasCliente';
import { grupoDaTarefa, montarMensagemPendencias } from '@/lib/pendencias-cliente';
import { montarMensagemRegua } from '@/lib/regua-mensagens';
import {
  BotaoEnviarSoEste,
  MOMENTO_CURTO,
  ModalEnvioAprovacao,
  PilulaEnvios,
  clientePronto,
  mensagensDe,
  quandoFoi,
  type GrupoEntrega,
  type ItemEntrega,
  type TipoEntrega,
} from '../../../../entrega/[id]/EntregaPorCliente';
import { ContornoVerde } from '../../../../_ui/ContornoVerde';
import { Avatar, Barra, Card, DuasColunas, Kpis, Ponto, Rotulo, Selo, ST, Tag, TituloCard, type Kpi, type St } from '../../../../_ui/lud';

/**
 * Entrega de UM projeto no visual novo (mock "NovaEntrega" + variação D
 * "linha do tempo por post"). Mesma lógica da página anterior
 * (EntregaDoProjeto): envios pelo grupo do cliente, mudar prazo, nota interna,
 * prévia do post. Só a apresentação mudou.
 */

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const SEMANA_LONGA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
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
function somarDias(iso: string, n: number): string {
  return new Date(utc(iso) + n * 86_400_000).toISOString().slice(0, 10);
}
function segundaDe(iso: string): string {
  return somarDias(iso, -((new Date(utc(iso)).getUTCDay() + 6) % 7));
}
/** Dia (YYYY-MM-DD) de um instante, no fuso de São Paulo. */
function diaSp(iso: string): string {
  if (iso.length <= 10) return iso;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso));
}
function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}
function rotuloMeses(datas: string[]): string | null {
  const meses = [...new Set(datas.map((d) => d.slice(0, 7)))].sort();
  if (meses.length === 0) return null;
  const nomes = meses.map((m) => MESES[Number(m.slice(5, 7)) - 1]);
  return `posts de ${nomes.length === 1 ? nomes[0] : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`}`;
}
/** "AUTOMAÇÃO ROTEIRO | Vai pra Chicago…" → etiqueta + título. */
function separarTag(titulo: string): { tag: string | null; titulo: string } {
  const i = titulo.indexOf(' | ');
  return i > -1 && i < 32 ? { tag: titulo.slice(0, i), titulo: titulo.slice(i + 3) } : { tag: null, titulo };
}

type Evento = { quando: string; texto: string; detalhe: string; st: St; destaque?: boolean };
type Aba = 'todas' | 'atrasadas' | 'esta' | 'proxima';

/** Situação de um post na linha: cor da miniatura, etiqueta e se está pronto aqui. */
function situacao(i: ItemEntrega, tipo: TipoEntrega, hoje: string): { st: St; texto: string; icone: string; tracejado: boolean } {
  if (i.enviado) return { st: 'ok', texto: tipo === 'envio' ? 'enviado' : tipo === 'cliente' ? 'aprovado' : 'feito', icone: '✓', tracejado: false };
  if (i.relacao === 'aqui') {
    if (i.reaprovacao) return { st: 'hoje', texto: 'alteração', icone: '↺', tracejado: false };
    if (tipo === 'cliente' && i.prazo && i.prazo < hoje) return { st: i.visto ? 'hoje' : 'atr', texto: 'atrasada', icone: i.visto ? '◉' : '!', tracejado: false };
    if (i.visto) return { st: 'hoje', texto: 'visto', icone: '◉', tracejado: false };
    return { st: 'info', texto: tipo === 'envio' ? 'pronto' : tipo === 'cliente' ? 'com o cliente' : 'liberado', icone: '•', tracejado: false };
  }
  if (i.relacao === 'antes') return { st: 'cheg', texto: 'em produção', icone: '⏳', tracejado: true };
  return { st: 'ok', texto: 'passou daqui', icone: '✓', tracejado: false };
}

/** Os três passos da linha do tempo de cada post. */
function passos(i: ItemEntrega, tipo: TipoEntrega): { rotulo: string; feito: boolean; data: string | null }[] {
  const primeiraMsg = i.mensagens.length ? diaSp(i.mensagens[i.mensagens.length - 1].enviadoEm) : null;
  const visto = { rotulo: 'visto', feito: !!i.visto, data: i.visto ? diaSp(i.visto.ultima) : null };
  if (tipo === 'envio') {
    const aprovado = i.relacao === 'concluido' || (i.relacao === 'depois' && !/aprova|altera/i.test(i.atualTitulo ?? ''));
    return [
      { rotulo: 'enviado', feito: i.enviado, data: i.enviadoEm ? diaSp(i.enviadoEm) : null },
      visto,
      { rotulo: 'aprovado', feito: aprovado, data: null },
    ];
  }
  if (tipo === 'cliente') {
    return [
      { rotulo: 'enviado', feito: !!primeiraMsg || i.enviado, data: primeiraMsg },
      visto,
      { rotulo: 'aprovado', feito: i.enviado, data: i.enviadoEm ? diaSp(i.enviadoEm) : null },
    ];
  }
  return [
    { rotulo: 'liberado', feito: i.relacao !== 'antes' || i.enviado, data: null },
    { rotulo: 'feito', feito: i.enviado, data: i.enviadoEm ? diaSp(i.enviadoEm) : null },
  ];
}

export function EntregaProjetoNova({
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
  const [mensagemItens, setMensagemItens] = useState<ItemEntrega[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>('todas');
  const [verFeitos, setVerFeitos] = useState(false);
  // O que sai agora muda na tela sem recarregar.
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
  const handle = nomeCurtoDoProjeto(grupo.projetoNome || grupo.nome);
  const meses = rotuloMeses(datasPosts);
  const rotuloFeito = tipo === 'envio' ? 'enviados' : comCliente ? 'aprovados' : 'concluídos';
  const enviadosAoCliente = itens.filter((i) => i.mensagens.length > 0 || i.enviado).length;

  // ── Mensagem: o que dá pra mandar agora ──
  const loteLiberado = tipo === 'envio' && clientePronto(itens);
  const paraPendencia = (lista: ItemEntrega[]): ItemPendenciaUi[] =>
    lista.map((i) => ({
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
    if (comCliente && prontos.length) {
      return montarMensagemPendencias({ apelido, itens: paraPendencia(prontos), textos, hoje: hojeIso });
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
    if (comCliente && prontos.length) setMensagemItens(prontos);
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

  // ── Números do topo ──
  const kpis: Kpi[] = [];
  if (abertos.length === 0) kpis.push({ rotulo: 'Feito', valor: 'Tudo certo', sub: `${plural(feitos.length, 'post', 'posts')} ${rotuloFeito}`, st: 'ok' });
  else if (!prazo) kpis.push({ rotulo: 'Prazo', valor: 'Sem data', sub: 'nenhuma tarefa com prazo' });
  else if (atraso > 0) kpis.push({ rotulo: 'Atraso', valor: plural(atraso, 'dia', 'dias'), sub: `venceu ${diaSemana(prazo)}, ${ddmm(prazo)}`, st: 'atr' });
  else if (diasPrazo === 0) kpis.push({ rotulo: 'Prazo', valor: 'Hoje', sub: `vence hoje, ${ddmm(prazo)}`, st: 'hoje' });
  else
    kpis.push({
      rotulo: 'Prazo',
      valor: diasPrazo === 1 ? 'Amanhã' : `Em ${diasPrazo} dias`,
      sub: `até ${diaSemana(prazo)}, ${ddmm(prazo)}`,
      st: diasPrazo! <= 2 ? 'cheg' : undefined,
    });
  if (tipo === 'interna') {
    kpis.push({
      rotulo: 'Nessa etapa',
      valor: `${prontos.length} de ${abertos.length}`,
      sub: travados.length ? `${plural(travados.length, 'ainda não chegou', 'ainda não chegaram')} aqui` : 'tudo liberado pra fazer',
    });
    kpis.push({ rotulo: rotuloFeito, valor: `${feitos.length} de ${itens.length}`, sub: feitos.length ? 'já passaram dessa etapa' : 'nenhum ainda' });
  } else {
    kpis.push({
      rotulo: 'Mensagens',
      valor: String(msgs.length),
      sub: msgs[0] ? `última ${quandoFoi(msgs[0].enviadoEm, hojeIso)}` : 'nenhuma sobre essa entrega',
    });
    kpis.push({
      rotulo: 'Cliente viu',
      valor: `${vistos.length} de ${itens.length}`,
      sub: ultimaVista ? `última abertura ${quandoFoi(ultimaVista, hojeIso)}` : 'nenhum post aberto',
    });
  }
  kpis.push({
    rotulo: 'Folga',
    valor: folga === null ? 'sem data' : plural(folga, 'dia', 'dias'),
    sub: primeiroPost ? `até o 1º post, em ${ddmm(primeiroPost)}` : 'sem post com data pela frente',
  });

  // ── Linha do envio até a data de entrega ──
  const primeiraMsg = msgs.length ? diaSp(msgs[msgs.length - 1].enviadoEm) : null;
  const linha = (() => {
    if (!prazo || abertos.length === 0) return null;
    const ini = primeiraMsg && primeiraMsg < prazo ? primeiraMsg : null;
    const inicio = ini ?? (prazo < hojeIso ? prazo : hojeIso);
    const fim = [prazo, hojeIso].sort()[1];
    const total = Math.max(1, diasEntre(inicio, fim));
    const pos = (d: string) => Math.min(100, Math.max(0, (diasEntre(inicio, d) / total) * 100));
    const resumo = [
      ini ? `${plural(diasEntre(ini, hojeIso), 'dia', 'dias')} desde o envio` : 'nada enviado ainda',
      ini ? `${plural(diasEntre(ini, prazo), 'dia', 'dias')} de prazo` : null,
      atraso > 0 ? `${plural(atraso, 'dia corrido', 'dias corridos')} depois do prazo` : diasPrazo === 0 ? 'vence hoje' : `faltam ${plural(diasPrazo!, 'dia', 'dias')}`,
    ]
      .filter(Boolean)
      .join(' · ');
    return { ini, inicio, pos, resumo };
  })();

  // ── Histórico ──
  const eventos: Evento[] = [];
  if (atraso > 0 && abertos.length) {
    eventos.push({
      quando: hojeIso,
      texto: `Hoje · ${plural(atraso, 'dia', 'dias')} de atraso${comCliente && vistos.length === 0 ? ', sem resposta' : ''}`,
      detalhe: `${diaSemana(hojeIso)}, ${ddmm(hojeIso)}`,
      st: 'atr',
      destaque: true,
    });
    eventos.push({
      quando: prazo!,
      texto: comCliente ? 'Prazo venceu sem aprovação' : tipo === 'envio' ? 'Prazo do envio venceu' : 'Prazo venceu',
      detalhe: `${diaSemana(prazo!)}, ${ddmm(prazo!)}`,
      st: 'atr',
    });
  }
  for (const m of msgs) {
    eventos.push({ quando: m.enviadoEm, texto: `Mensagem no grupo · ${MOMENTO_CURTO[m.momento] ?? m.momento}`, detalhe: quandoFoi(m.enviadoEm, hojeIso), st: 'ok' });
  }
  for (const i of vistos) {
    eventos.push({ quando: i.visto!.ultima, texto: `${grupo.nome} abriu “${separarTag(i.postTitulo).titulo}”`, detalhe: quandoFoi(i.visto!.ultima, hojeIso), st: 'hoje' });
  }
  for (const i of feitos) {
    if (!i.enviadoEm) continue;
    eventos.push({
      quando: i.enviadoEm,
      texto: `“${separarTag(i.postTitulo).titulo}” ${tipo === 'envio' ? 'enviado pro cliente' : comCliente ? 'aprovado' : 'concluído'}`,
      detalhe: i.enviadoEm.length > 10 ? quandoFoi(i.enviadoEm, hojeIso) : `${diaSemana(i.enviadoEm)}, ${ddmm(i.enviadoEm)}`,
      st: 'neu',
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
      if (atraso > 0) return `Já mandamos mensagem ${quandoFoi(msgs[0].enviadoEm, hojeIso)}. Sem resposta: cobrar de novo no grupo ou ligar.`;
      return `Esperar ${grupo.nome}. O prazo é ${prazo ? `${diaSemana(prazo)}, ${ddmm(prazo)}` : 'sem data'}.`;
    }
    const quem = responsaveis.length ? responsaveis.join(' e ') : 'a equipe';
    return `${quem} faz ${entregaNome.toLowerCase()} de ${plural(abertos.length, 'post', 'posts')}${prazo ? ` até ${diaSemana(prazo)}, ${ddmm(prazo)}` : ''}.`;
  })();

  // ── Grupos por semana do prazo, e dentro, por data ──
  const esta = segundaDe(hojeIso);
  const proxima = somarDias(esta, 7);
  const chaveSemana = (i: ItemEntrega): Aba | 'depois' | 'sem' =>
    !i.prazo ? 'sem' : segundaDe(i.prazo) < esta ? 'atrasadas' : segundaDe(i.prazo) === esta ? 'esta' : segundaDe(i.prazo) === proxima ? 'proxima' : 'depois';
  const secoes = (
    [
      { k: 'atrasadas', titulo: 'Atrasadas', sub: 'rodadas que já passaram do prazo', st: 'atr' as St },
      { k: 'esta', titulo: 'Esta semana', sub: `${ddmm(esta)} a ${ddmm(somarDias(esta, 6))}`, st: 'hoje' as St },
      { k: 'proxima', titulo: 'Próxima semana', sub: `${ddmm(proxima)} a ${ddmm(somarDias(proxima, 6))}`, st: 'cheg' as St },
      { k: 'depois', titulo: 'Mais pra frente', sub: 'depois da próxima semana', st: 'neu' as St },
      { k: 'sem', titulo: 'Sem data', sub: 'sem prazo no Notion', st: 'neu' as St },
    ] as const
  )
    .map((s) => {
      const lista = abertos.filter((i) => chaveSemana(i) === s.k);
      const porData = new Map<string, ItemEntrega[]>();
      for (const i of lista) porData.set(i.prazo ?? '', [...(porData.get(i.prazo ?? '') ?? []), i]);
      const blocos = [...porData.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([data, its]) => ({
          data,
          itens: its.sort((x, y) => (x.postData ?? '9').localeCompare(y.postData ?? '9')),
        }));
      return { ...s, total: lista.length, blocos };
    })
    .filter((s) => s.total > 0);
  const contaAba = (k: Aba) => (k === 'todas' ? abertos.length : abertos.filter((i) => chaveSemana(i) === k).length);
  const secoesVisiveis = aba === 'todas' ? secoes : secoes.filter((s) => s.k === aba);

  // ── Resumo ──
  const nAtr = abertos.filter((i) => i.prazo && i.prazo < hojeIso).length;
  const nHoje = abertos.filter((i) => i.prazo === hojeIso).length;
  const nCheg = abertos.length - nAtr - nHoje;

  function acaoDoItem(i: ItemEntrega) {
    if (i.enviado || i.relacao !== 'aqui' || !i.postId) return null;
    if (tipo === 'envio') return <BotaoEnviarSoEste onClick={() => setEnvio({ grupo: { ...grupo, itens: [i] }, separado: true })} />;
    if (comCliente)
      return (
        <ContornoVerde>
          <BotaoLembreteWpp
            tarefaId={i.tarefaId}
            clienteNome={grupo.nome}
            rotulo={i.mensagens.length ? 'Lembrar' : 'Enviar'}
            compacto
            aoEnviar={() => registrarMensagem([i.postId], 'avulso')}
          />
        </ContornoVerde>
      );
    return null;
  }

  function acaoDoBloco(its: ItemEntrega[]) {
    const pr = its.filter((i) => i.relacao === 'aqui' && i.postId && !i.enviado);
    if (tipo === 'envio') {
      if (clientePronto(its))
        return (
          <button type="button" onClick={() => setEnvio({ grupo: { ...grupo, itens: pr }, separado: false })} className={BTN_VERDE}>
            Enviar {pr.length === 1 ? 'o pronto' : `${pr.length} prontos`}
          </button>
        );
      return <span className={PILULA_CINZA}>{pr.length ? `${pr.length} pronto${pr.length > 1 ? 's' : ''} de ${its.length}` : 'nada pronto ainda'}</span>;
    }
    if (comCliente) {
      if (pr.length === 0) return <span className={PILULA_CINZA}>nada pronto ainda</span>;
      const jaFoi = pr.some((i) => i.mensagens.length > 0);
      return (
        <button type="button" onClick={() => setMensagemItens(pr)} className={BTN_VERDE}>
          {jaFoi ? 'Lembrar no grupo' : `Enviar ${pr.length === 1 ? 'o pronto' : `${pr.length} prontos`}`}
        </button>
      );
    }
    return null;
  }

  const abrirPrevia = (i: ItemEntrega) => i.postId && setPrevia({ postId: i.postId, tarefaId: i.aprovacaoTarefaId ?? i.tarefaId });

  return (
    <main className="lud-admin mx-auto flex w-full max-w-[1280px] flex-col gap-[18px] px-4 py-7 sm:px-8">
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
        <div className="flex rounded-[12px] bg-[#F4F4F5] p-[3px] text-[13px]" role="group" aria-label="Filtro de projeto">
          <span className="rounded-[10px] bg-white px-3.5 py-1.5 font-extrabold shadow-[0_1px_2px_rgba(17,17,19,0.08)]">Só {handle}</span>
          <Link href={rotas.entrega(entregaId)} className="rounded-[10px] px-3.5 py-1.5 font-bold text-[#636369] hover:text-[#111113]">
            Todos os clientes
          </Link>
        </div>
      </div>

      {aviso && (
        <div role="status" className="rounded-[14px] px-4 py-2.5 text-[13px] font-semibold" style={{ background: ST.ok[0], color: ST.ok[1] }}>
          {aviso}
        </div>
      )}

      {/* ─── Título ─── */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[12.5px] font-bold text-[#46464B]">
            Entrega · {comCliente ? 'com o cliente' : tipo === 'envio' ? 'envio pro cliente' : 'interna'}
            {meses ? ` · ${meses}` : ''}
            {frequencia ? ` · ${frequencia.toLowerCase()}` : ''}
          </span>
          <h1 className="text-[30px] font-extrabold leading-tight tracking-[-0.02em]">{entregaNome}</h1>
          <div className="flex flex-wrap items-center gap-2 text-[12.5px] font-bold text-[#46464B]">
            <Selo handle={handle} href={rotas.projeto(grupo.projetoId)} />
            <span className="rounded-full border border-[#E9E9EB] bg-white px-2.5 py-[3px]">{plural(itens.length, 'post', 'posts')}</span>
            <span className="flex items-center gap-1.5">
              <Avatar nome={apelido} tam={20} cor={ST.cli[2]} />
              {grupo.nome} · cliente
            </span>
            {responsaveis.length > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="flex -space-x-1.5">
                  {responsaveis.slice(0, 3).map((r) => (
                    <span key={r} className="rounded-full ring-2 ring-white">
                      <Avatar nome={r} tam={20} />
                    </span>
                  ))}
                </span>
                {responsaveis.join(', ')} · responsável Lud.
              </span>
            )}
          </div>
        </div>
        <div className="relative flex flex-wrap gap-2">
          {abertos.length > 0 && (
            <button type="button" onClick={() => setPrazoAberto((v) => !v)} className={BTN_SEC}>
              Mudar prazo
            </button>
          )}
          <a href={`https://www.notion.so/${entregaId.replace(/-/g, '')}`} target="_blank" rel="noreferrer" className={BTN_SEC}>
            Abrir no Notion ↗
          </a>
          {prazoAberto && (
            <div className="absolute right-0 top-full z-20 mt-2 flex w-[300px] flex-col gap-3 rounded-[18px] border border-[#E9E9EB] bg-white p-4 shadow-[0_12px_32px_rgba(17,17,19,0.14)]">
              <b className="text-[14px]">Novo prazo</b>
              <p className="text-[12.5px] text-[#636369]">
                Muda a data das {plural(abertos.length, 'tarefa', 'tarefas')} em aberto dessa entrega. Fica no histórico de cada post.
              </p>
              <input
                type="date"
                value={novoPrazo}
                onChange={(e) => setNovoPrazo(e.target.value)}
                className="w-full rounded-[11px] border border-[#D6D6D9] px-3 py-2 text-[14px]"
              />
              {erroPrazo && <p className="text-[12px]" style={{ color: ST.atr[2] }}>{erroPrazo}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPrazoAberto(false)} className="rounded-[10px] px-3 py-2 text-[13px] text-[#636369] hover:text-[#111113]">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={salvarPrazo}
                  disabled={salvandoPrazo || novoPrazo === prazo}
                  className="rounded-[10px] bg-[#111113] px-3.5 py-2 text-[13px] font-extrabold text-white hover:bg-[#2C2C30] disabled:opacity-40"
                >
                  {salvandoPrazo ? 'Salvando…' : 'Salvar prazo'}
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <Kpis itens={kpis} />

      {/* ─── Do envio até a data de entrega ─── */}
      {linha && prazo && (
        <Card pad="px-6 py-5">
          <TituloCard titulo="Do envio até a data de entrega" acao={<span className="text-[12px] text-[#636369]">{linha.resumo}</span>} />
          <div className="relative mt-1 h-[6px] rounded-full bg-[#E9E9EB]">
            <span className="absolute inset-y-0 left-0 rounded-l-full bg-[#B4B4B9]" style={{ width: `${linha.pos(prazo)}%` }} />
            {atraso > 0 && (
              <span
                className="absolute inset-y-0 rounded-r-full"
                style={{ left: `${linha.pos(prazo)}%`, width: `${linha.pos(hojeIso) - linha.pos(prazo)}%`, background: ST.atr[2] }}
              />
            )}
            <span className="absolute -top-[6px] h-[18px] w-[3px] -translate-x-1/2 rounded bg-[#111113]" style={{ left: `${linha.pos(hojeIso)}%` }} />
            {atraso > 0 && (
              <span className="absolute -top-[6px] h-[18px] w-[3px] -translate-x-1/2 rounded" style={{ left: `${linha.pos(prazo)}%`, background: ST.atr[2] }} />
            )}
          </div>
          <div className="flex flex-wrap justify-between gap-x-6 gap-y-2 text-[12px]">
            {linha.ini ? (
              <span className="flex flex-col">
                <b>{ddmm(linha.ini)} · enviada</b>
                <span className="text-[#636369]">mensagem no grupo</span>
              </span>
            ) : (
              <span className="flex flex-col">
                <b>nada enviado</b>
                <span className="text-[#636369]">{comCliente ? 'sem mensagem no grupo' : 'tarefas da Lud.'}</span>
              </span>
            )}
            <span className="flex flex-col text-center" style={atraso > 0 ? { color: ST.atr[2] } : undefined}>
              <b>{ddmm(prazo)} · data de entrega</b>
              <span className={atraso > 0 ? '' : 'text-[#636369]'}>{diaSemana(prazo)}</span>
            </span>
            {prazo !== hojeIso && (
              <span className="flex flex-col text-right" style={atraso > 0 ? { color: ST.atr[2] } : undefined}>
                <b>{ddmm(hojeIso)} · hoje</b>
                <span className={atraso > 0 ? '' : 'text-[#636369]'}>
                  {atraso > 0 ? `+${plural(atraso, 'dia', 'dias')} de atraso` : `faltam ${plural(diasPrazo!, 'dia', 'dias')}`}
                </span>
              </span>
            )}
          </div>
        </Card>
      )}

      <DuasColunas
        esq={
          <>
            {/* ─── Mensagem ao cliente ─── */}
            {tipo !== 'interna' && (
              <Card pad="p-6">
                <TituloCard
                  titulo="Mensagem ao cliente"
                  acao={
                    <span className="text-[12px] font-bold" style={{ color: grupo.gruposWpp.length ? '#46464B' : ST.atr[2] }}>
                      {grupo.gruposWpp.length ? `vai no grupo do WhatsApp${grupo.gruposWpp[0]?.nome ? ` · ${grupo.gruposWpp[0].nome}` : ''}` : 'sem grupo do WhatsApp'}
                    </span>
                  }
                />
                {msgs.length === 0 ? (
                  <div
                    className="rounded-[12px] px-3.5 py-2.5 text-[13.5px] font-semibold"
                    style={
                      abertos.length && (atraso > 0 || diasPrazo === 0)
                        ? { background: ST.atr[0], color: ST.atr[1] }
                        : { background: ST.neu[0], color: ST.neu[1] }
                    }
                  >
                    Ainda não mandamos nada sobre essa entrega.
                  </div>
                ) : (
                  <ul className="divide-y divide-[#F4F4F5] rounded-[12px] bg-[#FAFAFA] px-3.5">
                    {msgs.slice(0, 5).map((m) => (
                      <li key={`${m.momento}-${m.enviadoEm}`} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                        <span className="flex items-center gap-2 font-bold">
                          <Ponto st="ok" />
                          {MOMENTO_CURTO[m.momento] ?? m.momento}
                        </span>
                        <span className="text-[#636369]">{quandoFoi(m.enviadoEm, hojeIso)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {sugerida ? (
                  <>
                    <div className="max-h-[260px] overflow-y-auto whitespace-pre-wrap rounded-[14px] border border-[#D6D6D9] p-3.5 text-[14px] leading-[1.55]">
                      {sugerida}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <span className="text-[12px] text-[#636369]">Dá pra editar e escolher os posts antes de enviar. Vai com o link de cada post.</span>
                      <button type="button" onClick={abrirMensagem} className={`${BTN_VERDE} !px-4 !py-2.5 !text-[13.5px]`}>
                        Enviar no grupo
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-[13px] text-[#636369]">
                    {abertos.length === 0
                      ? 'Tudo dessa entrega já foi resolvido.'
                      : tipo === 'envio'
                        ? `O lote sai quando os ${plural(abertos.length, 'post estiver pronto', 'posts estiverem prontos')}. Enquanto isso, dá pra mandar um post de cada vez na lista abaixo.`
                        : 'Nenhum post chegou nessa etapa ainda.'}
                  </p>
                )}
              </Card>
            )}

            {/* ─── Posts da entrega ─── */}
            <Card pad="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <b className="text-[16px] font-bold tracking-[-0.01em]">Posts desta entrega</b>
                  <span className="text-[12.5px] text-[#636369]">
                    {tipo === 'interna'
                      ? `${feitos.length} de ${itens.length} ${rotuloFeito} · ${abertos.length} em aberto`
                      : `${enviadosAoCliente} de ${itens.length} enviados · ${plural(vistos.length, 'visto', 'vistos')} · ${feitos.length} ${rotuloFeito}`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-0.5 rounded-[12px] bg-[#F4F4F5] p-[3px]">
                  {(
                    [
                      ['todas', 'Todas'],
                      ['atrasadas', 'Atrasadas'],
                      ['esta', 'Esta semana'],
                      ['proxima', 'Próxima semana'],
                    ] as [Aba, string][]
                  ).map(([k, t]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setAba(k)}
                      className={`whitespace-nowrap rounded-[10px] px-3 py-1.5 text-[12.5px] ${
                        aba === k ? 'bg-white font-extrabold shadow-[0_1px_2px_rgba(17,17,19,0.08)]' : 'font-bold text-[#636369] hover:text-[#111113]'
                      }`}
                    >
                      {t} · {contaAba(k)}
                    </button>
                  ))}
                </div>
              </div>

              {secoesVisiveis.length === 0 && (
                <div className="rounded-[14px] border border-dashed border-[#D6D6D9] px-4 py-5 text-center text-[13px] text-[#636369]">
                  {abertos.length === 0 ? 'Nenhum post em aberto nessa entrega.' : 'Nada nesse recorte.'}
                </div>
              )}

              {secoesVisiveis.map((s) => (
                <section key={s.k} className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2 px-0.5 pt-1">
                    <span className="flex flex-wrap items-baseline gap-2">
                      <span className="self-center">
                        <Ponto st={s.st} />
                      </span>
                      <b className="text-[14px]">{s.titulo}</b>
                      <span className="text-[12.5px] text-[#636369]">{s.sub}</span>
                    </span>
                    <span className="text-[12px] font-extrabold text-[#46464B]">{s.blocos.length}</span>
                  </div>
                  {s.blocos.map((b) => (
                    <BlocoData
                      key={b.data || 'sem'}
                      data={b.data}
                      st={s.st}
                      itens={b.itens}
                      tipo={tipo}
                      hojeIso={hojeIso}
                      acao={acaoDoBloco(b.itens)}
                      acaoDoItem={acaoDoItem}
                      abrir={abrirPrevia}
                      rotuloFeito={rotuloFeito}
                    />
                  ))}
                </section>
              ))}

              {feitos.length > 0 && aba === 'todas' && (
                <section className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2 px-0.5 pt-1">
                    <span className="flex items-baseline gap-2">
                      <span className="self-center">
                        <Ponto st="ok" />
                      </span>
                      <b className="text-[14px]">Já feitos</b>
                      <span className="text-[12.5px] text-[#636369]">{rotuloFeito}</span>
                    </span>
                    <span className="text-[12px] font-extrabold text-[#46464B]">{feitos.length}</span>
                  </div>
                  <div className="overflow-hidden rounded-[16px] border border-[#E9E9EB]">
                    {[...feitos]
                      .sort((x, y) => (y.enviadoEm ?? '').localeCompare(x.enviadoEm ?? ''))
                      .slice(0, verFeitos ? feitos.length : 3)
                      .map((i) => (
                        <LinhaPost key={i.tarefaId} i={i} tipo={tipo} hojeIso={hojeIso} abrir={() => abrirPrevia(i)} acao={null} />
                      ))}
                  </div>
                  {feitos.length > 3 && (
                    <button type="button" onClick={() => setVerFeitos((v) => !v)} className="self-start px-1 text-[12.5px] font-bold text-[#636369] hover:text-[#111113]">
                      {verFeitos ? 'Mostrar menos' : `e mais ${feitos.length - 3} →`}
                    </button>
                  )}
                </section>
              )}
            </Card>
          </>
        }
        dir={
          <>
            <Card pad="p-[22px]">
              <TituloCard titulo="Resumo" />
              <div className="flex flex-col gap-1 text-[12.5px]">
                {responsaveis.length > 0 && (
                  <span>
                    <b>{responsaveis.join(', ')}</b> <span className="text-[#636369]">· responsável na Lud.</span>
                  </span>
                )}
                <span>
                  <b>{apelido}</b> <span className="text-[#636369]">· {comCliente ? 'aprova pelo cliente' : 'cliente'}</span>
                </span>
              </div>
              <Barra
                altura={8}
                partes={[
                  { st: 'atr', valor: nAtr },
                  { st: 'hoje', valor: nHoje },
                  { st: 'cheg', valor: nCheg },
                  { st: 'ok', valor: feitos.length },
                ]}
              />
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ['atr', 'Atrasados', nAtr],
                    ['hoje', 'Hoje', nHoje],
                    ['cheg', 'Chegando', nCheg],
                    ['ok', rotuloFeito, feitos.length],
                  ] as [St, string, number][]
                ).map(([st, r, n]) => (
                  <span key={r} className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-1.5">
                      <Ponto st={st} />
                      <Rotulo>{r}</Rotulo>
                    </span>
                    <b className={`text-[20px] font-extrabold ${n ? '' : 'text-[#B4B4B9]'}`}>{n}</b>
                  </span>
                ))}
              </div>
              <p className="border-t border-[#F4F4F5] pt-3 text-[13px] leading-[1.5]">
                <b>Próximo passo:</b> {proximoPasso}
              </p>
            </Card>

            <Card pad="p-[22px]">
              <TituloCard titulo="Histórico" acao={<span className="text-[12px] text-[#636369]">mais recente primeiro</span>} />
              {eventos.length === 0 ? (
                <p className="text-[13px] text-[#636369]">Nada registrado ainda.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {eventos.slice(0, 10).map((e, idx) => (
                    <div key={`${e.quando}-${idx}`} className="flex items-start gap-2.5">
                      <span className="mt-[5px]">
                        <Ponto st={e.st} />
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <b className="text-[13.5px]" style={e.destaque ? { color: ST.atr[2] } : undefined}>
                          {e.texto}
                        </b>
                        <span className="text-[12px] text-[#636369]">{e.detalhe}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card pad="p-[22px]">
              <TituloCard titulo="Nota interna" acao={<span className="text-[12px] text-[#636369]">só a equipe vê</span>} />
              <textarea
                id="nota-entrega"
                aria-label="Nota interna"
                rows={3}
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                onBlur={salvarNota}
                placeholder={`Ex.: ${grupo.nome} viaja até dia 22, cobrar depois.`}
                className="w-full rounded-[12px] border border-[#D6D6D9] p-3 text-[13.5px]"
              />
              <span className="text-[11.5px]" style={{ color: erroNota ? ST.atr[2] : '#8A8A90' }}>
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
            </Card>
          </>
        }
      />

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

      {mensagemItens && (
        <ModalMensagem
          projetoId={grupo.projetoId}
          clienteNome={grupo.nome}
          gruposWpp={grupo.gruposWpp}
          titulo={entregaNome}
          itens={paraPendencia(mensagemItens)}
          textos={textos}
          hojeIso={hojeIso}
          fechar={() => setMensagemItens(null)}
          aoEnviar={(nomeGrupo) => {
            registrarMensagem(
              mensagemItens.map((i) => i.postId),
              'geral',
            );
            setMensagemItens(null);
            setAviso(`Mensagem enviada no grupo ${nomeGrupo ?? grupo.gruposWpp[0]?.nome ?? 'do cliente'}.`);
          }}
        />
      )}
    </main>
  );
}

const BTN_SEC =
  'inline-flex items-center justify-center whitespace-nowrap rounded-[11px] border border-[#D6D6D9] bg-white px-3.5 py-2 text-[13px] font-extrabold hover:bg-[#F4F4F5]';
// Verde só pra ação que manda algo pro cliente.
const BTN_VERDE =
  'inline-flex items-center justify-center whitespace-nowrap rounded-[11px] border border-[#2E7D4F] bg-[#2E7D4F] px-3 py-1.5 text-[12.5px] font-extrabold text-white hover:bg-[#256641]';
const PILULA_CINZA = 'whitespace-nowrap rounded-full bg-[#F4F4F5] px-3 py-1 text-[12px] font-bold text-[#636369]';

const FUNDO_BLOCO: Record<St, string> = {
  atr: ST.atr[0],
  hoje: '#F4F4F5',
  cheg: ST.cheg[0],
  ok: ST.ok[0],
  info: ST.info[0],
  neu: '#F4F4F5',
  cli: ST.cli[0],
  areia: ST.areia[0],
  lima: ST.lima[0],
  prog: ST.prog[0],
};

/** Uma data de entrega: cabeçalho com miniaturas dos posts + as linhas de cada post. */
function BlocoData({
  data,
  st,
  itens,
  tipo,
  hojeIso,
  acao,
  acaoDoItem,
  abrir,
  rotuloFeito,
}: {
  data: string;
  st: St;
  itens: ItemEntrega[];
  tipo: TipoEntrega;
  hojeIso: string;
  acao: React.ReactNode;
  acaoDoItem: (i: ItemEntrega) => React.ReactNode;
  abrir: (i: ItemEntrega) => void;
  rotuloFeito: string;
}) {
  const atrasoDias = data && data < hojeIso ? diasEntre(data, hojeIso) : 0;
  const cor = st === 'atr' ? ST.atr[1] : st === 'cheg' ? ST.cheg[1] : '#111113';
  const etiqueta = !data
    ? 'sem prazo'
    : atrasoDias > 0
      ? `atrasada ${plural(atrasoDias, 'dia', 'dias')}`
      : data === hojeIso
        ? 'vence hoje'
        : st === 'hoje'
          ? 'esta semana'
          : st === 'cheg'
            ? 'próxima semana'
            : `em ${plural(diasEntre(hojeIso, data), 'dia', 'dias')}`;
  const enviados = itens.filter((i) => i.mensagens.length > 0 || i.enviado).length;
  const vistosN = itens.filter((i) => i.visto).length;
  return (
    <div className="overflow-hidden rounded-[16px] border" style={{ borderColor: st === 'atr' ? '#F0B9B3' : '#E9E9EB' }}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3.5 py-3" style={{ background: FUNDO_BLOCO[st] }}>
        <span className="flex min-w-[120px] flex-col">
          <b className="text-[15px] font-extrabold" style={{ color: cor }}>
            {data ? `${SEMANA_LONGA[new Date(utc(data)).getUTCDay()]}, ${ddmm(data)}` : 'Sem data'}
          </b>
          <span className="text-[11px] font-extrabold" style={{ color: cor, opacity: 0.85 }}>
            {etiqueta}
          </span>
        </span>
        <span className="flex flex-1 flex-wrap gap-1.5">
          {itens.map((i) => {
            const s = situacao(i, tipo, hojeIso);
            const [bg, fg, md] = ST[s.st];
            return (
              <button
                key={i.tarefaId}
                type="button"
                title={`${separarTag(i.postTitulo).titulo} · ${s.texto}`}
                onClick={() => abrir(i)}
                className="flex h-8 w-8 items-center justify-center rounded-[9px] text-[12px] font-extrabold"
                style={
                  s.tracejado
                    ? { border: '1.5px dashed #B4B4B9', background: '#FFFFFF', color: '#636369' }
                    : { border: `1.5px solid ${md}`, background: s.st === 'atr' ? '#FFFFFF' : bg, color: s.st === 'atr' ? md : fg }
                }
              >
                {s.icone}
              </button>
            );
          })}
        </span>
        <span className="flex flex-col text-right text-[12px] leading-[1.3]">
          {tipo === 'interna' ? (
            <span>
              <b>{itens.filter((i) => i.relacao === 'aqui').length} de {itens.length}</b> liberados
            </span>
          ) : (
            <>
              <span>
                <b>{vistosN} de {itens.length}</b> vistos
              </span>
              <span className="text-[#636369]">{plural(enviados, 'enviado', 'enviados')}</span>
            </>
          )}
        </span>
        {acao}
      </div>
      {itens.map((i) => (
        <LinhaPost key={i.tarefaId} i={i} tipo={tipo} hojeIso={hojeIso} abrir={() => abrir(i)} acao={acaoDoItem(i)} />
      ))}
    </div>
  );
}

/** Linha de um post: título + enviado → visto → aprovado + situação + ação. */
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
  const s = situacao(i, tipo, hojeIso);
  const ps = passos(i, tipo);
  const comentarios = i.mensagens.length;
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
      className={`grid grid-cols-1 items-center gap-x-4 gap-y-2 border-t border-[#F4F4F5] bg-white px-3.5 py-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(200px,1fr)_auto_auto] ${
        i.postId ? 'cursor-pointer hover:bg-[#FAFAFA]' : ''
      }`}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <b className="text-[13.5px] font-bold leading-[1.3]">{titulo}</b>
        <span className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-[#636369]">
          {i.postData ? `posta ${ddmm(i.postData)}` : 'sem data de postagem'}
          {tag && <span className="rounded-[6px] bg-[#F4F4F5] px-1.5 py-[1px] text-[10px] font-extrabold uppercase text-[#46464B]">{tag}</span>}
          {i.reaprovacao && i.rodada > 1 && <span>· {i.rodada}ª rodada</span>}
          {/* Quantas vezes a mensagem desse post já foi pro grupo nessa rodada (1º envio, 2º envio…). */}
          {!i.enviado && tipo === 'cliente' && <PilulaEnvios item={i} />}
          {comentarios > 0 && <span>· {plural(comentarios, 'mensagem', 'mensagens')}</span>}
          {!i.enviado && i.relacao === 'antes' && i.atualTitulo && (
            <span>
              · agora em {i.rotulo}
              {i.responsavel ? ` com ${i.responsavel}` : ''}
              {i.atualPrazo ? ` até ${ddmm(i.atualPrazo)}` : ''}
            </span>
          )}
        </span>
      </span>
      <span className="flex items-start">
        {ps.map((p, k) => (
          <span key={p.rotulo} className="flex flex-1 items-start">
            {k > 0 && <span className="mt-[6px] h-[2px] flex-1" style={{ background: p.feito && ps[k - 1].feito ? ST.ok[2] : '#E9E9EB' }} />}
            <span className="flex w-[56px] flex-col items-center gap-0.5">
              <span
                className="h-3 w-3 rounded-full"
                style={p.feito ? { background: ST.ok[2] } : { border: '1.5px solid #B4B4B9', background: '#FFFFFF' }}
              />
              <span className={`text-[10.5px] ${p.feito ? 'font-extrabold' : 'text-[#8A8A90]'}`} style={p.feito ? { color: ST.ok[1] } : undefined}>
                {p.rotulo}
              </span>
              <span className="text-[10px] text-[#8A8A90]">{p.data ? ddmm(p.data) : '·'}</span>
            </span>
          </span>
        ))}
      </span>
      <span>
        <Tag st={s.st} className="!min-w-0">
          {s.texto}
        </Tag>
      </span>
      <span className="justify-self-start sm:justify-self-end" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        {acao ?? (i.enviado ? null : <span className={PILULA_CINZA}>{i.relacao === 'antes' ? 'em produção' : 'nessa etapa'}</span>)}
      </span>
    </div>
  );
}
