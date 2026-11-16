/**
 * Dados de exemplo pro Painel geral da Lud.
 *
 * Porta direta do `renderVals()` do artifact de design — valores idênticos.
 * Depois vamos trocar cada seção por queries reais (Notion / Supabase / Nibo).
 */

const ACCENT = '#5E5CE6';

type CorBadge = { bg: string; fg: string };

function rgb(h: string): [number, number, number] {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(h: string, t: [number, number, number], w: number): string {
  const a = rgb(h);
  const r = a.map((v, i) => Math.round(v * (1 - w) + t[i] * w));
  return `rgb(${r.join(',')})`;
}

function brl(v: number): string {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 0 });
}

type OpcoesPainel = {
  /** Dia do mês a destacar na régua do Gantt (coluna + linha vertical). */
  diaDoMes?: number;
  /** Contagem real de reuniões do mês (substitui o "9 de 14" fake). */
  reunioes?: { feitas: number; total: number };
};

export function dadosPainel(opts: OpcoesPainel = {}) {
  const hoje = new Date();
  const diaDoMes = opts.diaDoMes ?? hoje.getDate();
  const accent = ACCENT;
  const accentTint = mix(accent, [255, 255, 255], 0.88);
  const accentDark = mix(accent, [0, 0, 0], 0.3);

  const OK: CorBadge = { bg: '#E4EBDF', fg: '#3B4A33' };
  const WARN: CorBadge = { bg: '#F1EBE5', fg: '#642223' };
  const BAD: CorBadge = { bg: '#FFD5D6', fg: '#90181A' };
  const NEU: CorBadge = { bg: '#F2F2F5', fg: '#48484C' };
  const ACC: CorBadge = { bg: accentTint, fg: accentDark };

  const alertasOp = [
    { tag: 'ATRASO', titulo: '3 entregas atrasadas', meta: '2 paradas com cliente, 1 com a Lud.', ...BAD },
    { tag: 'APROVAÇÃO', titulo: '2 aprovações paradas há 5+ dias', meta: 'Cliente 03 e Cliente 07', ...WARN },
    { tag: 'PRAZO', titulo: 'Briefings do dia 28', meta: 'Faltam 13 dias · 4 de 14 prontos', ...ACC },
  ];

  const alertasFin = [
    { tag: 'Vencido', titulo: 'R$ 2.400 a receber', meta: 'Cliente 07 · 12 dias em aberto', ...BAD },
    { tag: 'Dia 20', titulo: 'R$ 17.000 a pagar', meta: 'Parceiros de design e social media', ...WARN },
    { tag: 'Até 30/10', titulo: 'R$ 12.200 a receber', meta: '5 faturas no prazo', ...NEU },
  ];

  const kpis = [
    { label: 'Clientes ativos', valor: '14', sub: '+1 este mês', cor: '#1D1D1F' },
    { label: 'Projetos ativos', valor: '18', sub: '14 recorrentes · 4 pontuais', cor: '#1D1D1F' },
    { label: 'Entregas em andamento', valor: '64', sub: 'peças no fluxo', cor: '#1D1D1F' },
    { label: 'Em atraso', valor: '3', sub: 'média de 5 dias', cor: '#90181A' },
    { label: 'Receita recorrente', valor: 'R$ 48,2k', sub: 'mensal', cor: '#1D1D1F' },
    { label: 'A pagar em 30 dias', valor: 'R$ 25,2k', sub: '7 contas', cor: '#1D1D1F' },
  ];

  const dias: { n: string; cor: string; peso: string }[] = [];
  for (let i = 1; i <= 31; i++) {
    dias.push({
      n: String(i),
      cor: i === diaDoMes ? accentDark : '#8A8A8E',
      peso: i === diaDoMes ? '800' : '500',
    });
  }

  const OUT: CorBadge = { bg: '#E4EBDF', fg: '#3B4A33' };
  const NOV: CorBadge = { bg: accentTint, fg: accentDark };
  const DEZ: CorBadge = { bg: '#F1EBE5', fg: '#642223' };
  const PLACEHOLDER: CorBadge = { bg: '#F5F5F7', fg: '#8A8A8E' };

  const span = (a: number, b: number) => `${a + 1} / ${b + 2}`;

  const MESES_PT = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const mesVigenteNome = MESES_PT[hoje.getMonth()];
  const mesSeguinteNome = MESES_PT[(hoje.getMonth() + 1) % 12];
  const mesMais2Nome = MESES_PT[(hoje.getMonth() + 2) % 12];

  const reun = opts.reunioes;
  const rotuloReunioes = reun
    ? reun.total > 0
      ? `${reun.feitas} de ${reun.total} feitas`
      : 'nenhuma agendada'
    : 'a configurar';
  const corReunioes = reun && reun.total > 0 ? { bg: accent, fg: '#FFFFFF' } : PLACEHOLDER;

  const etapas = [
    { nome: 'Reunião com cliente', quem: `Social media · ${mesMais2Nome}`, col: span(0, 3), rotulo: rotuloReunioes, ...corReunioes, href: '/admin/reunioes' },
    { nome: 'Criação de pauta', quem: `Social media · ${mesMais2Nome}`, col: span(2, 8), rotulo: 'a configurar', ...PLACEHOLDER, href: undefined },
    { nome: 'Briefing e copy', quem: `Social media · ${mesSeguinteNome}`, col: span(8, 18), rotulo: 'a configurar', ...NOV, href: '/esteira' },
    { nome: 'Materiais para produção', quem: `Social media · ${mesSeguinteNome}`, col: span(12, 22), rotulo: 'a configurar', ...PLACEHOLDER, href: undefined },
    { nome: 'Produção de arte', quem: `Designers · ${mesSeguinteNome}`, col: span(18, 26), rotulo: 'a configurar', ...PLACEHOLDER, href: undefined },
    { nome: 'Aprovação cliente', quem: `Cliente · ${mesSeguinteNome}`, col: span(23, 29), rotulo: 'a configurar', ...PLACEHOLDER, href: '/admin/aprovacoes' },
    { nome: 'Programação e conferência', quem: `Social media · ${mesVigenteNome}`, col: span(1, 31), rotulo: 'a configurar', ...OUT, href: '/programacao' },
  ];
  // Mantém DEZ referenciado pra Design System não reclamar de unused var.
  void DEZ;

  type CicloCell = { sym: string; label: string; bg: string; fg: string };
  const C: Record<string, CicloCell> = {
    d: { sym: '✓', label: 'Feito', ...OK },
    a: { sym: '●', label: 'Em andamento', ...ACC },
    l: { sym: '!', label: 'Atrasado', ...BAD },
    p: { sym: '–', label: 'Ainda não', bg: '#F2F2F5', fg: '#5C5C61' },
  };
  const ciclo = (
    [
      ['Cliente 01', 'Social media 1', 'dddapppp'],
      ['Cliente 02', 'Social media 1', 'ddddpppp'],
      ['Cliente 03', 'Social media 2', 'ddlppppp'],
      ['Cliente 04', 'Social media 2', 'dddapppp'],
      ['Cliente 05', 'Social media 1', 'dlpppppp'],
      ['Cliente 06', 'Social media 2', 'ddddaapp'],
      ['Cliente 07', 'Social media 1', 'dddapppp'],
      ['Cliente 08', 'Social media 2', 'ddpppppp'],
    ] as const
  ).map(([nome, sm, s]) => ({ nome, sm, cells: s.split('').map((k) => C[k]) }));

  type StatusKey = 'ok' | 'risco' | 'atraso' | 'travado';
  const ST: Record<StatusKey, { status: string; bg: string; fg: string }> = {
    ok: { status: 'Em dia', ...OK },
    risco: { status: 'Atenção', ...WARN },
    atraso: { status: 'Atrasado', ...BAD },
    travado: { status: 'Travado', ...BAD },
  };
  const projetos = (
    [
      ['Cliente 01', 'Social media', 'Social media 1', 'Briefing nov · 28/10', 'ok'],
      ['Cliente 03', 'Social media + tráfego', 'Social media 2', 'Aprovação arte · 10/10', 'atraso'],
      ['Cliente 05', 'Social media', 'Social media 1', 'Calendário dez · 05/10', 'atraso'],
      ['Cliente 09', 'Identidade visual', 'Designer 1', 'Apresentação logo · 22/10', 'ok'],
      ['Cliente 10', 'Site', 'Designer 2', 'Layout home · 24/10', 'risco'],
      ['Cliente 11', 'Infoproduto', 'Gestão de projetos', 'Página de vendas · 30/10', 'ok'],
      ['Cliente 12', 'Diagramação de e-book', 'Designer 2', 'Aguardando conteúdo', 'travado'],
    ] as const
  ).map(([cliente, servico, resp, prox, s]) => ({ cliente, servico, resp, prox, ...ST[s as StatusKey] }));

  const atrasos = [
    { dias: '6', item: 'Aprovação das artes de outubro', cliente: 'Cliente 03', com: 'o cliente', etapa: 'aprovação' },
    { dias: '5', item: 'Envio de fotos para curadoria', cliente: 'Cliente 07', com: 'o cliente', etapa: 'curadoria' },
    { dias: '10', item: 'Calendário de dezembro', cliente: 'Cliente 05', com: 'a Lud.', etapa: 'calendário' },
  ];

  const ent = [
    { nome: 'Briefing e copy', n: 12, obs: 'mais antigo: 3 dias', barra: accentTint },
    { nome: 'Curadoria', n: 6, obs: '2 esperando material', barra: mix(accent, [255, 255, 255], 0.65) },
    { nome: 'Arte', n: 14, obs: 'Designer 1: 8 · Designer 2: 6', barra: mix(accent, [255, 255, 255], 0.4) },
    { nome: 'Revisão interna', n: 5, obs: 'mais antigo: 1 dia', barra: accent },
    { nome: 'Aprovação cliente', n: 9, obs: '2 há 5+ dias', barra: accentDark },
    { nome: 'Programado', n: 18, obs: 'próximos 7 dias', barra: '#7FC79A' },
  ];
  const totalEnt = ent.reduce((s, e) => s + e.n, 0);
  const entregas = ent.map((e) => ({
    ...e,
    n: String(e.n),
    pct: ((e.n / totalEnt) * 100).toFixed(1) + '%',
  }));

  const fin = [
    { label: 'Receita recorrente', valor: 'R$ 48,2k', sub: '14 contratos', cor: '#1D1D1F' },
    { label: 'Recebido em outubro', valor: 'R$ 36,0k', sub: '75% do previsto', cor: '#1D1D1F' },
    { label: 'A receber', valor: 'R$ 12,2k', sub: 'até 30/10', cor: '#1D1D1F' },
    { label: 'Inadimplência', valor: 'R$ 2,4k', sub: '1 cliente · 12 dias', cor: '#90181A' },
    { label: 'Margem média', valor: '38%', sub: 'meta: 40%', cor: '#1D1D1F' },
  ];

  const contasRaw: [string, string, string, string, number, 'agendado' | 'pendente'][] = [
    ['20', 'out', 'Parceiros de design', 'Equipe · 2 designers', 7200, 'agendado'],
    ['20', 'out', 'Parceiros de social media', 'Equipe', 9800, 'agendado'],
    ['22', 'out', 'Notion, Slack e Canva', 'Ferramentas', 640, 'pendente'],
    ['25', 'out', 'Google Workspace', 'Ferramentas', 210, 'pendente'],
    ['30', 'out', 'Parceiro de tráfego pago', 'Equipe', 3500, 'pendente'],
    ['05', 'nov', 'Contabilidade', 'Administrativo', 900, 'pendente'],
    ['10', 'nov', 'Impostos (DAS)', 'Impostos', 2950, 'pendente'],
  ];
  const contas = contasRaw.map(([dia, mes, desc, cat, v, s]) => ({
    dia, mes, desc, cat,
    valor: brl(v),
    status: s === 'agendado' ? 'Agendado' : 'Pendente',
    ...(s === 'agendado' ? OK : NEU),
  }));
  const totalContas = brl(contasRaw.reduce((s, c) => s + c[4], 0));

  const cx: [string, number, number][] = [['Nov', 50, 31], ['Dez', 52, 34], ['Jan', 44, 32]];
  const maxC = 52;
  const caixa = cx.map(([m, i, o]) => ({
    m,
    inH: Math.round((i / maxC) * 130) + 'px',
    outH: Math.round((o / maxC) * 130) + 'px',
    saldo: '+R$ ' + (i - o) + 'k',
  }));

  const margens = ([['Cliente 07', 12], ['Cliente 03', 19], ['Cliente 10', 31], ['Cliente 01', 42], ['Cliente 09', 51]] as [string, number][]).map(
    ([c, m]) => ({
      c,
      m: m + '%',
      w: Math.round((m / 60) * 100) + '%',
      cor: m < 20 ? '#E0603A' : m < 35 ? '#E3A21A' : '#3FA26A',
      txt: m < 20 ? '#90181A' : m < 35 ? '#642223' : '#3B4A33',
    }),
  );

  const pessoas = (
    [
      ['D1', 'Designer 1', '8 clientes · 14 peças na semana', 96, '91%', 'Alterações/peça', '1,6'],
      ['D2', 'Designer 2', '6 clientes · 11 peças na semana', 80, '96%', 'Alterações/peça', '1,1'],
      ['S1', 'Social media 1', '7 clientes', 92, '93%', 'Briefings prontos', '2 de 7'],
      ['S2', 'Social media 2', '7 clientes', 85, '88%', 'Briefings prontos', '2 de 7'],
      ['TP', 'Tráfego pago', '5 contas ativas', 70, '100%', 'Investimento gerido', 'R$ 31k'],
      ['GP', 'Gestão de projetos', '18 projetos', 75, '94%', 'Pendências abertas', '14'],
    ] as const
  ).map(([ini, papel, clientes, carga, prazo, terceiroLabel, terceiro]) => ({
    ini,
    papel,
    clientes,
    carga: String(carga),
    prazo,
    terceiroLabel,
    terceiro,
    w: Math.min(carga, 100) + '%',
    cor: carga >= 95 ? '#E0603A' : carga >= 85 ? '#E3A21A' : '#3FA26A',
    txt: carga >= 95 ? '#90181A' : carga >= 85 ? '#642223' : '#3B4A33',
  }));

  const adm = [
    { label: 'Contratos vencendo', valor: '3', sub: 'nos próximos 60 dias' },
    { label: 'Propostas abertas', valor: '4', sub: 'R$ 18,5k em negociação' },
    { label: 'Pendências do cliente', valor: '9', sub: 'materiais, acessos, aprovações' },
    { label: 'Pendências da Lud.', valor: '5', sub: 'contratos, notas, onboarding' },
  ];

  const contratos = [
    { cliente: 'Cliente 05', servico: 'Social media · 12 meses', vence: 'vence 04/11', acao: 'Renovar', ...WARN },
    { cliente: 'Cliente 02', servico: 'Social media + tráfego', vence: 'vence 20/11', acao: 'Proposta de upgrade', ...ACC },
    { cliente: 'Cliente 08', servico: 'Social media · 6 meses', vence: 'vence 12/12', acao: 'Agendar conversa', ...NEU },
    { cliente: 'Cliente 13', servico: 'Consultoria', vence: 'assinatura pendente', acao: 'Cobrar assinatura', ...BAD },
  ];

  const saude = [
    { label: 'Permanência média', valor: '14 meses', sub: 'clientes recorrentes' },
    { label: 'Saídas em 12 meses', valor: '2', sub: 'churn de 12%' },
    { label: 'Crescimento médio dos perfis', valor: '+3,1%', sub: 'seguidores no mês' },
    { label: 'Novos clientes no ano', valor: '6', sub: '4 por indicação' },
  ];

  return {
    accent,
    accentTint,
    accentDark,
    alertasOp,
    alertasFin,
    kpis,
    dias,
    etapas,
    ciclo,
    projetos,
    atrasos,
    entregas,
    totalEntregas: totalEnt,
    fin,
    contas,
    totalContas,
    caixa,
    margens,
    pessoas,
    adm,
    contratos,
    saude,
  };
}
