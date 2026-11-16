import { redirect } from 'next/navigation';
import { SemPiscar as Suspense } from '@/app/_ui/SemPiscar';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { planejarAvisos } from '@/lib/aviso-aprovacao';
import { Cabecalho, Pagina } from '../../_ui/lud';
import { Trilha } from '../../_components/Trilha';
import { AvisosLista } from './AvisosLista';

export const dynamic = 'force-dynamic';

/** Avisos automáticos de aprovação de post · modo prévia (a equipe manda com um clique). */
export default async function AvisosAprovacaoPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) redirect('/');
  const automatico = process.env.AVISO_APROVACAO_AUTO === 'on';
  return (
    <Pagina>
      <Trilha itens={[{ rotulo: 'Aprovações', href: '/admin/aprovacoes' }, { rotulo: 'Avisos de aprovação' }]} />
      <Cabecalho
        titulo="Avisos de aprovação"
        sub={
          automatico
            ? 'O portal manda sozinho de segunda a sexta, às 9h, 13h e 17h. Aqui você vê o que vai sair e pode mandar antes.'
            : 'Modo prévia: o portal monta as mensagens de aprovação de post e você manda com um clique. Depois de uma semana, liga o automático (seg a sex, 9h, 13h e 17h).'
        }
      />
      <Suspense fallback={<div className="h-[420px] animate-pulse rounded-[20px] bg-[#F0F0F1]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}

async function Conteudo() {
  try {
    const plano = await planejarAvisos();
    return <AvisosLista plano={plano} linkMensagens="/admin/configuracoes/mensagens" />;
  } catch (err: any) {
    return (
      <div className="rounded-[16px] border border-[#F3C4BE] bg-[#FBE3E0] px-5 py-4 text-[13.5px] text-[#7E211C]">
        Não consegui conferir o que já foi enviado nos grupos ({err?.message ?? 'erro'}). Por segurança, nada é mostrado pra envio. Tenta de novo em alguns minutos.
      </div>
    );
  }
}
