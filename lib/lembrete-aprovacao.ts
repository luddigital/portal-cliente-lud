/**
 * Lembrete de aprovação no WhatsApp, montado a partir de textos editáveis
 * (Configurações › Mensagens padrão). As condições seguem o Onboarding
 * Cliente do Notion. Prazo vencido → a data de publicação é remarcada.
 *
 * Arquivo puro (sem acesso a banco) pra ser usado também na prévia do admin.
 */

export type EtapaLembrete = 'pauta' | 'previos' | 'producao' | 'post';

export type SituacaoLembrete =
  | 'no_prazo'
  | 'vence_amanha'
  | 'vence_hoje'
  | 'vencido'
  | 'data_passou'
  | 'sem_prazo';

export const ETAPAS: {
  id: EtapaLembrete;
  nome: string;
  condicao: string;
  onboarding: string;
}[] = [
  {
    id: 'pauta',
    nome: 'Pauta',
    condicao: 'Título da tarefa tem "pauta"',
    onboarding: '2 dias úteis pra aprovar ou pedir ajuste. Depois de aprovada, a estrutura do post não muda mais.',
  },
  {
    id: 'previos',
    nome: 'Materiais prévios',
    condicao: 'Título da tarefa tem "prévia", "prévio" ou "conteúdo"',
    onboarding: '2 dias. O cliente manda informações, dicas e vídeos que já tem em mãos.',
  },
  {
    id: 'producao',
    nome: 'Materiais pra produção',
    condicao: 'Título da tarefa tem "material" ou "materiais"',
    onboarding: '5 dias. A data de envio é definitiva pra produção do post.',
  },
  {
    id: 'post',
    nome: 'Aprovação de post',
    condicao: 'Qualquer outra aprovação (post, arte, geral)',
    onboarding: 'De quinta a domingo. Alterações todas de uma vez, até 3 vezes.',
  },
];

export const SITUACOES: { id: SituacaoLembrete; nome: string; condicao: string }[] = [
  { id: 'no_prazo', nome: 'No prazo', condicao: 'Faltam 2 dias ou mais pro prazo da tarefa' },
  { id: 'vence_amanha', nome: 'Vence amanhã', condicao: 'O prazo da tarefa é amanhã' },
  { id: 'vence_hoje', nome: 'Vence hoje', condicao: 'O prazo da tarefa é hoje' },
  {
    id: 'vencido',
    nome: 'Prazo vencido',
    condicao: 'O prazo passou, mas a data de publicação do post ainda não chegou',
  },
  {
    id: 'data_passou',
    nome: 'Data do post passou',
    condicao: 'O prazo passou e a data de publicação também já chegou',
  },
  {
    id: 'sem_prazo',
    nome: 'Sem prazo',
    condicao: 'A tarefa não tem Data Entrega no Notion',
  },
];

export const VARIAVEIS: { nome: string; descricao: string }[] = [
  { nome: '{apelido}', descricao: 'Apelido do grupo (ou nome do cliente)' },
  { nome: '{titulo}', descricao: 'Título do post' },
  { nome: '{prazo}', descricao: 'Prazo da tarefa (06/10)' },
  { nome: '{prazo_dia}', descricao: 'Prazo com dia da semana (segunda (06/10))' },
  { nome: '{data_post}', descricao: 'Data de publicação do post (13/10)' },
  { nome: '{dias_atraso}', descricao: 'Há quanto tempo venceu (4 dias)' },
  { nome: '{verbo}', descricao: 'Verbo da etapa (aprovar / enviar)' },
];

export const PADRAO: Record<string, string> = {
  'lembrete.saudacao': 'Oie, {apelido}! Tudo bem? 😊',
  'lembrete.fechamento': 'Qualquer dúvida, pode me chamar! 💜',

  'lembrete.etapa.pauta.abertura': 'Tem pauta te esperando pra aprovação no portal:',
  'lembrete.etapa.pauta.acao': 'Dá uma olhada e aprova (ou pede ajuste) por aqui:',
  'lembrete.etapa.pauta.regra':
    'Lembrando que esse é O momento para alterar ou ajustar tudo o que desejar nas pautas e formatos antes de seguirmos com a produção dos posts.',
  'lembrete.etapa.pauta.verbo': 'aprovar',

  'lembrete.etapa.previos.abertura': 'Precisamos dos materiais prévios desse post:',
  'lembrete.etapa.previos.acao': 'Envia por aqui:',
  'lembrete.etapa.previos.regra':
    'Se o prazo passar sem envio, seguiremos o processo com informações internas, mas não será possível alterar a pauta depois, apenas alterar a copy ou cancelar o post.',
  'lembrete.etapa.previos.verbo': 'enviar',

  'lembrete.etapa.producao.abertura': 'Precisamos dos materiais pra produção desse post:',
  'lembrete.etapa.producao.acao': 'Envia por aqui:',
  'lembrete.etapa.producao.regra':
    '❗Passou o prazo e não conseguiu nos enviar? O post vai ser cancelado ou substituído por um photodump 😢\n❗Aconteceu algum imprevisto e não vai conseguir produzir a tempo? Nos avise!',
  'lembrete.etapa.producao.verbo': 'enviar',

  'lembrete.etapa.post.abertura': 'Tem post te esperando pra aprovação no portal:',
  'lembrete.etapa.post.acao': 'Abre aqui pra revisar e aprovar:',
  'lembrete.etapa.post.regra':
    'O post poderá ser alterado 3x apenas, então não esquece de enviar todas as solicitações que deseja em apenas uma solicitação 😉',
  'lembrete.etapa.post.verbo': 'aprovar',

  'lembrete.prazo.no_prazo': 'O prazo é até *{prazo_dia}*.',
  'lembrete.prazo.vence_amanha': 'O prazo termina *amanhã ({prazo})*.',
  'lembrete.prazo.vence_hoje': 'O prazo termina *hoje*.',
  'lembrete.prazo.vencido':
    'O prazo era {prazo} e já passou, então a data de publicação ({data_post}) vai precisar ser remarcada. Assim que você {verbo}, a gente te passa a nova data.',
  'lembrete.prazo.data_passou':
    'A data de publicação era {data_post} e já passou. Vamos remarcar: assim que você {verbo}, a gente te passa a nova data.',
  'lembrete.prazo.sem_prazo': '',
};

export function etapaDaTarefa(titulo: string): EtapaLembrete {
  const t = titulo.toLowerCase();
  if (t.includes('pauta')) return 'pauta';
  if (/pr[ée]vi|conte[úu]do/.test(t)) return 'previos';
  if (t.includes('materia')) return 'producao';
  return 'post';
}

export function hojeEmSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
    new Date(),
  );
}

function ymd(iso: string): [number, number, number] {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return [y, m - 1, d];
}

export function somarDias(iso: string, dias: number): string {
  const d = new Date(Date.UTC(...ymd(iso)) + dias * 86_400_000);
  return d.toISOString().slice(0, 10);
}

function diasEntre(deISO: string, ateISO: string): number {
  return Math.round((Date.UTC(...ymd(ateISO)) - Date.UTC(...ymd(deISO))) / 86_400_000);
}

export function ddmm(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
}

const DIA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export function diaComData(iso: string): string {
  const dia = new Date(Date.UTC(...ymd(iso))).getUTCDay();
  return `${DIA_SEMANA[dia]} (${ddmm(iso)})`;
}

export function situacaoDoPrazo(
  prazo: string | null,
  postData: string | null,
  hoje: string,
): { codigo: SituacaoLembrete; rotulo: string; diasAtraso: number } {
  if (!prazo) return { codigo: 'sem_prazo', rotulo: 'Sem prazo definido', diasAtraso: 0 };
  const dias = diasEntre(hoje, prazo);
  if (dias > 1) return { codigo: 'no_prazo', rotulo: `No prazo · vence em ${dias} dias`, diasAtraso: 0 };
  if (dias === 1) return { codigo: 'vence_amanha', rotulo: 'Prazo vence amanhã', diasAtraso: 0 };
  if (dias === 0) return { codigo: 'vence_hoje', rotulo: 'Prazo vence hoje', diasAtraso: 0 };
  const atraso = Math.abs(dias);
  const txt = atraso === 1 ? '1 dia' : `${atraso} dias`;
  if (postData && diasEntre(hoje, postData) <= 0) {
    return {
      codigo: 'data_passou',
      rotulo: `Prazo vencido há ${txt} · data do post (${ddmm(postData)}) já passou, remarcar`,
      diasAtraso: atraso,
    };
  }
  return {
    codigo: 'vencido',
    rotulo: `Prazo vencido há ${txt} · data do post precisa ser remarcada`,
    diasAtraso: atraso,
  };
}

function preencher(modelo: string, vars: Record<string, string>, temDataPost: boolean): string {
  let txt = modelo;
  if (!temDataPost) txt = txt.replace(/\s*\(\{data_post\}\)/g, '');
  return txt.replace(/\{(\w+)\}/g, (m, nome) => (nome in vars ? vars[nome] : m)).trim();
}

export function montarLembrete(input: {
  apelido: string;
  tarefaTitulo: string;
  postTitulo: string;
  prazo: string | null;
  postData: string | null;
  link: string;
  textos?: Record<string, string>;
  hoje?: string;
  forcarEtapa?: EtapaLembrete;
}): {
  mensagem: string;
  etapa: EtapaLembrete;
  situacao: { codigo: SituacaoLembrete; rotulo: string };
} {
  const textos = { ...PADRAO, ...(input.textos ?? {}) };
  const hoje = input.hoje ?? hojeEmSaoPaulo();
  const etapa = input.forcarEtapa ?? etapaDaTarefa(input.tarefaTitulo);
  const situacao = situacaoDoPrazo(input.prazo, input.postData, hoje);
  const e = (campo: string) => textos[`lembrete.etapa.${etapa}.${campo}`] ?? '';

  const atraso = situacao.diasAtraso;
  const vars: Record<string, string> = {
    apelido: input.apelido,
    titulo: input.postTitulo,
    prazo: input.prazo ? ddmm(input.prazo) : '',
    prazo_dia: input.prazo ? diaComData(input.prazo) : '',
    data_post: input.postData ? ddmm(input.postData) : 'a definir',
    dias_atraso: atraso === 1 ? '1 dia' : `${atraso} dias`,
    verbo: e('verbo').trim(),
  };
  const p = (modelo: string) => preencher(modelo, vars, Boolean(input.postData));

  const blocos = [
    p(textos['lembrete.saudacao']),
    [p(e('abertura')), `*${input.postTitulo}*`].filter(Boolean).join('\n'),
    p(textos[`lembrete.prazo.${situacao.codigo}`] ?? ''),
    [p(e('acao')), input.link].filter(Boolean).join('\n'),
    p(e('regra')),
    p(textos['lembrete.fechamento']),
  ].filter(Boolean);

  return { mensagem: blocos.join('\n\n'), etapa, situacao };
}
