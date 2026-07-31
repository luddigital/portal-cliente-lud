import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

/** POST /api/admin/criar-props
 *  Cria as propriedades Funil e Objetivo (SELECT) na DB de posts do Notion,
 *  se ainda não existirem, com todas as opções da Lud. já preenchidas.
 *  Só admin. */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: 'só admin' }, { status: 403 });
  }

  const { Client } = await import('@notionhq/client');
  const notion = new Client({ auth: env.notion.token });

  const resultado: any = { criado: [], jaExistia: [], erros: [] };

  const props: Record<string, any> = {};

  try {
    const db: any = await notion.databases.retrieve({
      database_id: env.notion.postagensDbId,
    });

    if (!db.properties?.Funil) {
      props.Funil = {
        select: {
          options: [
            { name: 'Topo', color: 'green' },
            { name: 'Meio', color: 'blue' },
            { name: 'Fundo', color: 'red' },
          ],
        },
      };
    } else {
      resultado.jaExistia.push({ nome: 'Funil', tipo: db.properties.Funil.type });
    }

    if (!db.properties?.Objetivo) {
      props.Objetivo = {
        select: {
          options: [
            { name: 'Antecipação',   color: 'red' },
            { name: 'Infotenimento', color: 'green' },
            { name: 'Divulgação',    color: 'blue' },
            { name: 'Automação',     color: 'red' },
            { name: 'Autoridade',    color: 'green' },
            { name: 'Utilidade',     color: 'green' },
            { name: 'Engajamento',   color: 'green' },
            { name: 'Awareness',     color: 'blue' },
            { name: 'Vendas',        color: 'red' },
            { name: 'Comunidade',    color: 'purple' },
          ],
        },
      };
    } else {
      resultado.jaExistia.push({ nome: 'Objetivo', tipo: db.properties.Objetivo.type });
    }

    if (Object.keys(props).length > 0) {
      await notion.databases.update({
        database_id: env.notion.postagensDbId,
        properties: props,
      });
      resultado.criado = Object.keys(props);
    }
  } catch (err: any) {
    resultado.erros.push(err?.message ?? String(err));
    return NextResponse.json(resultado, { status: 500 });
  }

  return NextResponse.json(resultado);
}
