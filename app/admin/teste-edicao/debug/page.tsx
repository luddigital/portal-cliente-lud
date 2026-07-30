import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Diagnóstico do sandbox — mostra o tipo e conteúdo das props Funil,
 *  Objetivo e Formato pra descobrir por que os selects estão vazios. */
export default async function DebugPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const ehAdmin = env.auth.adminEmails.includes(session.email.trim().toLowerCase());
  if (!ehAdmin) redirect('/');

  const info = await diagnosticar();

  return (
    <div className="min-h-screen bg-bg pb-16">
      <header className="border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="mx-auto max-w-3xl px-6 py-4">
          <Link href="/admin/teste-edicao" className="text-[11px] text-mauve hover:text-ink">
            ← Sandbox
          </Link>
          <h1 className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-ink">
            🔍 Diagnóstico Notion — props do post
          </h1>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="card p-5">
          <pre className="text-[11px] leading-[1.5] font-mono whitespace-pre-wrap text-ink">
{JSON.stringify(info, null, 2)}
          </pre>
        </div>
      </main>
    </div>
  );
}

async function diagnosticar() {
  const { Client } = await import('@notionhq/client');
  const notion = new Client({ auth: env.notion.token });

  const out: any = {
    postagensDbId: env.notion.postagensDbId,
    props: {},
    erros: [],
  };

  try {
    const db: any = await notion.databases.retrieve({
      database_id: env.notion.postagensDbId,
    });

    for (const propNome of ['Formato', 'Funil', 'Objetivo']) {
      const prop = db.properties?.[propNome];
      if (!prop) {
        out.props[propNome] = { encontrado: false };
        continue;
      }
      const propInfo: any = { encontrado: true, tipo: prop.type };

      if (prop.type === 'select') {
        propInfo.options = (prop.select?.options ?? []).map((o: any) => o.name);
      } else if (prop.type === 'status') {
        propInfo.options = (prop.status?.options ?? []).map((o: any) => o.name);
      } else if (prop.type === 'relation') {
        propInfo.targetDbId = prop.relation.database_id;
        try {
          const alvo: any = await notion.databases.retrieve({
            database_id: prop.relation.database_id,
          });
          const titleProp = Object.entries(alvo.properties).find(
            ([, p]: [string, any]) => p.type === 'title',
          )?.[0];
          propInfo.targetTitleProp = titleProp;
          propInfo.targetTitle = alvo.title?.[0]?.plain_text ?? '(sem título)';

          const q = await notion.databases.query({
            database_id: prop.relation.database_id,
            page_size: 100,
          });
          propInfo.paginasNoDbAlvo = q.results.length;
          propInfo.exemplosPaginas = (q.results as any[]).slice(0, 5).map((p) => {
            const t = Object.values(p.properties).find((x: any) => x.type === 'title') as any;
            const texto = (t?.title ?? []).map((r: any) => r.plain_text).join('') || '(sem nome)';
            return { id: p.id, nome: texto, archived: p.archived };
          });
        } catch (err: any) {
          propInfo.erroAoAcessarAlvo = err?.message ?? String(err);
        }
      }
      out.props[propNome] = propInfo;
    }
  } catch (err: any) {
    out.erros.push(err?.message ?? String(err));
  }

  return out;
}
