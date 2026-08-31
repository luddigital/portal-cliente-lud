import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { ProcessoView } from './ProcessoView';

export const dynamic = 'force-dynamic';

export default async function ProcessoPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    redirect('/');
  }
  return <ProcessoView />;
}
