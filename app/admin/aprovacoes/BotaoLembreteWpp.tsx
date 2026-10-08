'use client';

import { useEffect, useState } from 'react';

type Previa = {
  mensagem: string;
  clienteNome: string;
  apelido: string | null;
  situacao: { codigo: string; rotulo: string };
  grupoNome: string | null;
  grupoId: string | null;
  grupos: { id: string; nome: string; apelido: string | null }[];
  erroGrupo: string | null;
};

function corDaSituacao(codigo: string): { bg: string; fg: string } {
  if (codigo === 'vencido' || codigo === 'data_passou') {
    return { bg: 'var(--prazo-atrasado-soft)', fg: 'var(--prazo-atrasado)' };
  }
  if (codigo === 'vence_hoje' || codigo === 'vence_amanha') {
    return { bg: 'var(--prazo-hoje-soft)', fg: 'var(--prazo-hoje)' };
  }
  return { bg: 'rgba(21,21,33,0.05)', fg: 'var(--t2)' };
}

/**
 * Botão de lembrete de aprovação pelo WhatsApp (Z-API). Abre um popup com a
 * mensagem pronta e editável; só envia quando clicar em "Enviar". Sempre vai
 * pro grupo do cliente, nunca pro privado.
 */
export function BotaoLembreteWpp({
  tarefaId,
  clienteNome,
  rotulo,
  branco = false,
  verde = false,
}: {
  tarefaId: string;
  clienteNome: string;
  /** Texto do botão em versão maior (ex.: "Lembrar cliente: Aprovação | Post"). */
  rotulo?: string;
  /** Botão branco (sobre fundo colorido), sem ícone. A cor do texto vem do pai. */
  branco?: boolean;
  /** Verde do design system: envio de algo pro cliente (ex.: reaprovação). */
  verde?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [enviado, setEnviado] = useState(false);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setAberto(true)}
        title={`Enviar lembrete de aprovação no grupo de ${clienteNome}`}
        className={`inline-flex items-center gap-1.5 rounded-full font-semibold transition ${
          rotulo ? 'px-3.5 py-1.5 text-[12px]' : 'px-2.5 py-1 text-[10.5px]'
        } ${
          branco
            ? 'bg-white px-5 py-2 text-[14px] text-current hover:bg-white/90'
            : enviado
              ? 'bg-[var(--prazo-em-dia-soft)] text-[var(--prazo-em-dia)]'
              : verde
                ? 'bg-[var(--prazo-em-dia)] text-white hover:opacity-90'
                : rotulo
                ? 'bg-ink text-white hover:opacity-90'
                : 'bg-bgSoft text-t2 hover:bg-ink hover:text-white'
        }`}
      >
        {enviado ? '✓ enviado' : branco && rotulo ? rotulo : rotulo ? `📱 ${rotulo}` : '📱 lembrar'}
      </button>
      {aberto && (
        <ModalLembrete
          tarefaId={tarefaId}
          clienteNome={clienteNome}
          fechar={() => setAberto(false)}
          aoEnviar={() => {
            setEnviado(true);
            setAberto(false);
            setTimeout(() => setEnviado(false), 4000);
          }}
        />
      )}
    </div>
  );
}

function ModalLembrete({
  tarefaId,
  clienteNome,
  fechar,
  aoEnviar,
}: {
  tarefaId: string;
  clienteNome: string;
  fechar: () => void;
  aoEnviar: () => void;
}) {
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [texto, setTexto] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [grupoEscolhido, setGrupoEscolhido] = useState<string | null>(null);

  // Recarrega a prévia ao trocar de grupo: o apelido muda junto.
  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    (async () => {
      try {
        const res = await fetch(`/api/admin/wpp-lembrete-aprovacao/${tarefaId}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ apenasPrevia: true, grupoId: grupoEscolhido }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? `Erro ${res.status}`);
        if (cancelado) return;
        setPrevia(j);
        setTexto(j.mensagem);
      } catch (e: any) {
        if (!cancelado) setErro(e?.message ?? 'erro');
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [tarefaId, grupoEscolhido]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !enviando) fechar();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fechar, enviando]);

  async function enviar() {
    if (!texto.trim()) return;
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/admin/wpp-lembrete-aprovacao/${tarefaId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mensagemCustom: texto, grupoId: previa?.grupoId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `Erro ${res.status}`);
      aoEnviar();
    } catch (e: any) {
      setErro(e?.message ?? 'erro');
      setEnviando(false);
    }
  }

  const semGrupo = Boolean(previa?.erroGrupo);
  const editado = previa ? texto !== previa.mensagem : false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
      onClick={() => !enviando && fechar()}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white text-left shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[rgba(21,21,33,0.08)] px-5 py-3">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
              Lembrete de aprovação
            </div>
            <div className="mt-0.5 truncate text-[15px] font-semibold text-ink">
              {previa?.clienteNome ?? clienteNome}
            </div>
          </div>
          <button
            type="button"
            onClick={fechar}
            disabled={enviando}
            aria-label="Fechar"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[18px] text-t3 transition hover:bg-bgSoft hover:text-ink"
          >
            ×
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {carregando ? (
            <div className="h-[220px] animate-pulse rounded-xl bg-bgSoft" />
          ) : (
            <>
              {previa && (
                <div
                  className={`rounded-lg px-3 py-2 text-[12px] ${
                    semGrupo
                      ? 'bg-[var(--prazo-atrasado-soft)] text-[var(--prazo-atrasado)]'
                      : 'bg-bgSoft text-t2'
                  }`}
                >
                  {semGrupo ? (
                    previa.erroGrupo
                  ) : previa.grupos.length > 1 ? (
                    <label className="flex flex-wrap items-center gap-2">
                      Vai pro grupo
                      <select
                        value={previa.grupoId ?? ''}
                        onChange={(e) => setGrupoEscolhido(e.target.value)}
                        disabled={enviando}
                        className="rounded-md border border-[rgba(21,21,33,0.13)] bg-white px-2 py-1 text-[12px] font-semibold text-ink"
                      >
                        {previa.grupos.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.nome}
                            {g.apelido ? ` (${g.apelido})` : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <>
                      Vai pro grupo{' '}
                      <span className="font-semibold text-ink">
                        {previa.grupoNome}
                      </span>
                    </>
                  )}
                </div>
              )}
              {previa && (
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                    style={{
                      background: corDaSituacao(previa.situacao.codigo).bg,
                      color: corDaSituacao(previa.situacao.codigo).fg,
                    }}
                  >
                    {previa.situacao.rotulo}
                  </span>
                  {!previa.apelido && (
                    <span className="text-[11px] text-t3">
                      Sem apelido salvo pra esse grupo.{' '}
                      <a href="/admin/whatsapp" className="underline hover:text-ink">
                        Cadastrar
                      </a>
                    </span>
                  )}
                </div>
              )}
              {previa && (
                <>
                  <textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    rows={14}
                    disabled={enviando}
                    className="w-full resize-y rounded-xl border border-[rgba(21,21,33,0.13)] bg-white p-3 text-[13px] leading-[1.55] text-ink outline-none focus:border-[rgba(21,21,33,0.35)]"
                  />
                  <div className="flex items-center justify-between text-[11px] text-t3">
                    <span>*texto* fica em negrito no WhatsApp</span>
                    {editado && (
                      <button
                        type="button"
                        onClick={() => setTexto(previa.mensagem)}
                        className="underline hover:text-ink"
                      >
                        voltar ao texto padrão
                      </button>
                    )}
                  </div>
                </>
              )}
            </>
          )}
          {erro && (
            <p className="rounded-lg bg-[var(--prazo-atrasado-soft)] px-3 py-2 text-[12px] text-[var(--prazo-atrasado)]">
              {erro}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[rgba(21,21,33,0.08)] px-5 py-3">
          <button
            type="button"
            onClick={fechar}
            disabled={enviando}
            className="rounded-full px-4 py-2 text-[12px] font-semibold text-t2 transition hover:bg-bgSoft hover:text-ink"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={enviar}
            disabled={carregando || enviando || semGrupo || !texto.trim() || !previa}
            className="rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {enviando ? 'Enviando…' : 'Enviar no grupo'}
          </button>
        </div>
      </div>
    </div>
  );
}
