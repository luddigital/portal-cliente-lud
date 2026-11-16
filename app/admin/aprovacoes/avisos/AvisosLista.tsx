'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { GrupoDeAviso, MotivoParado, PlanoDeAvisos, TipoAviso } from '@/lib/aviso-aprovacao';
import { LinkPrevia } from '../../_components/LinkPrevia';

const TIPO: Record<TipoAviso, { rotulo: string; bg: string; tx: string; quando: string }> = {
  post: { rotulo: 'Primeiro envio', bg: '#E8E4FA', tx: '#3E2F8F', quando: 'ainda não mandamos nada sobre esse post' },
  reaprovacao: { rotulo: 'Reaprovação', bg: '#E8E4FA', tx: '#3E2F8F', quando: 'post voltou da alteração e ninguém avisou' },
  auto_hoje: { rotulo: 'Reforço de hoje', bg: '#F8DCEA', tx: '#7A1F4C', quando: 'mandamos hoje, há 5 horas ou mais' },
  auto_ontem: { rotulo: 'Lembrete de ontem', bg: '#FBEFD9', tx: '#8A5A1F', quando: 'mandamos ontem e o cliente não aprovou' },
};

const MOTIVO: Record<MotivoParado, string> = {
  limite: 'Já foram 2 avisos automáticos sem resposta',
  antigo: 'Última mensagem foi anteontem ou antes',
  sem_grupo: 'Projeto sem grupo do WhatsApp vinculado',
};

const hora = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

const SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const dia = (d: string) => `${SEM[new Date(`${d}T12:00:00Z`).getUTCDay()]} ${d.slice(8, 10)}/${d.slice(5, 7)}`;

function Texto({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/(\*[^*\n]+\*)/g).map((p, i) => (/^\*[^*\n]+\*$/.test(p) ? <strong key={i}>{p.slice(1, -1)}</strong> : <span key={i}>{p}</span>))}
    </>
  );
}

function CardAviso({ g, aoEnviar }: { g: GrupoDeAviso; aoEnviar: () => void }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(g.mensagem);
  const [estado, setEstado] = useState<'pronto' | 'enviando' | 'enviado' | 'erro'>('pronto');
  const [erro, setErro] = useState('');
  const t = TIPO[g.tipo];

  async function enviar() {
    setEstado('enviando');
    setErro('');
    const r = await fetch('/api/admin/avisos-aprovacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chave: g.chave, mensagem: texto !== g.mensagem ? texto : undefined }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok && j.ok !== false) {
      setEstado('enviado');
      aoEnviar();
    } else {
      setEstado('erro');
      setErro(j.error || j.resultados?.[0]?.erro || 'Não foi possível enviar.');
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-[18px] border border-[#E9E9EB] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <b className="text-[16px]">{g.projetoNome}</b>
          <span className="rounded-full px-2.5 py-0.5 text-[11.5px] font-extrabold" style={{ background: t.bg, color: t.tx }}>
            {t.rotulo}
          </span>
          <span className="text-[12px] text-[#636369]">grupo {g.grupoNome}</span>
        </span>
        <span className="text-[12px] text-[#636369]">{t.quando}</span>
      </div>
      <div className="flex flex-col divide-y divide-[#F4F4F5] rounded-[12px] border border-[#F0F0F2]">
        {g.posts.map((p) => (
          <div key={p.postId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <LinkPrevia postId={p.postId} tarefaId={p.tarefaId} className="!w-auto text-[13.5px] font-bold hover:underline">
              {p.titulo}
            </LinkPrevia>
            <span className="text-[12px] text-[#636369]">
              {p.ultimoEnvio ? `última mensagem ${hora(p.ultimoEnvio)}` : 'nenhuma mensagem ainda'}
              {p.prazo ? ` · prazo ${p.prazo.slice(8, 10)}/${p.prazo.slice(5, 7)}` : ''}
            </span>
          </div>
        ))}
      </div>
      {editando ? (
        <textarea
          id={`msg-${g.chave}`}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={12}
          className="w-full rounded-[12px] border border-[#D6D6D9] p-3 text-[13px] leading-relaxed"
        />
      ) : (
        <div className="whitespace-pre-wrap rounded-[12px] bg-[#F4F4F5] p-3 text-[13px] leading-relaxed text-[#2A2A2E]">
          <Texto texto={texto} />
        </div>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {estado === 'erro' && <span className="mr-auto text-[12.5px] font-bold text-[#B42318]">{erro}</span>}
        {estado === 'enviado' ? (
          <span className="text-[13px] font-bold text-[#2E5520]">✓ Enviado no grupo</span>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setEditando((v) => !v)}
              disabled={estado === 'enviando'}
              className="inline-flex h-9 items-center rounded-[10px] border border-[#D6D6D9] bg-white px-3 text-[13px] font-extrabold hover:bg-[#F4F4F5]"
            >
              {editando ? 'Ver prévia' : 'Editar texto'}
            </button>
            <button type="button" onClick={enviar} disabled={estado === 'enviando'} className="btn-enviar inline-flex h-9 items-center px-4 text-[13px] font-extrabold">
              {estado === 'enviando' ? 'Enviando…' : 'Enviar no grupo'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function AvisosLista({ plano, linkMensagens }: { plano: PlanoDeAvisos; linkMensagens: string }) {
  const router = useRouter();
  const [enviados, setEnviados] = useState<Set<string>>(new Set());
  const [todos, setTodos] = useState<'pronto' | 'enviando' | 'feito' | 'erro'>('pronto');
  const [erroTodos, setErroTodos] = useState('');
  const pendentes = plano.enviar.filter((g) => !enviados.has(g.chave));

  async function enviarTodos() {
    setTodos('enviando');
    const r = await fetch('/api/admin/avisos-aprovacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ todos: true }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    const falhas = (j.resultados ?? []).filter((x: any) => !x.ok);
    if (r?.ok && falhas.length === 0) {
      setTodos('feito');
      router.refresh();
    } else {
      setTodos('erro');
      setErroTodos(j.error || falhas.map((f: any) => `${f.projeto}: ${f.erro}`).join(' · ') || 'Alguns não foram enviados.');
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-[#E9E9EB] bg-white px-5 py-3.5">
        <span className="text-[13.5px]">
          <b>{pendentes.length}</b> {pendentes.length === 1 ? 'mensagem pronta' : 'mensagens prontas'} ·{' '}
          <b>{plano.antesDaData.length}</b> esperando a quinta · <b>{plano.esperando.length}</b> esperando as 5 horas · <b>{plano.parados.length}</b> pra você decidir
        </span>
        <span className="flex flex-wrap items-center gap-2">
          <Link href={linkMensagens} className="text-[12.5px] font-bold text-[#46464B] underline">
            Editar textos padrão
          </Link>
          {pendentes.length > 1 && todos !== 'feito' && (
            <button type="button" onClick={enviarTodos} disabled={todos === 'enviando'} className="btn-enviar inline-flex h-9 items-center px-4 text-[13px] font-extrabold">
              {todos === 'enviando' ? 'Enviando…' : `Enviar todas (${pendentes.length})`}
            </button>
          )}
        </span>
      </div>
      {todos === 'erro' && <div className="rounded-[12px] bg-[#FBE3E0] px-4 py-2.5 text-[13px] font-bold text-[#7E211C]">{erroTodos}</div>}

      <section className="flex flex-col gap-3">
        <h2 className="text-[17px] font-extrabold">Prontas pra mandar</h2>
        {plano.enviar.length === 0 ? (
          <div className="rounded-[16px] border border-[#E9E9EB] bg-white px-5 py-4 text-[13.5px] text-[#636369]">Nenhum aviso de aprovação pra mandar agora.</div>
        ) : (
          plano.enviar.map((g) => <CardAviso key={g.chave} g={g} aoEnviar={() => setEnviados((s) => new Set(s).add(g.chave))} />)
        )}
      </section>

      {plano.parados.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[17px] font-extrabold">Pra você decidir</h2>
          <p className="-mt-2 text-[13px] text-[#636369]">O portal parou de avisar esses posts. Mande um lembrete pelo post ou fale direto com o cliente.</p>
          <div className="flex flex-col divide-y divide-[#F4F4F5] rounded-[16px] border border-[#E9E9EB] bg-white">
            {plano.parados.map((p) => (
              <div key={p.postId} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <span className="flex min-w-0 flex-col">
                  <LinkPrevia postId={p.postId} tarefaId={p.tarefaId} className="!w-auto text-[14px] font-bold hover:underline">
                    {p.titulo}
                  </LinkPrevia>
                  <span className="text-[12px] text-[#636369]">
                    {p.projetoNome}
                    {p.ultimoEnvio ? ` · última mensagem ${hora(p.ultimoEnvio)}` : ''}
                  </span>
                </span>
                <span className="rounded-full bg-[#FBE3E0] px-2.5 py-0.5 text-[11.5px] font-extrabold text-[#7E211C]">{MOTIVO[p.motivo]}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {plano.antesDaData.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[17px] font-extrabold">Esperando a data de envio</h2>
          <p className="-mt-2 text-[13px] text-[#636369]">Posts novos que ficaram prontos antes da data de envio pra aprovação. Eles só vão pro cliente nessa data.</p>
          <div className="flex flex-col divide-y divide-[#F4F4F5] rounded-[16px] border border-[#E9E9EB] bg-white">
            {plano.antesDaData.map((p) => (
              <div key={p.postId} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <span className="flex min-w-0 flex-col">
                  <LinkPrevia postId={p.postId} tarefaId={p.tarefaId} className="!w-auto text-[14px] font-bold hover:underline">
                    {p.titulo}
                  </LinkPrevia>
                  <span className="text-[12px] text-[#636369]">{p.projetoNome}</span>
                </span>
                <span className="text-[12px] font-bold text-[#3E2F8F]">vai pro cliente em {dia(p.enviaEm)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {plano.esperando.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[17px] font-extrabold">Esperando as 5 horas</h2>
          <div className="flex flex-col divide-y divide-[#F4F4F5] rounded-[16px] border border-[#E9E9EB] bg-white">
            {plano.esperando.map((p) => (
              <div key={p.postId} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <span className="flex min-w-0 flex-col">
                  <LinkPrevia postId={p.postId} tarefaId={p.tarefaId} className="!w-auto text-[14px] font-bold hover:underline">
                    {p.titulo}
                  </LinkPrevia>
                  <span className="text-[12px] text-[#636369]">
                    {p.projetoNome}
                    {p.ultimoEnvio ? ` · mandamos ${hora(p.ultimoEnvio)}` : ''}
                  </span>
                </span>
                <span className="text-[12px] font-bold text-[#46464B]">pode avisar de novo a partir de {hora(p.liberaEm)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
