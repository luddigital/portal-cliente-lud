/**
 * Parser de CSV do Gerenciador de Anúncios da Meta (export em pt-BR).
 * Cada export pode ter colunas diferentes — a gente identifica pelo nome
 * do header e só popula as métricas que existem no arquivo.
 */

export type AdSetRow = {
  nome: string;
  veiculacao: string;
  investimento: number;
  impressoes: number;
  alcance: number;
  frequencia: number;
  cpm: number;
  cliques?: number | null;
  ctr?: number | null;
  cpc?: number | null;
  resultados?: number | null;
  custoPorResultado?: number | null;
  indicadorResultado?: string | null;
  seguidoresIg?: number | null;
  compras?: number | null;
  receita?: number | null;
};

export type RelatorioAds = {
  periodo: { inicio: string; fim: string };
  adSets: AdSetRow[];
  totais: {
    investimento: number;
    impressoes: number;
    alcance: number;
    cliques: number | null;
    cpm: number;
    cpc: number | null;
    ctr: number | null;
    compras: number | null;
    receita: number | null;
    roas: number | null;
    custoPorCompra: number | null;
    seguidoresIg: number | null;
    frequenciaMedia: number;
  };
};

/** Parser de CSV simples (suporta aspas duplas e escape ""). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n' || c === '\r') {
        if (field !== '' || row.length > 0) {
          row.push(field);
          rows.push(row);
        }
        row = [];
        field = '';
        if (c === '\r' && text[i + 1] === '\n') i++;
      } else field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const norm = (s: string) =>
  (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

function findCol(headers: string[], keywords: string[]): number {
  for (const k of keywords) {
    const kk = norm(k);
    const idx = headers.findIndex((h) => norm(h).includes(kk));
    if (idx >= 0) return idx;
  }
  return -1;
}

function toNum(s: string | undefined): number | null {
  if (s == null) return null;
  const t = s.trim();
  if (t === '' || t === '-') return null;
  // BR às vezes usa ',' como decimal; já vem com '.' nos exports
  const cleaned = t.replace(/\s/g, '').replace(/[^\d.,-]/g, '');
  if (cleaned === '') return null;
  // se tem ',' e não tem '.', vira decimal vírgula → ponto
  const norm = cleaned.includes(',') && !cleaned.includes('.')
    ? cleaned.replace(',', '.')
    : cleaned;
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

function getStr(row: string[], idx: number): string {
  return idx >= 0 ? (row[idx] ?? '').trim() : '';
}

function getNum(row: string[], idx: number): number | null {
  return idx >= 0 ? toNum(row[idx]) : null;
}

export function parseRelatorio(text: string): RelatorioAds | { error: string } {
  const rows = parseCsv(text);
  if (rows.length < 2) return { error: 'CSV vazio ou sem dados.' };
  const headers = rows[0];

  const cols = {
    inicio: findCol(headers, ['Início dos relatórios', 'Inicio dos relatorios']),
    fim: findCol(headers, ['Encerramento dos relatórios', 'Encerramento']),
    nome: findCol(headers, [
      'Nome do conjunto de anúncios',
      'Nome do conjunto',
      'Nome do anúncio',
      'Nome da campanha',
    ]),
    veiculacao: findCol(headers, ['Veiculação', 'Veiculacao', 'Status']),
    seguidoresIg: findCol(headers, ['Seguidores no Instagram', 'Seguidores no Instagram conquistados']),
    resultados: findCol(headers, ['Resultados']),
    indicadorResultados: findCol(headers, ['Indicador de resultados']),
    custoPorResultado: findCol(headers, ['Custo por resultados', 'Custo por resultado']),
    investimento: findCol(headers, ['Valor usado', 'Valor gasto']),
    impressoes: findCol(headers, ['Impressões', 'Impressoes']),
    alcance: findCol(headers, ['Alcance']),
    frequencia: findCol(headers, ['Frequência', 'Frequencia']),
    cpm: findCol(headers, ['Custo por 1.000', 'CPM']),
    cliques: findCol(headers, ['Cliques no link', 'Cliques (todos)', 'Cliques']),
    ctr: findCol(headers, ['CTR']),
    cpc: findCol(headers, ['CPC']),
    compras: findCol(headers, ['Compras', 'Compras no site']),
    receita: findCol(headers, ['Valor de conversão da compra', 'Valor da compra']),
  };

  const adSets: AdSetRow[] = [];
  let inicio = '';
  let fim = '';

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const nome = getStr(r, cols.nome);
    if (!nome) continue; // linha vazia
    inicio = inicio || getStr(r, cols.inicio);
    fim = fim || getStr(r, cols.fim);
    adSets.push({
      nome,
      veiculacao: getStr(r, cols.veiculacao),
      investimento: getNum(r, cols.investimento) ?? 0,
      impressoes: getNum(r, cols.impressoes) ?? 0,
      alcance: getNum(r, cols.alcance) ?? 0,
      frequencia: getNum(r, cols.frequencia) ?? 0,
      cpm: getNum(r, cols.cpm) ?? 0,
      cliques: cols.cliques >= 0 ? getNum(r, cols.cliques) : null,
      ctr: cols.ctr >= 0 ? getNum(r, cols.ctr) : null,
      cpc: cols.cpc >= 0 ? getNum(r, cols.cpc) : null,
      resultados: cols.resultados >= 0 ? getNum(r, cols.resultados) : null,
      custoPorResultado:
        cols.custoPorResultado >= 0 ? getNum(r, cols.custoPorResultado) : null,
      indicadorResultado:
        cols.indicadorResultados >= 0 ? getStr(r, cols.indicadorResultados) : null,
      seguidoresIg: cols.seguidoresIg >= 0 ? getNum(r, cols.seguidoresIg) : null,
      compras: cols.compras >= 0 ? getNum(r, cols.compras) : null,
      receita: cols.receita >= 0 ? getNum(r, cols.receita) : null,
    });
  }

  if (adSets.length === 0) return { error: 'Não achei nenhuma linha de anúncio no CSV.' };

  const somaSe = (k: keyof AdSetRow): number | null => {
    const algum = adSets.some((r) => (r as any)[k] != null);
    if (!algum) return null;
    return adSets.reduce((s, r) => s + (Number((r as any)[k]) || 0), 0);
  };

  const investimento = adSets.reduce((s, r) => s + r.investimento, 0);
  const impressoes = adSets.reduce((s, r) => s + r.impressoes, 0);
  const alcance = adSets.reduce((s, r) => s + r.alcance, 0);
  const cliques = somaSe('cliques');
  const compras = somaSe('compras');
  const receita = somaSe('receita');
  const seguidoresIg = somaSe('seguidoresIg');

  const totais: RelatorioAds['totais'] = {
    investimento,
    impressoes,
    alcance,
    cliques,
    cpm: impressoes > 0 ? (investimento / impressoes) * 1000 : 0,
    cpc: cliques && cliques > 0 ? investimento / cliques : null,
    ctr:
      cliques != null && impressoes > 0 ? (cliques / impressoes) * 100 : null,
    compras,
    receita,
    roas:
      receita != null && investimento > 0 ? receita / investimento : null,
    custoPorCompra:
      compras != null && compras > 0 ? investimento / compras : null,
    seguidoresIg,
    frequenciaMedia: alcance > 0 ? impressoes / alcance : 0,
  };

  return { periodo: { inicio, fim }, adSets, totais };
}
