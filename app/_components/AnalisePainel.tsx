import type { IgAnalytics, IgMediaItem } from '@/lib/instagram';
import { GraficoLinha } from './GraficoLinha';

function fmt(n: number): string {
  return n.toLocaleString('pt-BR');
}

function delta(atual: number, anterior: number): { txt: string; cor: string } | null {
  if (anterior <= 0) return null;
  const p = ((atual - anterior) / anterior) * 100;
  const sinal = p >= 0 ? '+' : '';
  return {
    txt: `${sinal}${p.toFixed(1)}%`,
    cor: p >= 0 ? 'text-sage' : 'text-crimson',
  };
}

function Metric({
  label,
  valor,
  atual,
  anterior,
}: {
  label: string;
  valor: string;
  atual?: number;
  anterior?: number;
}) {
  const d = atual != null && anterior != null ? delta(atual, anterior) : null;
  return (
    <div className="card p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-t3">
        {label}
      </div>
      <div className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-ink">
        {valor}
      </div>
      {d ? (
        <div className={`mt-1 text-[12px] font-semibold ${d.cor}`}>
          {d.txt} <span className="font-normal text-t3">vs. período anterior</span>
        </div>
      ) : (
        <div className="mt-1 text-[12px] text-t3">&nbsp;</div>
      )}
    </div>
  );
}

function MediaCard({ m }: { m: IgMediaItem }) {
  const data = m.timestamp ? new Date(m.timestamp).toLocaleDateString('pt-BR') : '';
  return (
    <a
      href={m.permalink || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="card flex gap-3 p-3 transition hover:border-navy/30"
    >
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-bgSoft">
        {m.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.thumbnail} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="rounded bg-bgSoft px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-t3">
            {m.mediaType || 'post'}
          </span>
          <span className="text-[11px] text-t3">{data}</span>
        </div>
        <p className="mt-1 line-clamp-2 text-[12px] text-t2">
          {m.caption || 'Sem legenda'}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-t3">
          <span>Alcance {fmt(m.reach)}</span>
          <span>Interações {fmt(m.interactions)}</span>
          <span>{fmt(m.likes)} curtidas</span>
          <span>{fmt(m.comments)} comentários</span>
        </div>
      </div>
    </a>
  );
}

export function AnalisePainel({ a }: { a: IgAnalytics }) {
  return (
    <div className="space-y-6">
      {/* cabeçalho da conta */}
      <div className="card flex items-center gap-4 p-4">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-bgSoft">
          {a.account.profilePicture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={a.account.profilePicture}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-ink">
            @{a.account.username}
          </div>
          <div className="text-[12px] text-t3">
            {fmt(a.account.followersCount)} seguidores · período {a.period.since} a{' '}
            {a.period.until}
          </div>
        </div>
      </div>

      {/* métricas */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Metric
          label="Alcance"
          valor={fmt(a.atual.reach)}
          atual={a.atual.reach}
          anterior={a.anterior.reach}
        />
        <Metric
          label="Interações"
          valor={fmt(a.atual.interactions)}
          atual={a.atual.interactions}
          anterior={a.anterior.interactions}
        />
        <Metric
          label="Contas engajadas"
          valor={fmt(a.atual.engagedAccounts)}
          atual={a.atual.engagedAccounts}
          anterior={a.anterior.engagedAccounts}
        />
        <Metric
          label="Visitas ao perfil"
          valor={fmt(a.atual.profileViews)}
          atual={a.atual.profileViews}
          anterior={a.anterior.profileViews}
        />
        <Metric
          label="Novos seguidores"
          valor={fmt(a.atual.novosSeguidores)}
          atual={a.atual.novosSeguidores}
          anterior={a.anterior.novosSeguidores}
        />
        <Metric
          label="Taxa de engajamento"
          valor={`${(a.taxaEngajamento * 100).toFixed(1)}%`}
        />
      </div>

      {/* série diária de alcance */}
      {a.serieAlcance.length > 0 && (
        <GraficoLinha dados={a.serieAlcance} label="Alcance por dia" />
      )}

      {/* top posts */}
      <div>
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
          Posts em destaque
        </h2>
        <p className="text-[12px] text-t2">
          Ordenados por interações no período.
        </p>
        {a.topMedia.length === 0 ? (
          <p className="mt-3 text-[13px] text-t3">
            Nenhum post publicado no período.
          </p>
        ) : (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {a.topMedia.map((m) => (
              <MediaCard key={m.id} m={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
