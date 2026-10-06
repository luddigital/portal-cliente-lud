'use client';

import { useRef, useState } from 'react';
import type { IgPontoSerie } from '@/lib/instagram';

const W = 720;
const H = 200;
const PADX = 36;
const PADY = 24;

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
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return n.toLocaleString('pt-BR');
}

export type MarcadorPost = { dia: string; titulo: string; tipo: string };

function emojiTipo(t: string): string {
  const u = (t || '').toUpperCase();
  if (u.includes('REEL') || u.includes('VIDEO')) return '🎬';
  if (u.includes('CAROUSEL') || u.includes('ALBUM')) return '🎠';
  if (u.includes('IMAGE') || u.includes('PHOTO')) return '🖼️';
  return '📄';
}

export function GraficoLinha({
  dados,
  label,
  marcadores,
}: {
  dados: IgPontoSerie[];
  label: string;
  /** Posts publicados no período, pra marcar o dia no gráfico. */
  marcadores?: MarcadorPost[];
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (dados.length === 0) return null;

  // Agrupa os posts por dia (AAAA-MM-DD) pra casar com os pontos da série.
  const postsPorDia: Record<string, MarcadorPost[]> = {};
  for (const m of marcadores ?? []) {
    if (!m.dia) continue;
    (postsPorDia[m.dia] ??= []).push(m);
  }
  const temMarcadores = Object.keys(postsPorDia).length > 0;

  const valores = dados.map((p) => p.valor);
  const max = Math.max(1, ...valores);
  const stepX = (W - PADX * 2) / Math.max(1, dados.length - 1);

  const pontos = dados.map((p, i) => {
    const x = PADX + i * stepX;
    const y = H - PADY - (p.valor / max) * (H - PADY * 2);
    return { x, y, p };
  });

  const linha = pontos
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`)
    .join(' ');
  const area = `${linha} L ${pontos[pontos.length - 1].x} ${
    H - PADY
  } L ${pontos[0].x} ${H - PADY} Z`;

  const indicesEixo = (() => {
    if (dados.length <= 8) return dados.map((_, i) => i);
    const passo = Math.ceil(dados.length / 6);
    const out = new Set<number>();
    for (let i = 0; i < dados.length; i += passo) out.add(i);
    out.add(dados.length - 1);
    return [...out].sort((a, b) => a - b);
  })();

  const total = valores.reduce((a, b) => a + b, 0);
  const media = Math.round(total / dados.length);

  // Converte coordenada do mouse pra índice do ponto mais próximo
  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const xPercent = (e.clientX - rect.left) / rect.width;
    const svgX = xPercent * W;
    let melhor = 0;
    let melhorDist = Infinity;
    for (let i = 0; i < pontos.length; i++) {
      const d = Math.abs(pontos[i].x - svgX);
      if (d < melhorDist) {
        melhorDist = d;
        melhor = i;
      }
    }
    setHoverIdx(melhor);
  }

  const hoverPonto = hoverIdx != null ? pontos[hoverIdx] : null;

  return (
    <div className="card relative p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-ink">{label}</h3>
        <span className="flex items-center gap-2 text-[11px] text-t3">
          {temMarcadores && (
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: '#E8663D' }}
              />
              dia com post
            </span>
          )}
          <span>média {fmtNum(media)} / dia</span>
        </span>
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
          {pontos.map((pt, i) => {
            const temPost = !!postsPorDia[pt.p.dia];
            if (temPost) {
              return (
                <circle
                  key={i}
                  cx={pt.x}
                  cy={pt.y}
                  r="4"
                  fill="#E8663D"
                  stroke="#fff"
                  strokeWidth="1.5"
                />
              );
            }
            return <circle key={i} cx={pt.x} cy={pt.y} r="2" fill="#313D65" />;
          })}

          {/* linha vertical do hover */}
          {hoverPonto && (
            <>
              <line
                x1={hoverPonto.x}
                x2={hoverPonto.x}
                y1={PADY}
                y2={H - PADY}
                stroke="rgba(21,21,33,0.35)"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <circle
                cx={hoverPonto.x}
                cy={hoverPonto.y}
                r="5"
                fill="#fff"
                stroke="#313D65"
                strokeWidth="2"
              />
            </>
          )}

          <text x={PADX} y={PADY - 4} fontSize="10" fill="#9898AA">
            {fmtNum(max)}
          </text>
          {indicesEixo.map((i) => (
            <text
              key={i}
              x={pontos[i].x}
              y={H - 2}
              fontSize="10"
              fill="rgba(21,21,33,0.45)"
              textAnchor={
                i === 0 ? 'start' : i === dados.length - 1 ? 'end' : 'middle'
              }
            >
              {fmtData(dados[i].dia)}
            </text>
          ))}
        </svg>

        {/* tooltip (em pixels reais, posicionado relativo ao SVG) */}
        {hoverPonto && hoverIdx != null && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg bg-ink px-2.5 py-1.5 text-[11px] text-white shadow-lg"
            style={{
              left: `${(hoverPonto.x / W) * 100}%`,
              top: `${(hoverPonto.y / H) * 100}%`,
              transform: 'translate(-50%, calc(-100% - 10px))',
              maxWidth: 240,
            }}
          >
            <div className="whitespace-nowrap font-semibold">
              {fmtDataLonga(dados[hoverIdx].dia)}
            </div>
            <div className="whitespace-nowrap text-white/80">
              {fmtNum(dados[hoverIdx].valor)}
            </div>
            {(postsPorDia[dados[hoverIdx].dia] ?? []).length > 0 && (
              <div className="mt-1 border-t border-white/20 pt-1">
                {(postsPorDia[dados[hoverIdx].dia] ?? []).map((m, i) => (
                  <div key={i} className="flex gap-1 leading-snug">
                    <span>{emojiTipo(m.tipo)}</span>
                    <span className="text-white/90">
                      {m.titulo.length > 70
                        ? `${m.titulo.slice(0, 70)}…`
                        : m.titulo}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
