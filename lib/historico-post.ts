/**
 * Histórico do post (visão Lud.): comentários, eventos do processo e envios
 * pro cliente, montado igual na página do post e no popup de prévia.
 *
 * Arquivo puro (sem acesso a banco): recebe os dados já buscados.
 */
import { ehTarefaDoCliente } from './etapas-projeto';
import type { TarefaDoPost } from './notion';

/** Item do histórico do post: comentário (cliente ou equipe) ou evento do processo. */
export type NotaHistorico = {
  id: string;
  quando: string;
  tipo:
    | 'interna'
    | 'cliente_comentou'
    | 'cliente_aprovou'
    | 'cliente_alteracao'
    | 'cliente_enviou'
    | 'equipe'
    | 'ok'
    | 'voltou'
    /** Envio pro cliente marcado no Notion (tarefa "Enviar Post Aprovação" concluída). */
    | 'enviado';
  autor: string | null;
  titulo: string;
  corpo: string;
};

/** Tarefa do cliente no post (pra medir o tempo que ele teve depois de cada envio). */
export type TarefaClienteHistorico = { titulo: string; prazo: string | null; concluidaEm: string | null };

/** Envio pro grupo do cliente registrado pelo portal (regua_envios). */
export type EnvioHistorico = {
  momento: string;
  variante: string | null;
  enviadoEm: string;
  enviadoPor: string | null;
  texto?: string | null;
};

/**
 * Comentários do Notion viram itens do histórico: o que veio do cliente pelo
 * portal (prefixos fixos) e o resto como nota da equipe.
 */
/** Começo do comentário de nota interna no Notion (o cliente não vê no portal). */
export const PREFIXO_NOTA_INTERNA = '🔒 Nota interna';

export function notasDosComentarios(
  lista: { id: string; texto: string; criadoEm: string }[],
  equipe: Set<string>,
): NotaHistorico[] {
  const out: NotaHistorico[] = [];
  const corpoDepoisDaPrimeira = (t: string) => t.split(/\n\s*\n/).slice(1).join('\n\n').trim();
  for (const c of lista) {
    const t = c.texto.trim();
    const base = { id: c.id, quando: c.criadoEm };
    const mi = t.match(/^🔒\s*Nota interna\s*·\s*(\S+@\S+)\s*\n+([\s\S]*)$/);
    const m = t.match(/^💬\s*(\S+@\S+)\s*\n+([\s\S]*)$/);
    if (mi) {
      out.push({ ...base, tipo: 'interna', titulo: 'Nota interna', autor: mi[1].toLowerCase(), corpo: mi[2].trim() });
    } else if (m) {
      const email = m[1].toLowerCase();
      const daEquipe = equipe.has(email) || email.endsWith('@lud.digital');
      out.push({
        ...base,
        tipo: daEquipe ? 'equipe' : 'cliente_comentou',
        titulo: daEquipe ? 'Equipe comentou' : 'Cliente comentou',
        autor: email,
        corpo: m[2].trim(),
      });
    } else if (/— aprovado pelo cliente/.test(t)) {
      const etapa = t.split('\n')[0].replace(/^✅\s*/, '').replace(/\s*— aprovado pelo cliente\.?$/, '');
      out.push({ ...base, tipo: 'cliente_aprovou', titulo: `Cliente aprovou · ${etapa}`, autor: null, corpo: corpoDepoisDaPrimeira(t) });
    } else if (/— alteração solicitada pelo cliente/.test(t)) {
      out.push({ ...base, tipo: 'cliente_alteracao', titulo: 'Cliente pediu alteração', autor: null, corpo: corpoDepoisDaPrimeira(t) });
    } else if (/— recebida do cliente/.test(t)) {
      out.push({ ...base, tipo: 'cliente_enviou', titulo: 'Cliente enviou materiais', autor: null, corpo: t.split('\n').slice(1).join('\n').trim() });
    } else {
      const [primeira, ...resto] = t.split('\n');
      out.push({
        ...base,
        tipo: 'equipe',
        titulo: primeira.length <= 90 ? primeira : 'Nota da equipe',
        autor: null,
        corpo: primeira.length <= 90 ? resto.join('\n').trim() : t,
      });
    }
  }
  return out;
}

/** Ciclo de alteração: alteração concluída, aprovação interna, reprovação. */
export function eventosDeAlteracao(tarefas: TarefaDoPost[]): NotaHistorico[] {
  return tarefas.flatMap((t): NotaHistorico[] => {
    const titulo = t.titulo.trim();
    if (!t.finalizadaEm) return [];
    const quem = t.pessoaNome ? t.pessoaNome.split(' ')[0] : null;
    const base = { id: `ev-${t.tarefaId}`, quando: t.finalizadaEm, autor: quem, corpo: '' };
    if (/^altera[çc][ãa]o\s*\|/i.test(titulo) && t.status === 'Concluído') {
      return [{ ...base, tipo: 'ok', titulo: `${titulo} concluída` }];
    }
    if (t.ordemUm === '03' && /^aprova[çc][ãa]o\s*\|/i.test(titulo)) {
      if (t.status === 'Concluído') return [{ ...base, tipo: 'ok', titulo: `${titulo} da alteração aprovada` }];
      if (t.status === 'Reprovado') {
        return [{ ...base, tipo: 'voltou', titulo: `${titulo} da alteração reprovada, voltou pra ajuste` }];
      }
    }
    return [];
  });
}

/**
 * Envio pro cliente feito fora do portal: a tarefa "Enviar Post Aprovação"
 * concluída no Notion. Se o portal registrou um envio perto dessa hora, ele
 * já aparece; não duplica.
 */
export function enviosMarcadosNoNotion(tarefas: TarefaDoPost[], envios: EnvioHistorico[]): NotaHistorico[] {
  return tarefas
    .filter((t) => /enviar post/i.test(t.titulo) && t.status === 'Concluído' && t.finalizadaEm)
    .filter(
      (t) =>
        !envios.some(
          (e) => Math.abs((Date.parse(e.enviadoEm) || 0) - (Date.parse(t.finalizadaEm!) || 0)) < 12 * 3_600_000,
        ),
    )
    .map((t) => ({
      id: `env-${t.tarefaId}`,
      quando: t.finalizadaEm!,
      tipo: 'enviado' as const,
      titulo: 'Enviado pro cliente aprovar (marcado no Notion)',
      autor: t.pessoaNome ? t.pessoaNome.split(' ')[0] : null,
      corpo: '',
    }));
}

/** Tarefas do cliente no post: base do "prazo dado" em cada envio. */
export function tarefasClienteDoHistorico(tarefas: TarefaDoPost[]): TarefaClienteHistorico[] {
  return tarefas
    .filter((t) => ehTarefaDoCliente(t.titulo) && t.status !== 'Cancelado' && t.status !== 'Excluída')
    .map((t) => ({
      titulo: t.titulo,
      prazo: t.prazo,
      concluidaEm: t.status === 'Concluído' ? t.finalizadaEm ?? t.finalizada : null,
    }));
}

/** Tudo que entra no histórico além das visualizações e envios do portal. */
export function notasDoPost(input: {
  comentarios: { id: string; texto: string; criadoEm: string }[];
  equipe: Set<string>;
  tarefas: TarefaDoPost[];
  envios: EnvioHistorico[];
}): NotaHistorico[] {
  return [
    ...notasDosComentarios(input.comentarios, input.equipe),
    ...eventosDeAlteracao(input.tarefas),
    ...enviosMarcadosNoNotion(input.tarefas, input.envios),
  ];
}
