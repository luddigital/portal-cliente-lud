/**
 * Entrega "Criação de Pauta" com todos os clientes (canvas NovaEntregaProjeto-pauta-todos):
 * quem está atrasado, em andamento, pronto pra aprovar ou já com o cliente.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { carregarEntrega } from '@/lib/entrega-dados';
import { listarTarefasAbertasDosPosts } from '@/lib/notion';
import { rotas } from '@/lib/rotas';
import { Trilha } from '../../_components/Trilha';
import { Card, Pagina, ST, Tag, Vazio, type St } from '../../_ui/lud';
import { AlternadorClientes } from '../../projetos/[id]/entregas/[entregaId]/EntregaPautaNova';
import { MESES, diaSemana, dm, montarCliente, primeiroNome, type EstadoPauta, type PautaCliente } from './pautaDados';

const ROT = 'text-[10.5px] font-extrabold uppercase tracking-[0.08em]';

function Kpi({ rot, val, sub, st }: { rot: string; val: string; sub: string; st?: St }) {
  return (
    <div
      className="flex min-w-0 flex-col gap-0.5 rounded-[18px] px-4 py-3.5"
      style={st ? { background: ST[st][0], color: ST[st][1] } : { background: '#FFFFFF', border: '1px solid #E9E9EB' }}
    >
      <span className={ROT}>{rot}</span>
      <b className="text-[24px] font-extrabold tracking-[-0.02em]">{val}</b>
      <span className="text-[12px]">{sub}</span>
    </div>
  );
}

const GRUPOS: { k: EstadoPauta; nome: string; st: St }[] = [
  { k: 'atr', nome: 'Atrasados', st: 'atr' },
  { k: 'and', nome: 'Em andamento', st: 'neu' },
  { k: 'pronta', nome: 'Prontos pra aprovar', st: 'ok' },
  { k: 'enviada', nome: 'Já com o cliente', st: 'info' },
];

const COLS = 'sm:grid-cols-[minmax(150px,1.1fr)_minmax(0,1.4fr)_140px_110px_160px]';

function Linha({ c, entregaId }: { c: PautaCliente; entregaId: string }) {
  const total = c.posts.length;
  const sit =
    c.estado === 'atr' ? (
      <Tag st="atr">venceu {dm(c.prazo)}</Tag>
    ) : c.estado === 'and' ? (
      <Tag st="neu">{c.prazo ? `vence ${dm(c.prazo)}` : 'sem prazo'}</Tag>
    ) : c.estado === 'pronta' ? (
      <Tag st="ok">pronta pra aprovar</Tag>
    ) : (
      <Tag st="info">com o cliente</Tag>
    );
  return (
    <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1.5 border-t border-[#F4F4F5] px-1.5 py-2.5 ${COLS}`}>
      <Link href={rotas.entregaDoProjeto(c.projetoId, entregaId)} className="flex min-w-0 items-center gap-2 hover:underline">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#111113] text-[10px] font-extrabold text-white">
          {c.handle.replace(/^@/, '').charAt(0).toUpperCase()}
        </span>
        <b className="truncate text-[13.5px]">{c.handle}</b>
      </Link>
      <span className="col-span-2 flex min-w-0 flex-col gap-1 sm:col-span-1">
        <span className="flex gap-[2px]">
          {c.posts.map((p) => (
            <span key={p.postId} className="h-2 flex-1 rounded-[2px]" style={{ background: p.tema ? ST.ok[2] : '#E9E9EB' }} />
          ))}
        </span>
        <span className="text-[11.5px] text-[#636369]">
          {c.comTema} de {total} pautas
        </span>
      </span>
      <span>{sit}</span>
      <span className="hidden truncate text-[12.5px] text-[#46464B] sm:block">{c.quemCria.map(primeiroNome).join(', ') || 'sem responsável'}</span>
      <span className="justify-self-end">
        {c.estado === 'pronta' ? (
          <Link
            href={rotas.entregaDoProjeto(c.projetoId, entregaId)}
            className="btn-enviar inline-flex h-[30px] items-center rounded-[10px] px-3 text-[12.5px] font-extrabold text-white"
            style={{ background: ST.ok[2] }}
          >
            Mandar pra aprovar
          </Link>
        ) : (
          <Link
            href={rotas.entregaDoProjeto(c.projetoId, entregaId)}
            className="inline-flex h-[30px] items-center rounded-[10px] border border-[#D6D6D9] bg-white px-3 text-[12.5px] font-extrabold hover:bg-[#F4F4F5]"
          >
            Abrir →
          </Link>
        )}
      </span>
    </div>
  );
}

export async function PautaTodos({ id }: { id: string }) {
  const d = await carregarEntrega(id);
  if (!d) notFound();
  const postIds = d.grupos.flatMap((g) => g.itens.map((i) => i.postId)).filter((x): x is string => !!x);
  const abertas = await listarTarefasAbertasDosPosts(postIds).catch(() => new Map());
  const clientes = d.grupos
    .map((g) => montarCliente(g, d.hojeIso, abertas))
    .filter((c): c is PautaCliente => !!c)
    .sort((a, b) => (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999') || a.handle.localeCompare(b.handle, 'pt-BR'));
  const total = clientes.reduce((s, c) => s + c.posts.length, 0);
  const comTema = clientes.reduce((s, c) => s + c.comTema, 0);
  const atr = clientes.filter((c) => c.estado === 'atr');
  const prontos = clientes.filter((c) => c.estado === 'pronta');
  const prazosAtr = [...new Set(atr.map((c) => c.prazo).filter((x): x is string => !!x))].sort();
  const aprov = clientes.map((c) => c.aprovacao).filter((x): x is string => !!x).sort();
  const meses = [...new Set(clientes.map((c) => c.mes))].sort();
  const nomeMes = meses.length ? MESES[Number(meses[meses.length - 1].slice(5, 7)) - 1] : '';

  return (
    <Pagina>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Trilha itens={[{ rotulo: 'Entregas', href: rotas.entregas() }, { rotulo: d.entrega.nome }]} />
        <AlternadorClientes
          entregaId={d.entrega.id}
          atual={null}
          clientes={clientes.map((c) => ({ projetoId: c.projetoId, handle: c.handle, feitas: c.comTema, total: c.posts.length }))}
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-[12px] font-bold text-[#636369]">
          Entrega{d.entrega.frequencia ? ` ${d.entrega.frequencia.toLowerCase()}` : ''}
          {nomeMes ? ` · pautas de ${nomeMes}` : ''} · {clientes.length} {clientes.length === 1 ? 'cliente' : 'clientes'}
        </span>
        <h1 className="text-[30px] font-extrabold leading-tight tracking-[-0.02em]">{d.entrega.nome}</h1>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          rot="Atrasados"
          val={`${atr.length} ${atr.length === 1 ? 'cliente' : 'clientes'}`}
          sub={atr.length ? `venceu ${prazosAtr.map((p) => `${diaSemana(p)} ${dm(p)}`).slice(0, 2).join(' e ')}` : 'ninguém atrasado'}
          st={atr.length ? 'atr' : undefined}
        />
        <Kpi rot="Pautas criadas" val={`${comTema} de ${total}`} sub={total - comTema ? `faltam ${total - comTema} temas` : 'todas com tema'} />
        <Kpi rot="Prontos" val={`${prontos.length} ${prontos.length === 1 ? 'cliente' : 'clientes'}`} sub="todas as pautas com tema" st={prontos.length ? 'ok' : undefined} />
        <Kpi rot="Próxima etapa" val="Aprovação" sub={aprov.length ? `clientes aprovam a partir de ${diaSemana(aprov[0])}, ${dm(aprov[0])}` : 'os clientes aprovam as pautas'} st="cheg" />
      </div>

      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2 pb-2">
          <b className="text-[16px]">Clientes</b>
          <span className="text-[12.5px] text-[#636369]">clica num cliente pra abrir só ele</span>
        </div>
        {clientes.length === 0 ? (
          <Vazio>Nenhum cliente com pautas nessa entrega agora.</Vazio>
        ) : (
          <>
            <div className={`hidden gap-3.5 px-1.5 pb-1.5 text-[10.5px] font-extrabold tracking-[0.06em] text-[#8A8A90] sm:grid ${COLS}`}>
              <span>CLIENTE</span>
              <span>PAUTAS{nomeMes ? ` DE ${nomeMes.toUpperCase()}` : ''}</span>
              <span>PRAZO</span>
              <span>QUEM CRIA</span>
              <span />
            </div>
            {GRUPOS.map((g) => {
              const ls = clientes.filter((c) => c.estado === g.k);
              if (!ls.length) return null;
              return (
                <div key={g.k} className="flex flex-col">
                  <span className="px-1.5 pb-1 pt-3 text-[11px] font-extrabold tracking-[0.08em]" style={{ color: ST[g.st][1] }}>
                    {g.nome.toUpperCase()} · {ls.length}
                  </span>
                  {ls.map((c) => (
                    <Linha key={c.projetoId} c={c} entregaId={d.entrega.id} />
                  ))}
                </div>
              );
            })}
          </>
        )}
      </Card>
    </Pagina>
  );
}
