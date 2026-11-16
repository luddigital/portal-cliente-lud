/**
 * Visão macro dos calendários: por cliente e por mês, em que fase os posts estão,
 * o que está atrasado pela régua e qual é a próxima ação.
 *
 * Régua (a mesma de tarefasDaPauta / tarefasDaProducao, mês M = mês da postagem):
 *   pauta até o dia 16 de M−2 · copy até o dia 30 de M−2 · materiais até S−21 ·
 *   arte até S−13 · aprovação do cliente até S−7 · programar até S−3 · no ar em D.
 */
import type { PostCalendario } from './notion';

export type Fase = 'pauta' | 'copy' | 'materiais' | 'arte' | 'aprovacao' | 'programar' | 'pronto';

export const FASES: { id: Fase; nome: string; emoji: string; cor: string }[] = [
  { id: 'pauta', nome: 'Pauta', emoji: '📝', cor: '#C9C2F2' },
  { id: 'copy', nome: 'Copy', emoji: '✍️', cor: '#B7CDEB' },
  { id: 'materiais', nome: 'Materiais', emoji: '📦', cor: '#F2D0EA' },
  { id: 'arte', nome: 'Arte', emoji: '🎨', cor: '#E3F0B2' },
  { id: 'aprovacao', nome: 'Aprovação', emoji: '👀', cor: '#F5CBA7' },
  { id: 'programar', nome: 'Programar', emoji: '📅', cor: '#FBE3A8' },
  { id: 'pronto', nome: 'Agendado / no ar', emoji: '✅', cor: '#9BCB8A' },
];
const ORDEM: Record<Fase, number> = { pauta: 0, copy: 1, materiais: 2, arte: 3, aprovacao: 4, programar: 5, pronto: 6 };

/** Fase do post pela etapa atual do Notion ("Status Geral" ou tarefa aberta mais cedo). */
export function faseDoPost(p: Pick<PostCalendario, 'status' | 'statusGeral' | 'tarefaAtualTitulo' | 'etapa'>): Fase {
  if (p.status === 'Postado' || p.etapa === 'publicado' || p.etapa === 'agendado') return 'pronto';
  const t = (p.statusGeral || p.tarefaAtualTitulo || '').toLowerCase();
  if (!t) return p.status === 'Em Produção' ? 'copy' : 'pauta';
  if (/conferir|postado|publicad/.test(t)) return 'pronto';
  if (/programar/.test(t)) return 'programar';
  if (/enviar post|aprova[çc][ãa]o \| post|altera[çc][ãa]o \| post|aprova[çc][ãa]o \| geral/.test(t)) return 'aprovacao';
  if (/arte/.test(t)) return 'arte';
  if (/materia|solicita[çc][ãa]o produ/.test(t)) return 'materiais';
  if (/briefing|copy|conte[úu]dos pr[ée]vios|envio de informa/.test(t)) return 'copy';
  if (/pauta|produzir post|ideia/.test(t)) return 'pauta';
  return 'copy';
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
function diaDoMesAntes(dia: string, mesesAntes: number, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - mesesAntes, n, 12)));
}
function somar(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}
function segundaDa(dia: string): string {
  const d = new Date(`${dia}T12:00:00Z`);
  return somar(dia, -((d.getUTCDay() + 6) % 7));
}

/** Prazo de saída de cada fase pela régua (até quando o post pode ficar nela). */
export function prazosDaRegua(dataPostagem: string): Record<Fase, string> {
  const D = dataPostagem.slice(0, 10);
  const S = segundaDa(D);
  return {
    pauta: diaDoMesAntes(D, 2, 16),
    copy: somar(diaDoMesAntes(D, 2, 28), 2),
    materiais: somar(S, -21),
    arte: somar(S, -13),
    aprovacao: somar(S, -7),
    programar: somar(S, -3),
    pronto: D,
  };
}

/** Fase em que o post já deveria ter chegado hoje. */
export function faseEsperada(dataPostagem: string, hoje: string): Fase {
  const pr = prazosDaRegua(dataPostagem);
  for (const f of FASES) if (hoje <= pr[f.id]) return f.id;
  return 'pronto';
}

export type Celula = {
  total: number;
  porFase: Record<Fase, number>;
  atrasados: number;
  /** Fase que mais segura o mês (a mais atrasada com post). */
  gargalo: Fase | null;
  proxima: { texto: string; ate: string | null } | null;
  situacao: 'vazio' | 'atrasado' | 'em_dia' | 'pronto';
};

export function montarCelula(posts: PostCalendario[], mes: string, hoje: string): Celula {
  const porFase = Object.fromEntries(FASES.map((f) => [f.id, 0])) as Record<Fase, number>;
  let atrasados = 0;
  let gargalo: Fase | null = null;
  for (const p of posts) {
    const f = faseDoPost(p);
    porFase[f]++;
    if (f !== 'pronto' && ORDEM[f] < ORDEM[faseEsperada(p.data, hoje)]) atrasados++;
    if (f !== 'pronto' && (gargalo === null || ORDEM[f] < ORDEM[gargalo])) gargalo = f;
  }
  const total = posts.length;
  const situacao: Celula['situacao'] = !total ? 'vazio' : porFase.pronto === total ? 'pronto' : atrasados ? 'atrasado' : 'em_dia';

  // Próxima ação do mês: a fase mais atrasada que ainda tem post, com o prazo da régua.
  let proxima: Celula['proxima'] = null;
  const primeiroDia = `${mes}-01`;
  if (!total) {
    proxima = { texto: 'Iniciar o calendário (pauta)', ate: diaDoMesAntes(primeiroDia, 2, 5) };
  } else if (gargalo) {
    const quantos = porFase[gargalo];
    const exemplo = posts.filter((p) => faseDoPost(p) === gargalo).sort((a, b) => a.data.localeCompare(b.data))[0];
    const ate = exemplo ? prazosDaRegua(exemplo.data)[gargalo] : null;
    const verbo: Record<Fase, string> = {
      pauta: 'Fechar e aprovar a pauta',
      copy: 'Briefing & copy',
      materiais: 'Cobrar e aprovar materiais',
      arte: 'Arte',
      aprovacao: 'Aprovação do cliente',
      programar: 'Programar',
      pronto: '',
    };
    proxima = { texto: `${verbo[gargalo]} · ${quantos} ${quantos === 1 ? 'post' : 'posts'}`, ate };
  }
  return { total, porFase, atrasados, gargalo, proxima, situacao };
}

export const ehStoriesDirecionamento = (p: Pick<PostCalendario, 'titulo'>) => /direcionamento de stories/i.test(p.titulo);
