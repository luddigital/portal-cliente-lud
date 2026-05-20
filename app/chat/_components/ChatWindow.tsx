'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { WhatsappMensagem } from '@/lib/supabase';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';

type Props = {
  grupoId: string;
  mensagensIniciais: WhatsappMensagem[];
  podeResponder: boolean;
  emailLogado: string;
};

export function ChatWindow({
  grupoId,
  mensagensIniciais,
  podeResponder,
  emailLogado,
}: Props) {
  const [mensagens, setMensagens] = useState<WhatsappMensagem[]>(mensagensIniciais);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);

  // Auto-scroll pro fim sempre que chegar mensagem
  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens.length]);

  // Realtime via Supabase: escuta inserts no canal do grupo
  useEffect(() => {
    let cancelado = false;
    let channel: any = null;

    (async () => {
      try {
        // Carrega cliente Supabase só no browser (dinâmico)
        // @ts-ignore — dependência opcional, instalada via `npm i @supabase/supabase-js`
        const { createClient } = await import('@supabase/supabase-js');
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !key) return;
        const sb = createClient(url, key, {
          auth: { persistSession: false },
        });
        if (cancelado) return;
        channel = sb
          .channel(`grupo:${grupoId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'whatsapp_mensagens',
              filter: `grupo_id=eq.${grupoId}`,
            },
            (payload: { new: WhatsappMensagem }) => {
              setMensagens((atual) => {
                // evita duplicar (ID já presente)
                if (atual.some((m) => m.id === payload.new.id)) return atual;
                return [...atual, payload.new];
              });
            },
          )
          .subscribe();
      } catch (e) {
        console.warn('[ChatWindow] realtime não disponível', e);
      }
    })();

    return () => {
      cancelado = true;
      if (channel) channel.unsubscribe();
    };
  }, [grupoId]);

  async function handleEnviar(texto: string) {
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    setErro(null);

    // Otimista: já mostra a mensagem na UI
    const otimista: WhatsappMensagem = {
      id: `tmp-${Date.now()}`,
      grupo_id: grupoId,
      remetente_numero: null,
      remetente_nome: 'Lud.',
      conteudo: texto,
      tipo: 'texto',
      midia_url: null,
      midia_mimetype: null,
      enviado_via_portal: true,
      enviado_por_usuario: emailLogado,
      citada_id: null,
      timestamp: new Date().toISOString(),
      criado_em: new Date().toISOString(),
    };
    setMensagens((atual) => [...atual, otimista]);

    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grupoId, texto }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Erro ${res.status}`);
      }
      const json = (await res.json()) as { ok: boolean; id: string };
      // Atualiza o ID otimista pelo real
      setMensagens((atual) =>
        atual.map((m) => (m.id === otimista.id ? { ...m, id: json.id } : m)),
      );
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao enviar');
      // Remove a mensagem otimista
      setMensagens((atual) => atual.filter((m) => m.id !== otimista.id));
    } finally {
      setEnviando(false);
    }
  }

  const agrupadasPorDia = useMemo(() => agruparPorDia(mensagens), [mensagens]);

  return (
    <>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-4 space-y-4">
          {mensagens.length === 0 && (
            <div className="rounded-lg border border-[rgba(21,21,33,0.08)] bg-white px-6 py-10 text-center">
              <div className="text-[14px] text-t2">Sem mensagens ainda</div>
              <div className="mt-1 text-[11px] text-t3">
                As novas conversas vão aparecer aqui em tempo real.
              </div>
            </div>
          )}

          {agrupadasPorDia.map(({ dia, items }) => (
            <div key={dia}>
              <div className="mb-2 flex justify-center">
                <span className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-t3 shadow-sm">
                  {dia}
                </span>
              </div>
              <div className="space-y-1.5">
                {items.map((m) => (
                  <MessageBubble key={m.id} msg={m} />
                ))}
              </div>
            </div>
          ))}

          <div ref={fimRef} />
        </div>
      </main>

      {erro && (
        <div className="border-t border-hubRed/20 bg-hubRed/5 px-4 py-2 text-center text-[11px] text-hubRed">
          {erro}
        </div>
      )}

      {podeResponder ? (
        <MessageInput onEnviar={handleEnviar} enviando={enviando} />
      ) : (
        <div className="border-t border-[rgba(21,21,33,0.08)] bg-white px-4 py-3 text-center text-[12px] text-t3">
          Você tem acesso apenas de leitura nesta conversa.
        </div>
      )}
    </>
  );
}

function agruparPorDia(msgs: WhatsappMensagem[]) {
  const grupos: { dia: string; items: WhatsappMensagem[] }[] = [];
  let diaAtual = '';
  for (const m of msgs) {
    const d = new Date(m.timestamp);
    const dia = formatarDia(d);
    if (dia !== diaAtual) {
      grupos.push({ dia, items: [m] });
      diaAtual = dia;
    } else {
      grupos[grupos.length - 1].items.push(m);
    }
  }
  return grupos;
}

function formatarDia(d: Date): string {
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  const ehHoje =
    d.getDate() === hoje.getDate() &&
    d.getMonth() === hoje.getMonth() &&
    d.getFullYear() === hoje.getFullYear();
  const ehOntem =
    d.getDate() === ontem.getDate() &&
    d.getMonth() === ontem.getMonth() &&
    d.getFullYear() === ontem.getFullYear();
  if (ehHoje) return 'Hoje';
  if (ehOntem) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}
