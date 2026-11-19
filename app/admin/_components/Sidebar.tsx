'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BotaoAtualizar } from './BotaoAtualizar';

type Item = {
  label: string;
  href: string;
  icon: keyof typeof ICONES;
  badge?: number;
  soon?: boolean; // "em breve" — visual mais discreto
};

// Menu: 5 itens fixos em cima e o resto em grupos recolhíveis ("Mais").
// Fechado (padrão) fica só com os ícones; » abre, « fecha (a escolha fica salva no navegador).
const FIXOS: Item[] = [
  { label: 'Hoje', href: '/admin', icon: 'home' },
  { label: 'Tarefas', href: '/admin/tarefas', icon: 'tarefas' },
  { label: 'Entregas', href: '/admin/entregas', icon: 'entregas' },
  { label: 'Calendário', href: '/admin/calendario', icon: 'calendario' },
  { label: 'Projetos', href: '/admin/projetos', icon: 'projetos' },
];
const HOME = FIXOS;

type Grupo = { titulo: string; icon: keyof typeof ICONES; itens: Item[] };
const GRUPOS: Grupo[] = [
  {
    titulo: 'Produção',
    icon: 'esteira',
    itens: [
      { label: 'Postagens', href: '/admin/postagens', icon: 'calendario' },
      { label: 'Esteira Copy', href: '/admin/esteira-copy', icon: 'esteira' },
      { label: 'Esteira Arte', href: '/admin/esteira-arte', icon: 'arte' },
      { label: 'Aprovações', href: '/admin/aprovacoes', icon: 'aprovacao' },
      { label: 'Programação', href: '/programacao', icon: 'programacao' },
    ],
  },
  {
    titulo: 'Clientes',
    icon: 'clientes',
    itens: [
      { label: 'Clientes', href: '/admin/clientes', icon: 'clientes' },
      { label: 'Objetivos da semana', href: '/gestao', icon: 'processo' },
      { label: 'Reuniões', href: '/admin/reunioes', icon: 'calendario' },
      { label: 'Contexto dos clientes', href: '/admin/contexto-clientes', icon: 'clientes' },
    ],
  },
  {
    titulo: 'Comunicação',
    icon: 'chat',
    itens: [
      { label: 'WhatsApp', href: '/admin/whatsapp', icon: 'chat' },
      { label: 'Régua da semana', href: '/admin/regua', icon: 'regua' },
      { label: 'Avisos de aprovação', href: '/admin/aprovacoes/avisos', icon: 'sino' },
      { label: 'Mensagens padrão', href: '/admin/configuracoes/mensagens', icon: 'chat' },
      { label: 'Notificações', href: '/admin/notificacoes', icon: 'sino' },
    ],
  },
  {
    titulo: 'Análise',
    icon: 'grafico',
    itens: [
      { label: 'Analytics IG', href: '/admin/analise', icon: 'grafico' },
      { label: 'Tráfego pago', href: '/admin/trafego-pago', icon: 'trafego' },
    ],
  },
  {
    titulo: 'Recursos',
    icon: 'banco',
    itens: [
      { label: 'Processo', href: '/admin/processo', icon: 'processo' },
      { label: 'Banco de materiais', href: '/admin/banco-de-materiais', icon: 'banco' },
      { label: 'Playbooks', href: '/admin/playbooks', icon: 'tarefas', soon: true },
      { label: 'Inbox de briefing', href: '/admin/inbox', icon: 'entregas', soon: true },
    ],
  },
  {
    titulo: 'Ajustes',
    icon: 'ajustes',
    itens: [
      { label: 'Equipe', href: '/admin/equipe', icon: 'equipe' },
      { label: 'Sync Notion', href: '/admin/sync', icon: 'sync' },
      { label: 'Configurações', href: '/admin/configuracoes', icon: 'ajustes' },
    ],
  },
];
const TODOS_ITENS: Item[] = [...HOME, ...GRUPOS.flatMap((g) => g.itens)];

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
  regua: 'M3 17 17 3l4 4L7 21z M7 13l2 2 M10 10l2 2 M13 7l2 2',
  entregas: 'M3 12h5l2 3h4l2-3h5 M5.5 5h13l2.5 7v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7z',
  tarefas: 'M10 6h10 M10 12h10 M10 18h10 M4 6l1.5 1.5L8 5 M4 12l1.5 1.5L8 11 M4 18l1.5 1.5L8 17',
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
  // Endereço antigo da entrega (/admin/entrega/[id]) redireciona pra Entregas.
  if (href === '/admin/entregas' && pathname.startsWith('/admin/entrega/')) return true;
  if (href === '/admin/configuracoes' && pathname.startsWith('/admin/configuracoes/mensagens')) return false;
  return pathname === href || pathname.startsWith(href + '/');
}

function ItemLink({ item, ativo, recuo = false }: { item: Item; ativo: boolean; recuo?: boolean }) {
  // Página que ainda não existe no portal: aparece apagada, sem link.
  if (item.soon) {
    return (
      <span className={`flex cursor-default items-center gap-2 rounded-[9px] py-[7px] pr-2.5 text-[13px] text-[#B4B4B9] ${recuo ? 'pl-[38px]' : 'pl-2.5'}`}>
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        <span className="shrink-0 text-[9.5px] font-bold uppercase tracking-[0.06em]">em breve</span>
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-2 rounded-[9px] py-[7px] pr-2.5 text-[13px] transition ${recuo ? 'pl-[38px]' : 'pl-2.5'} ${
        ativo ? 'bg-[#F4F4F5] font-bold text-[#111113]' : 'text-[#46464B] hover:bg-[#FAFAFA] hover:text-[#111113]'
      }`}
    >
      {!recuo && (
        <span className={ativo ? 'text-[#111113]' : 'text-[#8A8A90]'}>
          <NavIcon icon={item.icon} />
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badge != null && item.badge > 0 && (
        <span className="shrink-0 text-[11px] font-bold tabular-nums text-[#8A8A90]">{item.badge}</span>
      )}
    </Link>
  );
}

function BlocoGrupo({ grupo, pathname, abrirSempre }: { grupo: Grupo; pathname: string; abrirSempre?: boolean }) {
  const temAtivo = grupo.itens.some((it) => ehAtivo(pathname, it.href));
  return (
    <details open={temAtivo || abrirSempre} className="group">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-[9px] px-2.5 py-[7px] text-[13px] text-[#46464B] hover:bg-[#F4F4F5] hover:text-[#111113] [&::-webkit-details-marker]:hidden">
        <span className={temAtivo ? 'text-[#111113]' : 'text-[#8A8A90]'}>
          <NavIcon icon={grupo.icon} />
        </span>
        <span className={`flex-1 ${temAtivo ? 'font-bold text-[#111113]' : ''}`}>{grupo.titulo}</span>
        <span className="text-[9px] text-[#B4B4B9] transition group-open:rotate-90">▶</span>
      </summary>
      <div className="mt-px flex flex-col gap-px">
        {grupo.itens.map((it) => (
          <ItemLink key={it.href} item={it} ativo={ehAtivo(pathname, it.href)} recuo />
        ))}
      </div>
    </details>
  );
}

const CHAVE_MENU = 'ludhub-menu-aberto';

/** Marca: o "Lud" com o pontinho lilás (mesmo desenho do ícone do app). */
function Marca({ so = false }: { so?: boolean }) {
  if (so)
    return (
      <span className="relative flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#151521] text-[15px] font-extrabold tracking-[-0.04em] text-white" aria-label="Lud.">
        L<span className="absolute bottom-[9px] right-[8px] h-[5px] w-[5px] rounded-full bg-[#BAC4E6]" />
      </span>
    );
  return (
    <span className="flex items-baseline gap-1.5" aria-label="LudHub">
      <span className="flex items-baseline text-[22px] font-extrabold leading-none tracking-[-0.05em] text-[#151521]">
        Lud<span className="ml-[1px] inline-block h-[7px] w-[7px] rounded-full bg-[#8E9BD6]" />
      </span>
      <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#A1A1A8]">hub</span>
    </span>
  );
}
/** Largura do menu (fechado = só ícones). O conteúdo das páginas acompanha pela variável --sb. */
function aplicarLargura(aberto: boolean) {
  document.documentElement.style.setProperty('--sb', aberto ? '240px' : '68px');
}

export function Sidebar() {
  const pathname = usePathname() ?? '';
  const [aberto, setAberto] = useState(false);
  const [grupoPedido, setGrupoPedido] = useState<string | null>(null);
  useEffect(() => {
    let salvo = false;
    try {
      salvo = localStorage.getItem(CHAVE_MENU) === '1';
    } catch {}
    setAberto(salvo);
    aplicarLargura(salvo);
  }, []);
  function trocar(v: boolean, grupo?: string) {
    setAberto(v);
    setGrupoPedido(grupo ?? null);
    aplicarLargura(v);
    try {
      localStorage.setItem(CHAVE_MENU, v ? '1' : '0');
    } catch {}
  }

  if (!aberto) {
    // Fechado: só ícones, com o nome ao passar o mouse.
    const Icone = ({ it }: { it: Item }) => {
      const ativo = ehAtivo(pathname, it.href);
      return (
        <Link
          href={it.href}
          title={it.label}
          className={`group/ic relative flex h-[38px] w-[38px] items-center justify-center rounded-[11px] transition ${ativo ? 'bg-[#EDEDEF] text-[#111113]' : 'text-[#8A8A90] hover:bg-[#F0F0F1] hover:text-[#111113]'}`}
        >
          <NavIcon icon={it.icon} />
          <span className="pointer-events-none absolute left-[50px] z-50 hidden whitespace-nowrap rounded-[8px] bg-[#111113] px-2.5 py-1 text-[12px] font-bold text-white group-hover/ic:block">{it.label}</span>
        </Link>
      );
    };
    return (
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[68px] flex-col items-center gap-1.5 border-r border-[#E9E9EB] bg-[#FAFAFA] py-4 lg:flex">
        <span className="mb-1">
          <Marca so />
        </span>
        <button type="button" onClick={() => trocar(true)} title="Abrir menu" className="mb-1 flex h-7 w-7 items-center justify-center rounded-[8px] border border-[#E2E2E5] bg-white text-[13px] text-[#46464B] hover:bg-[#F4F4F5]">
          »
        </button>
        <BotaoAtualizar variante="icone" />
        <div className="my-1 h-px w-7 bg-[#E9E9EB]" />
        {FIXOS.map((it) => (
          <Icone key={it.href} it={it} />
        ))}
        <div className="my-1 h-px w-7 bg-[#E9E9EB]" />
        {GRUPOS.map((g) => {
          const ativo = g.itens.some((it) => ehAtivo(pathname, it.href));
          return (
            <button
              key={g.titulo}
              type="button"
              onClick={() => trocar(true, g.titulo)}
              title={g.titulo}
              className={`group/ic relative flex h-[38px] w-[38px] items-center justify-center rounded-[11px] transition ${ativo ? 'bg-[#EDEDEF] text-[#111113]' : 'text-[#8A8A90] hover:bg-[#F0F0F1] hover:text-[#111113]'}`}
            >
              <NavIcon icon={g.icon} />
              <span className="pointer-events-none absolute left-[50px] z-50 hidden whitespace-nowrap rounded-[8px] bg-[#111113] px-2.5 py-1 text-[12px] font-bold text-white group-hover/ic:block">{g.titulo}</span>
            </button>
          );
        })}
        <form action="/api/auth/logout" method="post" className="mt-auto">
          <button type="submit" title="Sair da conta" className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] text-[#8A8A90] hover:bg-[#F0F0F1] hover:text-[#111113]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8" />
              <path d="M17 16l5-4-5-4 M22 12H10" />
            </svg>
          </button>
        </form>
      </aside>
    );
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-[#E9E9EB] bg-[#FAFAFA] lg:flex">
      <div className="flex items-center justify-between px-4 pb-4 pt-5">
        <Marca />
        <button type="button" onClick={() => trocar(false)} title="Fechar menu" className="flex h-7 w-7 items-center justify-center rounded-[8px] border border-[#E2E2E5] bg-white text-[13px] text-[#46464B] hover:bg-[#F4F4F5]">
          «
        </button>
      </div>
      <div className="px-3 pb-2">
        <BotaoAtualizar />
      </div>
      <nav className="flex flex-1 flex-col gap-px overflow-y-auto px-3 pb-3 pt-1">
        {FIXOS.map((it) => (
          <ItemLink key={it.href} item={it} ativo={ehAtivo(pathname, it.href)} />
        ))}
        <span className="px-2.5 pb-1.5 pt-4 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-[#A1A1A8]">Mais</span>
        {GRUPOS.map((g) => (
          <BlocoGrupo key={g.titulo} grupo={g} pathname={pathname} abrirSempre={grupoPedido === g.titulo} />
        ))}
      </nav>
      <div className="border-t border-[#E9E9EB] px-3 py-3">
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-[9px] px-2.5 py-2 text-[13px] text-[#46464B] transition hover:bg-white hover:text-[#111113]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[#8A8A90]">
              <path d="M14 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8" />
              <path d="M17 16l5-4-5-4 M22 12H10" />
            </svg>
            Sair da conta
          </button>
        </form>
      </div>
    </aside>
  );
}

/** Barra de topo do admin no mobile (a sidebar fica só no desktop). */
export function TopbarMobile() {
  const pathname = usePathname() ?? '';
  const todos = TODOS_ITENS;
  return (
    <div className="sticky top-0 z-30 border-b border-[rgba(21,21,33,0.08)] bg-white lg:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[15px] font-bold tracking-[-0.02em] text-ink">
            LudHub
          </span>
        </div>
        <div className="flex items-center gap-3">
          <BotaoAtualizar variante="compacto" />
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="text-[12px] text-mauve">
              Sair
            </button>
          </form>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto min-h-fit px-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
