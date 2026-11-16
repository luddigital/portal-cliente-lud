'use client';

/**
 * Lateral da página do projeto: o grupo do WhatsApp do cliente (últimas
 * mensagens, atalhos de lembrete e caixa pra escrever). Tudo vai SÓ pro
 * grupo do cliente, nunca pro privado: os atalhos abrem o popup de
 * mensagem (revisado antes de enviar) e a caixa usa a mesma rota
 * /api/admin/projetos/[id]/mensagem-cliente, que sempre manda pro grupo.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ModalMensagem, type GrupoWpp, type ItemPendenciaUi } from './PendenciasCliente';
import { ST, Tag, Vazio } from '../../_ui/lud';

export type MsgLateral = { id: string; autor: string; texto: string; quando: string; daLud: boolean };

export function LateralWhatsapp({
  projetoId,
  clienteNome,
  gruposWpp,
  mensagens,
  itensCliente,
  textos,
  hojeIso,
}: {
  projetoId: string;
  clienteNome: string;
  gruposWpp: GrupoWpp[];
  mensagens: MsgLateral[];
  itensCliente: ItemPendenciaUi[];
  textos: Record<string, string>;
  hojeIso: string;
}) {
  const router = useRouter();
  const grupo = gruposWpp[0] ?? null;
  const [modal, setModal] = useState<{ titulo: string; itens: ItemPendenciaUi[] } | null>(null);
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'ok' | 'erro'>('idle');
  const [erro, setErro] = useState<string | null>(null);

  const aprov = itensCliente.filter((i) => i.grupo === 'post' || i.grupo === 'pauta');
  const mats = itensCliente.filter((i) => i.grupo === 'materiais' || i.grupo === 'previas' || i.grupo === 'stories');

  async function enviar() {
    if (!grupo || !texto.trim()) return;
    if (!confirm(`Enviar essa mensagem no grupo "${grupo.apelido || grupo.nome}"?`)) return;
    setEstado('enviando');
    setErro(null);
    try {
      const r = await fetch(`/api/admin/projetos/${projetoId}/mensagem-cliente`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mensagem: texto.trim(), grupoId: grupo.id }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? 'Não consegui enviar.');
      setTexto('');
      setEstado('ok');
      router.refresh();
      setTimeout(() => setEstado('idle'), 4000);
    } catch (e: any) {
      setErro(e?.message ?? 'Não consegui enviar.');
      setEstado('erro');
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-[#E9E9EB] bg-white p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[15px]" style={{ background: ST.ok[2], color: '#fff' }}>💬</span>
        <div className="flex min-w-0 flex-1 flex-col">
          <b className="truncate text-[14.5px] font-bold">{grupo ? grupo.apelido || grupo.nome : 'Sem grupo vinculado'}</b>
          <span className="text-[12px] text-[#636369]">grupo do WhatsApp</span>
        </div>
        <Link href="/admin/whatsapp" className="shrink-0 text-[12px] font-extrabold hover:underline">Abrir →</Link>
      </div>

      {!grupo ? (
        <Vazio>
          Esse projeto não tem grupo do WhatsApp vinculado. Vincule em <Link href="/admin/whatsapp" className="font-bold underline">WhatsApp</Link>.
        </Vazio>
      ) : (
        <>
          {mensagens.length === 0 ? (
            <span className="text-[12.5px] text-[#636369]">Nenhuma mensagem recente salva no portal.</span>
          ) : (
            <div className="flex flex-col gap-2">
              {mensagens.map((m) => (
                <div
                  key={m.id}
                  className={`flex max-w-[92%] flex-col gap-0.5 rounded-[14px] px-3 py-2 ${m.daLud ? 'self-end' : 'self-start bg-[#F4F4F5]'}`}
                  style={m.daLud ? { background: ST.ok[0], color: ST.ok[1] } : undefined}
                >
                  <span className="line-clamp-4 whitespace-pre-line text-[13px] leading-[1.45]">{m.texto}</span>
                  <span className="text-[10.5px] opacity-80">
                    {m.autor} · {m.quando}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            <button type="button" disabled={aprov.length === 0} onClick={() => setModal({ titulo: 'Lembrar aprovação', itens: aprov })} className="rounded-full border border-[#E9E9EB] px-3 py-1.5 text-[12px] font-bold hover:border-[#B4B4B9] disabled:opacity-40">
              Lembrar aprovação{aprov.length ? ` · ${aprov.length}` : ''}
            </button>
            <button type="button" disabled={mats.length === 0} onClick={() => setModal({ titulo: 'Pedir materiais', itens: mats })} className="rounded-full border border-[#E9E9EB] px-3 py-1.5 text-[12px] font-bold hover:border-[#B4B4B9] disabled:opacity-40">
              Pedir materiais{mats.length ? ` · ${mats.length}` : ''}
            </button>
            <Link href="/admin/reunioes" className="rounded-full border border-[#E9E9EB] px-3 py-1.5 text-[12px] font-bold hover:border-[#B4B4B9]">
              Marcar reunião
            </Link>
          </div>

          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            placeholder="Escreva pro grupo…"
            className="w-full resize-y rounded-[12px] border border-[#D6D6D9] px-3 py-2.5 text-[13px] outline-none focus:border-[#111113]"
          />
          {erro && <span className="text-[12px] font-bold text-[#B42318]">{erro}</span>}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11.5px] text-[#636369]">{estado === 'ok' ? '✓ Enviado no grupo' : 'só vai pro grupo do cliente'}</span>
            <button
              type="button"
              onClick={enviar}
              disabled={!texto.trim() || estado === 'enviando'}
              className="rounded-[11px] border border-[#2E7D4F] bg-[#2E7D4F] px-3.5 py-2 text-[12.5px] font-extrabold text-white hover:bg-[#256641] disabled:opacity-40"
            >
              {estado === 'enviando' ? 'Enviando…' : 'Enviar no grupo'}
            </button>
          </div>
        </>
      )}

      {modal && (
        <ModalMensagem
          projetoId={projetoId}
          clienteNome={clienteNome}
          gruposWpp={gruposWpp}
          titulo={modal.titulo}
          itens={modal.itens}
          textos={textos}
          hojeIso={hojeIso}
          fechar={() => setModal(null)}
          aoEnviar={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

/** Comentários internos ainda não têm onde ser salvos: estado vazio honesto. */
export function ComentariosInternos() {
  return (
    <section className="flex flex-col gap-2.5 rounded-[20px] border border-[#E9E9EB] bg-white p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <b className="text-[16px] font-bold">Comentários internos</b>
          <span className="text-[12.5px] text-[#636369]">só a equipe vê</span>
        </div>
        <Tag st="neu">em breve</Tag>
      </div>
      <Vazio>Os comentários do time ainda não têm onde ser salvos no portal.</Vazio>
    </section>
  );
}
