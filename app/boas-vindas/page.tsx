import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import {
  findProjetosByEmail,
  getNomeDoCliente,
} from '@/lib/notion';

export const dynamic = 'force-dynamic';

export default async function BoasVindasPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [nome, projetos] = await Promise.all([
    getNomeDoCliente(session.email),
    findProjetosByEmail(session.email),
  ]);
  const primeiroNome = (nome ?? '').split(/\s+/)[0] || 'cliente';
  const temVariosProjetos = projetos.length > 1;

  return (
    <div className="min-h-screen pb-32">
      <header className="sticky top-0 z-10 border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-[13px] text-mauve transition hover:text-ink"
          >
            ← Voltar pro portal
          </Link>
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
            Como funciona
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 space-y-10">
        {/* Hero */}
        <section className="space-y-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
            Bem-vindo · Lud.
          </div>
          <h1 className="text-[32px] sm:text-[40px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink">
            Oi {primeiroNome} 👋
            <br />
            Esse é o seu portal.
          </h1>
          <p className="max-w-prose text-[15px] leading-[1.6] text-t2">
            Aqui você acompanha tudo que a gente tá produzindo pra sua marca,
            aprova posts antes de irem ao ar e manda os materiais que a gente
            precisa de você — sem precisar de WhatsApp pra cada coisa.
          </p>
        </section>

        {/* Tour */}
        <section className="space-y-4">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
            O que dá pra fazer aqui
          </h2>

          <Passo
            n={1}
            emoji="📅"
            titulo="Ver seu calendário de posts"
            descricao="Tudo que vai pro ar nos próximos meses, organizado por dia. Cada cor indica em que etapa o post está — rascunho (cinza), em aprovação (azul), agendado (verde), com alteração pedida (laranja)."
            cta="Abrir calendário"
            href="/"
          />

          <Passo
            n={2}
            emoji="✅"
            titulo="Aprovar posts"
            descricao="Quando um post está pronto pra você ver, aparece nas suas tarefas pendentes. Você abre, vê a arte + a legenda, e aprova com um clique. Se quiser ajustes, comenta antes — a gente lê e refaz."
            cta="Ver minhas aprovações"
            href="/etapa/post"
          />

          <Passo
            n={3}
            emoji="📎"
            titulo="Mandar materiais (fotos, vídeos, áudios)"
            descricao="Quando a gente precisa de um material seu pra montar o post, abre uma tarefa de 'Materiais'. Você anexa os arquivos direto pelo navegador — pode soltar vários de uma vez, cada um até 450MB. Acima disso, manda link de Drive/Dropbox."
            cta="Ver materiais pendentes"
            href="/etapa/materiais"
          />

          <Passo
            n={4}
            emoji="🎤"
            titulo="Gravar voice over pelo navegador"
            descricao="Pra posts com sua voz: quando você abre a tarefa, aparece um teleprompter com o texto separado em frases. Clique em Gravar (vermelho), leia em voz alta enquanto avança as frases com 'Próxima', clique em Parar. O áudio fica anexado ao envio automaticamente — não precisa baixar nem subir nada."
            cta={null}
            href={null}
          />

          <Passo
            n={5}
            emoji="🔔"
            titulo="Saber o que precisa de você"
            descricao="O sino no canto superior mostra quantas tarefas estão te esperando. Sempre que abrir uma e finalizar, ela some da lista. Se tudo estiver em dia, o sino fica limpo."
            cta={null}
            href={null}
          />

          {temVariosProjetos && (
            <Passo
              n={6}
              emoji="🔄"
              titulo="Trocar entre seus projetos"
              descricao={`Você tem ${projetos.length} projetos com a gente. Use o seletor no topo do portal pra alternar entre eles — cada um tem seu próprio calendário, tarefas e materiais.`}
              cta={null}
              href={null}
            />
          )}
        </section>

        {/* Status pills explicado */}
        <section className="card p-6 space-y-4">
          <h2 className="text-[14px] font-semibold text-ink">
            O que cada cor significa
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <CorLegenda
              cor="var(--cal-rascunho)"
              soft="var(--cal-rascunho-soft)"
              label="Rascunho"
              desc="Estamos montando ainda."
            />
            <CorLegenda
              cor="var(--cal-aprovacao)"
              soft="var(--cal-aprovacao-soft)"
              label="Em aprovação"
              desc="Tá com você pra dar o ok."
            />
            <CorLegenda
              cor="var(--cal-alteracao)"
              soft="var(--cal-alteracao-soft)"
              label="Alteração"
              desc="Você pediu ajuste — voltamos a mexer."
            />
            <CorLegenda
              cor="var(--cal-agendado)"
              soft="var(--cal-agendado-soft)"
              label="Agendado"
              desc="Aprovado e na fila pra ir ao ar."
            />
          </div>
        </section>

        {/* Dúvidas */}
        <section className="rounded-2xl border border-[rgba(21,21,33,0.08)] bg-bgSoft/40 p-6">
          <h2 className="text-[14px] font-semibold text-ink">
            Qualquer dúvida, é só falar
          </h2>
          <p className="mt-1 text-[13px] leading-[1.6] text-t2">
            O portal cobre o dia a dia do conteúdo — mas se preferir falar com
            alguém pessoa, é só responder no nosso WhatsApp ou mandar email pra{' '}
            <a
              href="mailto:oi@lud.digital"
              className="font-medium text-ink underline decoration-mauve/40 underline-offset-2 hover:decoration-ink"
            >
              oi@lud.digital
            </a>
            .
          </p>
          <div className="mt-4">
            <Link
              href="/"
              className="btn-primary inline-flex items-center gap-2"
            >
              Ir pro portal →
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function Passo({
  n,
  emoji,
  titulo,
  descricao,
  cta,
  href,
}: {
  n: number;
  emoji: string;
  titulo: string;
  descricao: string;
  cta: string | null;
  href: string | null;
}) {
  return (
    <div className="card flex items-start gap-4 p-5 sm:p-6">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-bgSoft text-[22px]">
        {emoji}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
            Passo {n}
          </span>
        </div>
        <h3 className="mt-1 text-[16px] font-semibold leading-snug tracking-[-0.01em] text-ink">
          {titulo}
        </h3>
        <p className="mt-1.5 text-[13px] leading-[1.6] text-t2">{descricao}</p>
        {cta && href && (
          <Link
            href={href}
            className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink underline decoration-mauve/40 underline-offset-2 transition hover:decoration-ink"
          >
            {cta} →
          </Link>
        )}
      </div>
    </div>
  );
}

function CorLegenda({
  cor,
  soft,
  label,
  desc,
}: {
  cor: string;
  soft: string;
  label: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="mt-0.5 inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold uppercase tracking-[0.06em]"
        style={{ background: soft, color: cor }}
      >
        {label}
      </span>
      <span className="text-[12px] leading-[1.5] text-t2">{desc}</span>
    </div>
  );
}
