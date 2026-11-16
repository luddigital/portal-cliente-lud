import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { EMAIL_FEEDBACK_COPY } from '@/lib/esteira';
import { lerFilaDeCopy, listarTarefasDaEsteira, type ItemFilaCopy } from '@/lib/notion';
import { nomeCurtoDoProjeto } from '@/lib/rotas';
import { Pagina, Vazio, hojeSP } from '../_ui/lud';
import { EsteiraNova, type CardEsteira } from './EsteiraNova';
import { etapaDoCard } from './etapa';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function EsteiraCopyPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) redirect('/esteira');

  let cards: CardEsteira[] = [];
  let erro: string | null = null;
  try {
    const [brutos, fila] = await Promise.all([listarTarefasDaEsteira(), lerFilaDeCopy().catch(() => [] as ItemFilaCopy[])]);
    const semTraco = (x: string) => x.replace(/-/g, '');
    const naFila = new Map(fila.map((f) => [semTraco(f.postId), f.status]));
    cards = brutos.map((c) => {
      const etapa = etapaDoCard(c);
      const statusFila = etapa === 'nao' || etapa === 'andamento' ? naFila.get(semTraco(c.postId)) ?? null : null;
      return {
      tarefaId: c.tarefaId,
      postId: c.postId,
      titulo: c.postTitulo,
      handle: nomeCurtoDoProjeto(c.projetoNome),
      pessoa: c.responsavelNome,
      prazo: c.prazo ? c.prazo.slice(0, 10) : null,
      etapa: statusFila && statusFila !== 'Erro' ? ('andamento' as const) : etapa,
      etapaNome: c.entregaNome,
      fila: statusFila,
      formato: c.formatoNome ?? null,
    };
    });
  } catch (e: any) {
    erro = e?.message ?? 'erro';
  }

  return (
    <Pagina>
      {erro ? <Vazio>Não consegui carregar a esteira do Notion: {erro}</Vazio> : <EsteiraNova cards={cards} hoje={hojeSP()} souLuiza={session.email.trim().toLowerCase() === EMAIL_FEEDBACK_COPY} />}
    </Pagina>
  );
}
