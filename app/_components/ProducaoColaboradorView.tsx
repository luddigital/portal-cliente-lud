import Link from 'next/link';
import type { ColaboradorResumo, TarefaColaborador } from '@/lib/notion';

const MESES_ABREV = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function diasDiff(iso: string | null): number | null {
  if (!iso) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const data = new Date(iso.split('T')[0] + 'T00:00:00');
  return Math.round((data.getTime() - hoje.getTime()) / 86400000);
}

function relativoDia(dias: number | null): string {
  if (dias === null) return '—';
  if (dias < 0) return dias === -1 ? 'ontem' : `há ${-dias} dias`;
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  return `em ${dias} dias`;
}

function dataLong(iso: string | null): { dia: string; mes: string; full: string } {
  if (!iso) return { dia: '—', mes: '', full: '' };
  const [y, m, d] = iso.split('T')[0].split('-');
  return {
    dia: d,
    mes: MESES_ABREV[Number(m) - 1] ?? '',
    full: `${d}/${m}/${y}`,
  };
}

function dataRelativaDesde(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'agora';
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

type CategoriaPrazo = 'atrasada' | 'hoje' | 'proximos' | 'futuro';

export function categorizar(t: TarefaColaborador): CategoriaPrazo {
  const d = diasDiff(t.dataEntrega);
  if (d === null) return 'futuro';
  if (d < 0) return 'atrasada';
  if (d === 0) return 'hoje';
  if (d <= 7) return 'proximos';
  return 'futuro';
}

function corDoStatus(status: string | null): { bg: string; fg: string } {
  const s = (status ?? '').toLowerCase();
  if (s.includes('concluí') || s.includes('concluido')) {
    return { bg: 'var(--prazo-em-dia-soft)', fg: 'var(--prazo-em-dia)' };
  }
  if (s.includes('iniciar')) {
    return { bg: 'var(--cal-aprovacao-soft)', fg: 'var(--cal-aprovacao)' };
  }
  if (s.includes('andamento') || s.includes('em produ')) {
    return { bg: 'var(--cal-agendado-soft)', fg: 'var(--cal-agendado)' };
  }
  return { bg: 'var(--bgSoft)', fg: 'var(--t2)' };
}

function CardTarefa({ t, fromSlug }: { t: TarefaColaborador; fromSlug: string }) {
  const dias = diasDiff(t.dataEntrega);
  const cat = categorizar(t);
  const data = dataLong(t.dataEntrega);
  const corStatus = corDoStatus(t.status);
  const corPrazo =
    cat === 'atrasada'
      ? 'text-[var(--prazo-atrasado)]'
      : cat === 'hoje'
        ? 'text-[var(--prazo-hoje)]'
        : 'text-t1';

  return (
    <Link
      href={`/post/${t.postId}?tarefa=${t.tarefaId}&from=${fromSlug}`}
      className="group flex items-center gap-5 rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white px-5 py-4 transition hover:border-navy/30 hover:bg-bgSoft/40"
    >
      <div className="w-[56px] shrink-0 text-center leading-none">
        <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-t3">
          {data.mes}
        </div>
        <div className="mt-1.5 font-mono text-[28px] font-semibold tracking-[-0.03em] text-ink">
          {data.dia}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-t3">
          {t.tarefaTitulo}
        </div>
        <div className="truncate text-[15px] font-semibold text-ink">
          {t.projetoNome ? `${t.projetoNome} — ` : ''}
          {t.postTitulo}
        </div>
        {t.status && (
          <div className="mt-1">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: corStatus.bg, color: corStatus.fg }}
            >
              <span
                className="inline-block h-1 w-1 rounded-full"
                style={{ background: 'currentColor' }}
              />
              {t.status}
            </span>
          </div>
        )}
      </div>

      <div className="hidden shrink-0 text-right sm:block">
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
          Prazo
        </div>
        <div className={`mt-1 text-[13px] font-medium ${corPrazo}`}>
          {data.full || '—'}
        </div>
        {dias !== null && (
          <div className="mt-0.5 text-[10px] text-t3">{relativoDia(dias)}</div>
        )}
      </div>

      <div className="hidden text-t3 sm:block">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </div>
    </Link>
  );
}

function Secao({
  titulo,
  intro,
  badge,
  tom,
  tarefas,
  fromSlug,
}: {
  titulo: string;
  intro: string;
  badge: number;
  tom?: 'atrasada' | 'hoje';
  tarefas: TarefaColaborador[];
  fromSlug: string;
}) {
  if (tarefas.length === 0) return null;
  const corBadge =
    tom === 'atrasada'
      ? 'bg-[var(--prazo-atrasado-soft)] text-[var(--prazo-atrasado)]'
      : tom === 'hoje'
        ? 'bg-[var(--prazo-hoje-soft)] text-[var(--prazo-hoje)]'
        : 'bg-bgSoft text-t2';
  return (
    <section className="space-y-3">
      <div>
        <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.1em] text-t3">
          {titulo}
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${corBadge}`}>
            {badge}
          </span>
        </h2>
        <p className="mt-1 text-[13px] text-t2">{intro}</p>
      </div>
      <div className="space-y-2.5">
        {tarefas.map((t) => (
          <CardTarefa key={t.tarefaId} t={t} fromSlug={fromSlug} />
        ))}
      </div>
    </section>
  );
}

function CardStat({
  label,
  valor,
  desc,
  tom,
}: {
  label: string;
  valor: number;
  desc: string;
  tom?: 'alerta' | 'hoje' | 'feitas';
}) {
  const cor =
    tom === 'alerta'
      ? 'text-[var(--prazo-atrasado)]'
      : tom === 'hoje'
        ? 'text-[var(--prazo-hoje)]'
        : tom === 'feitas'
          ? 'text-[var(--prazo-em-dia)]'
          : 'text-ink';
  return (
    <div className="rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
        {label}
      </div>
      <div className={`mt-1.5 text-[26px] font-semibold tracking-[-0.02em] tabular-nums ${cor}`}>
        {valor}
      </div>
      <div className="mt-0.5 text-[11px] text-t3">{desc}</div>
    </div>
  );
}

export function ProducaoColaboradorView({
  colaborador,
  pendentes,
  concluidas,
  fromSlug,
}: {
  colaborador: ColaboradorResumo;
  pendentes: TarefaColaborador[];
  concluidas: TarefaColaborador[];
  /** Slug usado no parâmetro from=... do link pra o /post — define pra onde
   *  o botão "voltar" leva. Ex: 'admin/equipe' ou 'equipe/me'. */
  fromSlug: string;
}) {
  const atrasadas = pendentes.filter((t) => categorizar(t) === 'atrasada');
  const hoje = pendentes.filter((t) => categorizar(t) === 'hoje');
  const proximos = pendentes.filter((t) => categorizar(t) === 'proximos');
  const futuro = pendentes.filter((t) => categorizar(t) === 'futuro');

  const concluidasSemana = concluidas.filter((t) => {
    if (!t.finalizadaEm) return false;
    return Date.now() - new Date(t.finalizadaEm).getTime() < 7 * 86400000;
  });

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-center gap-5 border-b border-[rgba(21,21,33,0.08)] pb-6">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-navy to-mauve text-[20px] font-bold tracking-[-0.02em] text-white">
          {iniciais(colaborador.nome)}
        </div>
        <div className="flex-1">
          <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-ink">
            {colaborador.nome}
          </h1>
          {colaborador.funcao && (
            <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-t3">
              {colaborador.funcao}
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-4 text-[12px] text-t2">
            {colaborador.email && (
              <a
                href={`mailto:${colaborador.email}`}
                className="inline-flex items-center gap-1.5 transition hover:text-ink"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M3 7l9 6 9-6" />
                </svg>
                {colaborador.email}
              </a>
            )}
            {colaborador.whatsapp && (
              <a
                href={`https://wa.me/${colaborador.whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 transition hover:text-ink"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                  <path d="M21 12a8 8 0 0 1-11.6 7.2L4 21l1.8-5.4A8 8 0 1 1 21 12z" />
                </svg>
                {colaborador.whatsapp}
              </a>
            )}
          </div>
        </div>
      </header>

      {!colaborador.pessoaUserId ? (
        <div className="rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white p-6 text-center">
          <p className="text-[14px] font-semibold text-ink">
            Sem produção mapeada
          </p>
          <p className="mt-2 text-[13px] text-t2">
            Esse cadastro ainda não tem o campo <b>Pessoa</b> preenchido no
            Notion. Avise a equipe da Lud pra vincular o usuário Notion e a
            produção aparecer aqui.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <CardStat label="Atrasadas" valor={atrasadas.length} tom="alerta" desc="precisam de atenção" />
            <CardStat label="Pra hoje" valor={hoje.length} tom="hoje" desc="entrega hoje" />
            <CardStat label="Em andamento" valor={pendentes.length} desc="total pendentes" />
            <CardStat label="Feitas (7d)" valor={concluidasSemana.length} tom="feitas" desc="essa semana" />
          </div>

          {pendentes.length === 0 && concluidas.length === 0 ? (
            <p className="rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white p-6 text-center text-[13px] text-t3">
              Nenhuma tarefa atribuída no momento.
            </p>
          ) : (
            <>
              <Secao
                titulo="Atrasadas"
                intro="Passaram do prazo. Bota o foco aqui primeiro."
                badge={atrasadas.length}
                tom="atrasada"
                tarefas={atrasadas}
                fromSlug={fromSlug}
              />
              <Secao
                titulo="Pra hoje"
                intro="Tarefas com prazo de entrega hoje."
                badge={hoje.length}
                tom="hoje"
                tarefas={hoje}
                fromSlug={fromSlug}
              />
              <Secao
                titulo="Próximos 7 dias"
                intro="Tarefas com prazo nos próximos dias."
                badge={proximos.length}
                tarefas={proximos}
                fromSlug={fromSlug}
              />
              <Secao
                titulo="Mais à frente"
                intro="Tarefas com prazo daqui a mais de 7 dias ou sem data."
                badge={futuro.length}
                tarefas={futuro}
                fromSlug={fromSlug}
              />

              {concluidas.length > 0 && (
                <section className="space-y-3">
                  <div>
                    <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.1em] text-t3">
                      Concluídas recentemente
                      <span className="rounded-full bg-bgSoft px-2 py-0.5 text-[11px] font-medium text-t2">
                        {concluidas.length}
                      </span>
                    </h2>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white">
                    {concluidas.map((t, i) => (
                      <Link
                        key={t.tarefaId}
                        href={`/post/${t.postId}?tarefa=${t.tarefaId}&from=${fromSlug}`}
                        className={`flex items-center gap-3 px-4 py-2.5 text-[13px] transition hover:bg-bgSoft ${
                          i > 0 ? 'border-t border-[rgba(21,21,33,0.05)]' : ''
                        }`}
                      >
                        <span className="w-[48px] shrink-0 text-right text-[11px] font-mono text-t3">
                          {dataRelativaDesde(t.finalizadaEm)}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium text-ink">
                          {t.tarefaTitulo}
                          <span className="ml-2 font-normal text-t2">
                            — {t.postTitulo}
                          </span>
                        </span>
                        {t.projetoNome && (
                          <span className="hidden shrink-0 text-[11px] text-t3 sm:inline">
                            {t.projetoNome}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
