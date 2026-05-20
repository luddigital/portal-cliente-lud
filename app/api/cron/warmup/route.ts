import { NextResponse } from 'next/server';
import {
  listAllClientes,
  findProjetosByEmail,
  getNomeDoCliente,
  listTarefasPendentesPorCategoria,
  listPostsDoMes,
} from '@/lib/notion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Pré-aquece os caches do Notion. Roda via Vercel Cron a cada 5 min.
 * Quando o cliente acessa, o data cache já tá quente → sub-segundo.
 *
 * Vercel Cron envia header Authorization com o CRON_SECRET; só aceita esse caller.
 */
export async function GET(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (process.env.CRON_SECRET && auth !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const t0 = Date.now();
  const clientes = await listAllClientes();
  const hoje = new Date();
  const year = hoje.getFullYear();
  const month = hoje.getMonth() + 1;

  const resultados = await Promise.all(
    clientes
      .filter((c) => !!c.email)
      .map(async (c) => {
        const email = c.email!;
        try {
          const projetos = await findProjetosByEmail(email);
          const projetoIds = projetos.map((p) => p.id);
          if (projetoIds.length === 0) {
            return { email, ok: true, skipped: 'sem projetos' };
          }
          await Promise.all([
            getNomeDoCliente(email),
            listTarefasPendentesPorCategoria(projetoIds),
            listPostsDoMes(projetoIds, year, month),
          ]);
          return { email, ok: true };
        } catch (err: any) {
          return { email, ok: false, error: err?.message };
        }
      }),
  );

  const okCount = resultados.filter((r) => r.ok).length;
  const ms = Date.now() - t0;
  console.log(`[warmup] ${okCount}/${resultados.length} clientes pré-aquecidos em ${ms}ms`);
  return NextResponse.json({ ms, total: resultados.length, ok: okCount });
}
