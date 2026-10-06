import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Listar 3 níveis de pastas em série demora bastante quando tem muitos
// clientes/posts. 5 min cobre com folga.
export const maxDuration = 300;

/**
 * Lista todas as pastas abaixo do root do Drive da Lud. em formato árvore
 * (cliente → post → data). Até 3 níveis. Pra admin escolher o que apagar.
 *
 * GET → { arvore: [{ id, name, parent, depth, hasChildren, size? }] }
 * DELETE { ids: string[] } → apaga as pastas selecionadas (recursivo).
 */

function drive() {
  const auth = new google.auth.OAuth2(env.drive.clientId, env.drive.clientSecret);
  auth.setCredentials({ refresh_token: env.drive.refreshToken });
  return google.drive({ version: 'v3', auth });
}

async function listarFilhos(parentId: string, d: any) {
  const q = `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const res = await d.files.list({
    q,
    fields: 'files(id,name,createdTime,modifiedTime)',
    pageSize: 200,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    orderBy: 'name',
  });
  return res.data.files ?? [];
}

export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }

  const d = drive();
  const arvore: Array<{
    id: string;
    name: string;
    parent: string;
    depth: number;
    createdTime?: string;
    modifiedTime?: string;
  }> = [];

  try {
    // Nível 1: clientes
    const clientes = await listarFilhos(env.drive.rootFolderId, d);
    for (const c of clientes) {
      if (!c.id) continue;
      arvore.push({
        id: c.id,
        name: c.name ?? '(sem nome)',
        parent: env.drive.rootFolderId,
        depth: 1,
        createdTime: c.createdTime ?? undefined,
        modifiedTime: c.modifiedTime ?? undefined,
      });
    }

    // Nível 2: posts (paraleliza por cliente — bem mais rápido com muitos
    // clientes). Limita a 5 clientes simultâneos pra não bater rate limit.
    const nivel1Ids: string[] = clientes
      .filter((c: any) => typeof c.id === 'string')
      .map((c: any) => c.id as string);
    const postsPorCliente = await mapParalelo(nivel1Ids, 5, async (clienteId: string) => {
      const posts = await listarFilhos(clienteId, d);
      return { clienteId, posts };
    });
    for (const { clienteId, posts } of postsPorCliente) {
      for (const p of posts) {
        if (!p.id) continue;
        arvore.push({
          id: p.id,
          name: p.name ?? '(sem nome)',
          parent: clienteId,
          depth: 2,
          createdTime: p.createdTime ?? undefined,
          modifiedTime: p.modifiedTime ?? undefined,
        });
      }
    }

    // Nível 3: datas (paraleliza por post, limite 10).
    const nivel2 = arvore.filter((n) => n.depth === 2);
    const datasPorPost = await mapParalelo(nivel2, 10, async (post) => {
      const datas = await listarFilhos(post.id, d);
      return { postId: post.id, datas };
    });
    for (const { postId, datas } of datasPorPost) {
      for (const dt of datas) {
        if (!dt.id) continue;
        arvore.push({
          id: dt.id,
          name: dt.name ?? '(sem nome)',
          parent: postId,
          depth: 3,
          createdTime: dt.createdTime ?? undefined,
          modifiedTime: dt.modifiedTime ?? undefined,
        });
      }
    }

    return NextResponse.json({ arvore });
  } catch (err: any) {
    console.error('[drive-pastas GET]', err);
    return NextResponse.json(
      {
        error: `Falha listando pastas do Drive: ${err?.message ?? err}`.slice(0, 300),
        arvoreParcial: arvore,
      },
      { status: 500 },
    );
  }
}

/** Executa fn em paralelo até `limite` por vez. */
async function mapParalelo<T, R>(
  items: T[],
  limite: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += limite) {
    const lote = items.slice(i, i + limite);
    const r = await Promise.all(lote.map(fn));
    out.push(...r);
  }
  return out;
}

export async function DELETE(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { ids?: string[] };
  const ids = Array.isArray(body.ids) ? body.ids.filter((s) => typeof s === 'string') : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: 'nenhum id enviado' }, { status: 400 });
  }

  // Segurança: nunca apagar o root.
  if (ids.includes(env.drive.rootFolderId)) {
    return NextResponse.json(
      { error: 'não permitido apagar a pasta raiz' },
      { status: 400 },
    );
  }

  const d = drive();
  const apagados: string[] = [];
  const erros: { id: string; msg: string }[] = [];

  // Move pra lixeira em vez de delete definitivo — permite recuperar via
  // Drive se der merda. Idempotente.
  for (const id of ids) {
    try {
      await d.files.update({
        fileId: id,
        requestBody: { trashed: true },
        supportsAllDrives: true,
      });
      apagados.push(id);
    } catch (err: any) {
      erros.push({ id, msg: String(err?.message ?? err).slice(0, 200) });
    }
  }

  return NextResponse.json({ apagados, erros });
}
