/** Cards de projeto da proposta NOVA (banner, avatar, saúde e números de atraso).
 *  Usados na página Projetos e no Dashboard. */
import Link from 'next/link';
import { getCapaDoProjetoNotion, listAllProjetos, listarTarefasAbertasDeTodos, type TarefaDeTodos } from '@/lib/notion';
import { classificarProjeto } from '@/lib/projetoServico';
import { lerCustomizacaoProjeto } from '@/lib/supabase';
import { nomeCurtoDoProjeto, rotas } from '@/lib/rotas';
import { ST, Tag, hojeSP, somaDias, type St } from './lud';

const semTraco = (s: string) => s.replace(/-/g, '');
const BANNER = ['#D3E2F3', '#F2D0EA', '#E3F0B2', '#EFE4D8', '#E2DDFA', '#D8EDCF', '#F8D5E5', '#D6D6D9'];

export type Linha = {
  id: string;
  nome: string;
  tipo: string;
  cliente: string;
  clienteId: string;
  status: string | null;
  capa: string | null;
  atr: number;
  p7: number;
  p21: number;
  saude: { texto: string; st: St };
};

export async function carregarProjetos(): Promise<Linha[]> {
  const [projetos, tarefas] = await Promise.all([
    listAllProjetos(),
    listarTarefasAbertasDeTodos().catch(() => [] as TarefaDeTodos[]),
  ]);
  const hoje = hojeSP();
  const d7 = somaDias(hoje, 7);
  const d21 = somaDias(hoje, 21);
  // Mesma capa da página do projeto: a trocada no portal primeiro, senão a do Notion.
  const capas = await Promise.all(
    projetos.map(async (p) => {
      const custom = await lerCustomizacaoProjeto(p.id).catch(() => null);
      return custom?.coverUrl ?? (await getCapaDoProjetoNotion(p.id).catch(() => null));
    }),
  );
  return projetos.map((p, i) => {
    const doProj = tarefas.filter((t) => t.projetoId && semTraco(t.projetoId) === semTraco(p.id));
    const atr = doProj.filter((t) => t.prazo && t.prazo < hoje).length;
    const p7 = doProj.filter((t) => t.prazo && t.prazo >= hoje && t.prazo <= d7).length;
    const p21 = doProj.filter((t) => t.prazo && t.prazo > d7 && t.prazo <= d21).length;
    const saude: { texto: string; st: St } = atr > 3 ? { texto: 'Crítico', st: 'atr' } : atr > 0 ? { texto: 'Atenção', st: 'cheg' } : { texto: 'Em dia', st: 'ok' };
    return {
      id: p.id,
      nome: p.nome,
      tipo: classificarProjeto(p.nome),
      cliente: p.clienteNome,
      clienteId: p.clienteId,
      status: p.status,
      capa: capas[i],
      atr,
      p7,
      p21,
      saude,
    };
  });
}

export function CardProjeto({ p, i }: { p: Linha; i: number }) {
  const curto = nomeCurtoDoProjeto(p.nome);
  const temArroba = curto.startsWith('@');
  return (
    <div className="flex flex-col overflow-hidden rounded-[18px] border border-[#E9E9EB] bg-white">
      <Link href={rotas.projeto(p.id)} className="block h-20 shrink-0" style={{ background: BANNER[i % BANNER.length] }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.capa && <img src={p.capa} alt={`Capa de ${p.nome}`} className="h-full w-full object-cover" />}
      </Link>
      <div className="flex flex-1 flex-col gap-3 px-[18px] pb-4">
        <span className="-mt-6 mb-[-4px] flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-white bg-[#111113] text-[18px] font-extrabold text-white">
          {(temArroba ? curto.slice(1) : p.nome)[0]?.toUpperCase()}
        </span>
        <div className="flex items-start justify-between gap-2">
          <Link href={rotas.projeto(p.id)} className="flex min-w-0 flex-col gap-0.5">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="rounded-[5px] bg-[#F4F4F5] px-[5px] py-[2px] text-[10px] font-extrabold text-[#46464B]">{p.tipo === 'Instagram' ? 'IG' : p.tipo.toUpperCase()}</span>
              <b className="truncate text-[15px] font-extrabold">{temArroba ? curto : p.nome}</b>
            </span>
            <span className="truncate text-[12px] text-[#636369]">{p.cliente}</span>
          </Link>
          <Tag st={p.saude.st}>{p.saude.texto}</Tag>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { n: p.atr, l: 'ATRASADAS', st: p.atr ? ('atr' as St) : null },
            { n: p.p7, l: 'PRÓX. 7 DIAS', st: null },
            { n: p.p21, l: 'DIAS 8 A 21', st: null },
          ].map((x) => (
            <span
              key={x.l}
              className="flex flex-col gap-0.5 rounded-[12px] px-2.5 py-2"
              style={{ background: x.st ? ST[x.st][0] : '#F4F4F5', color: x.st ? ST[x.st][1] : '#111113' }}
            >
              <b className="text-[22px] font-extrabold leading-none tracking-[-0.02em] tabular-nums">{x.n}</b>
              <span className="text-[9.5px] font-extrabold tracking-[0.05em] opacity-80">{x.l}</span>
            </span>
          ))}
        </div>
        <div className="mt-auto flex items-center justify-between border-t border-[#E9E9EB] pt-2.5 text-[12px]">
          <Link href={rotas.projeto(p.id)} className="font-extrabold">
            Ver detalhes
          </Link>
          <Link href={`/admin/clientes/${p.clienteId}`} className="text-[#636369] hover:text-[#111113]">
            Cliente →
          </Link>
        </div>
      </div>
    </div>
  );
}

