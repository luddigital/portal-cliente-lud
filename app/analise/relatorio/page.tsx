import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { getIgAnalyticsDoProjeto, igConfigured } from '@/lib/instagram';
import { getProjetoNome } from '@/lib/notion';
import { Relatorio } from './Relatorio';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function diasAtrasMs(dias: number): number {
  return Date.now() - dias * 86_400_000;
}

function parseDataLocalMs(iso: string, fim = false): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, fim ? 23 : 0, fim ? 59 : 0, 0).getTime();
}

export default async function RelatorioPage({
  searchParams,
}: {
  searchParams: { projetoId?: string; inicio?: string; fim?: string };
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const projetoId = (searchParams.projetoId ?? '').trim();
  if (!projetoId) notFound();

  const ehAdmin = env.auth.adminEmails.includes(session.email.trim().toLowerCase());
  if (!ehAdmin && !session.projetoIds.includes(projetoId)) notFound();
  if (!igConfigured() || !env.instagram.accounts[projetoId]) notFound();

  // Janela: usa inicio/fim se vier, senão últimos 30 dias.
  const fimMs = searchParams.fim ? parseDataLocalMs(searchParams.fim, true) : Date.now();
  const inicioMs = searchParams.inicio
    ? parseDataLocalMs(searchParams.inicio)
    : diasAtrasMs(30);

  const [analytics, projetoNome] = await Promise.all([
    getIgAnalyticsDoProjeto(projetoId, inicioMs, fimMs),
    getProjetoNome(projetoId),
  ]);

  if (!analytics) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-[18px] font-semibold text-ink">
          Não foi possível carregar os dados.
        </h1>
        <p className="mt-2 text-[13px] text-t2">
          O Instagram desse projeto pode não estar conectado, ou houve uma falha
          temporária na Graph API. Tenta de novo em alguns segundos.
        </p>
      </main>
    );
  }

  return <Relatorio analytics={analytics} projetoNome={projetoNome ?? 'Projeto'} />;
}
