import { env } from '@/lib/env';
import {
  getHorarioDoProjeto,
  getProjetoNome,
  listOpcoesRelation,
  listOpcoesSelect,
  getPostsPorMes,
  listPostsDoMes,
  type PostCalendario,
} from '@/lib/notion';
import { lerCustomizacaoProjeto } from '@/lib/supabase';
import { nomeCurtoDoProjeto, rotas } from '@/lib/rotas';
import { Trilha } from '../../../_components/Trilha';
import { Pagina, hojeSP } from '../../../_ui/lud';
import { NovaPautaForm, type DiaPauta } from './NovaPautaForm';

export const dynamic = 'force-dynamic';

const semTraco = (x: string) => x.replace(/-/g, '');

/** A base "Etapa Funil" do Notion só tem o emoji: o nome vem daqui (pelos objetivos ligados a cada etapa). */
const FUNIL_NOME: Record<string, string> = {
  '182d04d23b4a80688548d3191e3187bb': 'Topo',
  '182d04d23b4a8049b878fd3dee5069c7': 'Meio',
  '182d04d23b4a80cb85ccf2d46d313f76': 'Fundo',
};
/** Reserva, se o Notion não devolver as opções: mesmas páginas da base Objetivos (id, nome, etapas do funil). */
const OBJETIVOS_RESERVA: { id: string; nome: string; funis: string[] }[] = [
  { id: '1cad04d23b4a8078ac66ebec2a35f288', nome: 'Awareness', funis: ['182d04d23b4a80688548d3191e3187bb'] },
  { id: '1d5d04d23b4a80eeb951ce0ced1ed186', nome: 'Comunidade', funis: ['182d04d23b4a80688548d3191e3187bb'] },
  { id: '1cad04d23b4a808d95bdf585c3d146a2', nome: 'Utilidade', funis: ['182d04d23b4a8049b878fd3dee5069c7', '182d04d23b4a80688548d3191e3187bb'] },
  { id: '1cad04d23b4a80aab171e59e0941c6b0', nome: 'Autoridade', funis: ['182d04d23b4a8049b878fd3dee5069c7', '182d04d23b4a80688548d3191e3187bb'] },
  { id: '1ced04d23b4a8041ad06d257c52b8a1b', nome: 'Infotenimento', funis: ['182d04d23b4a8049b878fd3dee5069c7', '182d04d23b4a80688548d3191e3187bb'] },
  { id: '1cad04d23b4a805fae7dd52ce572c5bc', nome: 'Engajamento', funis: ['182d04d23b4a8049b878fd3dee5069c7'] },
  { id: '1cbd04d23b4a8084ad07cc4f9d4542c5', nome: 'Divulgação', funis: ['182d04d23b4a80688548d3191e3187bb', '182d04d23b4a80cb85ccf2d46d313f76'] },
  { id: '1a4d04d23b4a80c6a670d73ca06af3a0', nome: 'Antecipação', funis: ['182d04d23b4a80cb85ccf2d46d313f76'] },
  { id: '1cad04d23b4a807c9d33df7e637c2cf9', nome: 'Vendas', funis: ['182d04d23b4a80cb85ccf2d46d313f76'] },
  { id: '1cbd04d23b4a807699b6cecf12a00399', nome: 'Automação', funis: ['182d04d23b4a80cb85ccf2d46d313f76'] },
];

/** Post ainda sem tema: título vazio ou o "Novo Post" que a automação do Notion cria por dia combinado. */
const semTema = (t: string | null | undefined) => !t || !t.trim() || /^novo post$/i.test(t.trim());

/** Projetos › projeto › Nova pauta: criar post, passo 1 (a pauta). */
export default async function NovaPautaPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { data?: string; post?: string; mes?: string };
}) {
  const projetoId = params.id;
  const hoje = hojeSP();
  // Funil e Objetivo podem ser relation ou select no Notion: se não vier relation,
  // usa as opções do select (aí o "id" é o próprio nome, como a API de props espera).
  async function opcoesRelOuSelect(prop: string) {
    const rel = await listOpcoesRelation(prop).catch(() => []);
    if (rel.length) return rel;
    const sel = await listOpcoesSelect(prop).catch(() => []);
    return sel.map((o) => ({ id: o.nome, nome: o.nome })) as typeof rel;
  }
  const dataPedida = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.data ?? '') ? searchParams.data! : null;
  const mesDe = (iso: string, soma = 0) => {
    const [y, m] = iso.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + soma, 1));
    return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 };
  };

  const [nome, horario, formatos, funis, objetivos, demandas, postsPorMes, custom] = await Promise.all([
    getProjetoNome(projetoId).catch(() => 'Projeto'),
    getHorarioDoProjeto(projetoId).catch(() => null),
    listOpcoesRelation('Formato').catch(() => []),
    opcoesRelOuSelect('Funil'),
    opcoesRelOuSelect('Objetivo'),
    listOpcoesSelect(env.notion.postProps.demanda).catch(() => []),
    getPostsPorMes(projetoId),
    lerCustomizacaoProjeto(projetoId).catch(() => null),
  ]);
  const diasFixos = custom?.diasFixos ?? [];

  // Dias do mês: os que já têm post (com tema ou livres) + os dias fixos combinados que ainda não têm post.
  function montarDias(posts: PostCalendario[], ano: number, mes: number): DiaPauta[] {
    const porDia = new Map<string, DiaPauta>();
    for (const p of [...posts].sort((a, b) => (a.data ?? '').localeCompare(b.data ?? ''))) {
      const d = p.data?.slice(0, 10);
      if (!d) continue;
      const atual = porDia.get(d);
      const livre = semTema(p.titulo);
      // Se o dia tem um post livre, ele é o que a gente preenche.
      if (!atual || (livre && atual.comTema)) {
        porDia.set(d, { data: d, postId: p.id, comTema: !livre, titulo: livre ? null : p.titulo, formato: p.formatoNome ?? null });
      }
    }
    if (diasFixos.length) {
      const nDias = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
      for (let i = 1; i <= nDias; i++) {
        const iso = `${ano}-${String(mes).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        if (diasFixos.includes(new Date(iso + 'T12:00:00Z').getUTCDay()) && !porDia.has(iso)) {
          porDia.set(iso, { data: iso, postId: null, comTema: false, titulo: null, formato: null });
        }
      }
    }
    return [...porDia.values()].sort((a, b) => a.data.localeCompare(b.data));
  }

  // Sem ?data=: abre no primeiro mês (deste até daqui a 3) que ainda tem dia livre.
  let ano: number, mes: number, posts: PostCalendario[], dias: DiaPauta[];
  const mesPedido = /^\d{4}-\d{2}$/.test(searchParams.mes ?? '') ? `${searchParams.mes}-01` : null;
  if (dataPedida || mesPedido) {
    ({ ano, mes } = mesDe((dataPedida ?? mesPedido)!));
    posts = await listPostsDoMes([projetoId], ano, mes).catch(() => [] as PostCalendario[]);
    dias = montarDias(posts, ano, mes);
  } else {
    const meses = [0, 1, 2, 3].map((k) => mesDe(hoje, k));
    const todos = await Promise.all(meses.map((m) => listPostsDoMes([projetoId], m.ano, m.mes).catch(() => [] as PostCalendario[])));
    const montados = meses.map((m, k) => montarDias(todos[k], m.ano, m.mes));
    let k = montados.findIndex((ds) => ds.some((d) => !d.comTema && d.data >= hoje));
    if (k < 0) k = 0;
    ({ ano, mes } = meses[k]);
    posts = todos[k];
    dias = montados[k];
  }

  const ORDEM_FUNIL = ['Topo', 'Meio', 'Fundo'];
  const funisRot = (funis.length ? funis : Object.keys(FUNIL_NOME).map((id) => ({ id, nome: '' })))
    .map((o) => {
      const etapa = FUNIL_NOME[semTraco(o.id)];
      return { id: o.id, nome: etapa ? `${o.nome} ${etapa}`.trim() : o.nome, ordem: etapa ? ORDEM_FUNIL.indexOf(etapa) : 9 };
    })
    .sort((a, b) => a.ordem - b.ordem)
    .map(({ id, nome }) => ({ id, nome }));
  const objetivosOk = objetivos.length ? objetivos.map((o) => ({ id: o.id, nome: o.nome })) : OBJETIVOS_RESERVA.map((o) => ({ id: o.id, nome: o.nome }));
  // Objetivos de cada etapa do funil, pra filtrar quando a etapa for escolhida.
  const objetivosPorFunil: Record<string, string[]> = {};
  for (const o of OBJETIVOS_RESERVA) for (const f of o.funis) (objetivosPorFunil[f] ??= []).push(o.id);

  // Post que vai ser preenchido: ?post=, senão o livre do dia pedido, senão o primeiro dia livre do mês.
  const escolhido =
    (searchParams.post && dias.find((d) => d.postId === searchParams.post)) ||
    (dataPedida && dias.find((d) => d.data === dataPedida && !d.comTema)) ||
    (!dataPedida && dias.find((d) => !d.comTema && d.data >= hoje)) ||
    null;
  const dataInicial = escolhido?.data ?? dataPedida ?? null;

  const curto = nomeCurtoDoProjeto(nome);
  return (
    <Pagina>
      <Trilha
        itens={[
          { rotulo: 'Projetos', href: rotas.projetos() },
          { rotulo: curto, href: rotas.projeto(projetoId) },
          { rotulo: 'Nova pauta' },
        ]}
      />
      <NovaPautaForm
        projetoId={projetoId}
        projetoCurto={curto}
        hoje={hoje}
        ano={ano}
        mes={mes}
        dias={dias}
        postsPorMes={postsPorMes}
        temDiasFixos={diasFixos.length > 0}
        objetivosPorFunil={objetivosPorFunil}
        postIdInicial={searchParams.post ?? escolhido?.postId ?? null}
        dataInicial={dataInicial}
        horario={horario}
        mix={posts.filter((p) => !semTema(p.titulo)).map((p) => ({ formato: p.formatoNome ?? null }))}
        formatos={formatos.filter((o) => !/direcionamento/i.test(o.nome)).map((o) => ({ id: o.id, nome: o.nome }))}
        funis={funisRot}
        objetivos={objetivosOk}
        demandas={demandas.map((o) => o.nome)}
      />
    </Pagina>
  );
}
