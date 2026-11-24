/**
 * Regra: o cliente sempre tem pelo menos 1 dia depois que a mensagem chega.
 * Depois de mandar posts pra aprovação, a tarefa de aprovação do cliente que
 * vence antes de amanhã passa a vencer amanhã. Prazo mais longo (ex.: segunda,
 * no envio de quinta) continua como está.
 */
import { atualizarPrazoTarefa, listarTarefasDoPost } from '@/lib/notion';
import { hojeEmSaoPaulo, somarDias } from '@/lib/lembrete-aprovacao';

const ehAprovacaoDoClienteTitulo = (t: string) => /^aprova[çc][ãa]o\s*\|/i.test(t.trim()) && !/\|\s*(arte|pauta|materia)/i.test(t);

export async function garantirUmDiaDePrazo(postIds: (string | null | undefined)[]): Promise<string[]> {
  const amanha = somarDias(hojeEmSaoPaulo(), 1);
  const erros: string[] = [];
  for (const postId of [...new Set(postIds.filter((x): x is string => !!x))]) {
    try {
      const tarefas = await listarTarefasDoPost(postId);
      const ap = tarefas.find((t) => t.aberta && ehAprovacaoDoClienteTitulo(t.titulo));
      if (!ap) continue;
      if (!ap.prazo || ap.prazo.slice(0, 10) < amanha) await atualizarPrazoTarefa(ap.tarefaId, amanha);
    } catch (e: any) {
      erros.push(`${postId}: ${e?.message ?? 'erro'}`);
    }
  }
  return erros;
}
