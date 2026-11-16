'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LinkPrevia } from '../_components/LinkPrevia';

export type PostSemana = {
  id: string;
  dia: string; // YYYY-MM-DD (fuso de São Paulo)
  hora: string | null; // parte da hora da Data Postagem, se tiver ("T10:00:00.000-03:00")
  handle: string;
  titulo: string;
  rotulo: string;
  fundo: string;
  cor: string;
  postado: boolean;
};

/**
 * Calendário da semana da dashboard: arrasta o card pra outro dia (ou usa o ✎)
 * pra mudar a Data Postagem do post no Notion. Post já postado não se move.
 */
export function SemanaArrastavel({
  dias,
  nomesDia,
  hoje,
  postsIniciais,
}: {
  dias: string[];
  nomesDia: string[];
  hoje: string;
  postsIniciais: PostSemana[];
}) {
  const router = useRouter();
  const [posts, setPosts] = useState(postsIniciais);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<Set<string>>(new Set());
  const [editando, setEditando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function mover(id: string, novoDia: string) {
    const p = posts.find((x) => x.id === id);
    if (!p || p.dia === novoDia || p.postado) return;
    const antes = p.dia;
    setErro(null);
    setPosts((ps) => ps.map((x) => (x.id === id ? { ...x, dia: novoDia } : x)));
    setSalvando((s) => new Set(s).add(id));
    try {
      const r = await fetch(`/api/pauta/${id}/props`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: p.hora ? `${novoDia}${p.hora}` : novoDia }),
      });
      if (!r.ok) throw new Error();
      router.refresh();
    } catch {
      setPosts((ps) => ps.map((x) => (x.id === id ? { ...x, dia: antes } : x)));
      setErro(`Não deu pra mudar a data de "${p.titulo}". Tenta de novo.`);
    } finally {
      setSalvando((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  }

  const fmt = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;

  return (
    <>
      {erro && <p className="rounded-[10px] bg-[#FBE3E0] px-3 py-2 text-[12.5px] font-bold text-[#7E211C]">{erro}</p>}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
        {dias.map((d, k) => {
          const ehHoje = d === hoje;
          const doDia = posts.filter((p) => p.dia === d);
          const ehAlvo = alvo === d && arrastando !== null;
          return (
            <div
              key={d}
              onDragOver={(e) => {
                if (!arrastando) return;
                e.preventDefault();
                if (alvo !== d) setAlvo(d);
              }}
              onDragLeave={() => setAlvo((a) => (a === d ? null : a))}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain') || arrastando;
                setAlvo(null);
                setArrastando(null);
                if (id) mover(id, d);
              }}
              className={`flex min-h-[140px] min-w-0 flex-col gap-1.5 rounded-[14px] border-2 p-2 transition-colors ${
                ehAlvo ? 'border-dashed border-[#111113] bg-[#F4F4F5]' : ehHoje ? 'border-[#111113] bg-white' : 'border-[#E9E9EB] bg-[#FAFAFA]'
              }`}
            >
              <div className="flex justify-between">
                <span className={`text-[12px] font-extrabold ${ehHoje ? 'text-[#111113]' : 'text-[#636369]'}`}>{ehHoje ? 'HOJE' : nomesDia[k]}</span>
                <b className="text-[16px]">{Number(d.slice(8))}</b>
              </div>
              {doDia.length === 0 && <span className="text-[11.5px] text-[#8A8A90]">{ehAlvo ? 'soltar aqui' : 'sem posts'}</span>}
              {doDia.map((p) => (
                <div
                  key={p.id}
                  draggable={!p.postado}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', p.id);
                    e.dataTransfer.effectAllowed = 'move';
                    setArrastando(p.id);
                  }}
                  onDragEnd={() => {
                    setArrastando(null);
                    setAlvo(null);
                  }}
                  className={`group relative min-w-0 rounded-[10px] ${p.postado ? '' : 'cursor-grab active:cursor-grabbing'} ${arrastando === p.id ? 'opacity-40' : ''} ${salvando.has(p.id) ? 'animate-pulse' : ''}`}
                  style={{ background: p.fundo, color: p.cor }}
                  title={p.postado ? undefined : 'Arraste pra outro dia pra mudar a data'}
                >
                  <LinkPrevia postId={p.id} className="flex min-w-0 flex-col overflow-hidden rounded-[10px]">
                    <span className="flex min-w-0 flex-col gap-1 px-2 pb-1.5 pt-2 pr-5">
                      <b className="line-clamp-2 text-[12px] leading-tight">{p.titulo}</b>
                      <span className="text-[10.5px] font-bold">{salvando.has(p.id) ? 'Salvando…' : p.rotulo}</span>
                    </span>
                    {/* Cliente no rodapé do card (opção 10 do layout) */}
                    <span className="flex min-w-0 items-center gap-1.5 bg-[rgba(17,17,19,0.06)] px-2 py-1">
                      <span className="flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full bg-[#111113] text-[8px] font-extrabold text-white">
                        {p.handle.replace(/^@/, '').charAt(0).toUpperCase()}
                      </span>
                      <span className="truncate text-[10.5px] font-semibold">{p.handle}</span>
                    </span>
                  </LinkPrevia>
                  {!p.postado && (
                    <button
                      type="button"
                      onClick={() => setEditando(editando === p.id ? null : p.id)}
                      aria-label="Mudar a data do post"
                      className="absolute right-1 top-1 rounded-[6px] px-1 text-[11px] opacity-60 hover:bg-white/60 hover:opacity-100"
                    >
                      ✎
                    </button>
                  )}
                  {editando === p.id && (
                    <div className="flex items-center gap-1 px-1.5 pb-1.5">
                      <input
                        type="date"
                        defaultValue={p.dia}
                        autoFocus
                        aria-label={`Nova data de ${p.titulo} (hoje ${fmt(p.dia)})`}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
                            setEditando(null);
                            mover(p.id, v);
                          }
                        }}
                        className="w-full min-w-0 rounded-[6px] border border-[#D6D6D9] bg-white px-1 py-0.5 text-[11px] text-[#111113]"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}
