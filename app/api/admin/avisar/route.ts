import { fetchDoNotion } from '@/lib/notionFetch';
import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { getSession } from '@/lib/auth';
import {
  findProjetosByEmail,
  getNomeDoCliente,
  listTarefasPendentesPorCategoria,
  CATEGORIA_LABEL,
} from '@/lib/notion';
import { sendAvisoTarefas } from '@/lib/mail';
import { sendPush } from '@/lib/push';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Resultado = {
  email: string;
  nome: string | null;
  enviado: boolean;
  totalTarefas: number;
  motivo?: string;
  pushEnviados?: number;
};

/**
 * Avisa por email os clientes com tarefas pendentes.
 *
 * Body opcional:
 *   { emails: string[] }  → avisa só esses emails (precisam estar cadastrados como cliente)
 *   {}                    → varre todos os clientes do banco e avisa quem tem tarefa pendente
 *
 * Apenas usuários listados em ADMIN_EMAILS podem chamar.
 */
export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: 'sem permissão (admin only)' }, { status: 403 });
  }

  let body: { emails?: string[] } = {};
  try {
    body = (await req.json().catch(() => ({}))) as any;
  } catch {}

  const emailsAlvo: string[] = await (async () => {
    if (Array.isArray(body.emails) && body.emails.length > 0) {
      return body.emails.map((e) => e.trim().toLowerCase());
    }
    // Sem lista: pega todos clientes do banco
    const notion = new Client({ auth: env.notion.token, fetch: fetchDoNotion as any });
    const out: string[] = [];
    let cursor: string | undefined;
    do {
      const res = await notion.databases.query({
        database_id: env.notion.clientesDbId,
        start_cursor: cursor,
        page_size: 100,
      });
      for (const p of res.results as any[]) {
        const e = p.properties?.[env.notion.clienteProps.email]?.email;
        if (e) out.push(e.trim().toLowerCase());
      }
      cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
    } while (cursor);
    return [...new Set(out)];
  })();

  const portalUrl = env.app.url;
  const resultados: Resultado[] = [];

  for (const email of emailsAlvo) {
    try {
      const projetos = await findProjetosByEmail(email);
      if (projetos.length === 0) {
        resultados.push({ email, nome: null, enviado: false, totalTarefas: 0, motivo: 'sem projetos vinculados' });
        continue;
      }
      const tarefasPorCat = await listTarefasPendentesPorCategoria(
        projetos.map((p) => p.id),
      );
      const categorias = (Object.keys(tarefasPorCat) as Array<keyof typeof tarefasPorCat>)
        .map((cat) => ({
          label: CATEGORIA_LABEL[cat].descPlur,
          count: tarefasPorCat[cat].length,
        }))
        .filter((c) => c.count > 0);
      const total = categorias.reduce((s, c) => s + c.count, 0);
      if (total === 0) {
        resultados.push({ email, nome: null, enviado: false, totalTarefas: 0, motivo: 'sem tarefas pendentes' });
        continue;
      }
      const nomeCompleto = (await getNomeDoCliente(email)) ?? 'cliente';
      const primeiroNome = nomeCompleto.split(/\s+/)[0] || 'cliente';
      const [, push] = await Promise.all([
        sendAvisoTarefas({ to: email, nome: primeiroNome, categorias, portalUrl }),
        sendPush(email, {
          title: `Oi ${primeiroNome}! Tem coisinha esperando`,
          body: categorias.map((c) => `${c.count} ${c.label}`).join(' · '),
          url: portalUrl,
          tag: 'avisar-tarefas',
        }).catch((e) => {
          console.warn('[avisar] push falhou pra', email, e?.message);
          return { enviados: 0, falhas: 0 };
        }),
      ]);
      resultados.push({
        email,
        nome: primeiroNome,
        enviado: true,
        totalTarefas: total,
        pushEnviados: push.enviados,
      });
    } catch (err: any) {
      resultados.push({
        email,
        nome: null,
        enviado: false,
        totalTarefas: 0,
        motivo: err?.message ?? 'erro',
      });
    }
  }

  const enviados = resultados.filter((r) => r.enviado).length;
  return NextResponse.json({ totalEmails: emailsAlvo.length, enviados, resultados });
}
