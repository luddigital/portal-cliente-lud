import { NextResponse } from 'next/server';
import { enviarResumos } from '@/lib/resumo-tarde';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Resumo do fim da tarde: seg a sex, 16h de São Paulo. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  try {
    const r = await enviarResumos();
    if (r.erros.length) console.warn('[resumo-tarde]', r.erros);
    return NextResponse.json({ ok: true, ...r });
  } catch (err: any) {
    console.warn('[resumo-tarde] falhou:', err?.message);
    return NextResponse.json({ ok: false, erro: err?.message }, { status: 500 });
  }
}
