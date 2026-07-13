import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import {
  getColaboradorByEmail,
  listAllProjetos,
  listPostsDoMes,
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

  const [postsDoMes, objetivos] = await Promise.all([
    projetoIds.length > 0
      ? listPostsDoMes(projetoIds, ano, mes)
      : Promise.resolve([]),
    lerObjetivosSemanaBatch(projetoIds),
  ]);

  const postsHoje = postsDoMes.filter((p) => p.data === isoHoje);

  return (
    <GestaoView
      projetos={projetos}
      postsHoje={postsHoje}
      objetivosIniciais={objetivos}
      podeEditar={ehAdmin || ehColaborador}
    />
  );
}
