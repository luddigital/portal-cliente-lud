/**
 * Lud. Digital — cliente Claude (Anthropic)
 *
 * Gera RASCUNHOS de resposta pro atendimento no WhatsApp. O texto nunca é
 * enviado automaticamente: ele vira uma sugestão que o time aprova no chat.
 *
 * Lazy import do SDK (igual ao supabase.ts) pra não quebrar o build quando
 * a env ainda não está configurada — o portal funciona sem a Claude.
 */
import { env } from './env';
import type { WhatsappMensagem } from './supabase';

const SYSTEM_PROMPT = `Você é o assistente de atendimento da Lud. Digital, um hub de marketing digital.
Você está dentro do grupo de WhatsApp de um cliente, conversando em nome da Lud.

Tom de voz da Lud.: acolhedor, próximo, profissional e direto. Português do Brasil.
Nada de formalidade engessada nem de excesso de emoji. Soa como uma pessoa do time
respondendo com atenção, não como um robô.

Regras:
- Escreva a PRÓXIMA mensagem da Lud. respondendo à última fala do cliente.
- Seja objetivo: WhatsApp pede mensagens curtas e claras.
- NUNCA invente prazos, valores, datas, números ou promessas. Se a resposta depende
  de uma informação que você não tem, escreva uma resposta que acolhe o cliente e
  diz que o time vai confirmar/retornar — sem chutar.
- Não se apresente de novo a cada mensagem; é uma conversa em andamento.
- Responda APENAS com o texto da mensagem, pronto pra enviar. Sem aspas, sem
  rótulos, sem explicação do que você fez.`;

/**
 * Gera um rascunho de resposta a partir do histórico recente do grupo.
 * `mensagens` deve vir em ordem cronológica (mais antiga → mais nova).
 */
export async function gerarSugestaoResposta(params: {
  grupoNome: string;
  mensagens: WhatsappMensagem[];
}): Promise<string> {
  if (!env.anthropic.apiKey) {
    throw new Error('ANTHROPIC_API_KEY não configurada');
  }

  // @ts-ignore — dependência opcional, instalada via `npm i @anthropic-ai/sdk`
  const mod = await import('@anthropic-ai/sdk');
  const Anthropic = mod.default;
  const client = new Anthropic({ apiKey: env.anthropic.apiKey });

  const transcript = params.mensagens
    .map((m) => {
      const ehLud = m.enviado_via_portal || m.remetente_nome === 'Lud.';
      const autor = ehLud
        ? 'Lud.'
        : m.remetente_nome || m.remetente_numero || 'Cliente';
      const corpo =
        m.conteudo?.trim() || (m.tipo === 'texto' ? '' : `[${m.tipo}]`);
      return corpo ? `${autor}: ${corpo}` : '';
    })
    .filter(Boolean)
    .join('\n');

  const resp = await client.messages.create({
    model: env.anthropic.model,
    max_tokens: 700,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Conversa recente no grupo "${params.grupoNome}" (WhatsApp):\n\n${transcript}\n\nEscreva a próxima resposta da Lud. para a última mensagem do cliente.`,
      },
    ],
  });

  const bloco = resp.content.find((b: any) => b.type === 'text') as
    | { type: 'text'; text: string }
    | undefined;
  return (bloco?.text ?? '').trim();
}
