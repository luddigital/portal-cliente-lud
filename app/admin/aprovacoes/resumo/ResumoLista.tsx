'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ResumoDoCliente } from '@/lib/resumo-tarde';
import { LinkPrevia } from '../../_components/LinkPrevia';

const SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const hojeSp = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

function Prazo({ prazo }: { prazo: string | null }) {
  if (!prazo) return <span className="rounded-[8px] border border-dashed border-[#D6D6D9] px-2 py-0.5 text-[11.5px] font-bold text-[#8A8A90]">sem prazo</span>;
  const d = prazo.slice(0, 10);
  const h = hojeSp();
  const [bg, fg, txt] = d < h ? ['#F6CFCB', '#7E211C', 'atrasado'] : d === h ? ['#F8D5E5', '#7A1F4C', 'vence hoje'] : ['#F4F4F5', '#46464B', 'prazo'];
  return (
    <span className="whitespace-nowrap rounded-[8px] px-2 py-0.5 text-[11.5px] font-extrabold" style={{ background: bg, color: fg }}>
      {txt} · {SEM[new Date(`${d}T12:00:00Z`).getUTCDay()]} {d.slice(8, 10)}/{d.slice(5, 7)}
    </span>
  );
}

export function ResumoLista({ clientes }: { clientes: ResumoDoCliente[] }) {
  const router = useRouter();
  const [salvando, setSalvando] = useState<string | null>(null);
  async function alternar(postId: string, fora: boolean) {
    setSalvando(postId);
    await fetch('/api/admin/resumo-tarde', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId, fora }) }).catch(() => null);
    setSalvando(null);
    router.refresh();
  }
  if (!clientes.length) return <div className="rounded-[16px] border border-[#E9E9EB] bg-white px-5 py-8 text-center text-[13.5px] text-[#636369]">Nenhum post esperando aprovação de cliente.</div>;
  const total = clientes.reduce((n, c) => n + c.posts.filter((p) => !p.fora).length, 0);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-[#46464B]">
        Às 16h: <b>{total} {total === 1 ? 'post' : 'posts'}</b> em <b>{clientes.filter((c) => c.posts.some((p) => !p.fora)).length} grupos</b>. Clique no post pra abrir e mudar o prazo.
      </p>
      {clientes.map((c) => {
        const vao = c.posts.filter((p) => !p.fora).length;
        return (
          <section key={c.projetoId} className="flex flex-col gap-3 rounded-[18px] border border-[#E9E9EB] bg-white p-5">
            <div className="flex flex-wrap items-center gap-2">
              <b className="text-[16px]">{c.projetoNome}</b>
              <span className="text-[12px] text-[#636369]">{c.grupoNome ? `grupo ${c.grupoNome}` : 'sem grupo do WhatsApp'}</span>
              <span className="ml-auto text-[12px] font-bold text-[#46464B]">{vao ? `${vao} no resumo` : 'não vai mensagem hoje'}</span>
            </div>
            <div className="flex flex-col divide-y divide-[#F4F4F5] rounded-[12px] border border-[#F0F0F2]">
              {c.posts.map((p) => (
                <div key={p.postId} className={`flex flex-wrap items-center gap-2 px-3 py-2.5 ${p.fora ? 'opacity-50' : ''}`}>
                  <LinkPrevia postId={p.postId} tarefaId={p.tarefaId} className="!w-auto text-[13.5px] font-bold hover:underline">
                    {p.titulo}
                  </LinkPrevia>
                  <Prazo prazo={p.prazo} />
                  {!p.abriu && <span className="rounded-[8px] bg-[#F2D0EA] px-2 py-0.5 text-[11.5px] font-extrabold text-[#6A2B5F]">ainda não abriu</span>}
                  <span className="ml-auto flex items-center gap-2">
                    {p.motivoFora && p.motivoFora !== 'você tirou do resumo de hoje' ? (
                      <span className="text-[12px] text-[#636369]">{p.motivoFora}</span>
                    ) : (
                      <button
                        type="button"
                        disabled={salvando === p.postId}
                        onClick={() => alternar(p.postId, !p.fora)}
                        className="rounded-full border border-[#D6D6D9] bg-white px-3 py-1 text-[12px] font-extrabold hover:bg-[#F4F4F5] disabled:opacity-50"
                      >
                        {p.fora ? 'Voltar pro resumo' : 'Tirar de hoje'}
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
            {c.mensagem && (
              <details>
                <summary className="cursor-pointer text-[12.5px] font-bold text-[#46464B]">Ver a mensagem</summary>
                <pre className="mt-2 whitespace-pre-wrap rounded-[12px] bg-[#F7F7F8] p-3 font-sans text-[13px] leading-[1.5] text-[#2C2C30]">{c.mensagem}</pre>
              </details>
            )}
          </section>
        );
      })}
    </div>
  );
}
