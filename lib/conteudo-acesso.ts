import { getSession } from './auth';
import { env } from './env';

/** Quem pode criar e editar conteúdo no portal: admin e equipe (colaboradores). */
export async function sessaoDaEquipe(): Promise<{ email: string } | null> {
  const session = await getSession();
  if (!session) return null;
  const email = session.email.trim().toLowerCase();
  if (env.auth.adminEmails.includes(email) || session.colaboradorId) return { email };
  return null;
}
