import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import {
  getColaboradorByEmail,
  listAllProjetos,
  listEntregas,
  listPostsDoMes,
  type EntregaItem,
} from '@/lib/notion';
import { classificarProjeto } from '@/lib/projetoServico';
import { lerObjetivosSemanaBatch } from '@/lib/supabase';
import { GestaoView } from './GestaoView';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SERVICOS_SOCIAL = new Set(['Instagram', 'TikTok', 'Stories']);

export default async function GestaoPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  // Só equipe interna (admin OU colaborador)
  const ehAdmin = env.auth.adminEmails.includes(session.email.trim().toLowerCase());
  let ehColaborador = !!session.colaboradorId;
  if (!ehColaborador && !ehAdmin) {
    try {
      const colab = await getColaboradorByEmail(session.email);
      ehColaborador = !!colab;
    } catch {
      /* mantém false */
    }
  }
  if (!ehAdmin && !ehColaborador) redirect('/');

  // Projetos ativos de social media (o resto — tráfego, sites — não entra
  // nessa visão semanal).
  const todos = await listAllProjetos();
  const projetos = todos.filter((p) =>
    SERVICOS_SOCIAL.has(classificarProjeto(p.nome)),
  );
  const projetoIds = projetos.map((p) => p.id);

  // Postagens de HOJE em todos os projetos (agrega o mês do current e filtra).
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;
  const isoHoje = hoje.toISOString().slice(0, 10);

  const [postsDoMes, objetivos, entregas] = await Promise.all([
    projetoIds.length > 0
      ? listPostsDoMes(projetoIds, ano, mes)
      : Promise.resolve([]),
    lerObjetivosSemanaBatch(projetoIds),
    listEntregas().catch(() => [] as EntregaItem[]),
  ]);

  const postsHoje = postsDoMes.filter((p) => p.data === isoHoje);

  // Fatias: entregas com pelo menos 1 tarefa atrasada, e entregas cuja
  // próxima data cai nos próximos 7 dias (planning da semana).
  function proximaISO(e: EntregaItem): string | null {
    if (!e.proximaData) return null;
    const m = e.proximaData.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!m) return null;
    return `${m[3]}-${m[2]}-${m[1]}`;
  }
  const entregasAtrasadas = entregas.filter((e) => e.atrasadas > 0).slice(0, 10);
  const emUmaSemanaMs = Date.now() + 7 * 86_400_000;
  const emUmaSemanaISO = new Date(emUmaSemanaMs).toISOString().slice(0, 10);
  const entregasSemana = entregas
    .filter((e) => {
      const iso = proximaISO(e);
      return iso !== null && iso >= isoHoje && iso <= emUmaSemanaISO;
    })
    .slice(0, 12);

  return (
    <GestaoView
      projetos={projetos}
      postsHoje={postsHoje}
      objetivosIniciais={objetivos}
      entregasAtrasadas={entregasAtrasadas}
      entregasSemana={entregasSemana}
      podeEditar={ehAdmin || ehColaborador}
    />
  );
}
