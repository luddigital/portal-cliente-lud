'use client';

import { useMemo, useRef, useState } from 'react';
import type { RelatorioAds, AdSetRow } from '@/lib/csvAds';
import type { ClienteResumo, ProjetoListItem } from '@/lib/notion';

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNum = (n: number) =>
  n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const fmtDec = (n: number, d = 2) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

function fmtData(iso: string): string {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

type ProjetoBriefing = {
  id: string;
  nome: string;
  clienteNome: string | null;
  objetivo: string;
  foco: string[];
};

type Sugestao = {
  tom: 'alerta' | 'atencao' | 'positivo' | 'info';
  titulo: string;
  texto: string;
};

function gerarSugestoes(relatorio: RelatorioAds, objetivo: string): Sugestao[] {
  const out: Sugestao[] = [];
  const t = relatorio.totais;
  const obj = objetivo.toLowerCase();

  // Frequência alta — saturação de criativo
  if (t.frequenciaMedia >= 3) {
    out.push({
      tom: 'atencao',
      titulo: 'Frequência alta — sinal de saturação',
      texto: `A frequência média está em ${fmtDec(t.frequenciaMedia)}. Acima de 3, o mesmo público começa a ver muitas vezes o anúncio. Vale trocar o criativo ou abrir o público.`,
    });
  } else if (t.frequenciaMedia > 0 && t.frequenciaMedia < 1.3) {
    out.push({
      tom: 'positivo',
      titulo: 'Frequência saudável',
      texto: `Frequência em ${fmtDec(t.frequenciaMedia)} — ainda há espaço pra escalar antes de saturar o público.`,
    });
  }

  // ROAS
  if (t.roas != null) {
    if (t.roas < 1) {
      out.push({
        tom: 'alerta',
        titulo: 'ROAS abaixo de 1x',
        texto: `Cada R$ 1 investido devolveu R$ ${fmtDec(t.roas)}. A campanha está dando prejuízo. Reveja oferta, criativo e públicos antes de manter o investimento.`,
      });
    } else if (t.roas >= 3) {
      out.push({
        tom: 'positivo',
        titulo: `ROAS forte — ${fmtDec(t.roas)}x`,
        texto: `O retorno está consistente. Vale aumentar o investimento gradualmente (20–30% por vez) nos conjuntos que estão performando melhor.`,
      });
    } else if (t.roas < 2) {
      out.push({
        tom: 'atencao',
        titulo: `ROAS apertado — ${fmtDec(t.roas)}x`,
        texto: `Ainda lucrativo, mas com margem fina. Olhe se dá pra cortar conjuntos com custo por compra acima da média e concentrar verba nos que pagam.`,
      });
    }
  }

  // CPM alto absoluto
  if (t.cpm > 60) {
    out.push({
      tom: 'atencao',
      titulo: 'CPM acima de R$ 60',
      texto: `Está pagando ${fmtBRL(t.cpm)} pra cada 1.000 impressões. Pode ser sinal de público muito quente, criativo gasto ou concorrência alta. Teste novos criativos e públicos.`,
    });
  }

  // Conjuntos sem clique (quando a campanha mede cliques)
  const algumComCliques = relatorio.adSets.some((a) => a.cliques != null);
  if (algumComCliques) {
    const semCliques = relatorio.adSets.filter(
      (a) => (a.cliques ?? 0) === 0 && a.investimento > 0,
    );
    if (semCliques.length > 0) {
      out.push({
        tom: 'alerta',
        titulo: `${semCliques.length} conjunto(s) sem cliques`,
        texto: `Gastou dinheiro sem gerar cliques: ${semCliques.map((a) => a.nome).join(', ')}. Pausa esses e direciona verba pros que estão gerando ação.`,
      });
    }
  }

  // Conjuntos pausados
  const pausados = relatorio.adSets.filter(
    (a) => (a.veiculacao ?? '').toLowerCase() !== 'active' && a.investimento > 0,
  );
  if (pausados.length > 0 && pausados.length < relatorio.adSets.length) {
    out.push({
      tom: 'info',
      titulo: `${pausados.length} conjunto(s) pausado(s) no período`,
      texto: `Esses conjuntos rodaram parte do período e foram pausados: ${pausados.map((a) => a.nome).join(', ')}. Confira se foi decisão estratégica ou se vale reativar.`,
    });
  }

  // Melhor conjunto (por ROAS ou custo por compra)
  if (relatorio.adSets.length > 1) {
    const comRoas = relatorio.adSets
      .filter((a) => a.receita != null && a.investimento > 0)
      .map((a) => ({ a, roas: (a.receita ?? 0) / a.investimento }))
      .sort((x, y) => y.roas - x.roas);
    if (comRoas.length > 0 && comRoas[0].roas > 0) {
      out.push({
        tom: 'positivo',
        titulo: 'Conjunto campeão',
        texto: `"${comRoas[0].a.nome}" entregou o melhor ROAS (${fmtDec(comRoas[0].roas)}x). Vale escalar o investimento dele primeiro.`,
      });
    }
  }

  // Objetivo "seguidores" — relatório de follower campaign
  if (
    (obj.includes('seguidor') || obj.includes('follow')) &&
    t.seguidoresIg != null
  ) {
    const custoPorSeguidor =
      t.seguidoresIg > 0 ? t.investimento / t.seguidoresIg : null;
    if (custoPorSeguidor != null) {
      const tom: Sugestao['tom'] =
        custoPorSeguidor > 25
          ? 'atencao'
          : custoPorSeguidor < 8
            ? 'positivo'
            : 'info';
      out.push({
        tom,
        titulo: `Custo por seguidor: ${fmtBRL(custoPorSeguidor)}`,
        texto: `${t.seguidoresIg} novo(s) seguidor(es) no IG por ${fmtBRL(t.investimento)} investidos. ${custoPorSeguidor > 25 ? 'Está caro — vale revisar criativo e público.' : custoPorSeguidor < 8 ? 'Custo ótimo, dá pra escalar.' : 'Custo dentro do esperado.'}`,
      });
    }
  }

  // CTR baixo (quando mede cliques)
  if (t.ctr != null) {
    if (t.ctr < 1) {
      out.push({
        tom: 'atencao',
        titulo: `CTR baixo — ${fmtDec(t.ctr)}%`,
        texto: `Menos de 1% do público que viu clicou. Criativo provavelmente não está parando o feed. Teste hooks novos, primeiros 3s mais fortes, copy mais direta.`,
      });
    } else if (t.ctr > 2.5) {
      out.push({
        tom: 'positivo',
        titulo: `CTR forte — ${fmtDec(t.ctr)}%`,
        texto: `O criativo está prendendo atenção. Mantém esse padrão de hook e gancho nos próximos.`,
      });
    }
  }

  if (out.length === 0) {
    out.push({
      tom: 'info',
      titulo: 'Sem alertas no período',
      texto:
        'As métricas estão dentro de uma faixa equilibrada. Mantém o teste rodando e revisa de novo na próxima semana.',
    });
  }

  return out;
}

function SecTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-t3">
      <span className="h-3 w-0.5 rounded-full bg-navy" />
      {children}
    </div>
  );
}

function Card({
  label,
  valor,
  tom,
}: {
  label: string;
  valor: string;
  tom?: 'destaque' | 'sucesso';
}) {
  const cor =
    tom === 'destaque'
      ? { bg: 'var(--prazo-hoje-soft)', txt: 'var(--prazo-hoje)' }
      : tom === 'sucesso'
        ? { bg: 'var(--prazo-em-dia-soft)', txt: 'var(--prazo-em-dia)' }
        : null;
  return (
    <div
      className="rounded-xl border border-[rgba(21,21,33,0.08)] p-4"
      style={cor ? { background: cor.bg } : { background: 'var(--bgSoft)' }}
    >
      <div
        className="text-[10px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: cor?.txt ?? 'var(--t3)' }}
      >
        {label}
      </div>
      <div
        className="mt-2 text-[20px] font-semibold tracking-[-0.02em]"
        style={{ color: cor?.txt ?? 'var(--ink)' }}
      >
        {valor}
      </div>
    </div>
  );
}

function CartaoSugestao({ s }: { s: Sugestao }) {
  const cores = {
    alerta: { bg: 'var(--prazo-atrasado-soft)', txt: 'var(--prazo-atrasado)', icon: '⚠️' },
    atencao: { bg: 'var(--prazo-hoje-soft)', txt: 'var(--prazo-hoje)', icon: '👀' },
    positivo: { bg: 'var(--prazo-em-dia-soft)', txt: 'var(--prazo-em-dia)', icon: '🚀' },
    info: { bg: 'var(--bgSoft)', txt: 'var(--t2)', icon: '💡' },
  }[s.tom];
  return (
    <div
      className="rounded-xl border border-[rgba(21,21,33,0.08)] p-4"
      style={{ background: cores.bg }}
    >
      <div className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: cores.txt }}>
        <span>{cores.icon}</span>
        {s.titulo}
      </div>
      <p className="mt-1.5 text-[12px] leading-snug" style={{ color: 'var(--ink)' }}>
        {s.texto}
      </p>
    </div>
  );
}

function BoxBriefing({
  projeto,
  objetivo,
  landing,
}: {
  projeto: ProjetoBriefing | null;
  objetivo: string;
  landing: string;
}) {
  if (!projeto && !objetivo && !landing) return null;
  return (
    <div className="rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white p-5">
      <SecTitle>Contexto da campanha</SecTitle>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {projeto?.clienteNome && (
          <BriefingCampo label="Cliente" valor={projeto.clienteNome} />
        )}
        {projeto?.nome && (
          <BriefingCampo label="Projeto" valor={projeto.nome} />
        )}
        {objetivo && (
          <BriefingCampo label="Objetivo da campanha" valor={objetivo} />
        )}
        {landing && (
          <BriefingCampo label="Landing page" valor={landing} link />
        )}
      </div>
      {(projeto?.objetivo || (projeto?.foco?.length ?? 0) > 0) && (
        <div className="mt-4 rounded-xl bg-bgSoft p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
            Briefing do projeto
          </div>
          {projeto?.objetivo && (
            <p className="mt-1.5 text-[12px] text-ink whitespace-pre-wrap">
              {projeto.objetivo}
            </p>
          )}
          {projeto?.foco && projeto.foco.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {projeto.foco.map((f, i) => (
                <span
                  key={i}
                  className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-t2"
                >
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BriefingCampo({
  label,
  valor,
  link,
}: {
  label: string;
  valor: string;
  link?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
        {label}
      </div>
      <div className="mt-0.5 text-[13px] text-ink">
        {link ? (
          <a
            href={valor}
            target="_blank"
            rel="noreferrer"
            className="break-all text-navy underline-offset-2 hover:underline"
          >
            {valor}
          </a>
        ) : (
          valor
        )}
      </div>
    </div>
  );
}

function Dashboard({ relatorio }: { relatorio: RelatorioAds }) {
  const t = relatorio.totais;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-bgSoft px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-t2">
          {fmtData(relatorio.periodo.inicio)} → {fmtData(relatorio.periodo.fim)}
        </span>
        <span className="rounded-full bg-bgSoft px-3 py-1.5 text-[11px] text-t2">
          {relatorio.adSets.length}{' '}
          {relatorio.adSets.length === 1 ? 'conjunto de anúncios' : 'conjuntos de anúncios'}
        </span>
      </div>

      <div>
        <SecTitle>Totais</SecTitle>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          <Card label="Investimento" valor={fmtBRL(t.investimento)} tom="destaque" />
          {t.receita != null && (
            <Card label="Receita" valor={fmtBRL(t.receita)} tom="sucesso" />
          )}
          {t.roas != null && (
            <Card label="ROAS" valor={`${fmtDec(t.roas)}x`} tom="sucesso" />
          )}
          {t.compras != null && (
            <Card label="Compras" valor={fmtNum(t.compras)} />
          )}
          {t.custoPorCompra != null && (
            <Card label="Custo por compra" valor={fmtBRL(t.custoPorCompra)} />
          )}
          <Card label="Impressões" valor={fmtNum(t.impressoes)} />
          <Card label="Alcance" valor={fmtNum(t.alcance)} />
          <Card label="Frequência" valor={fmtDec(t.frequenciaMedia)} />
          {t.cliques != null && (
            <Card label="Cliques" valor={fmtNum(t.cliques)} />
          )}
          {t.ctr != null && (
            <Card label="CTR" valor={`${fmtDec(t.ctr)}%`} />
          )}
          {t.cpc != null && (
            <Card label="CPC" valor={fmtBRL(t.cpc)} />
          )}
          <Card label="CPM" valor={fmtBRL(t.cpm)} />
          {t.seguidoresIg != null && (
            <Card label="Seguidores no Instagram" valor={fmtNum(t.seguidoresIg)} />
          )}
        </div>
      </div>

      <div>
        <SecTitle>Conjuntos de anúncios</SecTitle>
        <div className="mt-3 overflow-x-auto min-h-fit rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[rgba(21,21,33,0.06)] text-[10px] font-semibold uppercase tracking-[0.06em] text-t3">
                <th className="px-3 py-2 text-left">Conjunto</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Investimento</th>
                <th className="px-3 py-2 text-right">Impressões</th>
                <th className="px-3 py-2 text-right">Alcance</th>
                <th className="px-3 py-2 text-right">Freq.</th>
                <th className="px-3 py-2 text-right">CPM</th>
                {relatorio.adSets.some((a) => a.cliques != null) && (
                  <th className="px-3 py-2 text-right">Cliques</th>
                )}
                {relatorio.adSets.some((a) => a.compras != null) && (
                  <th className="px-3 py-2 text-right">Compras</th>
                )}
                {relatorio.adSets.some((a) => a.receita != null) && (
                  <th className="px-3 py-2 text-right">Receita</th>
                )}
                {relatorio.adSets.some((a) => a.seguidoresIg != null) && (
                  <th className="px-3 py-2 text-right">Seguidores IG</th>
                )}
              </tr>
            </thead>
            <tbody>
              {relatorio.adSets.map((a, i) => (
                <LinhaAdSet key={i} a={a} relatorio={relatorio} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function LinhaAdSet({ a, relatorio }: { a: AdSetRow; relatorio: RelatorioAds }) {
  const ativo = (a.veiculacao ?? '').toLowerCase() === 'active';
  return (
    <tr className="border-b border-[rgba(21,21,33,0.04)] last:border-b-0">
      <td className="px-3 py-2 text-ink">{a.nome}</td>
      <td className="px-3 py-2">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]"
          style={{
            background: ativo ? 'var(--prazo-em-dia-soft)' : 'var(--bgSoft)',
            color: ativo ? 'var(--prazo-em-dia)' : 'var(--t3)',
          }}
        >
          {ativo ? 'Ativo' : a.veiculacao || 'Pausado'}
        </span>
      </td>
      <td className="px-3 py-2 text-right font-mono">{fmtBRL(a.investimento)}</td>
      <td className="px-3 py-2 text-right font-mono">{fmtNum(a.impressoes)}</td>
      <td className="px-3 py-2 text-right font-mono">{fmtNum(a.alcance)}</td>
      <td className="px-3 py-2 text-right font-mono">{fmtDec(a.frequencia)}</td>
      <td className="px-3 py-2 text-right font-mono">{fmtBRL(a.cpm)}</td>
      {relatorio.adSets.some((x) => x.cliques != null) && (
        <td className="px-3 py-2 text-right font-mono">
          {a.cliques != null ? fmtNum(a.cliques) : '—'}
        </td>
      )}
      {relatorio.adSets.some((x) => x.compras != null) && (
        <td className="px-3 py-2 text-right font-mono">
          {a.compras != null ? fmtNum(a.compras) : '—'}
        </td>
      )}
      {relatorio.adSets.some((x) => x.receita != null) && (
        <td className="px-3 py-2 text-right font-mono">
          {a.receita != null ? fmtBRL(a.receita) : '—'}
        </td>
      )}
      {relatorio.adSets.some((x) => x.seguidoresIg != null) && (
        <td className="px-3 py-2 text-right font-mono">
          {a.seguidoresIg != null ? fmtNum(a.seguidoresIg) : '—'}
        </td>
      )}
    </tr>
  );
}

export function TrafegoPagoView({
  clientes,
  projetos,
}: {
  clientes: ClienteResumo[];
  projetos: ProjetoListItem[];
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [clienteId, setClienteId] = useState('');
  const [projetoId, setProjetoId] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [landing, setLanding] = useState('');
  const [relatorio, setRelatorio] = useState<RelatorioAds | null>(null);
  const [projetoBriefing, setProjetoBriefing] = useState<ProjetoBriefing | null>(null);
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projetosDoCliente = useMemo(() => {
    if (!clienteId) return projetos;
    return projetos.filter((p) => p.clienteId === clienteId);
  }, [clienteId, projetos]);

  function trocaCliente(id: string) {
    setClienteId(id);
    if (id) {
      const projAtual = projetos.find((p) => p.id === projetoId);
      if (!projAtual || projAtual.clienteId !== id) {
        setProjetoId('');
      }
    }
  }

  async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setLoading(true);
    setError(null);
    setArquivo(f.name);
    try {
      const fd = new FormData();
      fd.append('arquivo', f);
      if (projetoId) fd.append('projetoId', projetoId);
      const res = await fetch('/api/admin/trafego-pago/parse', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
      setRelatorio(data.relatorio as RelatorioAds);
      setProjetoBriefing((data.projeto as ProjetoBriefing) ?? null);
    } catch (e: any) {
      setError(e.message);
      setRelatorio(null);
    } finally {
      setLoading(false);
    }
  }

  const sugestoes = useMemo(() => {
    if (!relatorio) return [];
    return gerarSugestoes(relatorio, objetivo);
  }, [relatorio, objetivo]);

  return (
    <div className="space-y-6">
      {/* Form de contexto */}
      <div className="card p-5 print:hidden">
        <SecTitle>Contexto da campanha</SecTitle>
        <p className="mt-1 text-[12px] text-t3">
          Preencha antes de subir o relatório — assim a gente puxa o briefing
          do projeto e gera sugestões direcionadas.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Campo label="Cliente">
            <select
              value={clienteId}
              onChange={(e) => trocaCliente(e.target.value)}
              className="w-full rounded-lg border border-[rgba(21,21,33,0.12)] bg-white px-3 py-2 text-[13px] text-ink focus:border-navy focus:outline-none"
            >
              <option value="">Todos os clientes</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Campo>

          <Campo label="Projeto">
            <select
              value={projetoId}
              onChange={(e) => setProjetoId(e.target.value)}
              className="w-full rounded-lg border border-[rgba(21,21,33,0.12)] bg-white px-3 py-2 text-[13px] text-ink focus:border-navy focus:outline-none"
            >
              <option value="">Selecione um projeto</option>
              {projetosDoCliente.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                  {!clienteId && p.clienteNome ? ` — ${p.clienteNome}` : ''}
                </option>
              ))}
            </select>
          </Campo>

          <Campo label="Objetivo da campanha">
            <input
              type="text"
              value={objetivo}
              onChange={(e) => setObjetivo(e.target.value)}
              placeholder="Ex: venda de infoproduto, geração de leads, seguidores…"
              className="w-full rounded-lg border border-[rgba(21,21,33,0.12)] bg-white px-3 py-2 text-[13px] text-ink placeholder:text-t3 focus:border-navy focus:outline-none"
            />
          </Campo>

          <Campo label="Landing page (opcional)">
            <input
              type="url"
              value={landing}
              onChange={(e) => setLanding(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-lg border border-[rgba(21,21,33,0.12)] bg-white px-3 py-2 text-[13px] text-ink placeholder:text-t3 focus:border-navy focus:outline-none"
            />
          </Campo>
        </div>

        <div className="mt-5">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={escolher}
            className="hidden"
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[rgba(21,21,33,0.2)] bg-bgSoft px-4 py-6 text-[13px] font-medium text-t2 transition hover:border-navy/40 hover:text-ink disabled:opacity-50"
          >
            {loading ? 'Lendo relatório…' : '📊 Subir relatório (.csv) do Gerenciador da Meta'}
          </button>
          {arquivo && !error && !loading && (
            <p className="mt-2 text-[11px] text-t3">
              <b>{arquivo}</b> — relatório carregado.
            </p>
          )}
          {error && (
            <p className="mt-2 text-[12px] font-medium text-hubRed">{error}</p>
          )}
        </div>
      </div>

      {/* Briefing + dashboard */}
      {relatorio && (
        <div id="relatorio-export" className="space-y-6">
          {/* Cabeçalho no print */}
          <div className="hidden print:block">
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">
              Relatório de tráfego pago
            </h1>
            <p className="mt-1 text-[12px] text-t2">
              {fmtData(relatorio.periodo.inicio)} → {fmtData(relatorio.periodo.fim)}
            </p>
          </div>

          <BoxBriefing
            projeto={projetoBriefing}
            objetivo={objetivo}
            landing={landing}
          />

          <Dashboard relatorio={relatorio} />

          {/* Sugestões */}
          <div>
            <div className="flex items-center justify-between">
              <SecTitle>Sugestões & insights</SecTitle>
              <button
                type="button"
                onClick={() => window.print()}
                className="print:hidden rounded-lg bg-navy px-3 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-90"
              >
                🖨️ Exportar relatório
              </button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {sugestoes.map((s, i) => (
                <CartaoSugestao key={i} s={s} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CSS de print */}
      <style jsx global>{`
        @media print {
          body {
            background: white;
          }
          aside,
          nav,
          .print\\:hidden {
            display: none !important;
          }
          main {
            max-width: 100% !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
        {label}
      </div>
      {children}
    </label>
  );
}
