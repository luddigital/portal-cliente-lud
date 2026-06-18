import type { IgPontoSerie } from '@/lib/instagram';

const W = 720;
const H = 200;
const PADX = 36;
const PADY_TOP = 24;
const PADY_BOTTOM = 32;

function fmtData(iso: string): string {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function fmtNum(n: number): string {
  const abs = Math.abs(n);
  const sinal = n < 0 ? '-' : '';
  if (abs >= 1000) return `${sinal}${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
  return n.toLocaleString('pt-BR');
}

/**
 * Gráfico de barras pra valores signed (positivo + negativo).
 * Usado pro delta diário de seguidores: barras verdes pra dias que ganhou,
 * vermelhas pra dias que perdeu. Linha do zero atravessa o meio.
 */
export function GraficoBarras({
  dados,
  label,
  corPositiva = 'var(--prazo-em-dia)',
  corNegativa = 'var(--prazo-atrasada)',
}: {
  dados: IgPontoSerie[];
  label: string;
  corPositiva?: string;
  corNegativa?: string;
}) {
  if (dados.length === 0) return null;

  const valores = dados.map((p) => p.valor);
  const max = Math.max(1, ...valores);
  const min = Math.min(-1, ...valores);
  const range = Math.max(Math.abs(max), Math.abs(min));

  // Eixo zero em Y
  const innerH = H - PADY_TOP - PADY_BOTTOM;
  const zeroY = PADY_TOP + innerH / 2;
  const scaleY = (innerH / 2) / range;

  const totalDias = dados.length;
  const stepX = (W - PADX * 2) / totalDias;
  const barW = Math.max(2, stepX * 0.65);

  const positivos = valores.filter((v) => v > 0).reduce((a, b) => a + b, 0);
  const negativos = valores.filter((v) => v < 0).reduce((a, b) => a + b, 0);
  const liquido = positivos + negativos;

  const indicesEixo =
    dados.length <= 7
      ? dados.map((_, i) => i)
      : [0, Math.floor(dados.length / 2), dados.length - 1];

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-ink">{label}</h3>
        <div className="flex flex-wrap items-baseline gap-2 text-[11px]">
          <span style={{ color: 'var(--prazo-em-dia)' }} className="font-semibold">
            +{fmtNum(positivos)}
          </span>
          <span className="text-t3">entraram</span>
          <span
            style={{ color: 'var(--prazo-atrasada)' }}
            className="ml-2 font-semibold"
          >
            {fmtNum(negativos)}
          </span>
          <span className="text-t3">saíram</span>
          <span
            className="ml-2 font-semibold"
            style={{
              color:
                liquido > 0
                  ? 'var(--prazo-em-dia)'
                  : liquido < 0
                    ? 'var(--prazo-atrasada)'
                    : 'var(--t2)',
            }}
          >
            {liquido > 0 ? '+' : ''}
            {fmtNum(liquido)}
          </span>
          <span className="text-t3">líquido</span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 h-auto w-full"
        preserveAspectRatio="none"
      >
        {/* linhas de referência */}
        {[0.25, 0.5, 0.75].map((f) => {
          const y = PADY_TOP + f * innerH;
          return (
            <line
              key={f}
              x1={PADX}
              x2={W - PADX}
              y1={y}
              y2={y}
              stroke="rgba(21,21,33,0.06)"
              strokeWidth="1"
            />
          );
        })}

        {/* linha do zero (mais escura) */}
        <line
          x1={PADX}
          x2={W - PADX}
          y1={zeroY}
          y2={zeroY}
          stroke="rgba(21,21,33,0.18)"
          strokeWidth="1"
        />

        {/* barras */}
        {dados.map((p, i) => {
          const x = PADX + i * stepX + (stepX - barW) / 2;
          const h = Math.abs(p.valor) * scaleY;
          const y = p.valor >= 0 ? zeroY - h : zeroY;
          const cor = p.valor >= 0 ? corPositiva : corNegativa;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barW}
              height={Math.max(1, h)}
              rx={1.5}
              fill={cor}
              opacity={p.valor === 0 ? 0.3 : 0.85}
            />
          );
        })}

        {/* eixos com valores extremos */}
        <text x={PADX} y={PADY_TOP - 4} fontSize="10" fill="#9898AA">
          +{fmtNum(Math.ceil(range))}
        </text>
        <text x={PADX} y={H - PADY_BOTTOM + 14} fontSize="10" fill="#9898AA">
          -{fmtNum(Math.ceil(range))}
        </text>

        {/* eixo X */}
        {indicesEixo.map((i) => {
          const x = PADX + i * stepX + stepX / 2;
          return (
            <text
              key={i}
              x={x}
              y={H - 2}
              fontSize="10"
              fill="#9898AA"
              textAnchor={
                i === 0
                  ? 'start'
                  : i === dados.length - 1
                    ? 'end'
                    : 'middle'
              }
            >
              {fmtData(dados[i].dia)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
