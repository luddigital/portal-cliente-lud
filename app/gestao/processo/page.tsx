import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { getColaboradorByEmail } from '@/lib/notion';

export const dynamic = 'force-dynamic';

type Etapa = {
  n: number;
  titulo: string;
  quando: string;
  responsaveis: string[];
  desc: string;
  playbooks?: { label: string; url: string }[];
};

const ETAPAS: Etapa[] = [
  {
    n: 1,
    titulo: 'Análise de Dados',
    quando: 'Dia 1 do mês',
    responsaveis: ['Social Media', 'Gestão de Projetos'],
    desc: 'Tudo começa por dados. Análise de performance do mês anterior. O Social Media monta a apresentação no Canva e inclui o link na tarefa do cliente (criada no início do mês, com uma tarefa de Aprovação junto).',
    playbooks: [
      {
        label: 'Fechamento de Métricas',
        url: 'https://www.notion.so/Como-fazer-uma-entrega-de-Fechamento-de-M-tricas-263d04d23b4a80899132db912c29f6b2',
      },
    ],
  },
  {
    n: 2,
    titulo: 'Reunião Interna de Metas',
    quando: 'Início do mês',
    responsaveis: ['Time interno'],
    desc: 'Revisar os dados e alinhar as metas estratégicas do próximo ciclo. Essas metas orientam o calendário e conectam as decisões editoriais aos objetivos atuais do cliente.',
  },
  {
    n: 3,
    titulo: 'Entrega de Calendário',
    quando: 'Até dia 5',
    responsaveis: ['Social Media'],
    desc: 'Produzimos os temas sempre com 2 meses de antecedência (em setembro, entregamos novembro). Fluxo: construção das pautas → aprovação interna → vai pra reunião com o cliente.',
    playbooks: [
      {
        label: 'Entrega de Calendário',
        url: 'https://www.notion.so/Como-fazer-uma-entrega-de-Calend-rio-263d04d23b4a805fb2c0e16bb83fe73c',
      },
      {
        label: 'Cards de pauta',
        url: 'https://www.notion.so/Como-criar-e-gerenciar-cards-de-pauta-25dd04d23b4a80c689aaf261815ec870',
      },
    ],
  },
  {
    n: 4,
    titulo: 'Reunião com o Cliente',
    quando: '~Dia 15',
    responsaveis: ['Social Media', 'Gestão de Projetos'],
    desc: 'Com dados, metas e calendário prontos: apresentamos os dados do mês que fechou, aprovamos juntos o calendário (2 meses à frente) e coletamos o máximo de informações pra produção.',
  },
  {
    n: 5,
    titulo: 'Recebimento de Conteúdos Prévios',
    quando: 'Após a reunião (se necessário)',
    responsaveis: ['Social Media', 'Cliente'],
    desc: 'Se ficou pendente alguma informação que o cliente não pôde responder na reunião, aguardamos o envio. Sem necessidade de material extra, avança direto pra Etapa 6.',
  },
  {
    n: 6,
    titulo: 'Produção de Briefing & Copy',
    quando: 'Dia 28',
    responsaveis: ['Social Media', 'Copy'],
    desc: 'Briefings completos: roteiros, referências visuais, copy voice, formatos, legendas e instruções claras pra equipe criativa. Se precisar de material novo do cliente, é especificado aqui.',
    playbooks: [
      {
        label: 'Entrega de Briefing & Copy',
        url: 'https://www.notion.so/Como-fazer-uma-entrega-de-Briefing-Copy-263d04d23b4a80a1bd9df5fa94659520',
      },
      {
        label: 'Direcionamentos de Stories',
        url: 'https://www.notion.so/Como-criar-Direcionamentos-de-Stories-230d04d23b4a8090b3becb07e0427223',
      },
    ],
  },
  {
    n: 7,
    titulo: 'Solicitação de Materiais',
    quando: 'Após o briefing (se necessário)',
    responsaveis: ['Social Media', 'Cliente'],
    desc: 'Conteúdos que dependem de produção do cliente são organizados em solicitações específicas, com prazo definido pra envio de fotos, vídeos ou áudios.',
  },
  {
    n: 8,
    titulo: 'Curadoria de Materiais',
    quando: 'Após receber os materiais',
    responsaveis: ['Social Media'],
    desc: 'Seleção dos melhores materiais, conferência de qualidade técnica (formato, luz, áudio), alinhamento com o briefing e identificação de lacunas. Evita retrabalho e entrega insumos prontos pra arte.',
    playbooks: [
      {
        label: 'Curadoria de Materiais',
        url: 'https://www.notion.so/Como-fazer-uma-Curadoria-de-Materiais-263d04d23b4a80698d7cf199cc211b44',
      },
    ],
  },
  {
    n: 9,
    titulo: 'Arte',
    quando: 'Após curadoria aprovada',
    responsaveis: ['Design'],
    desc: 'A equipe de design produz as peças. Fluxo de aprovação: revisão interna pela Lud. → envio ao cliente → ajustes finais se necessário.',
    playbooks: [
      {
        label: 'Prazos e alterações',
        url: 'https://www.notion.so/Como-funcionam-os-prazos-e-orienta-es-para-altera-es-231d04d23b4a8038a11aebc66535c971',
      },
    ],
  },
  {
    n: 10,
    titulo: 'Programação, Publicação e Análise',
    quando: 'Conforme calendário',
    responsaveis: ['Social Media'],
    desc: 'Artes aprovadas são programadas conforme o calendário. Acompanhamos a performance e encerramos o ciclo com os aprendizados — que alimentam a próxima Análise de Dados e reiniciam o ciclo.',
  },
];

const COR_RESP: Record<string, { bg: string; fg: string }> = {
  'Social Media': { bg: 'var(--cal-agendado-soft)', fg: 'var(--cal-agendado)' },
  'Gestão de Projetos': { bg: '#E8EBF5', fg: '#313D65' },
  Copy: { bg: 'var(--cal-publicado-soft)', fg: 'var(--cal-publicado)' },
  Design: { bg: 'var(--cal-alteracao-soft)', fg: 'var(--cal-alteracao)' },
  'Time interno': { bg: '#EEF0F4', fg: '#8485A3' },
  Cliente: { bg: 'var(--cal-aprovacao-soft)', fg: 'var(--cal-aprovacao)' },
};

function ChipResp({ nome }: { nome: string }) {
  const c = COR_RESP[nome] ?? { bg: '#EEF0F4', fg: '#5C5B72' };
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ background: c.bg, color: c.fg }}
    >
      {nome}
    </span>
  );
}

export default async function ProcessoPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const ehAdmin = env.auth.adminEmails.includes(session.email.trim().toLowerCase());
  let ehColaborador = !!session.colaboradorId;
  if (!ehColaborador && !ehAdmin) {
    try {
      ehColaborador = !!(await getColaboradorByEmail(session.email));
    } catch {
      /* mantém false */
    }
  }
  if (!ehAdmin && !ehColaborador) redirect('/');

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/gestao" className="text-[12px] text-mauve hover:text-ink">
        ← Gestão
      </Link>
      <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.03em] text-ink">
        Processo de Social Media
      </h1>
      <p className="mt-1 max-w-2xl text-[14px] text-t2">
        Nosso processo é <b className="font-semibold text-ink">cíclico</b> e roda em 10
        etapas — da análise de dados à publicação. Trabalhamos sempre com{' '}
        <b className="font-semibold text-ink">2 meses de antecedência</b> no calendário.
      </p>

      {/* Calendário do ciclo */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-[rgba(21,21,33,0.08)] bg-bgSoft">
        <div className="border-b border-[rgba(21,21,33,0.06)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-t3">
          Calendário do ciclo mensal
        </div>
        <div className="divide-y divide-[rgba(21,21,33,0.05)]">
          {ETAPAS.map((e) => (
            <div key={e.n} className="flex items-center gap-3 px-5 py-2 text-[13px]">
              <span className="w-6 shrink-0 font-mono text-[12px] text-t3">
                {String(e.n).padStart(2, '0')}
              </span>
              <span className="w-40 shrink-0 text-t2">{e.quando}</span>
              <span className="font-medium text-ink">{e.titulo}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Etapas detalhadas */}
      <div className="mt-8 space-y-3">
        {ETAPAS.map((e) => (
          <div
            key={e.n}
            className="rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white p-5"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink text-[15px] font-bold text-white">
                {e.n}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">
                    {e.titulo}
                  </h2>
                  <span className="text-[12px] font-medium text-t3">{e.quando}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {e.responsaveis.map((r) => (
                    <ChipResp key={r} nome={r} />
                  ))}
                </div>
                <p className="mt-3 text-[13px] leading-[1.55] text-t2">{e.desc}</p>
                {e.playbooks && e.playbooks.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {e.playbooks.map((p) => (
                      <a
                        key={p.url}
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full bg-bgSoft px-3 py-1.5 text-[11px] font-semibold text-navy transition hover:bg-[rgba(21,21,33,0.06)]"
                      >
                        📘 {p.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-8 rounded-2xl bg-bgSoft px-5 py-4 text-[12px] leading-[1.6] text-t3">
        🔄 Os aprendizados da Etapa 10 alimentam a próxima Análise de Dados (Etapa 1) e
        reiniciam o ciclo. Fonte: <span className="font-mono">Processos/Social Media/Processo_Social_Media.md</span>.
      </p>
    </main>
  );
}
