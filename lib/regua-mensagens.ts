/**
 * Régua semanal de aprovação de posts (cliente), com textos editáveis em
 * Configurações › Mensagens padrão. Ciclo ancorado na quinta do envio:
 * qui envio · sex lembrete · seg último dia (manhã e tarde) · ter vencido.
 * Arquivo puro: usado no servidor e na prévia do admin.
 */
import { diaComData } from './lembrete-aprovacao';

export type MomentoRegua = 'quinta' | 'sexta' | 'segunda_manha' | 'segunda_tarde' | 'terca';
export type VarianteRegua = 'unica' | 'viu' | 'nao_viu';

export const MOMENTOS_REGUA: {
  id: MomentoRegua;
  nome: string;
  dia: string;
  quando: string;
  variantes: VarianteRegua[];
}[] = [
  {
    id: 'quinta',
    nome: 'Envio da semana',
    dia: 'Quinta',
    quando:
      'Quinta do envio. Uma mensagem por cliente com todos os posts da semana. Só sai se todos estiverem com a Aprovação | Arte concluída.',
    variantes: ['unica'],
  },
  {
    id: 'sexta',
    nome: 'Lembrete',
    dia: 'Sexta',
    quando: 'Dia seguinte ao envio. Só pra quem ainda tem post sem aprovar; quem aprovou tudo não recebe.',
    variantes: ['viu', 'nao_viu'],
  },
  {
    id: 'segunda_manha',
    nome: 'Último dia (manhã)',
    dia: 'Segunda',
    quando: 'Dia do prazo, primeira mensagem do dia. Só pra quem ainda tem post sem aprovar.',
    variantes: ['viu', 'nao_viu'],
  },
  {
    id: 'segunda_tarde',
    nome: 'Último dia (tarde)',
    dia: 'Segunda',
    quando: 'Dia do prazo, segunda mensagem (a partir das 13h). Só pra quem ainda tem post sem aprovar.',
    variantes: ['viu', 'nao_viu'],
  },
  {
    id: 'terca',
    nome: 'Prazo vencido',
    dia: 'Terça',
    quando:
      'Dia seguinte ao prazo. Segue o Onboarding e o doc Mensagens Padrão: o post sem aprovação é readequado (muda de data e o dia fica sem publicação).',
    variantes: ['viu', 'nao_viu'],
  },
];

export const VARIANTES_REGUA: Record<VarianteRegua, { nome: string; condicao: string }> = {
  unica: { nome: 'Mensagem', condicao: 'Todos os clientes com posts prontos' },
  viu: {
    nome: 'Viu e não aprovou',
    condicao: 'O cliente abriu no portal todos os posts que faltam aprovar, depois do envio',
  },
  nao_viu: {
    nome: 'Não viu',
    condicao: 'Algum post que falta aprovar ainda não foi aberto no portal',
  },
};

export const VARIAVEIS_REGUA: { nome: string; descricao: string }[] = [
  { nome: '{apelido}', descricao: 'Apelido do grupo (ou nome do cliente)' },
  { nome: '{lista_posts}', descricao: 'Lista dos posts com link (só os que faltam aprovar, nos lembretes)' },
  { nome: '{qtd_posts}', descricao: 'Quantidade de posts da lista' },
  { nome: '{prazo_dia}', descricao: 'Prazo do cliente com dia da semana (segunda (12/10))' },
];

export function chaveRegua(m: MomentoRegua, v: VarianteRegua): string {
  return v === 'unica' ? `regua.${m}` : `regua.${m}.${v}`;
}

// Base: doc "🗣️ Mensagens Padrão" do Notion (Envio de Posts para Aprovação,
// lembrete de sexta, lembrete final de segunda, opções em caso de não aprovação).
const ANALISE =
  'Nessa etapa, você pode analisar:\n- Tom de voz: estamos falando como você escreveria?\n- Design do post: curtiu como o post foi desenhado?\n- História contada e informações: tudo certinho? Ficou faltando algo?';
const READEQUADO =
  'Se o post não for aprovado e nem encaminhado para alteração, ele será readequado, fazendo com que o dia em que ele seria postado fique sem publicação, tá bem?';
const TRES_ALTERACOES =
  'O post poderá ser alterado 3x apenas, então não esquece de enviar todas as solicitações que deseja em apenas uma solicitação 😉';

export const PADRAO_REGUA: Record<string, string> = {
  'regua.quinta': [
    'Oiie {apelido}! Tudo bemm? ☺️',
    'Chegamos com a nossa aprovação semanal de posts! 🤩 Temos conteúdos novos aguardando aprovação:',
    '{lista_posts}',
    '🕦 O prazo de aprovação é até *{prazo_dia}*, mas, se conseguir antes, seria perfeito!',
    ANALISE,
    'Aproveita o findi para revisar tudo com calma! 🧘‍♀️',
    'Se curtiu os posts, é só aprovar que ele passa para a próxima etapa do processo. Mas se tiver algo que precise de alteração, é só colocar tudo detalhado nos comentários que a gente resolve por aqui 😉',
    'Caso o prazo passe e o post não for aprovado e nem encaminhado para alteração, ele será readequado, fazendo com que o dia em que ele seria postado fique sem publicação.',
    'O post poderá ser alterado 3x apenas, então não esquece de enviar todas as solicitações que deseja em apenas uma solicitação. Isso faz com que o processo de ajuste seja mais rápido!',
    'Qualquer dúvida, pode me chamar! 💜',
  ].join('\n\n'),

  'regua.sexta.nao_viu': [
    'Oiie {apelido}! Tudo bemm? ☺️',
    'Passando pra lembrar da nossa aprovação semanal de posts! Esses ainda estão te esperando no portal:',
    '{lista_posts}',
    `O último dia do nosso prazo é *{prazo_dia}*. ${READEQUADO}`,
    ANALISE,
    TRES_ALTERACOES,
    'Qualquer dúvida, pode me chamar! 💜',
  ].join('\n\n'),
  'regua.sexta.viu': [
    'Oiie {apelido}! Tudo bemm? ☺️',
    'Vimos que você já deu uma olhadinha nos posts da semana 👀 Ficou faltando alguma coisa pra aprovar?',
    '{lista_posts}',
    'Se curtiu, é só aprovar que ele passa para a próxima etapa. Se tiver algo pra ajustar, coloca tudo detalhado nos comentários que a gente resolve por aqui 😉',
    `O último dia do nosso prazo é *{prazo_dia}*. ${READEQUADO}`,
    'Qualquer dúvida, pode me chamar! 💜',
  ].join('\n\n'),

  'regua.segunda_manha.nao_viu': [
    'Oiie {apelido}! Tudo bemm? ☺️',
    'Passando pra lembrar da nossa aprovação semanal de posts! *Hoje é o último dia do nosso prazo* e esses posts ainda não foram abertos:',
    '{lista_posts}',
    READEQUADO,
    TRES_ALTERACOES,
    'Qualquer dúvida, pode me chamar! 💜',
  ].join('\n\n'),
  'regua.segunda_manha.viu': [
    'Oiie {apelido}! Tudo bemm? ☺️',
    'Vimos que você já viu os posts da semana, mas eles ainda estão sem aprovação:',
    '{lista_posts}',
    'Ficou faltando alguma coisa? Precisa de algo pra aprovar? Não esquece que *o prazo é hoje*!',
    READEQUADO,
    'Qualquer dúvida, pode me chamar! 💜',
  ].join('\n\n'),

  'regua.segunda_tarde.nao_viu': [
    'Oie, {apelido}! Último lembrete do dia 😊',
    'Esses posts ainda precisam da sua aprovação *até o fim de hoje*:',
    '{lista_posts}',
    'Depois disso eles serão readequados e o dia em que seriam postados fica sem publicação. Se precisar de algo, estamos por aqui! 💜',
  ].join('\n\n'),
  'regua.segunda_tarde.viu': [
    'Oie, {apelido}! Último lembrete do dia 😊',
    'Faltam só essas aprovações, e o prazo termina *hoje*:',
    '{lista_posts}',
    'Se tiver alguma dúvida ou algo travando a aprovação, me chama aqui que a gente resolve junto 💜',
  ].join('\n\n'),

  'regua.terca.nao_viu': [
    'Oie, {apelido}! ✌🏻',
    'Vi que temos posts que não foram aprovados, e eles nem chegaram a ser abertos no portal:',
    '{lista_posts}',
    'Como não tivemos seu retorno dentro do prazo, eles serão readequados: a data de publicação muda e o dia em que seriam postados fica sem publicação. Assim que você aprovar, a gente te passa as novas datas.',
    'Para evitarmos isso nas próximas semanas, ficamos à disposição pra conversar nas etapas anteriores e ajustar o que for preciso, pra juntos criarmos posts incríveis!',
    'Já sabe, se ficar com qualquer dúvida, estamos por aqui!',
  ].join('\n\n'),
  'regua.terca.viu': [
    'Oie, {apelido}! ✌🏻',
    'Vi que temos posts que você chegou a ver, mas que ficaram sem aprovação:',
    '{lista_posts}',
    'Como não tivemos seu retorno dentro do prazo, eles serão readequados: a data de publicação muda e o dia em que seriam postados fica sem publicação. Assim que você aprovar, a gente te passa as novas datas.',
    'Se ficou faltando alguma coisa pra aprovar, me conta que a gente resolve junto. Já sabe, estamos por aqui!',
  ].join('\n\n'),
};

export function listaDePosts(posts: { titulo: string; link: string }[]): string {
  return posts.map((p) => `• *${p.titulo}*\n${p.link}`).join('\n\n');
}

export function montarMensagemRegua(input: {
  momento: MomentoRegua;
  variante: VarianteRegua;
  apelido: string;
  posts: { titulo: string; link: string }[];
  prazo: string | null;
  textos?: Record<string, string>;
}): string {
  const chave = chaveRegua(input.momento, input.variante);
  const modelo = input.textos?.[chave] ?? PADRAO_REGUA[chave] ?? '';
  const vars: Record<string, string> = {
    apelido: input.apelido,
    lista_posts: listaDePosts(input.posts),
    qtd_posts: String(input.posts.length),
    prazo_dia: input.prazo ? diaComData(input.prazo) : 'segunda',
  };
  return modelo.replace(/\{(\w+)\}/g, (m, nome) => (nome in vars ? vars[nome] : m)).trim();
}
