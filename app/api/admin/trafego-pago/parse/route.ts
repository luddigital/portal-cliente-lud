import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { parseRelatorio } from '@/lib/csvAds';
import { getProjetoDetalhe } from '@/lib/notion';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

/**
 * Parseia o CSV do Gerenciador da Meta. Opcionalmente, recebe o projetoId
 * e devolve junto o briefing do projeto (objetivo + foco) — pra mostrar
 * o contexto da campanha no dashboard.
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (
      !session ||
      !env.auth.adminEmails.includes(session.email.trim().toLowerCase())
    ) {
      return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
    }
    const form = await req.formData();
    const file = form.get('arquivo');
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Anexe o CSV.' }, { status: 400 });
    }
    const text = await file.text();
    const relatorio = parseRelatorio(text);
    if ('error' in relatorio) {
      return NextResponse.json({ error: relatorio.error }, { status: 400 });
    }

    const projetoId = form.get('projetoId')?.toString() ?? '';
    let projeto: {
      id: string;
      nome: string;
      clienteNome: string | null;
      objetivo: string;
      foco: string[];
    } | null = null;
    if (projetoId) {
      const det = await getProjetoDetalhe(projetoId);
      if (det) {
        projeto = {
          id: det.id,
          nome: det.nome,
          clienteNome: det.clienteNome,
          objetivo: det.config.objetivo,
          foco: det.config.foco,
        };
      }
    }

    return NextResponse.json({ relatorio, projeto });
  } catch (err: any) {
    console.error('[trafego-pago/parse] erro:', err);
    return NextResponse.json(
      { error: err?.message ?? 'Erro inesperado' },
      { status: 500 },
    );
  }
}
