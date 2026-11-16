import { redirect } from 'next/navigation';
import { Figtree } from 'next/font/google';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { dadosPainel } from './dados-mock';
import { KPIsPainel, EtapasDoMes } from '../_components/PainelBlocos';

const figtree = Figtree({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'] });

export const dynamic = 'force-dynamic';

/**
 * Painel geral da Lud. — primeira versão com dados de exemplo.
 *
 * Fonte do layout: artifact "Painel geral Lud." (canvas de design).
 * Depois vamos ligar cada seção aos dados reais (Notion, Supabase, Nibo etc).
 */
export default async function PainelGeralPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    redirect('/');
  }

  const d = dadosPainel();
  const hoje = new Date();
  const nomeDia = hoje.toLocaleDateString('pt-BR', { weekday: 'long' }).replace(/^./, (c) => c.toUpperCase());
  const diaMes = `${hoje.getDate()} de ${hoje.toLocaleDateString('pt-BR', { month: 'long' })}`;
  const diaDoMes = hoje.getDate();
  const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const mesExtenso = hoje.toLocaleDateString('pt-BR', { month: 'long' });

  return (
    <div
      className={figtree.className}
      style={{
        minHeight: '100vh',
        background: '#F5F5F7',
        color: '#1D1D1F',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <div style={{ maxWidth: 1360, margin: '0 auto', padding: '40px 32px 96px', display: 'flex', flexDirection: 'column', gap: 32 }}>
        {/* Header */}
        <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#5C5C61', fontWeight: 600 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.02em' }}>Lud.</span>
              <span>Painel geral</span>
              <span style={{ background: '#F1EBE5', color: '#642223', fontSize: 12, padding: '3px 10px', borderRadius: 999 }}>
                Layout com dados de exemplo
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: 40, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.1 }}>
              Bom dia, Luiza
            </h1>
            <p style={{ margin: 0, fontSize: 16, color: '#5C5C61' }}>
              {nomeDia}, {diaMes} · dia {diaDoMes} de {diasNoMes} do ciclo de {mesExtenso}
            </p>
          </div>
          <div style={{ display: 'flex', background: '#E8E8ED', borderRadius: 12, padding: 4, gap: 2 }}>
            {['Hoje', 'Mês', 'Trimestre'].map((label, i) => (
              <button
                key={label}
                type="button"
                style={{
                  border: 0,
                  background: i === 0 ? '#FFFFFF' : 'transparent',
                  borderRadius: 9,
                  padding: '10px 16px',
                  minHeight: 40,
                  fontFamily: "inherit",
                  fontWeight: i === 0 ? 600 : 500,
                  fontSize: 14,
                  color: i === 0 ? '#1D1D1F' : '#5C5C61',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        {/* Atenção hoje — Operação + Financeiro */}
        <section style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'stretch' }}>
          <div style={cardBase({ flex: '999 1 560px', gap: 18 })}>
            <SectionHead sub="Atenção hoje" title="Operação" linkText="Ver entregas" linkHref="/admin/entregas" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, flex: 1 }}>
              {d.alertasOp.map((a) => (
                <div key={a.titulo} style={{ background: a.bg, borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: a.fg, letterSpacing: '0.02em' }}>{a.tag}</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.01em' }}>{a.titulo}</span>
                  <span style={{ fontSize: 14, color: '#48484C' }}>{a.meta}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={cardBase({ flex: '1 1 320px', gap: 14 })}>
            <SectionHead sub="Atenção hoje" title="Financeiro" linkText="Ver financeiro" linkHref="#" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {d.alertasFin.map((a) => (
                <div key={a.titulo} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: '1px solid #EFEFF2' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 999, background: a.bg, color: a.fg, flex: 'none', minWidth: 64, textAlign: 'center' }}>{a.tag}</span>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>{a.titulo}</span>
                    <span style={{ fontSize: 13, color: '#5C5C61' }}>{a.meta}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* KPIs resumo + Etapas do mês — compartilhados com a home /admin */}
        <KPIsPainel data={d} />

        <EtapasDoMes data={d} diaDoMes={diaDoMes} />

        {/* Ciclo por cliente (continua só no painel detalhado) */}
        <section style={{ background: '#FFFFFF', borderRadius: 22, border: '1px solid #E5E5EA', padding: 28, display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Ciclo por cliente</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 13, color: '#48484C' }}>
                <LegendaCiclo sym="✓" bg="#E4EBDF" fg="#3B4A33" label="Feito" />
                <LegendaCiclo sym="●" bg={d.accentTint} fg={d.accentDark} label="Em andamento" />
                <LegendaCiclo sym="!" bg="#FFD5D6" fg="#90181A" label="Atrasado" />
                <LegendaCiclo sym="–" bg="#F2F2F5" fg="#5C5C61" label="Ainda não" />
              </div>
            </div>
            <div style={{ overflowX: 'auto', border: '1px solid #E5E5EA', borderRadius: 16 }}>
              <div style={{ minWidth: 900 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '200px 150px repeat(8, minmax(0, 1fr))', padding: '12px 16px', background: '#FAFAFB', fontSize: 12, fontWeight: 700, color: '#5C5C61' }}>
                  <span>Cliente</span>
                  <span>Social media</span>
                  {['Análise set', 'Calendário dez', 'Reunião', 'Briefing nov', 'Curadoria', 'Arte', 'Aprovação', 'Programado'].map((h) => (
                    <span key={h} style={{ textAlign: 'center' }}>{h}</span>
                  ))}
                </div>
                {d.ciclo.map((c) => (
                  <div key={c.nome} style={{ display: 'grid', gridTemplateColumns: '200px 150px repeat(8, minmax(0, 1fr))', alignItems: 'center', padding: '10px 16px', borderTop: '1px solid #EFEFF2', fontSize: 14 }}>
                    <span style={{ fontWeight: 600 }}>{c.nome}</span>
                    <span style={{ color: '#5C5C61' }}>{c.sm}</span>
                    {c.cells.map((x, i) => (
                      <span key={i} style={{ display: 'flex', justifyContent: 'center' }}>
                        <span title={x.label} aria-label={x.label} style={{ width: 28, height: 28, borderRadius: 8, background: x.bg, color: x.fg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>
                          {x.sym}
                        </span>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Projetos ativos + Em atraso */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', gap: 16, alignItems: 'start' }}>
          <div style={cardBase({ gap: 16 })}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Projetos ativos</h2>
              <a href="/admin" style={linkAcento()}>Ver todos</a>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {d.projetos.map((p) => (
                <div key={p.cliente + p.servico} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 16px', padding: '14px 0', borderTop: '1px solid #EFEFF2' }}>
                  <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{p.cliente}</span>
                    <span style={{ fontSize: 13, color: '#5C5C61' }}>{p.servico} · {p.resp}</span>
                  </div>
                  <div style={{ flex: '1 1 160px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 13, color: '#5C5C61' }}>Próxima entrega</span>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{p.prox}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '5px 10px', borderRadius: 999, background: p.bg, color: p.fg }}>{p.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={cardBase({ gap: 16 })}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Em atraso</h2>
              <span style={{ fontSize: 13, fontWeight: 700, padding: '5px 10px', borderRadius: 999, background: '#FFD5D6', color: '#90181A' }}>3 itens</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <MiniStat label="Parado com o cliente" valor="2" />
              <MiniStat label="Parado com a Lud." valor="1" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {d.atrasos.map((t) => (
                <div key={t.item} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '14px 0', borderTop: '1px solid #EFEFF2' }}>
                  <span style={{ width: 52, height: 52, borderRadius: 14, background: '#FFD5D6', color: '#90181A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 'none', lineHeight: 1 }}>
                    <span style={{ fontSize: 18, fontWeight: 800 }}>{t.dias}</span>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>dias</span>
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{t.item}</span>
                    <span style={{ fontSize: 13, color: '#5C5C61' }}>{t.cliente} · com {t.com} · {t.etapa}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Entregas em andamento */}
        <section style={cardBase({ gap: 18 })}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Entregas em andamento</h2>
              <p style={{ margin: 0, fontSize: 14, color: '#5C5C61' }}>{d.totalEntregas} peças no fluxo · onde elas estão agora</p>
            </div>
            <a href="https://www.notion.so" target="_blank" rel="noopener noreferrer" style={linkAcento()}>Abrir no Notion</a>
          </div>
          <div style={{ display: 'flex', height: 14, borderRadius: 999, overflow: 'hidden', gap: 3 }}>
            {d.entregas.map((g) => (
              <div key={g.nome} style={{ width: g.pct, background: g.barra }} />
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            {d.entregas.map((g) => (
              <div key={g.nome} style={{ border: '1px solid #E5E5EA', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#48484C', fontWeight: 600 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: g.barra }} />
                  {g.nome}
                </span>
                <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>{g.n}</span>
                <span style={{ fontSize: 12, color: '#5C5C61' }}>{g.obs}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Financeiro */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.015em' }}>Financeiro</h2>
            <span style={{ fontSize: 14, color: '#5C5C61' }}>Cobranças via Nibo</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
            {d.fin.map((f) => (
              <div key={f.label} style={{ background: '#FFFFFF', borderRadius: 18, border: '1px solid #E5E5EA', padding: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 14, color: '#5C5C61', fontWeight: 500 }}>{f.label}</span>
                <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: f.cor }}>{f.valor}</span>
                <span style={{ fontSize: 13, color: '#5C5C61' }}>{f.sub}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: 16, alignItems: 'start' }}>
            {/* Próximas contas a pagar */}
            <div style={cardBase({ gap: 14 })}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Próximas contas a pagar</h3>
                <span style={{ fontSize: 14, color: '#5C5C61' }}>30 dias · <strong style={{ color: '#1D1D1F' }}>{d.totalContas}</strong></span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {d.contas.map((ct, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderTop: '1px solid #EFEFF2' }}>
                    <span style={{ width: 50, flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
                      <span style={{ fontSize: 18, fontWeight: 800 }}>{ct.dia}</span>
                      <span style={{ fontSize: 11, color: '#5C5C61', fontWeight: 600 }}>{ct.mes}</span>
                    </span>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{ct.desc}</span>
                      <span style={{ fontSize: 12, color: '#5C5C61' }}>{ct.cat}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{ct.valor}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: ct.bg, color: ct.fg }}>{ct.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Caixa projetado + Margem por cliente */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={cardBase({ gap: 16 })}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Caixa projetado</h3>
                  <span style={{ fontSize: 13, color: '#5C5C61' }}>próximos 3 meses</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, alignItems: 'end', height: 180 }}>
                  {d.caixa.map((cx) => (
                    <div key={cx.m} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 130 }}>
                        <div style={{ width: 28, height: cx.inH, background: d.accent, borderRadius: '6px 6px 2px 2px' }} />
                        <div style={{ width: 28, height: cx.outH, background: '#C7C7CC', borderRadius: '6px 6px 2px 2px' }} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{cx.m}</span>
                      <span style={{ fontSize: 12, color: '#3B4A33', fontWeight: 600 }}>{cx.saldo}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#48484C' }}>
                  <LegendaBar cor={d.accent} label="Entradas" />
                  <LegendaBar cor="#C7C7CC" label="Saídas" />
                </div>
              </div>

              <div style={cardBase({ gap: 14 })}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Margem por cliente</h3>
                  <span style={{ fontSize: 13, color: '#5C5C61' }}>menores primeiro</span>
                </div>
                {d.margens.map((mg) => (
                  <div key={mg.c} style={{ display: 'grid', gridTemplateColumns: '110px minmax(0, 1fr) 48px', alignItems: 'center', gap: 12, fontSize: 14 }}>
                    <span style={{ fontWeight: 600 }}>{mg.c}</span>
                    <div style={{ height: 10, background: '#F2F2F5', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: mg.w, background: mg.cor, borderRadius: 999 }} />
                    </div>
                    <span style={{ textAlign: 'right', fontWeight: 700, color: mg.txt }}>{mg.m}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Pessoas */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.015em' }}>Pessoas</h2>
            <span style={{ fontSize: 14, color: '#5C5C61' }}>Capacidade de design: 2 designers · 88% ocupada</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            {d.pessoas.map((ps) => (
              <div key={ps.papel} style={{ background: '#FFFFFF', borderRadius: 20, border: '1px solid #E5E5EA', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 44, height: 44, borderRadius: '50%', background: '#F2F2F5', color: '#1D1D1F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flex: 'none' }}>
                    {ps.ini}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{ps.papel}</span>
                    <span style={{ fontSize: 13, color: '#5C5C61' }}>{ps.clientes}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#5C5C61' }}>Carga</span>
                    <span style={{ fontWeight: 700, color: ps.txt }}>{ps.carga}%</span>
                  </div>
                  <div style={{ height: 8, background: '#F2F2F5', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: ps.w, background: ps.cor, borderRadius: 999 }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 12, color: '#5C5C61' }}>No prazo</span>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>{ps.prazo}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 12, color: '#5C5C61' }}>{ps.terceiroLabel}</span>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>{ps.terceiro}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Administrativo e comercial */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.015em' }}>Administrativo e comercial</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
            {d.adm.map((a) => (
              <div key={a.label} style={{ background: '#FFFFFF', borderRadius: 18, border: '1px solid #E5E5EA', padding: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 14, color: '#5C5C61', fontWeight: 500 }}>{a.label}</span>
                <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>{a.valor}</span>
                <span style={{ fontSize: 13, color: '#5C5C61' }}>{a.sub}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: 16, alignItems: 'start' }}>
            <div style={cardBase({ gap: 14 })}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Contratos e renovações</h3>
                <a href="#" style={linkAcento()}>Ver contratos</a>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {d.contratos.map((c) => (
                  <div key={c.cliente} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 16px', padding: '12px 0', borderTop: '1px solid #EFEFF2' }}>
                    <div style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{c.cliente}</span>
                      <span style={{ fontSize: 12, color: '#5C5C61' }}>{c.servico}</span>
                    </div>
                    <span style={{ fontSize: 13, color: '#48484C', flex: '0 0 auto' }}>{c.vence}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: c.bg, color: c.fg }}>{c.acao}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={cardBase({ gap: 16 })}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Saúde da carteira</h3>
                <span style={{ fontSize: 13, color: '#5C5C61' }}>visão mensal</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                {d.saude.map((s) => (
                  <div key={s.label} style={{ background: '#F5F5F7', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 13, color: '#5C5C61' }}>{s.label}</span>
                    <span style={{ fontSize: 22, fontWeight: 700 }}>{s.valor}</span>
                    <span style={{ fontSize: 12, color: '#5C5C61' }}>{s.sub}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Rodapé — link voltar */}
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <a href="/admin" style={{ fontSize: 13, color: '#5C5C61', fontWeight: 600, textDecoration: 'none' }}>
            ← Voltar pra home admin
          </a>
        </div>
      </div>
    </div>
  );
}

// ------- helpers (server components) -------

function cardBase(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    background: '#FFFFFF',
    borderRadius: 22,
    border: '1px solid #E5E5EA',
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    ...extra,
  };
}

function linkAcento(): React.CSSProperties {
  return { color: '#3F3DB8', textDecoration: 'none', fontWeight: 600, fontSize: 14 };
}

function SectionHead({ sub, title, linkText, linkHref }: { sub: string; title: string; linkText: string; linkHref: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 13, color: '#5C5C61', fontWeight: 600 }}>{sub}</span>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</h2>
      </div>
      <a href={linkHref} style={linkAcento()}>{linkText}</a>
    </div>
  );
}

function LegendaCiclo({ sym, bg, fg, label }: { sym: string; bg: string; fg: string; label: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 22, height: 22, borderRadius: 7, background: bg, color: fg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
        {sym}
      </span>
      {label}
    </span>
  );
}

function MiniStat({ label, valor }: { label: string; valor: string }) {
  return (
    <div style={{ background: '#F5F5F7', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 13, color: '#5C5C61' }}>{label}</span>
      <span style={{ fontSize: 24, fontWeight: 700 }}>{valor}</span>
    </div>
  );
}

function LegendaBar({ cor, label }: { cor: string; label: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: cor }} />
      {label}
    </span>
  );
}
