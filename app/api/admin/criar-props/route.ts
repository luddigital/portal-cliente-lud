import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

const OPCOES_FUNIL = [
  { name: 'Topo', color: 'green' },
  { name: 'Meio', color: 'blue' },
  { name: 'Fundo', color: 'red' },
] as const;

const OPCOES_OBJETIVO = [
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
] as const;

/** POST /api/admin/criar-props
 *  Recria as props Funil e Objetivo como SELECT na DB de posts.
 *  Se já existirem quebradas (relation pra DB inacessível), apaga primeiro
 *  e recria. Só admin. */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: 'só admin' }, { status: 403 });
  }

  const { Client } = await import('@notionhq/client');
  const notion = new Client({ auth: env.notion.token });
  const dbId = env.notion.postagensDbId;

  const resultado: any = { acoes: {}, erros: [] };

  async function recriarComoSelect(
    nomeProp: string,
    options: readonly { name: string; color: string }[],
  ) {
    // 1) tenta criar direto como select
    try {
      await notion.databases.update({
        database_id: dbId,
        properties: { [nomeProp]: { select: { options: [...options] } } } as any,
      });
      resultado.acoes[nomeProp] = 'criado';
      return;
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      const quebrada = /not accessible|Repair the relation/i.test(msg);
      if (!quebrada) {
        resultado.acoes[nomeProp] = `falha: ${msg}`;
        resultado.erros.push({ nomeProp, etapa: 'criar', msg });
        return;
      }
    }

    // 2) prop existe mas está quebrada — apaga e recria
    try {
      await notion.databases.update({
        database_id: dbId,
        properties: { [nomeProp]: null as any },
      });
    } catch (err: any) {
      resultado.acoes[nomeProp] = `falha ao apagar: ${err?.message}`;
      resultado.erros.push({ nomeProp, etapa: 'apagar', msg: err?.message });
      return;
    }
    try {
      await notion.databases.update({
        database_id: dbId,
        properties: { [nomeProp]: { select: { options: [...options] } } } as any,
      });
      resultado.acoes[nomeProp] = 'recriado (a versão anterior estava quebrada)';
    } catch (err: any) {
      resultado.acoes[nomeProp] = `falha ao recriar: ${err?.message}`;
      resultado.erros.push({ nomeProp, etapa: 'recriar', msg: err?.message });
    }
  }

  // Executa Funil e Objetivo em sequência (pra erro em uma não bloquear outra)
  await recriarComoSelect('Funil', OPCOES_FUNIL);
  await recriarComoSelect('Objetivo', OPCOES_OBJETIVO);

  const httpStatus = resultado.erros.length > 0 ? 500 : 200;
  return NextResponse.json(resultado, { status: httpStatus });
}
