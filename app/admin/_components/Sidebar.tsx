'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Item = {
  label: string;
  href: string;
  icon: keyof typeof ICONES;
  badge?: number;
  soon?: boolean; // "em breve" — visual mais discreto
};

// 🏠 Home
const HOME: Item[] = [
  { label: 'Dashboard', href: '/admin', icon: 'home' },
];

// 📋 Social Media — o fluxo de produção completo
const SOCIAL: Item[] = [
  { label: 'Processo', href: '/admin/processo', icon: 'processo', soon: true },
  { label: 'Calendário', href: '/admin/calendario', icon: 'calendario', soon: true },
  { label: 'Esteira Copy', href: '/esteira', icon: 'esteira' },
  { label: 'Esteira Arte', href: '/admin/esteira-arte', icon: 'arte', soon: true },
  { label: 'Programação', href: '/programacao', icon: 'programacao' },
  { label: 'Aprovações', href: '/admin/aprovacoes', icon: 'aprovacao' },
];

// 👥 Clientes
const CLIENTES: Item[] = [
  { label: 'Todos os clientes', href: '/admin/clientes', icon: 'clientes' },
  { label: 'Projetos', href: '/admin/projetos', icon: 'projetos' },
];

// 📊 Análise
const ANALISE: Item[] = [
  { label: 'Analytics IG', href: '/admin/analise', icon: 'grafico' },
  { label: 'Tráfego pago', href: '/admin/trafego-pago', icon: 'trafego' },
];

// 💬 Comunicação
const COMUNICACAO: Item[] = [
  { label: 'WhatsApp', href: '/admin/whatsapp', icon: 'chat' },
  { label: 'Notificações', href: '/admin/notificacoes', icon: 'sino' },
];

// ⚙️ Configurações
const CONFIG: Item[] = [
  { label: 'Equipe', href: '/admin/equipe', icon: 'equipe' },
  { label: 'Banco de materiais', href: '/admin/banco-de-materiais', icon: 'banco' },
  { label: 'Sync Notion', href: '/admin/sync', icon: 'sync' },
  { label: 'Configurações', href: '/admin/configuracoes', icon: 'ajustes' },
];

const ICONES = {
  home: 'M3 10.5 12 3l9 7.5 M5 9.5V21h14V9.5',
  projetos: 'M12 2 3 7v10l9 5 9-5V7z M3 7l9 5 9-5 M12 12v10',
  clientes:
    'M9 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M3 20c0-3 3-5 6-5s6 2 6 5 M16 5a3 3 0 0 1 0 6 M17 15c2 .5 4 2 4 5',
  aprovacao: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M8 12l3 3 5-6',
  grafico: 'M3 3v18h18 M7 14l4-4 3 3 5-6',
  equipe: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M3 21c0-3 2.5-5 6-5s6 2 6 5 M16 7a3 3 0 1 0 0 6 M17 21c.5-2.5 2.5-4 5-4',
  banco: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  trafego: 'M3 21h18 M7 21V11 M12 21V6 M17 21V14',
  chat: 'M21 12a8 8 0 0 1-11.6 7.2L4 21l1.8-5.4A8 8 0 1 1 21 12z',
  sino: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 0 1-3.4 0',
  processo: 'M4 6h16 M4 12h16 M4 18h10 M20 18l-3 3v-6z',
  calendario: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M3 9h18 M8 3v4 M16 3v4',
  esteira: 'M3 12h4l2-4h6l2 4h4 M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6',
  arte: 'M12 3a9 9 0 1 0 9 9c0-2-2-3-4-3h-2a2 2 0 0 1 0-4 c2 0 3-1 3-2z M7 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M15 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  programacao: 'M12 6v6l4 2 M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z',
  sync: 'M3 12a9 9 0 0 1 15-6.7L21 8 M21 12a9 9 0 0 1-15 6.7L3 16 M17 4v4h4 M7 20v-4H3',
  ajustes: 'M4 6h9 M17 6h3 M15 4v4 M4 12h3 M11 12h9 M9 10v4 M4 18h11 M19 18h1 M17 16v4',
};

function NavIcon({ icon }: { icon: keyof typeof ICONES }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {ICONES[icon].split(' M').map((seg, i) => (
        <path key={i} d={i === 0 ? seg : `M${seg}`} />
      ))}
    </svg>
  );
}

function ehAtivo(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(href + '/');
}

function ItemLink({ item, ativo }: { item: Item; ativo: boolean }) {
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition ${
        ativo
          ? 'bg-[rgba(21,21,33,0.055)] font-semibold text-ink'
          : 'text-t2 hover:bg-[rgba(21,21,33,0.03)] hover:text-ink'
      } ${item.soon ? 'opacity-70' : ''}`}
    >
      <span className={ativo ? 'text-navy' : 'text-t3'}>
        <NavIcon icon={item.icon} />
      </span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badge != null && (
        <span className="shrink-0 rounded-full bg-hubRed px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
          {item.badge}
        </span>
      )}
      {item.soon && (
        <span className="shrink-0 rounded-full bg-bgSoft px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-t3">
          em breve
        </span>
      )}
    </Link>
  );
}

function SecaoTitulo({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-t3">
      {children}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-[rgba(21,21,33,0.08)] bg-white lg:flex">
      {/* topo: logo + avatar */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-1.5">
          <span className="text-[17px] font-bold tracking-[-0.02em] text-ink">
            LudHub
          </span>
          <span className="rounded bg-bgSoft px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-t3">
            MVP
          </span>
        </div>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-navy text-[10px] font-bold text-white">
          LD
        </span>
      </div>

      {/* navegação */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <div className="space-y-0.5">
          {HOME.map((it) => (
            <ItemLink key={it.href} item={it} ativo={ehAtivo(pathname, it.href)} />
          ))}
        </div>

        <SecaoTitulo>Social Media</SecaoTitulo>
        <div className="mt-1 space-y-0.5">
          {SOCIAL.map((it) => (
            <ItemLink key={it.href} item={it} ativo={ehAtivo(pathname, it.href)} />
          ))}
        </div>

        <SecaoTitulo>Clientes</SecaoTitulo>
        <div className="mt-1 space-y-0.5">
          {CLIENTES.map((it) => (
            <ItemLink key={it.href} item={it} ativo={ehAtivo(pathname, it.href)} />
          ))}
        </div>

        <SecaoTitulo>Análise</SecaoTitulo>
        <div className="mt-1 space-y-0.5">
          {ANALISE.map((it) => (
            <ItemLink key={it.href} item={it} ativo={ehAtivo(pathname, it.href)} />
          ))}
        </div>

        <SecaoTitulo>Comunicação</SecaoTitulo>
        <div className="mt-1 space-y-0.5">
          {COMUNICACAO.map((it) => (
            <ItemLink key={it.href} item={it} ativo={ehAtivo(pathname, it.href)} />
          ))}
        </div>

        <SecaoTitulo>Configurações</SecaoTitulo>
        <div className="mt-1 space-y-0.5">
          {CONFIG.map((it) => (
            <ItemLink key={it.href} item={it} ativo={ehAtivo(pathname, it.href)} />
          ))}
        </div>
      </nav>

      {/* sair */}
      <div className="border-t border-[rgba(21,21,33,0.08)] px-3 py-3">
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-t2 transition hover:bg-[rgba(21,21,33,0.03)] hover:text-ink"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-t3"
            >
              <path d="M14 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8" />
              <path d="M17 16l5-4-5-4 M22 12H10" />
            </svg>
            Sair da Conta
          </button>
        </form>
      </div>
    </aside>
  );
}

/** Barra de topo do admin no mobile (a sidebar fica só no desktop). */
export function TopbarMobile() {
  const pathname = usePathname();
  const todos = [...HOME, ...SOCIAL, ...CLIENTES, ...ANALISE, ...COMUNICACAO, ...CONFIG];
  return (
    <div className="sticky top-0 z-30 border-b border-[rgba(21,21,33,0.08)] bg-white lg:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[15px] font-bold tracking-[-0.02em] text-ink">
            LudHub
          </span>
          <span className="rounded bg-bgSoft px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-t3">
            MVP
          </span>
        </div>
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="text-[12px] text-mauve">
            Sair
          </button>
        </form>
      </div>
      <div className="flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {todos.map((it) => {
          const ativo = ehAtivo(pathname, it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] transition ${
                ativo
                  ? 'bg-ink font-semibold text-white'
                  : 'bg-bgSoft text-t2'
              }`}
            >
              <NavIcon icon={it.icon} />
              {it.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
