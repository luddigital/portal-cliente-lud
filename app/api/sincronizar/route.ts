import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { invalidarTudo } from '@/lib/notion';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Botão "Sincronizar com o Notion" da home. Limpa TODOS os caches do portal
 * (tags do Next + memory caches) pra forçar a releitura do estado atual do
 * Notion na hora. Só a equipe (admin ou colaborador) pode disparar.
 *
 * Não escreve nada no Notion — só invalida cache de leitura. Idempotente.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  }
  const ehAdmin = env.auth.adminEmails.includes(
    session.email.trim().toLowerCase(),
  );
  const ehColaborador = !!session.colaboradorId;
  if (!ehAdmin && !ehColaborador) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }

  invalidarTudo();

  return NextResponse.json({ ok: true, em: Date.now() });
}
