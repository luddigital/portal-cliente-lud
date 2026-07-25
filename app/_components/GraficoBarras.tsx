'use client';

import { useRef, useState } from 'react';
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

function fmtDataLonga(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  const data = new Date(Number(y), Number(m) - 1, Number(d));
  const semana = data.toLocaleDateString('pt-BR', { weekday: 'short' });
  return `${d}/${m} · ${semana}`;
}

function fmtNum(n: number): string {
  const abs = Math.abs(n);
  const sinal = n < 0 ? '-' : n > 0 ? '+' : '';
  if (abs >= 1000) return `${sinal}${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
  return `${sinal}${abs.toLocaleString('pt-BR')}`;
}

function indicesEixoX(n: number): number[] {
  if (n <= 8) return Array.from({ length: n }, (_, i) => i);
  const passo = Math.ceil(n / 6);
  const out = new Set<number>();
  for (let i = 0; i < n; i += passo) out.add(i);
  out.add(n - 1);
  return [...out].sort((a, b) => a - b);
}

export function GraficoBarras({
  dados,
  label,
}: {
  dados: IgPontoSerie[];
  label: string;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (dados.length === 0) return null;

  const valores = dados.map((p) => p.valor);
  const max = Math.max(0, ...valores);
  const min = Math.min(0, ...valores);
  const temNegativos = min < 0;
  const range = Math.max(Math.abs(max), Math.abs(min), 1);

  const innerH = H - PADY_TOP - PADY_BOTTOM;
  const zeroY = temNegativos ? PADY_TOP + innerH / 2 : PADY_TOP + innerH;
  const escalaPos = temNegativos ? innerH / 2 / range : innerH / range;
  const escalaNeg = temNegativos ? innerH / 2 / range : 0;

  const totalDias = dados.length;
  const stepX = (W - PADX * 2) / totalDias;
  const barW = Math.max(2, stepX * 0.7);

  // A API do Instagram só expõe o SALDO LÍQUIDO por dia (não separa entradas de
  // saídas). Então mostramos só o líquido — nada de "entraram/saíram" inventado.
  const liquido = valores.reduce((a, b) => a + b, 0);
  const diasGanho = valores.filter((v) => v > 0).length;
  const diasPerda = valores.filter((v) => v < 0).length;

  // Mesma amostragem de dias do gráfico de linha, pra padronizar os dois.
  const indicesX = indicesEixoX(dados.length);

  const corPos = 'var(--prazo-em-dia)';
  const corNeg = 'var(--prazo-atrasado)';

  // Centro x de cada barra (pra posicionar tooltip + linha)
  const centroX = (i: number) => PADX + i * stepX + stepX / 2;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const xPercent = (e.clientX - rect.left) / rect.width;
    const svgX = xPercent * W;
    let melhor = 0;
    let melhorDist = Infinity;
    for (let i = 0; i < dados.length; i++) {
      const cx = centroX(i);
      const d = Math.abs(cx - svgX);
      if (d < melhorDist) {
        melhorDist = d;
        melhor = i;
      }
    }
    setHoverIdx(melhor);
  }

  const hoverX = hoverIdx != null ? centroX(hoverIdx) : null;

  return (
    <div className="card relative p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div>
          <h3 className="text-[13px] font-semibold text-ink">{label}</h3>
          <p className="text-[11px] text-t3">
            {diasGanho} {diasGanho === 1 ? 'dia' : 'dias'} no positivo
            {diasPerda > 0
              ? ` · ${diasPerda} ${diasPerda === 1 ? 'dia' : 'dias'} no negativo`
              : ''}
          </p>
        </div>
        <div className="flex items-baseline gap-1.5 text-[11px]">
          <span
            className="text-[15px] font-semibold"
            style={{
              color: liquido > 0 ? corPos : liquido < 0 ? corNeg : 'var(--t2)',
            }}
          >
            {liquido > 0 ? '+' : ''}
            {liquido.toLocaleString('pt-BR')}
          </span>
          <span className="text-t3">no período</span>
        </div>
      </div>
      <div className="relative mt-3">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full cursor-crosshair"
          preserveAspectRatio="none"
          onMouseMove={onMove}
          onMouseLeave={() => setHoverIdx(null)}
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
            const ativo = hoverIdx === i;
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={barW}
                height={Math.max(1, h)}
                rx={2}
                fill={cor}
                opacity={p.valor === 0 ? 0.25 : ativo ? 1 : 0.7}
              />
            );
          })}

          {/* linha vertical do hover */}
          {hoverX != null && (
            <line
              x1={hoverX}
              x2={hoverX}
              y1={PADY_TOP}
              y2={H - PADY_BOTTOM}
              stroke="rgba(21,21,33,0.35)"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
          )}

          {/* eixo X */}
          {indicesX.map((i) => (
            <text
              key={i}
              x={centroX(i)}
              y={H - 8}
              fontSize="10"
              fill="rgba(21,21,33,0.45)"
              textAnchor="middle"
            >
              {fmtData(dados[i].dia)}
            </text>
          ))}
        </svg>

        {/* tooltip */}
        {hoverIdx != null && hoverX != null && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg bg-ink px-2.5 py-1.5 text-[11px] text-white shadow-lg"
            style={{
              left: `${(hoverX / W) * 100}%`,
              top: 0,
              transform: 'translate(-50%, -8px)',
              whiteSpace: 'nowrap',
            }}
          >
            <div className="font-semibold">{fmtDataLonga(dados[hoverIdx].dia)}</div>
            <div
              className="font-mono"
              style={{
                color:
                  dados[hoverIdx].valor >= 0
                    ? 'rgba(180,220,180,0.95)'
                    : 'rgba(255,180,180,0.95)',
              }}
            >
              {fmtNum(dados[hoverIdx].valor)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
