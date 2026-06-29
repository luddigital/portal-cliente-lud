import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { getColaboradorByEmail } from '@/lib/notion';
import { salvarRelatorioNotas } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Salva os blocos editáveis do relatório (funcionou / não funcionou / plano).
 * Só admin e colaborador da Lud. podem escrever — cliente final é read-only.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  }

  const ehAdmin = env.auth.adminEmails.includes(session.email.trim().toLowerCase());
  let ehColaborador = !!session.colaboradorId;
  if (!ehColaborador && !ehAdmin) {
    // Fallback: sessão velha pode não ter colaboradorId — checa Notion
    try {
      const colab = await getColaboradorByEmail(session.email);
      ehColaborador = !!colab;
    } catch {
      /* mantém false */
    }
  }
  if (!ehAdmin && !ehColaborador) {
    return NextResponse.json(
      { error: 'só equipe Lud. pode editar o relatório' },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    projetoId?: string;
    inicio?: string;
    fim?: string;
    funcionou?: string;
    naoFuncionou?: string;
    plano?: string;
  };

  const projetoId = (body.projetoId ?? '').trim();
  const inicio = (body.inicio ?? '').trim();
  const fim = (body.fim ?? '').trim();
  if (!projetoId || !/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fim)) {
    return NextResponse.json(
      { error: 'projetoId/inicio/fim obrigatórios (data ISO YYYY-MM-DD)' },
      { status: 400 },
    );
  }

  try {
    await salvarRelatorioNotas(
      projetoId,
      inicio,
      fim,
      {
        funcionou: (body.funcionou ?? '').slice(0, 5000),
        naoFuncionou: (body.naoFuncionou ?? '').slice(0, 5000),
        plano: (body.plano ?? '').slice(0, 5000),
      },
      session.email,
    );
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[relatorio/notas] erro:', err);
    return NextResponse.json(
      { error: err?.message ?? 'erro ao salvar' },
      { status: 500 },
    );
  }
}
