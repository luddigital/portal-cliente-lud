import type { WhatsappMensagem } from '@/lib/supabase';

export function MessageBubble({ msg }: { msg: WhatsappMensagem }) {
  const ehDaLud = msg.enviado_via_portal || msg.remetente_numero == null;

  return (
    <div className={`flex ${ehDaLud ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 shadow-sm ${
          ehDaLud ? 'bg-navy text-white' : 'bg-white text-ink'
        }`}
      >
        {!ehDaLud && msg.remetente_nome && (
          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-mauve">
            {msg.remetente_nome}
          </div>
        )}

        {msg.tipo === 'imagem' && msg.midia_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={msg.midia_url}
            alt="imagem"
            className="mb-1 max-h-72 rounded-lg object-cover"
          />
        )}

        {msg.tipo === 'audio' && msg.midia_url && (
          <audio controls src={msg.midia_url} className="w-full" />
        )}

        {msg.tipo === 'video' && msg.midia_url && (
          <video controls src={msg.midia_url} className="mb-1 max-h-72 rounded-lg" />
        )}

        {msg.tipo === 'doc' && msg.midia_url && (
          <a
            href={msg.midia_url}
            target="_blank"
            rel="noreferrer"
            className={`mb-1 block rounded px-2 py-1 text-[12px] underline ${
              ehDaLud ? 'text-white/90' : 'text-mauve'
            }`}
          >
            📎 {msg.conteudo ?? 'documento'}
          </a>
        )}

        {msg.conteudo && msg.tipo !== 'doc' && (
          <div className="whitespace-pre-wrap break-words text-[13px] leading-snug">
            {msg.conteudo}
          </div>
        )}

        <div
          className={`mt-1 flex items-center gap-1 text-[9px] ${
            ehDaLud ? 'text-white/60' : 'text-t3'
          }`}
        >
          <span>
            {new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {msg.enviado_via_portal && msg.enviado_por_usuario && (
            <span className="ml-1 opacity-80">via {msg.enviado_por_usuario}</span>
          )}
        </div>
      </div>
    </div>
  );
}
