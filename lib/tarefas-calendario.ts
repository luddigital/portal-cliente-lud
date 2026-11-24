/**
 * Todo dia 1: uma tarefa "Criação de Calendário <mês>" por cliente de social media ativo,
 * pro calendário de 2 meses à frente (em 1/12 → calendário de fevereiro), com prazo no dia 5.
 * Não duplica: se a tarefa do mês já existe pro projeto, pula.
 */
import { env } from '@/lib/env';
import { notionCru } from '@/lib/notion';

const SERVICO_SOCIAL = '15bd04d2-3b4a-8059-81a9-df3dd1437549';
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export type ResultadoCalendario = { mes: string; criadas: string[]; jaExistiam: string[]; erros: string[] };

export async function criarTarefasDeCalendario(opts: { hoje: string; previa?: boolean }): Promise<ResultadoCalendario> {
  const [ano, mes] = opts.hoje.split('-').map(Number);
  const alvo = new Date(Date.UTC(ano, mes - 1 + 2, 1));
  const nomeMes = MESES[alvo.getUTCMonth()];
  const titulo = `Criação de Calendário ${nomeMes}`;
  const prazo = `${opts.hoje.slice(0, 7)}-05`;
  const res: ResultadoCalendario = { mes: nomeMes, criadas: [], jaExistiam: [], erros: [] };
  const notion = notionCru();

  // Projetos de social media ativos.
  const projetos: { id: string; nome: string; pessoa: string | null }[] = [];
  let cursor: string | undefined;
  do {
    const r: any = await notion.databases.query({
      database_id: env.notion.projetosDbId,
      start_cursor: cursor,
      page_size: 100,
      filter: {
        and: [
          { property: 'Serviço', relation: { contains: SERVICO_SOCIAL } },
          { property: 'Status Manual', select: { equals: 'Ativo' } },
        ],
      },
    });
    for (const p of r.results) {
      const nome = (p.properties?.Nome?.title ?? []).map((t: any) => t.plain_text).join('') || 'Projeto';
      const pessoa = p.properties?.['Social Media Resp']?.people?.[0]?.id ?? null;
      projetos.push({ id: p.id, nome, pessoa });
    }
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);

  for (const p of projetos) {
    try {
      const ja: any = await notion.databases.query({
        database_id: env.notion.tarefasDbId,
        page_size: 1,
        filter: {
          and: [
            { property: 'Tarefa', title: { equals: titulo } },
            { property: 'Projeto', relation: { contains: p.id } },
          ],
        },
      });
      if (ja.results.length) {
        res.jaExistiam.push(p.nome);
        continue;
      }
      if (!opts.previa) {
        await notion.pages.create({
          parent: { type: 'database_id', database_id: env.notion.tarefasDbId },
          properties: {
            Tarefa: { title: [{ text: { content: titulo } }] },
            Projeto: { relation: [{ id: p.id }] },
            'Data Entrega': { date: { start: prazo } },
            Status: { status: { name: 'Iniciar' } },
            ...(p.pessoa ? { Pessoa: { people: [{ id: p.pessoa }] } } : {}),
          },
        });
      }
      res.criadas.push(p.nome);
    } catch (e: any) {
      res.erros.push(`${p.nome}: ${e?.message ?? 'erro'}`);
    }
  }
  return res;
}
