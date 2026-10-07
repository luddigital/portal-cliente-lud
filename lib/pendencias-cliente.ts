/**
 * Pendências do cliente num projeto, divididas por tipo de entrega, e a
 * mensagem geral de WhatsApp que junta tudo numa só (em vez de um lembrete por
 * tarefa). Reaproveita os textos de Configurações › Mensagens padrão
 * (saudação, fechamento e a regra de cada etapa).
 *
 * Arquivo puro (sem acesso a banco): usado no servidor e na prévia do admin.
 */
import {
  PADRAO,
  ddmm,
  diaComData,
  hojeEmSaoPaulo,
  situacaoDoPrazo,
  type EtapaLembrete,
} from './lembrete-aprovacao';

export type GrupoPendencia = 'pauta' | 'previas' | 'materiais' | 'stories' | 'post';

/** Ordem = ordem do fluxo do post. `etapa` aponta pra regra editável da etapa. */
export const GRUPOS_PENDENCIA: {
  id: GrupoPendencia;
  label: string;
  etapa: EtapaLembrete | null;
}[] = [
  { id: 'pauta', label: 'Aprovar pauta', etapa: 'pauta' },
  { id: 'previas', label: 'Enviar informações prévias', etapa: 'previos' },
  { id: 'materiais', label: 'Enviar materiais', etapa: 'producao' },
  { id: 'stories', label: 'Direcionar stories', etapa: null },
  { id: 'post', label: 'Aprovar posts', etapa: 'post' },
];

export type ItemPendencia = {
  tarefaId: string;
  tarefaTitulo: string;
  postId: string;
  postTitulo: string;
  postData: string | null;
  /** Data Entrega da tarefa (ou Data Inicial, se não houver). */
  prazo: string | null;
  link: string;
  grupo: GrupoPendencia;
};

/** Em qual divisão cai uma tarefa do cliente, pelo título (mesmos critérios da home). */
export function grupoDaTarefa(titulo: string): GrupoPendencia {
  const t = titulo.toLowerCase();
  if (t.includes('stories') || t.includes('story')) return 'stories';
  if (t.includes('pauta')) return 'pauta';
  if (/pr[ée]vi|conte[úu]do|informa/.test(t)) return 'previas';
  if (t.includes('materia')) return 'materiais';
  return 'post';
}

const ABERTURA: Record<GrupoPendencia, { um: string; varios: string }> = {
  pauta: {
    um: 'Tem uma pauta te esperando pra aprovação no portal:',
    varios: 'Tem {n} pautas te esperando pra aprovação no portal:',
  },
  previas: {
    um: 'Precisamos dos materiais prévios desse post:',
    varios: 'Precisamos dos materiais prévios desses {n} posts:',
  },
  materiais: {
    um: 'Precisamos dos materiais pra produção desse post:',
    varios: 'Precisamos dos materiais pra produção desses {n} posts:',
  },
  stories: {
    um: 'Precisamos do seu direcionamento pros stories:',
    varios: 'Precisamos do seu direcionamento pra {n} stories:',
  },
  post: {
    um: 'Tem um post te esperando pra aprovação no portal:',
    varios: 'Tem {n} posts te esperando pra aprovação no portal:',
  },
};

function sufixoPrazo(i: ItemPendencia, hoje: string): string {
  if (!i.prazo) return '';
  const { codigo } = situacaoDoPrazo(i.prazo, i.postData, hoje);
  switch (codigo) {
    case 'vence_hoje':
      return ' (até hoje)';
    case 'vence_amanha':
      return ` (até amanhã, ${ddmm(i.prazo)})`;
    case 'vencido':
    case 'data_passou':
      return ` (prazo era ${ddmm(i.prazo)})`;
    default:
      return ` (até ${diaComData(i.prazo)})`;
  }
}

export function montarMensagemPendencias(input: {
  apelido: string;
  itens: ItemPendencia[];
  textos?: Record<string, string>;
  hoje?: string;
}): string {
  const textos = { ...PADRAO, ...(input.textos ?? {}) };
  const hoje = input.hoje ?? hojeEmSaoPaulo();
  const comApelido = (s: string) => s.replace(/\{apelido\}/g, input.apelido).trim();

  const grupos = GRUPOS_PENDENCIA.map((g) => ({
    g,
    itens: input.itens.filter((i) => i.grupo === g.id),
  })).filter((x) => x.itens.length > 0);
  if (grupos.length === 0) return '';

  const blocos: string[] = [comApelido(textos['lembrete.saudacao'] ?? '')];
  if (grupos.length > 1) blocos.push('Separei aqui tudo o que está pendente com você:');

  for (const { g, itens } of grupos) {
    const abertura = itens.length === 1 ? ABERTURA[g.id].um : ABERTURA[g.id].varios;
    const lista = itens
      .map((i) => `• *${i.postTitulo}*${sufixoPrazo(i, hoje)}\n${i.link}`)
      .join('\n\n');
    blocos.push(`${abertura.replace('{n}', String(itens.length))}\n\n${lista}`);
  }

  // Regra de cada etapa presente, uma vez só (mesmos textos do lembrete avulso).
  for (const { g } of grupos) {
    if (!g.etapa) continue;
    const regra = comApelido(textos[`lembrete.etapa.${g.etapa}.regra`] ?? '');
    if (regra) blocos.push(regra);
  }

  blocos.push(comApelido(textos['lembrete.fechamento'] ?? ''));
  return blocos.filter(Boolean).join('\n\n');
}
