import Link from 'next/link';

export const dynamic = 'force-dynamic';

const SUBPAGINAS = [
  {
    href: '/admin/configuracoes/mensagens',
    titulo: 'Mensagens padrão',
    descricao:
      'Textos do WhatsApp (régua da semana e lembrete avulso), com as condições de quando cada um é usado.',
  },
];

export default function ConfiguracoesPage() {
  return (
    <div className="px-6 py-8">
      <header className="mb-6">
        <h1 className="text-[22px] font-bold tracking-[-0.02em] text-ink">Configurações</h1>
        <p className="text-[13px] text-t3">Ajustes do portal.</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SUBPAGINAS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-xl border border-[rgba(21,21,33,0.09)] bg-white p-5 transition hover:bg-[rgba(55,53,47,0.03)]"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-[14px] font-semibold text-ink">{s.titulo}</div>
              <span className="text-[16px] text-t3">›</span>
            </div>
            <p className="mt-1.5 text-[12px] leading-[1.5] text-t3">{s.descricao}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
