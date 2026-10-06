/**
 * Sincroniza a lista de grupos do WhatsApp (via Z-API) com o banco.
 * Operação admin: faz upsert dos grupos vindos do Z-API.
 *
 * Por segurança: novos grupos entram como `ativo = false`. A Luiza ativa
 * manualmente os que devem aparecer no Portal (evita "vazar" grupo pessoal
 * por engano).
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { listarGruposZapi } from '@/lib/zapi';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let grupos;
  try {
    grupos = await listarGruposZapi();
  } catch (e: any) {
    console.error('[sync-groups] Z-API falhou:', e?.message);
    return NextResponse.json(
      { error: `zapi_falhou: ${e?.message ?? 'erro desconhecido'}` },
      { status: 502 },
    );
  }

  const sb = await supabaseAdmin();
  let novos = 0;
  let atualizados = 0;

  for (const g of grupos) {
    const { data: existente } = await sb
      .from('whatsapp_grupos')
      .select('id')
      .eq('id', g.id)
      .maybeSingle();

    if (existente) {
      await sb
        .from('whatsapp_grupos')
        .update({
          nome: g.name ?? '(sem nome)',
          foto_url: g.pictureUrl ?? null,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', g.id);
      atualizados++;
    } else {
      await sb.from('whatsapp_grupos').insert({
        id: g.id,
        nome: g.name ?? '(sem nome)',
        foto_url: g.pictureUrl ?? null,
        ativo: false, // padrão seguro
      });
      novos++;
    }
  }

  return NextResponse.json({
    ok: true,
    total: grupos.length,
    novos,
    atualizados,
  });
}
