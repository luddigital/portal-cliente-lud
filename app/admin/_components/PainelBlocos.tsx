import { Figtree } from 'next/font/google';
import type { dadosPainel } from '../painel/dados-mock';

const figtree = Figtree({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'] });

type Dados = ReturnType<typeof dadosPainel>;

/** Subset de `Dados` que o <EtapasDoMes /> realmente usa — assim o cronograma
 *  de um projeto específico (que não tem alertas/KPIs/pessoas/etc) encaixa aqui. */
type DadosEtapasDoMes = Pick<Dados, 'accent' | 'accentTint' | 'accentDark' | 'dias' | 'etapas'>;

/** Grid de 6 KPIs — Clientes, Projetos, Entregas, Atraso, Receita, A pagar. */
export function KPIsPainel({ data }: { data: Dados }) {
  return (
    <div
      className={figtree.className}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
        gap: 12,
        color: '#1D1D1F',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {data.kpis.map((k) => (
        <div
          key={k.label}
          style={{
            background: '#FFFFFF',
            borderRadius: 18,
            border: '1px solid #E5E5EA',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <span style={{ fontSize: 14, color: '#5C5C61', fontWeight: 500 }}>{k.label}</span>
          <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', color: k.cor }}>
            {k.valor}
          </span>
          <span style={{ fontSize: 13, color: '#5C5C61' }}>{k.sub}</span>
        </div>
      ))}
    </div>
  );
}

/** Seção "Etapas do mês" completa: descrição + pills dos 4 meses + 4 milestones + Gantt. */
export function EtapasDoMes({ data, diaDoMes }: { data: DadosEtapasDoMes; diaDoMes: number }) {
  return (
    <section
      className={figtree.className}
      style={{
        background: '#FFFFFF',
        borderRadius: 22,
        border: '1px solid #E5E5EA',
        padding: 28,
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
        color: '#1D1D1F',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.015em' }}>
            Etapas do mês
          </h2>
          <p style={{ margin: 0, fontSize: 15, color: '#5C5C61' }}>
            Em outubro rodam quatro meses ao mesmo tempo: analisamos setembro, publicamos outubro, produzimos novembro e planejamos dezembro.
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Pill bg="#EDEDF0" fg="#48484C">Setembro · análise</Pill>
          <Pill bg="#E4EBDF" fg="#3B4A33">Outubro · no ar</Pill>
          <Pill bg={data.accentTint} fg={data.accentDark}>Novembro · produção</Pill>
          <Pill bg="#F1EBE5" fg="#642223">Dezembro · planejamento</Pill>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <MilestoneCard dia="5" bg="#E4EBDF" fg="#3B4A33" titulo="Calendário de dezembro" sub="Entregue · 13 de 14" subColor="#3B4A33" />
        <MilestoneCard dia="15" bg={data.accent} fg="#FFFFFF" titulo="Reuniões com clientes" sub="Hoje · 9 de 14 feitas" subColor={data.accentDark} destaque border={`2px solid ${data.accent}`} />
        <MilestoneCard dia="28" bg="#F2F2F5" fg="#1D1D1F" titulo="Briefings de novembro" sub="Em 13 dias · 4 de 14 prontos" subColor="#5C5C61" />
        <MilestoneCard dia="31" bg="#F2F2F5" fg="#1D1D1F" titulo="Fechamento de outubro" sub="Abre a análise de novembro" subColor="#5C5C61" />
      </div>

      {/* Gantt */}
      <div style={{ overflowX: 'auto', borderRadius: 14 }}>
        <div style={{ minWidth: 980, position: 'relative', paddingTop: 4 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '240px repeat(31, minmax(0, 1fr))', alignItems: 'end', height: 32 }}>
            <div style={{ fontSize: 12, color: '#5C5C61', fontWeight: 600 }}>Etapa</div>
            {data.dias.map((dia) => (
              <div key={dia.n} style={{ textAlign: 'center', fontSize: 11, color: dia.cor, fontWeight: dia.peso }}>
                {dia.n}
              </div>
            ))}
          </div>
          {data.etapas.map((e) => {
            const href = (e as { href?: string }).href;
            const barraStyle = {
              gridColumn: e.col,
              height: 32,
              borderRadius: 9,
              background: e.bg,
              color: e.fg,
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              padding: '0 10px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              margin: '0 2px',
              textDecoration: 'none',
              cursor: href ? 'pointer' : 'default',
              transition: 'opacity 0.15s',
            } as React.CSSProperties;
            return (
              <div
                key={e.nome}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '240px repeat(31, minmax(0, 1fr))',
                  alignItems: 'center',
                  minHeight: 58,
                  borderTop: '1px solid #EFEFF2',
                }}
              >
                <div style={{ paddingRight: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {href ? (
                    <a
                      href={href}
                      style={{ fontSize: 14, fontWeight: 700, color: '#1D1D1F', textDecoration: 'none' }}
                      className="hover:underline"
                    >
                      {e.nome}
                    </a>
                  ) : (
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{e.nome}</span>
                  )}
                  <span style={{ fontSize: 12, color: '#5C5C61' }}>{e.quem}</span>
                </div>
                {href ? (
                  <a href={href} style={barraStyle} className="hover:opacity-85">
                    {e.rotulo}
                  </a>
                ) : (
                  <div style={barraStyle}>{e.rotulo}</div>
                )}
              </div>
            );
          })}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `calc(240px + (100% - 240px) * ${(diaDoMes - 1) / 31})`,
              width: 2,
              marginLeft: -1,
              background: data.accent,
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
    </section>
  );
}

function Pill({ children, bg, fg }: { children: React.ReactNode; bg: string; fg: string }) {
  return (
    <span style={{ fontSize: 13, fontWeight: 600, padding: '6px 12px', borderRadius: 999, background: bg, color: fg }}>
      {children}
    </span>
  );
}

function MilestoneCard({
  dia, bg, fg, titulo, sub, subColor, destaque, border,
}: {
  dia: string; bg: string; fg: string; titulo: string; sub: string; subColor: string; destaque?: boolean; border?: string;
}) {
  return (
    <div
      style={{
        border: border ?? '1px solid #E5E5EA',
        borderRadius: 16,
        padding: destaque ? 15 : 16,
        display: 'flex',
        gap: 14,
        alignItems: 'center',
      }}
    >
      <span
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: bg,
          color: fg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: 18,
          flex: 'none',
        }}
      >
        {dia}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{titulo}</span>
        <span style={{ fontSize: 13, color: subColor, fontWeight: 600 }}>{sub}</span>
      </div>
    </div>
  );
}
