import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import {
  getColaboradorByEmail,
  listarTarefasDaEsteira,
  type CardEsteiraNotion,
} from '@/lib/notion';
import { EsteiraView, type CardMock } from './EsteiraView';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Paleta pra colorir clientes que não têm cor manual definida
const CORES_CLIENTE = [
  '#E85A4F', '#2E86AB', '#B85C38', '#4D9078', '#8E44AD',
  '#D4A017', '#C0392B', '#16A085', '#6E2A2C', '#3D5A80',
];
const CORES_CLIENTE_MANUAL: Record<string, string> = {
  'Nyorquina': '#E85A4F',
  'Descubra Paris': '#2E86AB',
  'Descobrindo a Suíça': '#B85C38',
  'Turismo em Chicago': '#4D9078',
  'TKRA-Takara': '#8E44AD',
  'Ligia Bueno': '#D4A017',
  'Roteiros na África': '#C0392B',
  'Ste Travels': '#16A085',
  'Israel by Thati': '#6E2A2C',
  'Re Sucena': '#3D5A80',
  'Emanuel Transfer Paris': '#5A7B4E',
};
function corDoCliente(nome: string): string {
  // Também bate na parte depois de "IG | @" — pega o handle pra dar cor
  const chave = nome.trim();
  if (CORES_CLIENTE_MANUAL[chave]) return CORES_CLIENTE_MANUAL[chave];
  for (const [k, v] of Object.entries(CORES_CLIENTE_MANUAL)) {
    if (chave.toLowerCase().includes(k.toLowerCase())) return v;
  }
  let hash = 0;
  for (const c of chave) hash = (hash * 31 + c.charCodeAt(0)) | 0;
  return CORES_CLIENTE[Math.abs(hash) % CORES_CLIENTE.length];
}

function iniciais(nome: string | null): string {
  if (!nome) return '?';
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

const CORES_PESSOA_MANUAL: Record<string, string> = {
  Luiza: '#6E2A2C',
  Alisson: '#3D5A80',
  Thifany: '#B68A2E',
};
function corDaPessoa(nome: string | null): string {
  if (!nome) return '#7A6B58';
  const primeiro = nome.trim().split(/\s+/)[0];
  if (CORES_PESSOA_MANUAL[primeiro]) return CORES_PESSOA_MANUAL[primeiro];
  let hash = 0;
  for (const c of nome) hash = (hash * 31 + c.charCodeAt(0)) | 0;
  const cores = ['#6E2A2C', '#3D5A80', '#B68A2E', '#4B7F52', '#7A4E9B', '#B85C38'];
  return cores[Math.abs(hash) % cores.length];
}

function toCard(t: CardEsteiraNotion): CardMock {
  const nomePessoa = t.responsavelNome ?? 'Sem responsável';
  return {
    id: t.tarefaId,
    postId: t.postId,
    titulo: t.postTitulo,
    cliente: {
      id: t.projetoId,
      nome: t.projetoNome,
      cor: corDoCliente(t.projetoNome),
    },
    responsavel: {
      id: t.responsavelId ?? 'sem',
      nome: nomePessoa,
      iniciais: iniciais(t.responsavelNome),
      cor: corDaPessoa(t.responsavelNome),
    },
    prazoIso: t.prazo ?? new Date().toISOString(),
    coluna: t.coluna,
    etapa: t.entregaNome,
  };
}

export default async function EsteiraPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const ehAdmin = env.auth.adminEmails.includes(
    session.email.trim().toLowerCase(),
  );
  let ehColaborador = !!session.colaboradorId;
  if (!ehColaborador && !ehAdmin) {
    try {
      const colab = await getColaboradorByEmail(session.email);
      ehColaborador = !!colab;
    } catch {}
  }
  if (!ehAdmin && !ehColaborador) redirect('/');

  let cards: CardMock[] = [];
  let erro: string | null = null;
  try {
    const notionCards = await listarTarefasDaEsteira();
    cards = notionCards.map(toCard);
  } catch (err: any) {
    console.error('[esteira] falhou buscar tarefas:', err);
    erro = err?.message ?? 'Erro ao carregar tarefas';
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-20 border-b border-[rgba(21,21,33,0.08)] bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              href={ehAdmin ? '/admin' : '/gestao'}
              className="text-[13px] text-mauve transition hover:text-ink"
            >
              ← Voltar
            </Link>
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-t3">
              produção
            </span>
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-t3">
            esteira · {cards.length} tarefa{cards.length === 1 ? '' : 's'}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-6 py-8">
        {erro && (
          <div className="mb-6 rounded-xl border border-hubRed/30 bg-hubRed/5 px-4 py-3 text-[13px] text-hubRed">
            Erro ao carregar dados reais do Notion: {erro}
          </div>
        )}
        <EsteiraView cardsIniciais={cards} />
      </main>
    </div>
  );
}
