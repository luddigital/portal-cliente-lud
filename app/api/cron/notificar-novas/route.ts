import { fetchDoNotion } from '@/lib/notionFetch';
import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import {
  TAREFAS_CATEGORIAS,
  categoriaDaTarefa,
  CATEGORIA_LABEL,
  findProjetosByEmail,
  getNomeDoCliente,
  invalidarCachesAposMudanca,
  semTarefasDePost,
} from '@/lib/notion';
import { sendAvisoTarefas } from '@/lib/mail';
import { sendPush } from '@/lib/push';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const notion = new Client({ auth: env.notion.token, fetch: fetchDoNotion as any });

/**
 * Cron de notificação: varre tarefas que ficaram disponíveis pro cliente
 * (Pronto=true, status aberto, sem "Notificado em") e dispara email + push.
 *
 * Chamado por cron externo (cron-job.org) com header Authorization:Bearer <secret>.
 * Sem CRON_SECRET configurado, aceita sem auth (pra desenvolvimento).
 */
export async function GET(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (process.env.CRON_SECRET && auth !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const STATUS_FECHADOS = ['Concluído', 'Cancelado', 'Reprovado', 'Excluída'];
  const matchers = Object.values(TAREFAS_CATEGORIAS).flat();

  // 1. Query: tarefas Cliente, status aberto, ainda sem "Notificado em"
  const tarefasCandidatas: any[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.databases.query(semTarefasDePost({
      database_id: env.notion.tarefasDbId,
      start_cursor: cursor,
      filter: {
        and: [
          {
            or: matchers.map((m: any) => ({
              property: 'Tarefa',
              title: { [m.type]: m.value } as any,
            })),
          },
          ...STATUS_FECHADOS.map((s) => ({
            property: 'Status',
            status: { does_not_equal: s },
          })),
          {
            property: 'Notificado em',
            date: { is_empty: true },
          },
        ],
      },
    }));
    for (const t of res.results as any[]) {
      // Filtra pra os que estão Pronto=true
      const prontoProp = t.properties[' Pronto'];
      const pronto =
        prontoProp?.formula?.type === 'boolean' &&
        prontoProp.formula.boolean === true;
      if (pronto) tarefasCandidatas.push(t);
    }
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);

  // 2. Agrupa por projeto pra evitar disparar 5 emails pro mesmo cliente
  const porProjeto = new Map<string, { titulo: string; categoria: string; postId: string }[]>();
  for (const t of tarefasCandidatas) {
    const projRel = t.properties.Projeto?.relation ?? [];
    const projId = projRel[0]?.id;
    if (!projId) continue;
    const tt = Object.values(t.properties).find((p: any) => p.type === 'title') as any;
    const titulo = tt?.title?.map((x: any) => x.plain_text).join('') ?? '';
    const cat = categoriaDaTarefa(titulo);
    if (!cat) continue;
    const postRel = t.properties.Post?.relation ?? [];
    const item = {
      titulo,
      categoria: cat as string,
      postId: postRel[0]?.id ?? '',
    };
    if (!porProjeto.has(projId)) porProjeto.set(projId, []);
    porProjeto.get(projId)!.push(item);
  }

  // 3. Pra cada projeto, descobre o cliente via banco Clientes (busca quem tem esse projeto)
  const clientesDb = await notion.databases.query(semTarefasDePost({
    database_id: env.notion.clientesDbId,
    page_size: 100,
    filter: { property: 'Status', status: { equals: 'Ativo' } },
  }));
  // Map: projetoId → email
  const projetoParaEmail = new Map<string, string>();
  for (const c of clientesDb.results as any[]) {
    const email = c.properties?.[env.notion.clienteProps.email]?.email;
    if (!email) continue;
    const projs = c.properties?.[env.notion.clienteProps.projetos]?.relation ?? [];
    for (const p of projs) {
      if (!projetoParaEmail.has(p.id)) projetoParaEmail.set(p.id, email);
    }
  }

  // 4. Agrupa as tarefas por email (caso 1 cliente tenha múltiplos projetos)
  const porEmail = new Map<string, { titulo: string; categoria: string; postId: string }[]>();
  const tarefaIdsPorEmail = new Map<string, string[]>();
  for (const [projetoId, items] of porProjeto) {
    const email = projetoParaEmail.get(projetoId);
    if (!email) continue;
    if (!porEmail.has(email)) {
      porEmail.set(email, []);
      tarefaIdsPorEmail.set(email, []);
    }
    porEmail.get(email)!.push(...items);
  }
  // Atribui ids reais por email pra marcar depois
  for (const t of tarefasCandidatas) {
    const projRel = t.properties.Projeto?.relation ?? [];
    const projId = projRel[0]?.id;
    if (!projId) continue;
    const email = projetoParaEmail.get(projId);
    if (!email) continue;
    if (!tarefaIdsPorEmail.has(email)) tarefaIdsPorEmail.set(email, []);
    tarefaIdsPorEmail.get(email)!.push(t.id);
  }

  // 5. Dispara notificação pra cada cliente + marca tarefas como "Notificado em" agora
  const portalUrl = env.app.url;
  const agoraIso = new Date().toISOString();
  const resultados: any[] = [];

  for (const [email, items] of porEmail) {
    try {
      const projetos = await findProjetosByEmail(email);
      if (projetos.length === 0) {
        resultados.push({ email, ok: false, motivo: 'sem projetos' });
        continue;
      }
      // Conta por categoria pra montar mensagem
      const counts = new Map<string, number>();
      for (const it of items) {
        counts.set(it.categoria, (counts.get(it.categoria) ?? 0) + 1);
      }
      const categorias = [...counts.entries()].map(([cat, count]) => ({
        label: (CATEGORIA_LABEL as any)[cat]?.descPlur ?? `${count} tarefas`,
        count,
      }));
      const total = items.length;
      const nomeCompleto = (await getNomeDoCliente(email)) ?? 'cliente';
      const primeiroNome = nomeCompleto.split(/\s+/)[0] || 'cliente';

      await Promise.all([
        sendAvisoTarefas({ to: email, nome: primeiroNome, categorias, portalUrl }),
        sendPush(email, {
          title: `Oi ${primeiroNome}! Tem coisinha esperando`,
          body: categorias.map((c) => `${c.count} ${c.label}`).join(' · '),
          url: portalUrl,
          tag: 'notificar-novas',
        }).catch(() => ({ enviados: 0, falhas: 0 })),
      ]);

      // Marca todas tarefas como notificadas
      const ids = tarefaIdsPorEmail.get(email) ?? [];
      await Promise.all(
        ids.map((tid) =>
          notion.pages.update({
            page_id: tid,
            properties: {
              'Notificado em': { date: { start: agoraIso, time_zone: 'America/Sao_Paulo' } },
            },
          }).catch((e) => console.warn('[notificar] falhou marcar', tid, e?.message)),
        ),
      );

      resultados.push({ email, ok: true, total, marcadas: ids.length });
    } catch (err: any) {
      resultados.push({ email, ok: false, motivo: err?.message });
    }
  }

  if (resultados.some((r) => r.ok)) invalidarCachesAposMudanca();

  return NextResponse.json({
    totalTarefasNovas: tarefasCandidatas.length,
    clientesNotificados: resultados.filter((r) => r.ok).length,
    resultados,
  });
}
