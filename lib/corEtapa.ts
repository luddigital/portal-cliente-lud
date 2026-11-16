/**
 * Cor da tag de etapa do post (pelo rótulo de rotuloDaTarefaAtual), na paleta do admin.
 * Nenhuma etapa fica cinza: cada fase tem o seu tom.
 */
export type CorTag = { bg: string; fg: string };

const C = {
  alteracao: { bg: '#F6CFCB', fg: '#7E211C' },
  cliente: { bg: '#F2D0EA', fg: '#6A2B5F' },
  esperando: { bg: '#F8D5E5', fg: '#7A1F4C' },
  pronto: { bg: '#D8EDCF', fg: '#2E5520' },
  programar: { bg: '#F5CBA7', fg: '#6E2E0A' },
  agendado: { bg: '#D3E2F3', fg: '#24466B' },
  arte: { bg: '#E3F0B2', fg: '#45540F' },
  copy: { bg: '#E2DDFA', fg: '#3D3478' },
  interna: { bg: '#EFE4D8', fg: '#5A4634' },
} satisfies Record<string, CorTag>;

export function corDaEtapa(rotulo: string): CorTag {
  const t = rotulo.toLowerCase();
  if (/altera/.test(t)) return C.alteracao;
  if (/programar/.test(t)) return C.programar;
  if (/pronto pra enviar|enviar post|publicado|postado|conclu/.test(t)) return C.pronto;
  if (/agendado|posta hoje|conferir postagem/.test(t)) return C.agendado;
  if (/com o cliente|cliente pra aprovar|aprova[çc][ãa]o \| post/.test(t)) return C.cliente;
  if (/esperando|materia|informa|stories|conte[úu]dos|pr[ée]vi/.test(t)) return C.esperando;
  if (/aprova/.test(t)) return C.interna; // aprovação interna (arte, geral, briefing, pauta)
  if (/arte/.test(t)) return C.arte;
  if (/briefing|copy|roteiro/.test(t)) return C.copy;
  if (/pauta/.test(t)) return C.interna;
  return C.copy;
}
