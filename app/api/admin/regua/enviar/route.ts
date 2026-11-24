import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { concluirTarefa, invalidarCachesAposMudanca } from '@/lib/notion';
import { garantirUmDiaDePrazo } from '@/lib/prazo-envio';
import { getGrupoWhatsappDoProjeto, supabaseAdmin } from '@/lib/supabase';
import { enviarMensagemTexto, zapiConfigured } from '@/lib/zapi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Item = {
  projetoId: string;
  ciclo: string;
  momento: string;
  variante: string | null;
  texto: string;
  postIds: string[];
  /** Só no envio de quinta: tarefas "Enviar Post Aprovação" a concluir. */
  tarefasEnvio?: string[];
  /** Grupo escolhido (se o projeto tiver mais de um); padrão = principal. */
  grupoId?: string | null;
};

/** Envia a fila da Régua. Sempre no GRUPO do cliente, nunca no privado. */
export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  const email = session.email.trim().toLowerCase();
  if (!env.auth.adminEmails.includes(email)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }
  if (!zapiConfigured()) {
    return NextResponse.json({ error: 'Z-API não configurado.' }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as { itens?: Item[] };
  const itens = (body.itens ?? []).filter(
    (i) => i && i.projetoId && i.ciclo && i.momento && typeof i.texto === 'string' && i.texto.trim(),
  );
  if (itens.length === 0) {
    return NextResponse.json({ error: 'nada pra enviar' }, { status: 400 });
  }

  const sb = await supabaseAdmin();
  const resultados: { projetoId: string; ok: boolean; erro?: string }[] = [];

  for (const item of itens) {
    const grupo = await getGrupoWhatsappDoProjeto(item.projetoId, item.grupoId ?? null);
    if (!grupo?.id) {
      resultados.push({ projetoId: item.projetoId, ok: false, erro: 'sem grupo vinculado' });
      continue;
    }
    const r = await enviarMensagemTexto(grupo.id, item.texto.trim().slice(0, 4000));
    if (!r.ok) {
      resultados.push({ projetoId: item.projetoId, ok: false, erro: r.erro });
      continue;
    }
    await sb.from('regua_envios').insert({
      projeto_id: item.projetoId,
      ciclo: item.ciclo,
      momento: item.momento,
      variante: item.variante,
      texto: item.texto.trim(),
      post_ids: item.postIds ?? [],
      grupo_id: grupo.id,
      message_id: r.messageId ?? null,
      enviado_por: email,
    });

    let erroNotion: string | undefined;
    // Lote da semana e envio separado concluem "Enviar Post Aprovação".
    if ((item.momento === 'quinta' || item.momento === 'separado') && item.tarefasEnvio?.length) {
      const falhas = await Promise.all(
        item.tarefasEnvio.map((id) => concluirTarefa(id).then(() => null, (e) => e?.message ?? 'erro')),
      );
      if (falhas.some(Boolean)) erroNotion = 'enviado, mas não consegui concluir todas as tarefas no Notion';
    }
    // Quem recebe hoje tem pelo menos até amanhã pra aprovar.
    if (['quinta', 'separado', 'reaprovacao'].includes(item.momento)) await garantirUmDiaDePrazo(item.postIds ?? []);
    resultados.push({ projetoId: item.projetoId, ok: true, erro: erroNotion });
  }

  // Páginas de entrega e da régua leem as tarefas com cache: enviado sai da lista na hora.
  invalidarCachesAposMudanca();
  return NextResponse.json({ resultados });
}
