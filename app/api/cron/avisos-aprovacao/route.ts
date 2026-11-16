import { NextResponse } from 'next/server';
import { enviarAviso, planejarAvisos } from '@/lib/aviso-aprovacao';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Avisos automáticos de aprovação de post (seg a sex, 9h, 13h e 17h de São Paulo).
 * Só manda de verdade com AVISO_APROVACAO_AUTO=on. Sem isso fica em modo prévia:
 * monta o plano e não envia nada (a equipe manda em /admin/aprovacoes/avisos).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  }
  let plano;
  try {
    plano = await planejarAvisos();
  } catch (err: any) {
    console.warn('[avisos-aprovacao] plano falhou, nada enviado:', err?.message);
    return NextResponse.json({ ok: false, erro: err?.message }, { status: 503 });
  }
  const auto = process.env.AVISO_APROVACAO_AUTO === 'on';
  if (!auto) {
    return NextResponse.json({ ok: true, modo: 'previa', enviariam: plano.enviar.length, parados: plano.parados.length });
  }
  const resultados = [];
  for (const g of plano.enviar) {
    const r = await enviarAviso(g, 'aviso automático');
    if (!r.ok) console.warn('[avisos-aprovacao] falhou', g.projetoNome, r.erro);
    resultados.push({ projeto: g.projetoNome, tipo: g.tipo, posts: g.posts.length, ...r });
  }
  return NextResponse.json({ ok: true, modo: 'automatico', resultados, parados: plano.parados.length });
}
