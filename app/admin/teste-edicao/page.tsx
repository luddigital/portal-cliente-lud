import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import {
  garantirOpcoesProp,
  getPostComDetalhes,
  listAllProjetos,
  listOpcoesRelation,
  listOpcoesSelect,
  listPostsNoIntervalo,
} from '@/lib/notion';
import { supabaseAdmin } from '@/lib/supabase';
import { ConstrucaoModal } from './ConstrucaoModal';
import { LandingCalendario } from './LandingCalendario';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Sandbox: landing sempre renderiza; se ?postId=X, abre o modal de
 *  construção por cima, mantendo o calendário atrás. */
export default async function TesteEdicaoPage({
  searchParams,
}: {
  searchParams: {
    postId?: string;
    clienteId?: string;
    projetoId?: string;
    mes?: string;
  };
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  const ehAdmin = env.auth.adminEmails.includes(session.email.trim().toLowerCase());
  if (!ehAdmin) redirect('/');

  const postId = (searchParams.postId ?? '').trim();

  // ─────────── Sempre carrega os dados do calendário ───────────
  const hoje = new Date();
  const hojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

  let ano = hoje.getFullYear();
  let mes = hoje.getMonth(); // 0-11
  const mesParam = (searchParams.mes ?? '').match(/^(\d{4})-(\d{2})$/);
  if (mesParam) {
    ano = parseInt(mesParam[1], 10);
    mes = parseInt(mesParam[2], 10) - 1;
  }

  const projetos = await listAllProjetos().catch(() => []);
  const clienteIdSel = searchParams.clienteId?.trim() || null;
  const projetosDoCliente = projetos.filter((p) => p.clienteId === clienteIdSel);
  const projetoIdSel =
    (searchParams.projetoId?.trim() || null) ??
    (projetosDoCliente.length === 1 ? projetosDoCliente[0].id : null);

  let postsChips: {
    id: string; projetoId: string; data: string; titulo: string;
    cor: 'publicado' | 'agendado' | 'aprovacao' | 'alteracao' | 'aguardando' | 'rascunho';
  }[] = [];
  if (projetoIdSel) {
    const inicio = `${ano}-${String(mes + 1).padStart(2, '0')}-01`;
    const fim = new Date(ano, mes + 1, 0);
    const fimISO = `${fim.getFullYear()}-${String(fim.getMonth() + 1).padStart(2, '0')}-${String(fim.getDate()).padStart(2, '0')}`;

    const posts = await listPostsNoIntervalo(inicio, fimISO).catch(() => []);
    postsChips = posts
      .filter((p) => p.projetoId === projetoIdSel)
      .map((p) => ({
        id: p.id,
        projetoId: p.projetoId,
        data: p.data,
        titulo: p.titulo,
        cor: p.cor,
      }));
  }

  const landing = (
    <LandingCalendario
      projetos={projetos.map((p) => ({
        id: p.id,
        nome: p.nome,
        clienteId: p.clienteId,
        clienteNome: p.clienteNome,
      }))}
      posts={postsChips}
      ano={ano}
      mes={mes}
      clienteId={clienteIdSel}
      projetoId={projetoIdSel}
      hojeISO={hojeISO}
    />
  );

  // Sem postId → só landing
  if (!postId) return landing;

  // ─────────── Com postId → landing + modal de construção ───────────
  const bruto = postId.trim().replace(/^["']|["']$/g, '');
  const idLimpo = bruto.replace(/-/g, '').match(/[a-f0-9]{32}/i)?.[0];
  if (!idLimpo) {
    return (
      <>
        {landing}
        <ErroModal
          titulo="ID inválido"
          detalhe="Não achei um UUID de 32 caracteres hex nesse valor."
          idTentado={bruto}
        />
      </>
    );
  }
  const idFinal = `${idLimpo.slice(0, 8)}-${idLimpo.slice(8, 12)}-${idLimpo.slice(12, 16)}-${idLimpo.slice(16, 20)}-${idLimpo.slice(20)}`;

  let post;
  try {
    post = await getPostComDetalhes(idFinal);
  } catch (err: any) {
    return (
      <>
        {landing}
        <ErroModal
          titulo="Notion rejeitou a leitura"
          detalhe={err?.message ?? 'Erro desconhecido do Notion API'}
          idTentado={idFinal}
        />
      </>
    );
  }

  if (!post) {
    return (
      <>
        {landing}
        <ErroModal
          titulo="Página não encontrada"
          detalhe="Confere se o ID está certo e se a integração Lud. tem acesso à página."
          idTentado={idFinal}
        />
      </>
    );
  }

  // Auto-seed Funil e Objetivo (idempotente — só cria o que faltar)
  await Promise.all([
    garantirOpcoesProp('Funil', ['Topo', 'Meio', 'Fundo']).catch((e) =>
      console.error('[seed funil]', e?.message),
    ),
    garantirOpcoesProp('Objetivo', [
      'Antecipação',
      'Infotenimento',
      'Divulgação',
      'Automação',
      'Autoridade',
      'Utilidade',
      'Engajamento',
      'Awareness',
      'Vendas',
      'Comunidade',
    ]).catch((e) => console.error('[seed objetivo]', e?.message)),
  ]);

  const [rascunho, formatos, funis, objetivos, demandas] = await Promise.all([
    (async () => {
      try {
        const sb = await supabaseAdmin();
        const { data } = await sb
          .from('rascunho_pauta')
          .select('ideia_texto, informacoes_texto, materiais_texto, atualizado_em, publicado_em')
          .eq('post_id', post.id)
          .maybeSingle();
        return data ?? null;
      } catch {
        return null;
      }
    })(),
    listOpcoesRelation('Formato').catch(() => []),
    listOpcoesRelation('Funil').catch(() => []),
    listOpcoesRelation('Objetivo').catch(() => []),
    listOpcoesSelect(env.notion.postProps.demanda).catch(() => []),
  ]);

  return (
    <>
      {landing}
      <ConstrucaoModal
        postId={post.id}
        titulo={post.titulo}
        data={post.data ?? ''}
        projetoNome={post.projetoNome}
        ideia={post.ideiaDoPost ?? ''}
        rascunhoPauta={rascunho}
        formatos={formatos
          .filter((o) => !/direcionamento/i.test(o.nome))
          .map((o) => ({ id: o.id, nome: o.nome }))}
        funis={funis.map((o) => ({ id: o.id, nome: o.nome }))}
        objetivos={objetivos.map((o) => ({ id: o.id, nome: o.nome }))}
        demandas={demandas.map((o) => ({ nome: o.nome, cor: o.cor ?? null }))}
        formatoIdAtual={post.formato[0]?.id ?? null}
        funilIdAtual={post.funil[0]?.id ?? null}
        objetivoIdAtual={post.objetivo[0]?.id ?? null}
        demandaAtual={post.demanda}
      />
    </>
  );
}

function ErroModal({
  titulo,
  detalhe,
  idTentado,
}: {
  titulo: string;
  detalhe: string;
  idTentado: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center py-16 px-3"
      style={{ background: 'rgba(21,21,33,0.45)' }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
        <h1 className="text-[18px] font-semibold text-ink">{titulo}</h1>
        <p className="mt-2 text-[13px] leading-[1.55] text-t2">{detalhe}</p>
        <p className="mt-4 text-[11px] text-t3">
          Valor recebido:{' '}
          <code className="rounded bg-bgSoft px-1.5 py-0.5 text-[11px] break-all">
            {idTentado || '(vazio)'}
          </code>
        </p>
        <Link
          href="/admin/teste-edicao"
          className="mt-5 inline-block text-[13px] font-medium text-mauve hover:text-ink"
        >
          ← fechar
        </Link>
      </div>
    </div>
  );
}
