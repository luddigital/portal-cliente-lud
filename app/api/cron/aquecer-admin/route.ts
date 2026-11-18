import { NextResponse } from 'next/server';
import { listAllClientes, listAllProjetos, listEntregas, listPostsNoIntervalo, listarTarefasAbertasDeTodos } from '@/lib/notion';
import { carregarEntrega } from '@/lib/entrega-dados';
import { carregarQuadro } from '@/app/admin/entregas/quadro';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Deixa o cache das telas internas pronto (Início, Entregas, cada entrega, Tarefas).
 * O Notion leva de 5 a 20 s por consulta pesada; sem isso, quem abria a página
 * depois de uma mudança (concluir, enviar, Atualizar) esperava a consulta inteira.
 * Roda de 5 em 5 min (vercel.json) e logo depois de cada mudança feita no portal.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  }
  const t0 = Date.now();
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const [y, m] = hoje.split('-').map(Number);
  const fim = `${hoje.slice(0, 8)}${new Date(Date.UTC(y, m, 0)).getUTCDate()}`;
  // Base primeiro (todas as telas usam), depois cada entrega, de 3 em 3 pra não estourar o limite do Notion.
  await Promise.all([
    listarTarefasAbertasDeTodos().catch(() => null),
    listAllProjetos().catch(() => null),
    listAllClientes().catch(() => null),
    listPostsNoIntervalo(hoje.slice(0, 8) + '01', fim).catch(() => null),
  ]);
  const [entregas] = await Promise.all([listEntregas().catch(() => []), carregarQuadro().catch(() => null)]);
  const ids = entregas.map((e) => e.id);
  const erros: string[] = [];
  for (let k = 0; k < ids.length; k += 3) {
    await Promise.all(ids.slice(k, k + 3).map((id) => carregarEntrega(id).catch(() => erros.push(id))));
  }
  const ms = Date.now() - t0;
  console.log(`[aquecer-admin] ${ids.length} entregas em ${ms}ms${erros.length ? ` · ${erros.length} com erro` : ''}`);
  return NextResponse.json({ ms, entregas: ids.length, erros: erros.length });
}
