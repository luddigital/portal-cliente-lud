import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { salvarProjetoConfig, type ProjetoConfig } from '@/lib/notion';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

/**
 * Salva o objetivo / metas de um projeto na database de config do portal.
 * Só admin.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
    if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
      return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      projetoNome?: string;
      config?: ProjetoConfig;
    };
    if (!body.config) {
      return NextResponse.json({ error: 'config faltando' }, { status: 400 });
    }

    await salvarProjetoConfig(
      params.id,
      body.projetoNome ?? 'Projeto',
      body.config,
    );
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[projeto-config] erro:', err);
    let msg = err?.message ?? 'Erro inesperado';
    if (err?.body) try { msg = JSON.parse(err.body).message ?? msg; } catch {}
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
