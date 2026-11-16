/**
 * Agrega tudo que a visão rica da lista de projetos (home /admin) precisa:
 * KPIs por prazo, contagem por etapa, distribuição de posts dos 3 meses
 * (vigente + 2 à frente) e lista de atrasos mais antigos.
 */
import {
  getProjetoDetalhe,
  listPostsDoMes,
  type PostCalendario,
} from './notion';
import { resumirEtapas, ddmm, type ResumoEtapa, type EtapaProjeto } from './etapas-projeto';
import { hojeEmSaoPaulo } from './lembrete-aprovacao';

export type DistribuicaoPostsMes = {
  mes: number; // 1..12
  ano: number;
  total: number;
  postados: number;
  emProducao: number;
  soPauta: number;
};

export type AtrasoResumo = {
  data: string; // ISO
  dataFormatada: string; // dd/mm
  tarefas: string[]; // nomes únicos das tarefas atrasadas
};

export type ProjetoAgregado = {
  projetoId: string;
  atrasadas: number;
  prox7Dias: number;
  dias8a21: number;
  porEtapa: Record<EtapaProjeto, number>;
  posts: DistribuicaoPostsMes[]; // 3 meses: vigente, +1, +2
  atrasoDesde: AtrasoResumo | null;
  criticidade: 'critico' | 'atencao' | 'em_dia';
};

const ETAPAS_VISIVEIS: EtapaProjeto[] = [
  'pauta', 'briefing', 'materiais', 'arte', 'aprovacao', 'programacao',
];

function diasEntreIso(deIso: string, ateIso: string): number {
  const toUtc = (s: string) => {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(ateIso) - toUtc(deIso)) / 86_400_000);
}

function deslocarMes(y: number, m: number, delta: number): { year: number; month: number } {
  const base = new Date(Date.UTC(y, m - 1 + delta, 1));
  return { year: base.getUTCFullYear(), month: base.getUTCMonth() + 1 };
}

/** Classifica o post num dos 3 estados que a barra segmentada do card mostra. */
function estadoDoPost(p: PostCalendario): 'postado' | 'em_producao' | 'so_pauta' {
  const sg = (p.statusGeral ?? '').trim().toLowerCase();
  if (sg.includes('postado') || p.cor === 'publicado') return 'postado';
  const titTarefa = (p.tarefaAtualTitulo ?? '').toLowerCase();
  if (sg === 'pauta' || /\bpauta\b/.test(titTarefa)) return 'so_pauta';
  return 'em_producao';
}

/** Monta os dados de UM projeto. Robusto a falhas — campos faltantes viram zero. */
export async function agregarProjeto(projetoId: string): Promise<ProjetoAgregado> {
  const hoje = hojeEmSaoPaulo();
  const [yA, mA] = hoje.slice(0, 10).split('-').map(Number);
  const meses = [0, 1, 2].map((d) => deslocarMes(yA, mA, d));

  const [detalhe, ...postosPorMes] = await Promise.all([
    getProjetoDetalhe(projetoId).catch(() => null),
    ...meses.map((m) => listPostsDoMes([projetoId], m.year, m.month).catch(() => [] as PostCalendario[])),
  ]);

  const porEtapaInit: Record<EtapaProjeto, number> = {
    pauta: 0, previos: 0, briefing: 0, materiais: 0, stories: 0, arte: 0, aprovacao: 0, programacao: 0,
  };

  if (!detalhe) {
    return {
      projetoId,
      atrasadas: 0,
      prox7Dias: 0,
      dias8a21: 0,
      porEtapa: porEtapaInit,
      posts: meses.map((m) => ({ ano: m.year, mes: m.month, total: 0, postados: 0, emProducao: 0, soPauta: 0 })),
      atrasoDesde: null,
      criticidade: 'em_dia',
    };
  }

  const etapas = resumirEtapas(detalhe.tarefas, hoje);
  const porEtapa = { ...porEtapaInit };
  let atrasadas = 0, prox7Dias = 0, dias8a21 = 0;
  const tarefasAtrasadasMap = new Map<string, Set<string>>(); // data iso → set de nomes

  for (const e of etapas) {
    porEtapa[e.etapa] = e.posts.length;
    for (const p of e.posts) {
      const prazo = p.tarefa.prazo;
      if (!prazo) continue;
      if (prazo < hoje) {
        atrasadas += 1;
        const key = prazo.slice(0, 10);
        if (!tarefasAtrasadasMap.has(key)) tarefasAtrasadasMap.set(key, new Set());
        tarefasAtrasadasMap.get(key)!.add(p.tarefa.titulo);
      } else {
        const dias = diasEntreIso(hoje, prazo);
        if (dias >= 0 && dias <= 7) prox7Dias += 1;
        else if (dias >= 8 && dias <= 21) dias8a21 += 1;
      }
    }
  }

  // Atraso mais antigo + tarefas distintas desse dia (até 4 nomes).
  const atrasoDesde: AtrasoResumo | null = (() => {
    if (tarefasAtrasadasMap.size === 0) return null;
    const datasOrdenadas = [...tarefasAtrasadasMap.keys()].sort();
    const data = datasOrdenadas[0];
    const nomes = [...(tarefasAtrasadasMap.get(data) ?? [])].slice(0, 5);
    return { data, dataFormatada: ddmm(data), tarefas: nomes };
  })();

  const posts: DistribuicaoPostsMes[] = meses.map((m, i) => {
    const lista = postosPorMes[i] as PostCalendario[];
    let postados = 0, emProducao = 0, soPauta = 0;
    for (const p of lista) {
      const estado = estadoDoPost(p);
      if (estado === 'postado') postados += 1;
      else if (estado === 'so_pauta') soPauta += 1;
      else emProducao += 1;
    }
    return { ano: m.year, mes: m.month, total: lista.length, postados, emProducao, soPauta };
  });

  const criticidade: ProjetoAgregado['criticidade'] =
    atrasadas >= 3 ? 'critico' : atrasadas >= 1 ? 'atencao' : 'em_dia';

  return { projetoId, atrasadas, prox7Dias, dias8a21, porEtapa, posts, atrasoDesde, criticidade };
}

export const ETAPAS_CARD = ETAPAS_VISIVEIS;
