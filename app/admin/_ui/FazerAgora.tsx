'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { corDaEtapa } from '@/lib/corEtapa';
import { AvatarProjeto } from './Avatares';

export type ItemFazerAgora = {
  id: string;
  titulo: string;
  post: string | null;
  prazo: string | null;
  projeto: string | null;
  pessoa: string;
};

/** Home: o que fazer agora (atrasadas + hoje), no mesmo visual da página de Tarefas. */
export function FazerAgora({ itens, hoje, pessoas }: { itens: ItemFazerAgora[]; hoje: string; pessoas: string[] }) {
  const router = useRouter();
  const [feitas, setFeitas] = useState<Record<string, true>>({});
  const [pessoa, setPessoa] = useState<string>('');
  const [mais, setMais] = useState(false);
  const lista = itens.filter((t) => !feitas[t.id] && (!pessoa || t.pessoa === pessoa));
  const visiveis = mais ? lista : lista.slice(0, 10);
  async function concluir(id: string) {
    setFeitas((f) => ({ ...f, [id]: true }));
    const r = await fetch(`/api/tarefas/${id}/concluir`, { method: 'POST' }).catch(() => null);
    if (!r?.ok) {
      setFeitas((f) => {
        const n = { ...f };
        delete n[id];
        return n;
      });
      return;
    }
    router.refresh();
  }
  const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {['', ...pessoas].map((p) => {
          const n = itens.filter((t) => !feitas[t.id] && (!p || t.pessoa === p)).length;
          return (
            <button
              key={p || 'todos'}
              type="button"
              onClick={() => setPessoa(p)}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-[12.5px] font-bold ${pessoa === p ? 'bg-[#111113] text-white' : 'border border-[#E9E9EB] bg-white text-[#46464B] hover:border-[#B4B4B9]'}`}
            >
              {p ? p.split(' ')[0] : 'Todo mundo'} <span className="opacity-60">{n}</span>
            </button>
          );
        })}
      </div>
      {lista.length === 0 ? (
        <p className="rounded-[12px] bg-[#F7F7F8] px-4 py-6 text-center text-[13px] text-[#8A8A90]">Nada atrasado nem pra hoje. ✓</p>
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-[#EDEDEF]">
          <table className="w-full table-fixed border-collapse">
            <tbody>
              {visiveis.map((t) => {
                const atr = !!t.prazo && t.prazo.slice(0, 10) < hoje;
                const c = corDaEtapa(t.titulo);
                return (
                  <tr key={t.id} className="border-b border-[#F2F2F4] last:border-0 hover:bg-[#FAFAFB]">
                    <td className={`w-[64px] px-3 py-2.5 text-[12.5px] font-bold ${atr ? 'text-[#B42318]' : 'text-[#46464B]'}`}>{t.prazo ? (atr ? dm(t.prazo) : 'hoje') : ''}</td>
                    <td className="w-[230px] px-2 py-2.5">
                      <span title={t.titulo} className="inline-block max-w-full truncate whitespace-nowrap rounded-full px-2.5 py-[3px] align-middle text-[11.5px] font-bold" style={{ background: c.bg, color: c.fg }}>
                        {t.titulo}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      <Link href={`/admin/tarefas/${t.id}`} title={t.post ?? t.titulo} className="block truncate text-[13px] text-[#2C2C30] hover:underline">
                        {t.post ?? t.projeto ?? '—'}
                      </Link>
                    </td>
                    <td className="w-[52px] px-2 py-2.5">{t.projeto && <AvatarProjeto handle={t.projeto} />}</td>
                    <td className="w-[110px] truncate px-2 py-2.5 text-[12px] text-[#636369]" title={t.pessoa}>
                      {t.pessoa.split(' ')[0]}
                    </td>
                    <td className="w-[120px] px-3 py-2.5 text-right">
                      <button type="button" onClick={() => concluir(t.id)} className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-[#2E7D4F] bg-[#2E7D4F] px-3 py-[3px] text-[11.5px] font-bold text-white hover:bg-[#256A42]">
                        ✓ Concluir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between text-[12.5px] font-bold">
        {lista.length > 10 ? (
          <button type="button" onClick={() => setMais((v) => !v)} className="text-[#46464B] hover:underline">
            {mais ? 'mostrar menos' : `mostrar mais ${lista.length - 10}`}
          </button>
        ) : (
          <span />
        )}
        <Link href="/admin/tarefas" className="text-[#111113] hover:underline">
          ver todas em Tarefas →
        </Link>
      </div>
    </div>
  );
}
