import { NextResponse } from 'next/server';
import { sessaoDaEquipe } from '@/lib/conteudo-acesso';
import { criarPostDoPortal, listarPostsDoPortal, projetoDoPortal } from '@/lib/conteudo-portal';
import { invalidarCachesAposMudanca, posicoesDoNotionNoMes } from '@/lib/notion';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Traz as datas das posições do Notion (ex.: "Novo Post" de dezembro) como
 * pautas vazias no portal. Não mexe no Notion. POST { mes: 'YYYY-MM' }
 */
export async function POST(req: Request, { params }: { params: { projetoId: string } }) {
  const quem = await sessaoDaEquipe();
  if (!quem) return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  const projeto = await projetoDoPortal(params.projetoId);
  if (!projeto) return NextResponse.json({ error: 'esse projeto não roda no portal' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const m = String(body?.mes ?? '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return NextResponse.json({ error: 'mês inválido' }, { status: 400 });
  const [ano, mes] = [Number(m[1]), Number(m[2])];
  try {
    const inicio = `${m[1]}-${m[2]}-01`;
    const fim = new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
    const jaTem = new Set((await listarPostsDoPortal({ projetoIds: [projeto.projetoId], inicio, fim })).map((p) => p.dataPostagem));
    const posicoes = (await posicoesDoNotionNoMes(projeto.projetoId, ano, mes)).filter(
      (p) => p.data >= projeto.desde && !jaTem.has(p.data),
    );
    for (const p of posicoes) {
      await criarPostDoPortal(
        projeto.projetoId,
        {
          titulo: /^novo post$/i.test(p.titulo.trim()) ? 'Nova pauta' : p.titulo,
          dataPostagem: p.data,
          formato: p.formatoNome,
        },
        quem.email,
      );
    }
    invalidarCachesAposMudanca();
    return NextResponse.json({ ok: true, criadas: posicoes.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'erro' }, { status: 500 });
  }
}
