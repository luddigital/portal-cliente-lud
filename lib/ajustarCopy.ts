/**
 * Aplica na hora o feedback da Luiza na copy (Esteira Copy, aprovação).
 * Usa as regras das skills de copy da Lud. (copy-guide, transforma-copy,
 * revisao-copy) e devolve só o texto novo: a frase trocada ou o campo inteiro.
 */
import { env } from './env';
import { REGRAS_COPY_LUD } from './regrasCopyLud';
import { textoDoContexto } from './contextoClientes';

/** Mensagem curta quando acaba o saldo da API da Anthropic (Console, não a assinatura do claude.ai). */
export const ERRO_SEM_CREDITO = 'Acabaram os créditos da API do Claude. Recarregue em console.anthropic.com, em Billing.';

type Args = {
  modo: 'frase' | 'geral';
  campo: 'Voice over' | 'Carrossel' | 'Legenda';
  feedback: string;
  textoCampo: string;
  frase?: string | null;
  cliente: string;
  titulo: string;
  ideia: string | null;
  briefing: string | null;
  feedbacksAnteriores: string[];
};

const MODELO_COPY = process.env.ANTHROPIC_COPY_MODEL || 'claude-opus-5-5';

export async function ajustarCopyComFeedback(a: Args): Promise<string> {
  if (!env.anthropic.apiKey) throw new Error('ANTHROPIC_API_KEY não configurada');
  // @ts-ignore — dependência opcional
  const mod = await import('@anthropic-ai/sdk');
  const client = new mod.default({ apiKey: env.anthropic.apiKey });
  // Contexto do cliente (espelho do projeto dele no Claude): briefing, tom de voz, guia de copy, regras.
  const contexto = await textoDoContexto(a.cliente);

  const system = `Você é o copy da Lud., hub de marketing digital. A Luiza revisou a copy de um post e deu um feedback. Aplique o feedback seguindo o MESMO RACIONAL do método criar-copy-completo (abaixo), só que no trecho pedido, sem rodar pesquisa nova:
1. Inteligência: entenda o post pela ideia, pelo briefing e pela copy atual (dor do público, ângulo, fatos já verificados). Não invente fato novo.
2. Direção: mantenha o gancho e a dor do post, a não ser que o feedback peça pra mudar.
3. Construção: escreva com a briefing-copy e o copy-guide, na voz da cliente.
4. Transformação: passe pela transforma-copy (experiencial: eu vivi, te conto, você quer), que é obrigatória.
5. Revisão: confira com o checklist da revisao-copy e a lista de proibidos do copy-guide antes de devolver. Não invente fatos, datas, preços nem experiências que não estejam na copy, na ideia ou no briefing. Sem travessão.

Responda SÓ com o texto novo, sem explicação, sem aspas, sem markdown.
${a.modo === 'frase' ? '- Modo TRECHO: devolva só o texto que vai substituir o trecho marcado (uma frase, uma linha ou um card inteiro). Se o trecho marcado tem várias linhas, devolva o mesmo formato de linhas (num card do carrossel: o texto do card e, no fim, a linha "Foto:" ou "Vídeo:"; a etiqueta "CARD N" não faz parte do trecho). Se o feedback pede pra tirar, apagar ou remover o trecho inteiro, responda exatamente [APAGAR]. Se pede pra tirar só uma parte, devolva o trecho sem essa parte.' : `- Modo GERAL: devolva o campo "${a.campo}" inteiro já ajustado, mantendo a mesma estrutura de linhas (no carrossel, cada card começa com "CARD N"; as indicações "Foto:" ou "Vídeo:" ficam). Ordem de cada card, como na skill briefing-copy: etiqueta "CARD N", depois o texto do card, e só no fim a linha "Foto:" ou "Vídeo:". Se algum card estiver com a indicação de arte antes do texto, corrija a ordem. Mude só o que o feedback pede, a não ser que ele peça pra reescrever tudo.`}

=== REGRAS DE COPY DA LUD. ===
${REGRAS_COPY_LUD}`;

  const user = `Cliente: ${a.cliente}
Post: ${a.titulo}

IDEIA DO POST:
${a.ideia ?? '(não preenchida)'}

BRIEFING PRA EQUIPE:
${a.briefing ?? '(não preenchido)'}

${a.feedbacksAnteriores.length ? `FEEDBACKS ANTERIORES DA LUIZA PRA ESSE CLIENTE (respeite também):\n${a.feedbacksAnteriores.map((f) => `- ${f}`).join('\n')}\n` : ''}
CAMPO "${a.campo}" ATUAL:
${a.textoCampo}

${a.modo === 'frase' ? `TRECHO MARCADO:\n${a.frase}\n\n` : ''}FEEDBACK DA LUIZA:
${a.feedback}`;

  const pedir = (model: string) =>
    client.messages.create({ model, max_tokens: 4000, system: [
        { type: 'text', text: system, cache_control: { type: 'ephemeral' } },
        ...(contexto
          ? [{ type: 'text', text: `=== CONTEXTO DO CLIENTE ${a.cliente} (o mesmo do projeto dele no Claude; vale mais que as regras gerais quando houver conflito) ===\n${contexto}`, cache_control: { type: 'ephemeral' } }]
          : []),
      ] as any, messages: [{ role: 'user', content: user }] });
  // Tenta o modelo de copy e, se falhar, os modelos reserva. Guarda os erros pra mostrar o motivo.
  let res: any;
  const erros: string[] = [];
  for (const m of [...new Set([MODELO_COPY, 'claude-sonnet-5-5', 'claude-sonnet-4-5', env.anthropic.model])]) {
    try {
      res = await pedir(m);
      break;
    } catch (e: any) {
      erros.push(`${m}: ${e?.status ?? ''} ${e?.error?.error?.message ?? e?.message ?? 'erro'}`.trim());
      console.error('[ajustarCopy] falhou com', m, e?.status, e?.message);
      // Sem crédito na API: os modelos reserva também vão falhar, então para aqui.
      if (/credit balance/i.test(erros[erros.length - 1])) throw new Error(ERRO_SEM_CREDITO);
    }
  }
  if (!res) throw new Error('O Claude não respondeu agora.');
  const texto = (res.content ?? [])
    .filter((c: any) => c.type === 'text')
    .map((c: any) => c.text)
    .join('')
    .trim()
    .replace(/^["“]|["”]$/g, '');
  // Pedido de apagar o trecho: devolve vazio (quem chama apaga as linhas no post).
  if (a.modo === 'frase' && /^\[?APAGAR\]?$/i.test(texto)) return '';
  if (!texto) throw new Error('O Claude não devolveu texto.');
  return texto.replace(/—/g, ',');
}
