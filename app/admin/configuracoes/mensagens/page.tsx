import Link from 'next/link';
import { lerMensagensEditadas } from '@/lib/mensagens-padrao';
import { EditorMensagens } from './EditorMensagens';

export const dynamic = 'force-dynamic';

export default async function MensagensPadraoPage() {
  const editadas = await lerMensagensEditadas();
  return (
    <div className="px-6 py-8">
      <div className="mb-2 text-[12px] text-t3">
        <Link href="/admin/configuracoes" className="hover:text-ink">
          Configurações
        </Link>{' '}
        › Mensagens padrão
      </div>
      <EditorMensagens editadas={editadas} />
    </div>
  );
}
