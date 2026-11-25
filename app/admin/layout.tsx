import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { Sidebar, TopbarMobile } from './_components/Sidebar';
import { AbrirPostEmPopup } from './_components/AbrirPostEmPopup';
import { AvisoWhatsapp } from './_components/AvisoWhatsapp';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    redirect('/');
  }

  return (
    <div className="min-h-screen">
      <Sidebar />
      <TopbarMobile />
      <div className="conteudo-admin transition-[padding] lg:pl-[var(--sb,68px)]">
        <AvisoWhatsapp />
        {children}
      </div>
      <AbrirPostEmPopup />
    </div>
  );
}
