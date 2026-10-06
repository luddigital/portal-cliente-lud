/**
 * Monta o lembrete de WhatsApp conforme a etapa da tarefa e a situação do
 * prazo, seguindo as regras do Onboarding Cliente (Notion):
 *  - Pauta: 2 dias úteis; depois de aprovada, a estrutura não muda mais.
 *  - Materiais prévios: 2 dias; o que o cliente já tiver em mãos.
 *  - Materiais pra produção: 5 dias; a data de envio é definitiva.
 *  - Aprovação de post: quinta a domingo; alterações todas de uma vez.
 * Prazo vencido → a data de publicação precisa ser remarcada.
 */

export type EtapaLembrete = 'pauta' | 'previos' | 'producao' | 'post';

export type SituacaoLembrete =
  | 'sem_prazo'
  | 'no_prazo'
  | 'vence_amanha'
  | 'vence_hoje'
  | 'vencido'
  | 'data_passou';

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

function diasEntre(deISO: string, ateISO: string): number {
  const a = Date.UTC(...ymd(deISO));
  const b = Date.UTC(...ymd(ateISO));
  return Math.round((b - a) / 86_400_000);
}

function ymd(iso: string): [number, number, number] {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return [y, m - 1, d];
}

function ddmm(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
}

const DIA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

function diaComData(iso: string): string {
  const dia = new Date(Date.UTC(...ymd(iso))).getUTCDay();
  return `${DIA_SEMANA[dia]} (${ddmm(iso)})`;
}

export function situacaoDoPrazo(
  prazo: string | null,
  postData: string | null,
  hoje: string,
): { codigo: SituacaoLembrete; rotulo: string } {
  if (!prazo) return { codigo: 'sem_prazo', rotulo: 'Sem prazo definido' };
  const dias = diasEntre(hoje, prazo);
  if (dias > 1) return { codigo: 'no_prazo', rotulo: `No prazo · vence em ${dias} dias` };
  if (dias === 1) return { codigo: 'vence_amanha', rotulo: 'Prazo vence amanhã' };
  if (dias === 0) return { codigo: 'vence_hoje', rotulo: 'Prazo vence hoje' };
  const atraso = Math.abs(dias);
  const txtAtraso = atraso === 1 ? '1 dia' : `${atraso} dias`;
  if (postData && diasEntre(hoje, postData) <= 0) {
    return {
      codigo: 'data_passou',
      rotulo: `Prazo vencido há ${txtAtraso} · data do post (${ddmm(postData)}) já passou, remarcar`,
    };
  }
  return {
    codigo: 'vencido',
    rotulo: `Prazo vencido há ${txtAtraso} · data do post precisa ser remarcada`,
  };
}

const ABERTURA: Record<EtapaLembrete, string> = {
  pauta: 'Tem pauta te esperando pra aprovação no portal:',
  previos: 'Precisamos dos materiais prévios desse post:',
  producao: 'Precisamos dos materiais pra produção desse post:',
  post: 'Tem post te esperando pra aprovação no portal:',
};

const ACAO: Record<EtapaLembrete, string> = {
  pauta: 'Dá uma olhada e aprova (ou pede ajuste) por aqui:',
  previos: 'Envia por aqui:',
  producao: 'Envia por aqui:',
  post: 'Abre aqui pra revisar e aprovar:',
};

const VERBO: Record<EtapaLembrete, string> = {
  pauta: 'aprovar',
  previos: 'enviar',
  producao: 'enviar',
  post: 'aprovar',
};

const REGRA: Record<EtapaLembrete, string> = {
  pauta: 'Depois da pauta aprovada a estrutura do post não muda mais, então essa é a hora de ajustar o que quiser.',
  previos: 'Se tiver dicas, fotos ou vídeos que já tenha em mãos, pode mandar junto.',
  producao: 'É com esse material que o post entra em produção, então a data de envio é definitiva.',
  post: 'Se tiver ajustes, manda tudo de uma vez só. Assim o post não atrasa 😉',
};

export function montarLembrete(input: {
  apelido: string;
  tarefaTitulo: string;
  postTitulo: string;
  prazo: string | null;
  postData: string | null;
  link: string;
  hoje?: string;
}): {
  mensagem: string;
  etapa: EtapaLembrete;
  situacao: { codigo: SituacaoLembrete; rotulo: string };
} {
  const hoje = input.hoje ?? hojeEmSaoPaulo();
  const etapa = etapaDaTarefa(input.tarefaTitulo);
  const situacao = situacaoDoPrazo(input.prazo, input.postData, hoje);
  const verbo = VERBO[etapa];

  let linhaPrazo: string | null = null;
  switch (situacao.codigo) {
    case 'no_prazo':
      linhaPrazo = `O prazo é até *${diaComData(input.prazo!)}*.`;
      break;
    case 'vence_amanha':
      linhaPrazo = `O prazo termina *amanhã (${ddmm(input.prazo!)})*.`;
      break;
    case 'vence_hoje':
      linhaPrazo = 'O prazo termina *hoje*.';
      break;
    case 'vencido':
      linhaPrazo =
        `O prazo era ${ddmm(input.prazo!)} e já passou, então a data de publicação` +
        (input.postData ? ` (${ddmm(input.postData)})` : '') +
        ` vai precisar ser remarcada. Assim que você ${verbo}, a gente te passa a nova data.`;
      break;
    case 'data_passou':
      linhaPrazo =
        `A data de publicação era ${ddmm(input.postData!)} e já passou. ` +
        `Vamos remarcar: assim que você ${verbo}, a gente te passa a nova data.`;
      break;
  }

  const partes = [
    `Oi ${input.apelido}! Aqui é da Lud. ✨`,
    '',
    ABERTURA[etapa],
    `*${input.postTitulo}*`,
    '',
  ];
  if (linhaPrazo) partes.push(linhaPrazo, '');
  partes.push(ACAO[etapa], input.link, '', REGRA[etapa], '', 'Qualquer dúvida, só me chamar por aqui.');

  return { mensagem: partes.join('\n'), etapa, situacao };
}
