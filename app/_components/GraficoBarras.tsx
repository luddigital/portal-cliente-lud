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
 * Indices distribuídos pra exibir ~6-8 labels no eixo X, independente do
 * tamanho da série. Sempre inclui o primeiro e o último.
 */
function indicesEixoX(n: number): number[] {
  if (n <= 8) return Array.from({ length: n }, (_, i) => i);
  const passo = Math.ceil(n / 6);
  const out = new Set<number>();
  for (let i = 0; i < n; i += passo) out.add(i);
  out.add(n - 1);
  return [...out].sort((a, b) => a - b);
}

/**
 * Gráfico de barras pra valores signed (positivo + negativo).
 * Usado pro delta diário de seguidores: barras verdes pra dias que ganhou,
 * vermelhas pra dias que perdeu. Linha do zero atravessa o meio.
 */
export function GraficoBarras({
  dados,
  label,
}: {
  dados: IgPontoSerie[];
  label: string;
}) {
  if (dados.length === 0) return null;

  const valores = dados.map((p) => p.valor);
  const max = Math.max(0, ...valores);
  const min = Math.min(0, ...valores);
  const temNegativos = min < 0;
  const range = Math.max(Math.abs(max), Math.abs(min), 1);

  // Layout do eixo Y: se só tem positivos, baseia no piso. Se tem negativos,
  // baseline no meio.
  const innerH = H - PADY_TOP - PADY_BOTTOM;
  const zeroY = temNegativos ? PADY_TOP + innerH / 2 : PADY_TOP + innerH;
  const escalaPos = temNegativos ? innerH / 2 / range : innerH / range;
  const escalaNeg = temNegativos ? innerH / 2 / range : 0;

  const totalDias = dados.length;
  const stepX = (W - PADX * 2) / totalDias;
  const barW = Math.max(2, stepX * 0.7);

  const positivos = valores.filter((v) => v > 0).reduce((a, b) => a + b, 0);
  const negativos = valores.filter((v) => v < 0).reduce((a, b) => a + b, 0);
  const liquido = positivos + negativos;

  const indicesX = indicesEixoX(dados.length);

  // Cores do design system — versão suave (alpha) pras barras
  const corPos = 'var(--prazo-em-dia)';
  const corNeg = 'var(--prazo-atrasada)';

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-ink">{label}</h3>
        <div className="flex flex-wrap items-baseline gap-2 text-[11px]">
          <span style={{ color: corPos }} className="font-semibold">
            +{fmtNum(positivos)}
          </span>
          <span className="text-t3">entraram</span>
          <span style={{ color: corNeg }} className="ml-2 font-semibold">
            {fmtNum(negativos)}
          </span>
          <span className="text-t3">saíram</span>
          <span
            className="ml-2 font-semibold"
            style={{
              color: liquido > 0 ? corPos : liquido < 0 ? corNeg : 'var(--t2)',
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
        {(temNegativos ? [0.25, 0.75] : [0.25, 0.5, 0.75]).map((f) => {
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

        {/* linha do zero */}
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
          const cor = p.valor >= 0 ? corPos : corNeg;
          const h =
            p.valor >= 0
              ? p.valor * escalaPos
              : Math.abs(p.valor) * escalaNeg;
          const y = p.valor >= 0 ? zeroY - h : zeroY;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barW}
              height={Math.max(1, h)}
              rx={2}
              fill={cor}
              opacity={p.valor === 0 ? 0.25 : 0.7}
            />
          );
        })}

        {/* destaque do maior valor positivo (pra dar referência numérica) */}
        {max > 0 &&
          (() => {
            const iMax = valores.indexOf(max);
            const x = PADX + iMax * stepX + stepX / 2;
            const y = zeroY - max * escalaPos - 4;
            return (
              <text
                x={x}
                y={y}
                fontSize="10"
                fill="rgba(21,21,33,0.55)"
                textAnchor="middle"
                fontWeight="600"
              >
                +{fmtNum(max)}
              </text>
            );
          })()}

        {/* maior valor negativo */}
        {min < 0 &&
          (() => {
            const iMin = valores.indexOf(min);
            const x = PADX + iMin * stepX + stepX / 2;
            const y = zeroY + Math.abs(min) * escalaNeg + 12;
            return (
              <text
                x={x}
                y={y}
                fontSize="10"
                fill="rgba(21,21,33,0.55)"
                textAnchor="middle"
                fontWeight="600"
              >
                {fmtNum(min)}
              </text>
            );
          })()}

        {/* eixo X — múltiplos labels */}
        {indicesX.map((i) => {
          const x = PADX + i * stepX + stepX / 2;
          return (
            <text
              key={i}
              x={x}
              y={H - 8}
              fontSize="10"
              fill="rgba(21,21,33,0.45)"
              textAnchor="middle"
            >
              {fmtData(dados[i].dia)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
