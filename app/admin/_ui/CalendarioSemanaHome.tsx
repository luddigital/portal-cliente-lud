'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Card } from './lud';
import { SemanaArrastavel } from './SemanaArrastavel';
import type { SemanaHome } from './semanaHome';

const NOMES_DIA = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];

function hojePorExtenso(iso: string) {
  const d = new Date(iso + 'T12:00:00Z');
  const dia = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(d).replace('-feira', '').toLowerCase();
  return `${dia}, ${iso.slice(8)}/${iso.slice(5, 7)}`;
}

/**
 * Calendário da semana da home. As setas buscam só a semana nova (API) e trocam o calendário,
 * sem recarregar a página. Semanas já vistas ficam guardadas, e a anterior e a próxima já vêm buscadas.
 */
export function CalendarioSemanaHome({ inicial }: { inicial: SemanaHome }) {
  const [semana, setSemana] = useState(inicial);
  const [carregando, setCarregando] = useState(false);
  const cache = useRef(new Map<number, Promise<SemanaHome>>([[inicial.deslocamento, Promise.resolve(inicial)]]));

  function buscar(n: number): Promise<SemanaHome> {
    const c = cache.current.get(n);
    if (c) return c;
    const p = fetch(`/api/admin/semana-posts?semana=${n}`, { cache: 'no-store' }).then((r) => {
      if (!r.ok) throw new Error();
      return r.json() as Promise<SemanaHome>;
    });
    cache.current.set(n, p);
    p.catch(() => cache.current.delete(n));
    return p;
  }

  // router.refresh() (ex.: fechou o popup depois de concluir) traz dados novos: usa eles.
  const semanaRef = useRef(semana.deslocamento);
  semanaRef.current = semana.deslocamento;
  useEffect(() => {
    cache.current = new Map([[inicial.deslocamento, Promise.resolve(inicial)]]);
    if (semanaRef.current === inicial.deslocamento) setSemana(inicial);
  }, [inicial]);

  // Concluiu uma etapa em qualquer lugar da tela: relê a semana (o Notion leva uns segundos pra virar a etapa).
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    function aoConcluir() {
      clearTimeout(t);
      t = setTimeout(() => {
        const n = semanaRef.current;
        cache.current.delete(n);
        buscar(n).then((s) => semanaRef.current === n && setSemana(s)).catch(() => {});
      }, 4000);
    }
    window.addEventListener('lud:tarefa-concluida', aoConcluir);
    return () => {
      clearTimeout(t);
      window.removeEventListener('lud:tarefa-concluida', aoConcluir);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Já deixa a semana anterior e a próxima prontas.
  useEffect(() => {
    buscar(semana.deslocamento + 1).catch(() => {});
    buscar(semana.deslocamento - 1).catch(() => {});
  }, [semana.deslocamento]); // eslint-disable-line react-hooks/exhaustive-deps

  async function ir(n: number) {
    setCarregando(true);
    try {
      const s = await buscar(n);
      setSemana(s);
      const url = new URL(window.location.href);
      if (n) url.searchParams.set('semana', String(n));
      else url.searchParams.delete('semana');
      window.history.replaceState(null, '', url.toString());
    } catch {
      /* fica na semana atual */
    } finally {
      setCarregando(false);
    }
  }

  const BTN = 'flex h-10 w-10 items-center justify-center rounded-[12px] border border-[#E9E9EB] bg-white text-[16px] font-bold hover:bg-[#F4F4F5] disabled:opacity-50';
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <b className="text-[16px] font-bold">Calendário da semana</b>
          <span className="w-fit rounded-full bg-[#111113] px-3 py-1 text-[11.5px] font-extrabold text-white">● Hoje é {hojePorExtenso(semana.hoje)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => ir(semana.deslocamento - 1)} disabled={carregando} aria-label="Semana anterior" className={BTN}>
            ‹
          </button>
          <button type="button" onClick={() => ir(0)} className="px-1 text-[18px] font-extrabold tracking-[-0.01em]" title="Voltar pra semana de hoje">
            {semana.rotulo}
          </button>
          <button type="button" onClick={() => ir(semana.deslocamento + 1)} disabled={carregando} aria-label="Próxima semana" className={BTN}>
            ›
          </button>
        </div>
      </div>
      {semana.erro && (
        <p className="rounded-[10px] bg-[#FBE3E0] px-3 py-2 text-[12.5px] font-bold text-[#7E211C]">
          O Notion não respondeu e os posts desta semana não carregaram.{' '}
          <button type="button" className="underline" onClick={() => (cache.current.delete(semana.deslocamento), ir(semana.deslocamento))}>
            Tentar de novo
          </button>
        </p>
      )}
      <div className={`transition-opacity ${carregando ? 'opacity-50' : ''}`}>
        {/* key: troca de semana monta o calendário de novo (senão ele guardava os posts da semana anterior) */}
        <SemanaArrastavel key={semana.dias[0]} dias={semana.dias} nomesDia={NOMES_DIA} hoje={semana.hoje} postsIniciais={semana.posts} />
      </div>
      <Link href="/admin/calendario" className="w-fit rounded-[11px] border border-[#D6D6D9] bg-white px-4 py-2 text-[13px] font-extrabold hover:bg-[#F4F4F5]">
        Ver mês completo →
      </Link>
    </Card>
  );
}
