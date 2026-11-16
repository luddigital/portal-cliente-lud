'use client';

/** "Ações" da página de tráfego: tarefas abertas do projeto, com check que conclui no Notion. */
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { rotas } from '@/lib/rotas';
import { ST, Tag, Vazio, type St } from '../../_ui/lud';

export type AcaoLite = { id: string; titulo: string; prazo: string | null; pessoa: string | null };

const SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function AcoesProjeto({ acoes, hojeIso }: { acoes: AcaoLite[]; hojeIso: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [feitas, setFeitas] = useState<Set<string>>(new Set());
  const [indo, setIndo] = useState<string | null>(null);
  const [erro, setErro] = useState(false);

  async function concluir(id: string) {
    setIndo(id);
    setErro(false);
    try {
      const r = await fetch(`/api/tarefas/${id}/concluir`, { method: 'POST' });
      if (!r.ok) throw new Error();
      setFeitas((s) => new Set(s).add(id));
      startTransition(() => router.refresh());
    } catch {
      setErro(true);
    } finally {
      setIndo(null);
    }
  }

  const quando = (p: string | null): { t: string; st: St } => {
    if (!p) return { t: 'sem data', st: 'neu' };
    if (p < hojeIso) return { t: `venceu ${dm(p)}`, st: 'atr' };
    if (p === hojeIso) return { t: 'hoje', st: 'hoje' };
    return { t: `${SEM[new Date(p + 'T12:00:00Z').getUTCDay()]} ${dm(p)}`, st: 'cheg' };
  };

  return (
    <section className="flex flex-col gap-2 rounded-[20px] border border-[#E9E9EB] bg-white p-5">
      <div className="flex flex-col gap-0.5">
        <b className="text-[16px] font-bold">Ações</b>
        <span className="text-[12.5px] text-[#636369]">tarefas abertas do projeto no Notion</span>
      </div>
      {erro && <span className="text-[12px] font-bold text-[#B42318]">Não consegui concluir no Notion. Tente de novo.</span>}
      {acoes.length === 0 ? (
        <Vazio>Nenhuma tarefa aberta.</Vazio>
      ) : (
        <div className="flex flex-col">
          {acoes.map((a) => {
            const f = feitas.has(a.id);
            const q = f ? { t: 'feita', st: 'ok' as St } : quando(a.prazo);
            return (
              <div key={a.id} className="flex items-center gap-2.5 border-t border-[#F4F4F5] py-2.5 first:border-t-0">
                <button
                  type="button"
                  aria-label={`Concluir ${a.titulo}`}
                  disabled={f || indo === a.id}
                  onClick={() => concluir(a.id)}
                  className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] text-[10px] font-extrabold"
                  style={f ? { background: ST.ok[0], borderColor: ST.ok[2], color: ST.ok[1] } : { borderColor: '#B4B4B9' }}
                >
                  {f ? '✓' : ''}
                </button>
                <Link href={rotas.tarefa(a.id)} className={`min-w-0 flex-1 text-[13px] leading-snug hover:underline ${f ? 'text-[#8A8A90] line-through' : ''}`}>
                  {a.titulo}
                </Link>
                <Tag st={q.st} className="!min-w-0">{q.t}</Tag>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
