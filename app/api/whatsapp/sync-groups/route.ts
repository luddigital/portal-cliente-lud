/**
 * Sincroniza a lista de grupos do WhatsApp com o banco.
 * Operação admin: chama a Evolution, faz upsert dos grupos.
 *
 * Por segurança: novos grupos entram como `ativo = false`. A Luiza ativa
 * manualmente os que devem aparecer no Portal (evita "vazar" grupo pessoal
 * por engano).
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { listarGruposWhatsApp } from '@/lib/whatsapp';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
    grupos = await listarGruposWhatsApp();
  } catch (e: any) {
    console.error('[sync-groups] Evolution falhou:', e?.message);
    return NextResponse.json({ error: 'evolution_falhou' }, { status: 502 });
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
          nome: g.subject ?? '(sem nome)',
          foto_url: g.pictureUrl ?? null,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', g.id);
      atualizados++;
    } else {
      await sb.from('whatsapp_grupos').insert({
        id: g.id,
        nome: g.subject ?? '(sem nome)',
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
