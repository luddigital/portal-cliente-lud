/**
 * Dados do calendário da semana da home (servidor). Usado pela página e pela API das setas.
 */
import { listPostsNoIntervalo, type PostCalendario } from '@/lib/notion';
import { nomeCurtoDoProjeto } from '@/lib/rotas';
import { ST, hojeSP, somaDias, type St } from './lud';
import type { PostSemana } from './SemanaArrastavel';

export type SemanaHome = { deslocamento: number; hoje: string; dias: string[]; rotulo: string; erro: boolean; posts: PostSemana[] };

const COR_ST: Record<PostCalendario['cor'], St> = {
  publicado: 'ok',
  agendado: 'info',
  aprovacao: 'cli',
  alteracao: 'atr',
  aguardando: 'hoje',
  rascunho: 'neu',
};

/**
 * Status que aparece no card do post: o mesmo do Notion ("Status Geral").
 * Antes, post sem tarefa aberta aparecia como "Rascunho" mesmo não sendo.
 */
function statusDoPost(p: PostCalendario): { rotulo: string; st: St } {
  // Sem emoji e com a palavra do Notion ("Postado"), pra todos os cards ficarem iguais.
  const limpo = (x: string | null | undefined) => (x ?? '').replace(/^[^\p{L}\p{N}]+/u, '').trim();
  if (p.etapa === 'publicado') return { rotulo: 'Postado', st: 'ok' };
  const geral = limpo(p.statusGeral);
  const texto = geral || (p.etapa === 'rascunho' ? limpo(p.status) || 'Sem status' : p.etapaLabel);
  const t = texto.toLowerCase();
  const st: St = /postad|publicad/.test(t)
    ? 'ok'
    : /altera/.test(t)
      ? 'atr'
      : /aprova/.test(t)
        ? 'cli'
        : /programar/.test(t)
          ? 'prog'
          : /programa|agenda|conferir/.test(t)
          ? 'info'
          : /material|envio|informa|direcionamento/.test(t)
            ? 'hoje'
            : geral
              ? 'cheg'
              : COR_ST[p.cor] ?? 'neu';
  return { rotulo: texto, st };
}

export async function montarSemana(deslocamento: number): Promise<SemanaHome> {
  const hoje = hojeSP();
  const dow = (new Date(hoje + 'T12:00:00Z').getUTCDay() + 6) % 7;
  const seg = somaDias(hoje, -dow + 7 * deslocamento);
  const dias = Array.from({ length: 7 }, (_, k) => somaDias(seg, k));
  const lidos = await listPostsNoIntervalo(dias[0], dias[6]).catch(() => null);
  const fim = dias[6];
  const mes = (d: string) => new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'));
  const rotulo =
    seg.slice(5, 7) === fim.slice(5, 7)
      ? `${Number(seg.slice(8))} a ${Number(fim.slice(8))} de ${mes(fim)}`
      : `${Number(seg.slice(8))} de ${mes(seg)} a ${Number(fim.slice(8))} de ${mes(fim)}`;
  const posts: PostSemana[] = (lidos ?? [])
    .filter((p) => p.data)
    .map((p) => {
      const { rotulo: r, st } = statusDoPost(p);
      const data = p.data as string;
      return {
        id: p.id,
        dia: data.slice(0, 10),
        hora: data.length > 10 ? data.slice(10) : null,
        handle: nomeCurtoDoProjeto(p.projetoNome),
        titulo: p.titulo,
        rotulo: r,
        fundo: ST[st][0],
        cor: ST[st][1],
        postado: p.etapa === 'publicado' || r === 'Postado',
      };
    });
  return { deslocamento, hoje, dias, rotulo, erro: lidos === null, posts };
}
