/**
 * Etapas do processo de social media, a partir do título das tarefas abertas
 * do projeto no Notion. Usado nos cards do topo da página do projeto e na aba
 * Entregas (agrupada por etapa). Arquivo puro: sem acesso a banco.
 */
import type { TarefaDoProjeto } from './notion';

export type EtapaProjeto =
  | 'pauta'
  | 'previos'
  | 'stories'
  | 'briefing'
  | 'materiais'
  | 'arte'
  | 'aprovacao'
  | 'programacao';

export const ETAPAS_PROJETO: { id: EtapaProjeto; nome: string; curto: string }[] = [
  { id: 'pauta', nome: 'Criação de Pauta', curto: 'Pauta' },
  { id: 'previos', nome: 'Conteúdos Prévios', curto: 'Prévios' },
  { id: 'briefing', nome: 'Briefing & Copy', curto: 'Briefing & Copy' },
  { id: 'materiais', nome: 'Materiais para Produção', curto: 'Materiais' },
  { id: 'arte', nome: 'Arte', curto: 'Arte' },
  { id: 'aprovacao', nome: 'Aprovação do Post', curto: 'Aprovação' },
  { id: 'programacao', nome: 'Programação', curto: 'Programação' },
  { id: 'stories', nome: 'Direcionamento de Stories', curto: 'Stories' },
];

/** Etapa da tarefa pelo título; null = tarefa fora do fluxo de posts (reuniões, calendário…). */
export function etapaDaTarefa(titulo: string): EtapaProjeto | null {
  const t = titulo.toLowerCase();
  if (/reuni|fechamento|m[ée]tricas/.test(t)) return null;
  if (/direcionamento|stories|story/.test(t)) return 'stories';
  if (/pauta|produzir post/.test(t)) return 'pauta';
  if (/pr[ée]vi|conte[úu]do/.test(t)) return 'previos';
  if (/briefing|copy|roteiro/.test(t)) return 'briefing';
  if (/materia/.test(t)) return 'materiais';
  if (/\barte\b/.test(t)) return 'arte';
  if (/enviar post|aprova[çc][ãa]o\s*\|\s*(post|geral)|altera[çc][ãa]o\s*\|\s*post/.test(t)) return 'aprovacao';
  if (/programar|conferir postagem/.test(t)) return 'programacao';
  return null;
}

/** A tarefa está na mão do cliente (aprovar, enviar material/informação, direcionar stories)? */
export function ehTarefaDoCliente(titulo: string): boolean {
  const t = titulo.toLowerCase();
  if (/enviar post|aprova[çc][ãa]o\s*\|\s*(arte|briefing|copy|materia|cria|geral)/.test(t)) return false;
  return /aprova[çc][ãa]o|materiais para produ|pr[ée]vi|conte[úu]do|direcionamento/.test(t);
}

function diasEntre(deIso: string, ateIso: string): number {
  const d = (s: string) => {
    const [y, m, dd] = s.slice(0, 10).split('-').map(Number);
    return Date.UTC(y, m - 1, dd);
  };
  return Math.round((d(ateIso) - d(deIso)) / 86_400_000);
}

/** Um post na etapa em que ele está agora (primeira tarefa aberta no fluxo). */
export type PostNaEtapa = {
  postId: string;
  postTitulo: string;
  postData: string | null;
  /** Tarefa aberta atual do post (a que define a etapa). */
  tarefa: TarefaDoProjeto;
  doCliente: boolean;
};

export type ResumoEtapa = {
  etapa: EtapaProjeto;
  nome: string;
  curto: string;
  posts: PostNaEtapa[];
  atrasadas: number;
  /** Data limite mais recente que já passou (entre as atrasadas). */
  ultimoAtraso: string | null;
  /** Próxima data limite (hoje ou depois). */
  proxima: string | null;
  diasProxima: number | null;
};

const ORDEM: EtapaProjeto[] = [
  'pauta',
  'previos',
  'briefing',
  'materiais',
  'stories',
  'arte',
  'aprovacao',
  'programacao',
];

/**
 * Ordem dentro da mesma etapa, igual ao processo do Notion: produção →
 * alteração → aprovação (e, na aprovação do post: geral → envio → alteração →
 * aprovação do cliente). A data só desempata.
 */
function subOrdem(titulo: string): number {
  const t = titulo.toLowerCase();
  if (/aprova[çc][ãa]o\s*\|\s*geral/.test(t)) return 0;
  if (/enviar post/.test(t)) return 1;
  if (/altera[çc][ãa]o\s*\|\s*post/.test(t)) return 2;
  if (/aprova[çc][ãa]o\s*\|\s*post/.test(t)) return 3;
  if (/programar/.test(t)) return 0;
  if (/conferir/.test(t)) return 1;
  if (/produzir post/.test(t)) return 3;
  if (/aprova[çc][ãa]o\s*\|\s*pauta/.test(t)) return 2;
  if (/aprova[çc][ãa]o\s*\|\s*cria/.test(t)) return 1;
  if (/altera/.test(t)) return 1;
  if (/aprova/.test(t)) return 2;
  return 0;
}

/**
 * Ordem do processo. Com a propriedade "Ordem" do Notion preenchida, vale ela
 * (e "Ordem (1)": 01 original, 02 alteração, 03 nova aprovação), igual à view
 * de tarefas do post no Notion. Sem ela, cai na ordem pelas etapas do título.
 */
export function compararNoFluxo(a: TarefaDoProjeto, b: TarefaDoProjeto): number {
  const na = a.ordem ? Number(a.ordem) : NaN;
  const nb = b.ordem ? Number(b.ordem) : NaN;
  if (!Number.isNaN(na) || !Number.isNaN(nb)) {
    if (Number.isNaN(na)) return 1;
    if (Number.isNaN(nb)) return -1;
    return (
      na - nb ||
      Number(a.ordemUm ?? '01') - Number(b.ordemUm ?? '01') ||
      (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999')
    );
  }
  const ea = etapaDaTarefa(a.titulo);
  const eb = etapaDaTarefa(b.titulo);
  const oa = ea ? ORDEM.indexOf(ea) : 99;
  const ob = eb ? ORDEM.indexOf(eb) : 99;
  return (
    oa - ob ||
    subOrdem(a.titulo) - subOrdem(b.titulo) ||
    (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999')
  );
}

export function resumirEtapas(tarefas: TarefaDoProjeto[], hoje: string): ResumoEtapa[] {
  const porPost = new Map<string, TarefaDoProjeto[]>();
  for (const t of tarefas) {
    if (!t.postId || !etapaDaTarefa(t.titulo)) continue;
    const lista = porPost.get(t.postId) ?? [];
    lista.push(t);
    porPost.set(t.postId, lista);
  }

  const atuais: (PostNaEtapa & { etapa: EtapaProjeto })[] = [];
  for (const [postId, ts] of porPost) {
    const ordenadas = [...ts].sort(compararNoFluxo);
    const tarefa = ordenadas[0];
    atuais.push({
      postId,
      postTitulo: tarefa.postTitulo ?? tarefa.titulo,
      postData: tarefa.postData,
      tarefa,
      doCliente: ehTarefaDoCliente(tarefa.titulo),
      etapa: etapaDaTarefa(tarefa.titulo)!,
    });
  }

  return ETAPAS_PROJETO.map((e) => {
    const posts = atuais
      .filter((p) => p.etapa === e.id)
      .sort((a, b) => (a.tarefa.prazo ?? '9999').localeCompare(b.tarefa.prazo ?? '9999'));
    const vencidas = posts.filter((p) => p.tarefa.prazo && p.tarefa.prazo < hoje).map((p) => p.tarefa.prazo!);
    const futuras = posts.filter((p) => p.tarefa.prazo && p.tarefa.prazo >= hoje).map((p) => p.tarefa.prazo!);
    const proxima = futuras.length ? futuras.reduce((a, b) => (a < b ? a : b)) : null;
    return {
      etapa: e.id,
      nome: e.nome,
      curto: e.curto,
      posts,
      atrasadas: vencidas.length,
      ultimoAtraso: vencidas.length ? vencidas.reduce((a, b) => (a > b ? a : b)) : null,
      proxima,
      diasProxima: proxima ? diasEntre(hoje, proxima) : null,
    };
  });
}

export function ddmm(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
}

export function textoProxima(dias: number | null): string {
  if (dias === null) return '';
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  return `em ${dias} dias`;
}

/** Nome amigável do que está acontecendo com o post, pela tarefa aberta atual. */
function hojeSp(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

/**
 * Rótulo de onde o post está. `prazo` (YYYY-MM-DD) da tarefa ajusta o que
 * depende do dia: "Conferir Postagem" com data futura ainda é agendado.
 */
export function rotuloDaTarefaAtual(titulo: string, prazo?: string | null, hoje: string = hojeSp()): string {
  const t = titulo.toLowerCase().trim();
  if (t === 'arte') return 'Arte em produção';
  if (/aprova[çc][ãa]o\s*\|\s*arte/.test(t)) return 'Aguardando aprovação de arte';
  if (/altera[çc][ãa]o\s*\|\s*arte/.test(t)) return 'Arte em alteração';
  if (/aprova[çc][ãa]o\s*\|\s*geral/.test(t)) return 'Aguardando aprovação geral (interna)';
  if (/enviar post/.test(t)) return 'Pronto pra enviar ao cliente';
  if (/aprova[çc][ãa]o\s*\|\s*post/.test(t)) return 'Com o cliente pra aprovar';
  if (/altera[çc][ãa]o\s*\|\s*post/.test(t)) return 'Alteração pedida pelo cliente';
  if (/programar/.test(t)) return 'Aprovado · falta programar';
  if (/conferir postagem/.test(t)) {
    const dia = prazo ? prazo.slice(0, 10) : null;
    if (dia && dia > hoje) return `Agendado · posta ${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
    if (dia && dia === hoje) return 'Posta hoje · conferir';
    return 'Publicado · conferir postagem';
  }
  if (/aprova[çc][ãa]o\s*\|\s*materia/.test(t)) return 'Conferir materiais recebidos';
  if (/materia/.test(t)) return 'Esperando materiais do cliente';
  if (/pr[ée]vi|conte[úu]do/.test(t)) return 'Esperando informações prévias';
  if (/aprova[çc][ãa]o\s*\|\s*(briefing|copy)/.test(t)) return 'Aguardando aprovação do briefing';
  if (/briefing|copy/.test(t)) return 'Briefing & copy em produção';
  if (/aprova[çc][ãa]o\s*\|\s*(pauta|cria)/.test(t)) return 'Pauta em aprovação';
  if (/pauta|produzir post/.test(t)) return 'Pauta em criação';
  if (/direcionamento|stories/.test(t)) return 'Direcionamento de stories';
  return titulo;
}

export type StatusReal = {
  /** Tarefa aberta que define onde o post está agora (null = nada aberto). */
  atual: TarefaDoProjeto | null;
  rotulo: string;
  /** Em relação à entrega da página: o post está nela, ainda não chegou ou já passou. */
  relacao: 'aqui' | 'antes' | 'depois' | 'concluido';
  comCliente: boolean;
};

function chaveTitulo(t: string): string {
  return t.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Onde o post está de verdade, comparado com a entrega `tituloEntrega`. */
export function statusRealDoPost(
  abertas: TarefaDoProjeto[],
  tituloEntrega: string,
  hoje: string = hojeSp(),
): StatusReal {
  const ordenadas = [...abertas].sort(compararNoFluxo);
  const atual = ordenadas[0] ?? null;
  if (!atual) return { atual: null, rotulo: 'Concluído', relacao: 'concluido', comCliente: false };

  const daEntrega = abertas.find((t) => chaveTitulo(t.titulo) === chaveTitulo(tituloEntrega));
  let relacao: StatusReal['relacao'];
  if (chaveTitulo(atual.titulo) === chaveTitulo(tituloEntrega)) relacao = 'aqui';
  else if (daEntrega) relacao = 'antes';
  else relacao = 'depois';

  return {
    atual,
    rotulo: rotuloDaTarefaAtual(atual.titulo, atual.prazo, hoje),
    relacao,
    comCliente: ehTarefaDoCliente(atual.titulo),
  };
}
