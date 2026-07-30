'use server';

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { criarPostVazio } from '@/lib/notion';

/** Cria uma pauta vazia no Notion pra o projeto/data e leva pra construção
 *  do sandbox. Só admin acessa a landing, então guard por email. */
export async function criarPautaNaData(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error('não autenticado');
  const ehAdmin = env.auth.adminEmails.includes(
    session.email.trim().toLowerCase(),
  );
  if (!ehAdmin) throw new Error('só admin');

  const projetoId = String(formData.get('projetoId') ?? '').trim();
  const dataISO = String(formData.get('data') ?? '').trim();
  if (!projetoId || !/^\d{4}-\d{2}-\d{2}$/.test(dataISO)) {
    throw new Error('projetoId ou data inválidos');
  }

  const { id } = await criarPostVazio(projetoId, dataISO);
  redirect(`/admin/teste-edicao?postId=${id}`);
}
