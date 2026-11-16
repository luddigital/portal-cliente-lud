/**
 * Monta o cronograma do mês para UM projeto específico, a partir dos dados
 * reais que já temos (tarefas abertas no Notion + posts do mês vigente +
 * calendário salvo pro mês de planejamento, se houver).
 *
 * O shape de saída é compatível com o componente <EtapasDoMes /> que a gente
 * já usa no painel geral — mesma UI, dados diferentes.
 */
import type { ResumoEtapa } from './etapas-projeto';
import type { CalendarioWorkspace } from './supabase';
import type { PostCalendario } from './notion';

type CronogramaEtapa = {
  nome: string;
  quem: string;
  col: string;
  rotulo: string;
  bg: string;
  fg: string;
  href?: string;
};

export type CronogramaProjeto = {
  accent: string;
  accentTint: string;
  accentDark: string;
  dias: { n: string; cor: string; peso: string }[];
  etapas: CronogramaEtapa[];
};

const ACCENT = '#5E5CE6';

function rgb(h: string): [number, number, number] {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(h: string, t: [number, number, number], w: number): string {
  const a = rgb(h);
  const r = a.map((v, i) => Math.round(v * (1 - w) + t[i] * w));
  return `rgb(${r.join(',')})`;
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export function montarCronogramaProjeto(input: {
  year: number;
  month: number;
  dia: number;
  etapasAbertas: ResumoEtapa[];
  postsMesVigente: PostCalendario[];
  workspacePlanejamento: CalendarioWorkspace | null;
  projetoId: string;
  reunioes?: { feitas: number; total: number };
}): CronogramaProjeto {
  const accent = ACCENT;
  const accentTint = mix(accent, [255, 255, 255], 0.88);
  const accentDark = mix(accent, [0, 0, 0], 0.3);

  const dias: { n: string; cor: string; peso: string }[] = [];
  for (let i = 1; i <= 31; i++) {
    dias.push({
      n: String(i),
      cor: i === input.dia ? accentDark : '#8A8A8E',
      peso: i === input.dia ? '800' : '500',
    });
  }

  // Paleta por "estado" do bloco no Gantt.
  const PASSADO = { bg: '#EDEDF0', fg: '#48484C' };
  const PUBLICANDO = { bg: '#E4EBDF', fg: '#3B4A33' };
  const PRODUCAO = { bg: accentTint, fg: accentDark };
  const PLANEJAMENTO = { bg: '#F1EBE5', fg: '#642223' };
  const SEM_DADO = { bg: '#F5F5F7', fg: '#8A8A8E' };

  const span = (a: number, b: number) => `${a + 1} / ${b + 2}`;

  const mesVigente = MESES[input.month - 1];
  const mesSeguinte = MESES[input.month % 12];
  const mesMais2 = MESES[(input.month + 1) % 12];

  // Mês vigente: quantos posts foram publicados vs total programado.
  const totalVigente = input.postsMesVigente.length;
  const publicadosVigente = input.postsMesVigente.filter((p) => p.cor === 'publicado').length;

  // Contagens por etapa das TAREFAS ABERTAS (fluxo natural: tarefas abertas
  // agora pertencem majoritariamente ao mês de produção = mês+1).
  const porEtapa: Record<string, number> = {};
  for (const e of input.etapasAbertas) porEtapa[e.etapa] = e.posts.length;
  const nBriefingCopy = (porEtapa.pauta ?? 0) + (porEtapa.briefing ?? 0);
  const nCuradoria = (porEtapa.previos ?? 0) + (porEtapa.materiais ?? 0);
  const nArte = porEtapa.arte ?? 0;
  const nAprovacao = porEtapa.aprovacao ?? 0;

  // Calendário do mês de planejamento (mês+2).
  const wks = input.workspacePlanejamento;
  const temPlanejamento = !!(wks && (wks.rascunho.trim() || wks.versoes.length > 0));
  const versoes = wks?.versoes.length ?? 0;

  const plural = (n: number, s: string, p: string) => (n === 1 ? s : p);

  const reun = input.reunioes;
  const rotuloReunioes = reun
    ? reun.total > 0
      ? `${reun.feitas} de ${reun.total} feitas`
      : 'nenhuma agendada'
    : 'a configurar';
  const corReunioes = reun && reun.total > 0 ? PLANEJAMENTO : SEM_DADO;

  // Hrefs levam pros lugares onde a Luiza age em cada etapa.
  const hrefEntregas = `/admin/projetos/${input.projetoId}?aba=entregas`;
  const hrefCalWorkspace = `/admin/projetos/${input.projetoId}/calendario-workspace`;
  const hrefProgramacao = `/programacao?projetoId=${input.projetoId}`;

  const etapas: CronogramaEtapa[] = [
    {
      nome: 'Reunião com cliente',
      quem: `Social media · ${mesMais2}`,
      col: span(0, 3),
      rotulo: rotuloReunioes,
      ...corReunioes,
      href: '/admin/reunioes',
    },
    {
      nome: 'Criação de pauta',
      quem: `Social media · ${mesMais2}`,
      col: span(2, 8),
      rotulo: temPlanejamento
        ? versoes > 0
          ? `✓ ${versoes} ${plural(versoes, 'versão salva', 'versões salvas')}`
          : '✓ rascunho em aberto'
        : 'a fazer',
      ...(temPlanejamento ? PLANEJAMENTO : SEM_DADO),
      href: hrefCalWorkspace,
    },
    {
      nome: 'Briefing e copy',
      quem: `Social media · ${mesSeguinte}`,
      col: span(8, 18),
      rotulo: nBriefingCopy > 0
        ? `${nBriefingCopy} ${plural(nBriefingCopy, 'post em produção', 'posts em produção')}`
        : 'sem posts nessa etapa',
      ...(nBriefingCopy > 0 ? PRODUCAO : SEM_DADO),
      href: hrefEntregas,
    },
    {
      nome: 'Materiais para produção',
      quem: `Social media · ${mesSeguinte}`,
      col: span(12, 22),
      rotulo: nCuradoria > 0
        ? `${nCuradoria} ${plural(nCuradoria, 'post', 'posts')}`
        : 'sem posts nessa etapa',
      ...(nCuradoria > 0 ? PRODUCAO : SEM_DADO),
      href: hrefEntregas,
    },
    {
      nome: 'Produção de arte',
      quem: `Designers · ${mesSeguinte}`,
      col: span(18, 26),
      rotulo: nArte > 0
        ? `${nArte} ${plural(nArte, 'post', 'posts')}`
        : 'sem posts nessa etapa',
      ...(nArte > 0 ? PRODUCAO : SEM_DADO),
      href: hrefEntregas,
    },
    {
      nome: 'Aprovação cliente',
      quem: `Cliente · ${mesSeguinte}`,
      col: span(23, 29),
      rotulo: nAprovacao > 0
        ? `${nAprovacao} ${plural(nAprovacao, 'post aguardando', 'posts aguardando')}`
        : 'nada em aprovação',
      ...(nAprovacao > 0 ? PRODUCAO : SEM_DADO),
      href: hrefEntregas,
    },
    {
      nome: 'Programação e conferência',
      quem: `Social media · ${mesVigente}`,
      col: span(1, 31),
      rotulo: totalVigente > 0
        ? `${mesVigente} no ar · ${publicadosVigente} de ${totalVigente} publicados`
        : 'sem posts programados',
      ...(totalVigente > 0 ? PUBLICANDO : SEM_DADO),
      href: hrefProgramacao,
    },
  ];

  return { accent, accentTint, accentDark, dias, etapas };
}
