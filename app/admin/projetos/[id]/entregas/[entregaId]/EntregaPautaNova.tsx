'use client';

/**
 * Entrega "Criação de Pauta" de um cliente (canvas NovaEntregaProjeto-pauta):
 * quanto falta, quando é a aprovação e o calendário do mês com cada dia de post.
 */
import Link from 'next/link';
import { useState } from 'react';
import { rotas } from '@/lib/rotas';
import { Trilha } from '../../../../_components/Trilha';
import { LinkPrevia } from '../../../../_components/LinkPrevia';
import { MudarPrazo } from '../../../../_ui/MudarPrazo';
import { Card, Pagina, ST, TituloCard } from '../../../../_ui/lud';
import {
  MESES,
  diaSemana,
  diasEntre,
  dm,
  primeiroNome,
  somaDiasIso,
  type PautaCliente,
} from '../../../../entregas/[id]/pautaDados';

type Nota = { texto: string; atualizadoPor: string | null; atualizadoEm: string } | null;

const ROT = 'text-[10.5px] font-extrabold uppercase tracking-[0.08em]';

export function AlternadorClientes({
  entregaId,
  atual,
  clientes,
}: {
  entregaId: string;
  atual: { projetoId: string; handle: string } | null;
  clientes: { projetoId: string; handle: string; feitas?: number; total?: number }[];
}) {
  const [busca, setBusca] = useState('');
  const lista = clientes.filter((c) => c.handle.toLowerCase().includes(busca.trim().toLowerCase()));
  return (
    <div className="flex gap-0.5 rounded-[11px] bg-[#F4F4F5] p-[3px]">
      <details className="relative">
        <summary
          className={`cursor-pointer list-none rounded-[9px] px-3 py-1.5 text-[12.5px] [&::-webkit-details-marker]:hidden ${
            atual ? 'bg-white font-extrabold shadow-[0_1px_2px_rgba(17,17,19,0.08)]' : 'font-bold text-[#46464B]'
          }`}
        >
          {atual ? atual.handle : 'Um cliente'} ▾
        </summary>
        <div className="absolute right-0 top-[40px] z-20 flex w-[300px] flex-col gap-0.5 rounded-[14px] border border-[#E9E9EB] bg-white p-2 shadow-[0_12px_32px_rgba(17,17,19,0.12)]">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente…"
            aria-label="Buscar cliente"
            className="mb-1 rounded-[9px] border border-[#D6D6D9] px-2.5 py-1.5 text-[12.5px]"
          />
          <div className="flex max-h-[300px] flex-col gap-0.5 overflow-auto">
            {lista.map((c) => (
              <Link
                key={c.projetoId}
                href={rotas.entregaDoProjeto(c.projetoId, entregaId)}
                className={`flex items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-[13px] hover:bg-[#F4F4F5] ${
                  atual?.projetoId === c.projetoId ? 'bg-[#F4F4F5] font-extrabold' : 'font-semibold'
                }`}
              >
                <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#111113] text-[8.5px] font-extrabold text-white">
                  {c.handle.replace(/^@/, '').charAt(0).toUpperCase()}
                </span>
                <span className="truncate">{c.handle}</span>
                {c.total ? <span className="ml-auto text-[11.5px] text-[#636369]">{c.feitas ?? 0}/{c.total}</span> : null}
              </Link>
            ))}
            {lista.length === 0 && <span className="px-2.5 py-1.5 text-[12px] text-[#636369]">Nenhum cliente.</span>}
          </div>
        </div>
      </details>
      <Link
        href={rotas.entrega(entregaId)}
        className={`rounded-[9px] px-3 py-1.5 text-[12.5px] ${atual ? 'font-bold text-[#636369]' : 'bg-white font-extrabold shadow-[0_1px_2px_rgba(17,17,19,0.08)]'}`}
      >
        Todos os clientes
      </Link>
    </div>
  );
}

function Kpi({ rot, val, sub, st }: { rot: string; val: string; sub: string; st?: 'atr' | 'ok' }) {
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

export function EntregaPautaNova({
  entregaId,
  entregaNome,
  frequencia,
  c,
  hoje,
  clientes,
  notaInicial,
}: {
  entregaId: string;
  entregaNome: string;
  frequencia: string | null;
  c: PautaCliente;
  hoje: string;
  clientes: { projetoId: string; handle: string; feitas?: number; total?: number }[];
  notaInicial: Nota;
}) {
  const [prazo, setPrazo] = useState(c.prazo);
  const total = c.posts.length;
  const faltam = total - c.comTema;
  const atraso = prazo && prazo < hoje && faltam > 0 ? diasEntre(prazo, hoje) : 0;
  const [ano, mesN] = c.mes.split('-').map(Number);
  const nomeMes = MESES[mesN - 1];
  const aprovador = primeiroNome(c.aprovador) || 'o cliente';
  const criadores = c.quemCria.map(primeiroNome).filter(Boolean);
  const diasDePost = [...new Set(c.posts.map((p) => diaSemana(p.data)))];
  const ORD = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
  diasDePost.sort((a, b) => ORD.indexOf(a) - ORD.indexOf(b));

  // ---- próxima etapa: os dias até a aprovação
  const ap = c.aprovacao;
  const diasAteAp = ap ? diasEntre(hoje, ap) : null;
  const blocos: { d: string; rot: string; fim: boolean; hoje: boolean }[] = [];
  if (ap && diasAteAp !== null && diasAteAp >= 0) {
    if (diasAteAp <= 6) {
      for (let k = 0; k <= diasAteAp; k++) {
        const d = somaDiasIso(hoje, k);
        blocos.push({ d, rot: k === 0 ? 'hoje' : k === diasAteAp ? 'aprovação' : '', fim: k === diasAteAp, hoje: k === 0 });
      }
    } else {
      blocos.push({ d: hoje, rot: 'hoje', fim: false, hoje: true });
      blocos.push({ d: '', rot: `+${diasAteAp - 1} dias`, fim: false, hoje: false });
      blocos.push({ d: ap, rot: 'aprovação', fim: true, hoje: false });
    }
  }

  // ---- calendário do mês (semana começa na segunda)
  const diasNoMes = new Date(Date.UTC(ano, mesN, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(ano, mesN - 1, 1)).getUTCDay() + 6) % 7;
  const porDia = new Map<number, typeof c.posts>();
  for (const p of c.posts) {
    const d = Number(p.data.slice(8, 10));
    porDia.set(d, [...(porDia.get(d) ?? []), p]);
  }

  // ---- tipos de post
  const tipos = new Map<string, number>();
  for (const p of c.posts) {
    const k = p.tema ? p.tipo ?? 'Sem tipo definido' : 'Sem tema ainda';
    tipos.set(k, (tipos.get(k) ?? 0) + 1);
  }
  const listaTipos = [...tipos.entries()].sort((a, b) => (a[0] === 'Sem tema ainda' ? 1 : b[0] === 'Sem tema ainda' ? -1 : b[1] - a[1]));

  // ---- histórico
  const hist: { txt: string; quando: string; st: 'atr' | 'ok' | 'neu' }[] = [];
  if (atraso > 0) hist.push({ txt: `Hoje · ${atraso} ${atraso === 1 ? 'dia' : 'dias'} de atraso`, quando: `${diaSemana(hoje)}, ${dm(hoje)}`, st: 'atr' });
  const feitas = c.posts.filter((p) => p.feitaEm).sort((a, b) => (b.feitaEm ?? '').localeCompare(a.feitaEm ?? ''));
  for (const p of feitas.slice(0, 5)) {
    const iso = p.feitaEm!;
    const hora = iso.length > 10 ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)).replace(':', 'h') : '';
    const dia = iso.length > 10 ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso)) : iso.slice(0, 10);
    hist.push({ txt: `Pauta "${p.titulo}" criada`, quando: `${diaSemana(dia)}, ${dm(dia)}${hora ? ` às ${hora}` : ''}`, st: 'ok' });
  }
  if (prazo && prazo < hoje && faltam > 0) hist.push({ txt: 'Prazo venceu', quando: `${diaSemana(prazo)}, ${dm(prazo)}`, st: 'neu' });

  // ---- nota interna
  const [nota, setNota] = useState(notaInicial?.texto ?? '');
  const [notaSalva, setNotaSalva] = useState(notaInicial);
  const [salvando, setSalvando] = useState(false);
  const [erroNota, setErroNota] = useState(false);
  async function salvarNota() {
    if (nota === (notaSalva?.texto ?? '')) return;
    setSalvando(true);
    setErroNota(false);
    try {
      const r = await fetch(`/api/admin/entregas/${entregaId}/nota`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projetoId: c.projetoId, texto: nota }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error();
      setNotaSalva(j.nota);
    } catch {
      setErroNota(true);
    } finally {
      setSalvando(false);
    }
  }

  // "Mudar prazo" muda todas as tarefas abertas dessa entrega pro cliente.
  const primeira = c.tarefasAbertas[0];
  async function mudouPrazo(novo: string) {
    setPrazo(novo);
    await Promise.all(
      c.tarefasAbertas.slice(1).map((t) =>
        fetch(`/api/admin/tarefas/${t.id}/prazo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prazo: novo }),
        }).catch(() => null),
      ),
    );
  }

  const prontas = faltam === 0;

  return (
    <Pagina>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Trilha
          itens={[
            { rotulo: 'Projetos', href: rotas.projetos() },
            { rotulo: c.handle, href: rotas.projeto(c.projetoId) },
            { rotulo: 'Entregas', href: rotas.entregasDoProjeto(c.projetoId) },
            { rotulo: entregaNome },
          ]}
        />
        <AlternadorClientes entregaId={entregaId} atual={{ projetoId: c.projetoId, handle: c.handle }} clientes={clientes} />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-bold text-[#636369]">
            Entrega{frequencia ? ` ${frequencia.toLowerCase()}` : ''} · pautas de {nomeMes}
          </span>
          <h1 className="text-[30px] font-extrabold leading-tight tracking-[-0.02em]">{entregaNome}</h1>
          <span className="flex flex-wrap gap-1.5">
            {[c.handle, `${total} ${total === 1 ? 'post' : 'posts'} em ${nomeMes}`, criadores.length ? `${criadores.join(' e ')} cria` : null, `depois vai pra ${aprovador} aprovar`]
              .filter(Boolean)
              .map((t) => (
                <span key={t as string} className="inline-flex h-6 items-center rounded-full border border-[#E9E9EB] bg-white px-2.5 text-[12px] font-bold">
                  {t}
                </span>
              ))}
          </span>
        </div>
        {primeira && (
          <span className="flex items-center gap-2 rounded-[11px] border border-[#D6D6D9] bg-white px-3 py-1.5 text-[13px] font-extrabold">
            Mudar prazo
            <MudarPrazo tarefaId={primeira.id} prazo={prazo} hoje={hoje} onMudou={mudouPrazo} />
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {atraso > 0 ? (
          <Kpi rot="Atraso" val={`${atraso} ${atraso === 1 ? 'dia' : 'dias'}`} sub={`venceu ${diaSemana(prazo!)}, ${dm(prazo)}`} st="atr" />
        ) : (
          <Kpi rot="Prazo" val={prazo ? dm(prazo) : '--'} sub={prontas ? 'todas as pautas com tema' : prazo ? `${diaSemana(prazo)} · faltam ${Math.max(0, diasEntre(hoje, prazo))} dias` : 'sem prazo'} st={prontas ? 'ok' : undefined} />
        )}
        <Kpi rot="Pautas criadas" val={`${c.comTema} de ${total}`} sub={faltam ? `faltam ${faltam} ${faltam === 1 ? 'tema' : 'temas'}` : 'todas com tema'} />
        <div className="grid min-w-0 grid-cols-1 items-center gap-3.5 rounded-[18px] px-4 py-3.5 sm:col-span-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]" style={{ background: ST.cheg[0], color: ST.cheg[1] }}>
          <span className="flex flex-col gap-0.5">
            <span className={ROT}>Próxima etapa</span>
            <b className="text-[20px] font-extrabold tracking-[-0.02em]">
              {ap && diasAteAp !== null
                ? diasAteAp > 0
                  ? `Aprovação em ${diasAteAp} ${diasAteAp === 1 ? 'dia' : 'dias'}`
                  : diasAteAp === 0
                    ? 'Aprovação hoje'
                    : `Aprovação atrasada`
                : 'Aprovação da pauta'}
            </b>
            <span className="text-[12px]">
              {ap ? `${aprovador} aprova as pautas ${diasAteAp !== null && diasAteAp < 0 ? 'desde' : 'na'} ${diaSemana(ap)}, ${dm(ap)}` : `${aprovador} aprova as pautas`}
            </span>
          </span>
          {blocos.length > 0 && (
            <span className="flex items-stretch gap-1.5">
              {blocos.map((b, k) => (
                <span
                  key={k}
                  className="flex flex-1 flex-col items-center gap-0.5 rounded-[10px] px-1 py-1.5"
                  style={b.fim ? { background: ST.cheg[1], color: '#FFFFFF' } : b.hoje ? { background: '#FFFFFF', border: `1.5px solid ${ST.cheg[1]}` } : { background: 'rgba(61,52,120,0.08)' }}
                >
                  <span className="text-[10px] font-extrabold">{b.d ? diaSemana(b.d) : ''}</span>
                  <b className="text-[16px] leading-none">{b.d ? b.d.slice(8, 10) : '…'}</b>
                  <span className="text-[9.5px] font-bold">{b.rot || ' '}</span>
                </span>
              ))}
            </span>
          )}
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <b className="text-[16px]">Pautas de {nomeMes}</b>
          <span className="text-[12.5px] text-[#636369]">
            {c.comTema} {c.comTema === 1 ? 'criada' : 'criadas'} · {faltam} sem tema
          </span>
        </div>
        <div className="flex gap-[3px]">
          {c.posts.map((p) => (
            <span key={p.postId} className="h-2.5 flex-1 rounded-[3px]" style={{ background: p.tema ? ST.ok[2] : '#E9E9EB' }} title={`${dm(p.data)} · ${p.tema ? p.titulo : 'sem tema'}`} />
          ))}
        </div>
        <div className="flex flex-wrap gap-3.5 text-[12px] text-[#46464B]">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: ST.ok[2] }} />com tema</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-[#E9E9EB]" />sem tema</span>
          {diasDePost.length > 0 && <span>dias de post: {diasDePost.join(', ').replace(/, ([^,]*)$/, ' e $1')}</span>}
        </div>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <b className="text-[16px]">Calendário de {nomeMes}</b>
              <span className="text-[12.5px] text-[#636369]">cada quadradinho é um dia de post · clica pra escrever o tema</span>
            </div>
          </div>
          <div className="overflow-x-auto min-h-fit">
            <div className="grid min-w-[560px] grid-cols-7 gap-1.5">
              {['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map((s) => (
                <span key={s} className="px-1 text-[11px] font-extrabold text-[#636369]">{s}</span>
              ))}
              {Array.from({ length: offset }).map((_, k) => (
                <div key={`v${k}`} />
              ))}
              {Array.from({ length: diasNoMes }, (_, k) => k + 1).map((d) => {
                const ps = porDia.get(d) ?? [];
                const ativo = ps.length > 0;
                const iso = `${c.mes}-${String(d).padStart(2, '0')}`;
                return (
                  <div
                    key={d}
                    className="flex min-h-[92px] min-w-0 flex-col gap-1.5 rounded-[12px] p-[7px]"
                    style={{ background: ativo ? '#FFFFFF' : '#FAFAFA', border: `1px solid ${ativo ? '#E9E9EB' : '#F4F4F5'}` }}
                  >
                    <span className="text-[12px] font-extrabold" style={{ color: ativo ? '#111113' : '#B4B4B9' }}>{d}</span>
                    {ps.map((p) =>
                      p.tema ? (
                        <LinkPrevia key={p.postId} postId={p.postId} tarefaId={p.tarefaId} className="flex flex-col gap-1 rounded-[9px] bg-[#D8EDCF] px-2 py-[7px] text-[#2E5520] hover:brightness-95">
                          <b className="line-clamp-3 text-[12px] leading-tight">{p.titulo}</b>
                          {p.tipo && <span className="text-[10.5px] font-bold">{p.tipo}</span>}
                        </LinkPrevia>
                      ) : (
                        <Link
                          key={p.postId}
                          href={`${rotas.novaPauta(c.projetoId, iso)}&post=${p.postId}`}
                          className="flex flex-col gap-0.5 rounded-[9px] border-[1.5px] border-dashed border-[#B4B4B9] px-2 py-[7px] text-[#46464B] hover:border-[#111113]"
                        >
                          <b className="text-[12px]">+ Criar pauta</b>
                          <span className="text-[10.5px]">sem tema ainda</span>
                        </Link>
                      ),
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <TituloCard titulo="Resumo" />
            {criadores.length > 0 && (
              <span className="text-[13px]">
                <b>{c.quemCria.join(', ')}</b> <span className="text-[#636369]">· cria as pautas</span>
              </span>
            )}
            <span className="text-[13px]">
              <b>{aprovador}</b> <span className="text-[#636369]">· aprova na próxima etapa</span>
            </span>
            <span className="flex h-2 overflow-hidden rounded-full bg-[#E9E9EB]">
              <span style={{ width: `${total ? Math.round((100 * c.comTema) / total) : 0}%`, background: ST.ok[2] }} />
            </span>
            <span className="text-[12px] text-[#46464B]">{c.comTema} de {total} pautas com tema</span>
            <div className="rounded-[12px] bg-[#F4F4F5] px-3 py-2.5 text-[13px] leading-[1.45]">
              <b>Próximo passo:</b>{' '}
              {prontas
                ? `mandar as ${total} pautas pra ${aprovador} aprovar.`
                : `${criadores[0] ?? 'a equipe'} escreve ${faltam === 1 ? 'o tema que falta' : `os ${faltam} temas que faltam`}.${atraso > 0 ? ` Venceu ${diaSemana(prazo!)}, ${dm(prazo)}.` : ''}`}
            </div>
            <button
              type="button"
              disabled
              title={prontas ? 'O envio da pauta pro cliente ainda não está no portal' : `Libera quando as ${total} pautas tiverem tema`}
              className="btn-enviar w-fit rounded-[11px] px-3.5 py-2 text-[13px] font-extrabold text-white disabled:cursor-not-allowed"
              style={{ background: ST.ok[2], opacity: 0.45 }}
            >
              Mandar pra {aprovador} aprovar
            </button>
            <span className="text-[11.5px] text-[#636369]">
              {prontas ? 'O envio da pauta pelo portal ainda vai entrar. Por enquanto, a aprovação segue pela entrega de Aprovação | Pauta.' : `O botão verde libera quando as ${total} pautas tiverem tema.`}
            </span>
          </Card>

          <Card>
            <TituloCard titulo="Tipos de post no mês" />
            {listaTipos.map(([t, n]) => (
              <span key={t} className={`flex justify-between text-[13px] ${t === 'Sem tema ainda' ? 'text-[#636369]' : ''}`}>
                <span>{t}</span>
                <b>{n}</b>
              </span>
            ))}
            <span className="text-[11.5px] text-[#636369]">Ajuda a ver se o mês está equilibrado antes de mandar pro cliente.</span>
          </Card>

          {hist.length > 0 && (
            <Card>
              <TituloCard titulo="Histórico" acao={<span className="text-[12px] text-[#636369]">mais recente primeiro</span>} />
              {hist.map((h, k) => (
                <span key={k} className="flex gap-2 text-[13px]">
                  <span className="mt-[5px] h-2 w-2 shrink-0 rounded-full" style={{ background: ST[h.st][2] }} />
                  <span>
                    {h.st === 'atr' ? <b style={{ color: ST.atr[2] }}>{h.txt}</b> : h.txt}
                    <br />
                    <span className="text-[12px] text-[#636369]">{h.quando}</span>
                  </span>
                </span>
              ))}
            </Card>
          )}

          <Card>
            <TituloCard titulo="Nota interna" acao={<span className="text-[12px] text-[#636369]">só a equipe vê</span>} />
            <textarea
              aria-label="Nota interna"
              rows={3}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              onBlur={salvarNota}
              placeholder="Escreva uma nota pra equipe…"
              className="w-full rounded-[12px] border border-[#D6D6D9] p-3 text-[13.5px]"
            />
            <span className="text-[11.5px]" style={{ color: erroNota ? ST.atr[2] : '#8A8A90' }}>
              {erroNota ? 'Não consegui salvar. Tente de novo.' : salvando ? 'Salvando…' : nota !== (notaSalva?.texto ?? '') ? 'Salva quando você clicar fora.' : ''}
            </span>
          </Card>
        </div>
      </div>
    </Pagina>
  );
}

