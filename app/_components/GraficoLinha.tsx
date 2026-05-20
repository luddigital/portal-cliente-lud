import type { IgPontoSerie } from '@/lib/instagram';

const W = 720;
const H = 180;
const PADX = 36;
const PADY = 18;

function fmtData(iso: string): string {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function fmtNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return n.toLocaleString('pt-BR');
}

export function GraficoLinha({
  dados,
  label,
}: {
  dados: IgPontoSerie[];
  label: string;
}) {
  if (dados.length === 0) return null;

  const valores = dados.map((p) => p.valor);
  const max = Math.max(1, ...valores);
  const stepX = (W - PADX * 2) / Math.max(1, dados.length - 1);

  const pontos = dados.map((p, i) => {
    const x = PADX + i * stepX;
    const y = H - PADY - (p.valor / max) * (H - PADY * 2);
    return { x, y, p };
  });

  const linha = pontos.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');
  const area = `${linha} L ${pontos[pontos.length - 1].x} ${H - PADY} L ${pontos[0].x} ${H - PADY} Z`;

  const indicesEixo = dados.length <= 7
    ? dados.map((_, i) => i)
    : [0, Math.floor(dados.length / 2), dados.length - 1];

  const total = valores.reduce((a, b) => a + b, 0);
  const media = Math.round(total / dados.length);

  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[13px] font-semibold text-ink">{label}</h3>
        <span className="text-[11px] text-t3">
          média {fmtNum(media)} / dia
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 h-auto w-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="gradAlcance" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#313D65" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#313D65" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={PADX}
            x2={W - PADX}
            y1={PADY + f * (H - PADY * 2)}
            y2={PADY + f * (H - PADY * 2)}
            stroke="rgba(21,21,33,0.06)"
            strokeWidth="1"
          />
        ))}
        <path d={area} fill="url(#gradAlcance)" />
        <path d={linha} fill="none" stroke="#313D65" strokeWidth="2" />
        {pontos.map((pt, i) => (
          <circle key={i} cx={pt.x} cy={pt.y} r="2" fill="#313D65" />
        ))}
        <text x={PADX} y={PADY - 4} fontSize="10" fill="#9898AA">
          {fmtNum(max)}
        </text>
        {indicesEixo.map((i) => (
          <text
            key={i}
            x={pontos[i].x}
            y={H - 2}
            fontSize="10"
            fill="#9898AA"
            textAnchor={i === 0 ? 'start' : i === dados.length - 1 ? 'end' : 'middle'}
          >
            {fmtData(dados[i].dia)}
          </text>
        ))}
      </svg>
    </div>
  );
}
