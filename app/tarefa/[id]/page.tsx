import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getSession } from '@/lib/auth';
import {
  getTarefaComPost,
  lerBodyDePagina,
  lerSecaoEntre,
  type RelacaoItem,
} from '@/lib/notion';
import { env } from '@/lib/env';
import { TarefaForm } from './form';

export const dynamic = 'force-dynamic';

const ETAPA_INFO: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  'Envio de Conteúdos Prévios': {
    label: 'Informações prévias',
    bg: 'bg-[rgba(186,196,230,0.35)]',
    text: 'text-navy',
  },
  'Materiais para Produção': {
    label: 'Materiais para produção',
    bg: 'bg-[rgba(184,210,234,0.5)]',
    text: 'text-deep',
  },
};

export default async function TarefaPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { from?: string };
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const data = await getTarefaComPost(params.id);
  if (!data) notFound();
  const t = data.tarefa;
  const ehAdmin = env.auth.adminEmails.includes(session.email.trim().toLowerCase());
  if (!t.projetoId || (!ehAdmin && !session.projetoIds.includes(t.projetoId))) {
    notFound();
  }

  // Pra "Materiais para Produção" o briefing fica entre os marcadores no card
  // do Notion. Pra outras categorias mostra o body inteiro como fallback.
  const ehMateriais = t.tarefaTitulo === 'Materiais para Produção';
  const ehPrevias = t.tarefaTitulo === 'Envio de Conteúdos Prévios';
  const bodyPost = ehMateriais
    ? await lerSecaoEntre(
        t.postId,
        'Materiais que precisamos para o post',
        ['Briefing'],
      )
    : ehPrevias
      ? await lerSecaoEntre(t.postId, 'Informações prévias', ['Briefing'])
      : await lerBodyDePagina(t.postId);
  const bodyTarefa = await lerBodyDePagina(t.tarefaId);

  const etapa = ETAPA_INFO[t.tarefaTitulo] ?? {
    label: t.tarefaTitulo,
    bg: 'bg-[rgba(21,21,33,0.06)]',
    text: 'text-ink',
  };
  const prazoStatus = analisarPrazo(t.tarefaPrazo);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="mx-auto flex max-w-3xl lg:max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 text-[13px] text-mauve transition hover:text-ink">
            ← Voltar
          </Link>
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">{t.projetoNome}</div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl lg:max-w-4xl px-6 py-10">
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] ${etapa.bg} ${etapa.text}`}
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
          {etapa.label}
        </span>

        <h1 className="mt-4 text-[26px] font-semibold tracking-[-0.03em] text-ink">{t.postTitulo}</h1>

        <div className="mt-4 grid gap-2 text-[13px] sm:grid-cols-2">
          <div className="card flex items-center justify-between p-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">Data de postagem</span>
            <span className="font-mono text-[12px] text-t1">{fmtData(t.postData)}</span>
          </div>
          <div
            className={`flex items-center justify-between rounded-2xl p-3 ${prazoStatus.cardClass}`}
          >
            <span
              className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${prazoStatus.labelClass}`}
            >
              Prazo de envio
            </span>
            <span className={`font-mono text-[12px] ${prazoStatus.textClass}`}>{prazoStatus.label}</span>
          </div>
        </div>

        {(t.formato.length > 0 || t.funil.length > 0 || t.objetivo.length > 0) && (
          <dl className="mt-4 card divide-y divide-[rgba(21,21,33,0.06)] overflow-hidden">
            {t.formato.length > 0 && (
              <DetalheRow label="Formato" itens={t.formato} />
            )}
            {t.funil.length > 0 && <DetalheRow label="Funil" itens={t.funil} />}
            {t.objetivo.length > 0 && (
              <DetalheRow label="Objetivo" itens={t.objetivo} />
            )}
          </dl>
        )}

        <p className="mt-6 whitespace-pre-line text-[14px] leading-[1.6] text-mauve">
          {copyDaTarefa(t.tarefaTitulo)}
        </p>

        {bodyTarefa && (
          <div className="mt-6 card p-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
              O que a equipe precisa de você
            </div>
            <p className="mt-3 whitespace-pre-line text-[14px] leading-[1.6] text-ink">
              {bodyTarefa}
            </p>
          </div>
        )}

        {bodyPost && (
          <div className="mt-4 card p-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
              Sobre esse post
            </div>
            <p className="mt-3 whitespace-pre-line text-[14px] leading-[1.6] text-ink">
              {bodyPost}
            </p>
          </div>
        )}

        <div className="mt-8">
          <TarefaForm
            tarefaId={t.tarefaId}
            voltarPara={searchParams.from ? `/etapa/${searchParams.from}` : '/'}
            {...(ehMateriais
              ? {
                  mostrarTexto: false,
                  aceitarComentario: true,
                  aceitarLink: true,
                  permitirGravarVoz: true,
                  tituloUpload: 'Fotos, vídeos e áudios',
                  ajudaUpload: 'Quantos arquivos quiser. Se precisar de um áudio, dá pra gravar aqui mesmo.',
                  textoBotao: 'Enviar materiais',
                }
              : ehPrevias
                ? {
                    mostrarTexto: true,
                    aceitarLink: true,
                    permitirGravarVoz: true,
                    tituloUpload: 'Fotos, vídeos e áudios (se tiver)',
                    ajudaUpload: 'Quantos arquivos quiser. Também dá pra gravar um áudio aqui.',
                    textoBotao: 'Enviar informações',
                  }
                : {})}
          />
        </div>
      </main>
    </div>
  );
}

function DetalheRow({ label, itens }: { label: string; itens: RelacaoItem[] }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <dt className="w-24 shrink-0 text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
        {label}
      </dt>
      <dd className="flex flex-wrap items-center gap-2">
        {itens.map((it) => (
          <span
            key={it.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(21,21,33,0.04)] px-2.5 py-1 text-[12px] text-ink"
          >
            <RelacaoIcon icon={it.icon} alt={it.name} />
            {it.name}
          </span>
        ))}
      </dd>
    </div>
  );
}

function RelacaoIcon({ icon, alt }: { icon: string | null; alt: string }) {
  if (!icon) return null;
  if (icon.startsWith('http')) {
    return (
      <Image
        src={icon}
        alt={alt}
        width={14}
        height={14}
        className="h-3.5 w-3.5 rounded-sm object-contain"
        unoptimized
      />
    );
  }
  return <span className="text-[13px] leading-none">{icon}</span>;
}

function fmtData(iso: string | null): string {
  if (!iso) return 'sem data';
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

function analisarPrazo(iso: string | null): {
  label: string;
  cardClass: string;
  textClass: string;
  labelClass: string;
} {
  const neutral = {
    cardClass: 'card',
    textClass: 'text-t1',
    labelClass: 'text-t3',
  };
  if (!iso) {
    return { label: 'Sem prazo', ...neutral, textClass: 'text-t3' };
  }
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const prazo = new Date(iso.split('T')[0] + 'T00:00:00');
  const diffMs = prazo.getTime() - hoje.getTime();
  const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const data = fmtData(iso);
  if (diffDias < 0) {
    return {
      label: `${data} · atrasado`,
      cardClass: 'bg-crimson',
      textClass: 'text-white font-semibold',
      labelClass: 'text-white/70',
    };
  }
  if (diffDias === 0) {
    return {
      label: `${data} · hoje`,
      cardClass: 'bg-crimson',
      textClass: 'text-white font-semibold',
      labelClass: 'text-white/70',
    };
  }
  if (diffDias <= 2) {
    return {
      label: `${data} · em ${diffDias} dia${diffDias > 1 ? 's' : ''}`,
      cardClass: 'bg-[rgba(144,24,26,0.12)] border border-crimson/30',
      textClass: 'text-crimson font-semibold',
      labelClass: 'text-crimson/70',
    };
  }
  return {
    label: `${data} · em ${diffDias} dias`,
    ...neutral,
  };
}

function copyDaTarefa(titulo: string): string {
  if (titulo === 'Envio de Conteúdos Prévios') {
    return 'Conta pra gente tudo o que ajuda a montar esse post: contexto, detalhes, datas e referências.\nSe já tiver foto ou vídeo, pode mandar junto.';
  }
  if (titulo === 'Materiais para Produção') {
    return 'Hora de mandar os materiais desse post: fotos, vídeos e áudios.\nSe quiser explicar alguma coisa, deixa um recado pra equipe no fim da página.';
  }
  return 'Manda aqui as informações e os materiais desse post.';
}
