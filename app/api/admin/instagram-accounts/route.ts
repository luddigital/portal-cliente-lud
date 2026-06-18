import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { listIgAccounts, igConfigured } from '@/lib/instagram';
import { listAllProjetos } from '@/lib/notion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Lista todas as contas IG acessíveis pelo token + sugere mapeamento com
 * projetos do Notion pelo @username. Útil pra montar o IG_ACCOUNTS (JSON
 * projetoId → igUserId) na 1ª configuração.
 */
export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'login' }, { status: 401 });
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }
  if (!igConfigured()) {
    return NextResponse.json(
      { error: 'IG_GRAPH_TOKEN não configurado' },
      { status: 400 },
    );
  }

  try {
    const [accounts, projetos] = await Promise.all([
      listIgAccounts(),
      listAllProjetos(),
    ]);

    // Heurística: nome do projeto começa com 'IG | @x' → tenta achar
    // conta @x dentro de accounts.
    const sugestoes: {
      projetoId: string;
      projetoNome: string;
      clienteNome: string;
      sugeridoIgUserId: string | null;
      sugeridoUsername: string | null;
    }[] = [];
    for (const p of projetos) {
      const m = p.nome.match(/^ig\s*\|\s*@?([\w.]+)/i);
      const u = m?.[1]?.toLowerCase() ?? null;
      const conta = u
        ? accounts.find((a) => a.username.toLowerCase() === u)
        : null;
      if (u) {
        sugestoes.push({
          projetoId: p.id,
          projetoNome: p.nome,
          clienteNome: p.clienteNome,
          sugeridoIgUserId: conta?.igUserId ?? null,
          sugeridoUsername: conta?.username ?? null,
        });
      }
    }

    // Monta o JSON pronto pra colar no IG_ACCOUNTS
    const mapaPronto: Record<string, string> = {};
    for (const s of sugestoes) {
      if (s.sugeridoIgUserId) mapaPronto[s.projetoId] = s.sugeridoIgUserId;
    }

    return NextResponse.json({
      contasAcessiveis: accounts.map((a) => ({
        username: a.username,
        igUserId: a.igUserId,
        followers: a.followersCount,
        pageName: a.pageName,
      })),
      projetosIG: sugestoes,
      naoMapeados: sugestoes.filter((s) => !s.sugeridoIgUserId),
      mapaPronto,
      mapaProntoJSON: JSON.stringify(mapaPronto),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'erro inesperado' },
      { status: 500 },
    );
  }
}
