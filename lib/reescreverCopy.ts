/**
 * Reescreve a copy de um post aplicando feedbacks da Luiza (por card do
 * carrossel + instrução geral). Chama o Claude via Anthropic SDK.
 *
 * O resultado volta nos 3 campos padrão (voice/carrossel/legenda) e é
 * salvo no Notion como bloco "✨ Copy Reescrita — v[N]".
 */
import { env } from './env';
import type { CopyDoPost } from './notion';

type ReescreverArgs = {
  copyAtual: CopyDoPost;
  feedbacksPorCard: Record<string, string>;
  instrucaoGeral: string;
  clienteNome: string;
  postTitulo: string;
};

export async function reescreverCopyComClaude(
  args: ReescreverArgs,
): Promise<CopyDoPost> {
  if (!env.anthropic.apiKey) {
    throw new Error('ANTHROPIC_API_KEY não configurada');
  }

  // @ts-ignore — dependência opcional
  const mod = await import('@anthropic-ai/sdk');
  const Anthropic = mod.default;
  const client = new Anthropic({ apiKey: env.anthropic.apiKey });

  const feedbacksTxt = Object.entries(args.feedbacksPorCard)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .map(([n, t]) => `CARD ${n}: ${t}`)
    .join('\n');

  const system = `Você é o Copy da Lud. Digital — hub de marketing digital PT-BR.
Sua tarefa: REESCREVER a copy de um post do Instagram aplicando os feedbacks
da revisão. Mantém o tom de voz da cliente e as regras da Lud.

Regras inquebráveis:
- SEM travessão (—). Use dois pontos, vírgula, ponto ou quebra de linha.
- SEM "não é sobre X, é sobre Y" (qualquer variação).
- SEM tom de guru ("eu sempre digo", "quando você entende").
- SEM generalizações ("todo mundo", "ninguém", "muita gente", "quase ninguém").
- SEM conector vazio ("ou seja", "e é por isso que").
- Frases curtas, tom casual, primeira pessoa da cliente.
- Preservar a estrutura do carrossel (mesmo número de cards, cada um com sua
  função) a menos que o feedback peça mudar.
- Preservar o CTA e a palavra-chave da DM automation, exceto se o feedback
  pedir mudar.`;

  const user = `Cliente: ${args.clienteNome}
Post: ${args.postTitulo}

--- COPY ATUAL ---

VOICE OVER:
${args.copyAtual.voice ?? '(vazio — não aplica pra esse post)'}

COPY DO CARROSSEL:
${args.copyAtual.carrossel ?? '(vazio — não aplica pra esse post)'}

LEGENDA:
${args.copyAtual.legenda ?? '(vazio — não aplica pra esse post)'}

--- FEEDBACKS DA REVISÃO ---

${feedbacksTxt || '(sem feedback por card)'}

${args.instrucaoGeral ? `INSTRUÇÃO GERAL: ${args.instrucaoGeral}` : ''}

--- SUA TAREFA ---

Reescreva a copy aplicando os feedbacks. Devolva EXATAMENTE nesse formato,
com os 3 headers marcados. Se um campo era vazio na original, mantenha vazio.

## Voice over

[texto do voice over reescrito, ou "(vazio)" se não aplica]

## Copy do Carrossel

CARD 1 (CAPA)

[corpo card 1]

CARD 2

[corpo card 2]

... e assim por diante.

## Legenda

[legenda reescrita]

#hashtags`;

  const res = await client.messages.create({
    model: env.anthropic.model,
    max_tokens: 4096,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const texto =
    res.content
      ?.filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('\n') ?? '';

  return parsearRespostaClaude(texto);
}

/**
 * Produz copy DO ZERO pra um post que ainda não tem copy. Usa o briefing do
 * card (Ideia, Informações, Materiais) e o tom da cliente.
 */
export async function produzirCopyDoZeroComClaude(args: {
  briefing: {
    ideiaPost: string | null;
    informacoes: string | null;
    materiais: string | null;
    briefingLivre: string | null;
  };
  clienteNome: string;
  postTitulo: string;
  formato: 'carrossel' | 'reels' | 'story' | 'desconhecido';
}): Promise<CopyDoPost> {
  if (!env.anthropic.apiKey) {
    throw new Error('ANTHROPIC_API_KEY não configurada');
  }
  // @ts-ignore
  const mod = await import('@anthropic-ai/sdk');
  const Anthropic = mod.default;
  const client = new Anthropic({ apiKey: env.anthropic.apiKey });

  const system = `Você é o Copy da Lud. Digital — hub de marketing digital PT-BR.
PRODUZA a copy completa (não reescreva — está sendo criada do zero) pra um
post do Instagram. Use o briefing do card + tom da cliente pra produzir com
substância real, sem clichê genérico de turismo.

Regras inquebráveis:
- SEM travessão (—). Use dois pontos, vírgula, ponto ou quebra de linha.
- SEM "não é sobre X, é sobre Y" (qualquer variação).
- SEM tom de guru ("eu sempre digo", "quando você entende").
- SEM generalizações ("todo mundo", "ninguém", "muita gente", "quase ninguém").
- SEM conector vazio ("ou seja", "e é por isso que").
- Frases curtas, tom casual, primeira pessoa da cliente.
- CTA claro no fim (palavra-chave pra DM se fizer sentido).`;

  const briefingTxt = [
    args.briefing.ideiaPost && `IDEIA DO POST:\n${args.briefing.ideiaPost}`,
    args.briefing.informacoes &&
      `INFORMAÇÕES QUE PRECISAMOS:\n${args.briefing.informacoes}`,
    args.briefing.materiais && `MATERIAIS:\n${args.briefing.materiais}`,
    args.briefing.briefingLivre &&
      `BRIEFING LIVRE:\n${args.briefing.briefingLivre}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const formatoInstrucao =
    args.formato === 'reels'
      ? 'Post é REELS — produza Voice over (roteiro pra gravar) + Legenda. Deixe "Copy do Carrossel" vazio.'
      : args.formato === 'carrossel'
        ? 'Post é CARROSSEL — produza Copy do Carrossel (numerados CARD 1, CARD 2… tipicamente 7-9 cards) + Legenda. Deixe "Voice over" vazio.'
        : args.formato === 'story'
          ? 'Post é STORY — produza Legenda (roteiro dos telas). Deixe "Voice over" e "Copy Carrossel" vazio.'
          : 'Formato incerto — produza Copy do Carrossel + Legenda (versão mais versátil).';

  const user = `Cliente: ${args.clienteNome}
Post: ${args.postTitulo}
Formato: ${args.formato}

${formatoInstrucao}

--- BRIEFING DO CARD (dado real, siga fielmente) ---

${briefingTxt || '(sem briefing detalhado — use bom senso pelo título e cliente)'}

--- FORMATO DE ENTREGA (obrigatório) ---

## Voice over

[roteiro pra gravar OU "(vazio)" se não aplica]

## Copy do Carrossel

CARD 1 (CAPA)

[texto do card 1]

CARD 2

[texto do card 2]

… continue até o CTA. Cada CARD numerado, uma linha em branco entre.

## Legenda

[legenda com quebras naturais]

#hashtag1 #hashtag2 #hashtag3
(5-12 hashtags, mistura amplas + específicas)`;

  const res = await client.messages.create({
    model: env.anthropic.model,
    max_tokens: 4096,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const texto =
    res.content
      ?.filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('\n') ?? '';

  return parsearRespostaClaude(texto);
}

function parsearRespostaClaude(texto: string): CopyDoPost {
  function extrair(header: RegExp): string | null {
    const re = new RegExp(
      `${header.source}[^\\n]*\\n+([\\s\\S]*?)(?=\\n##\\s|$)`,
      'i',
    );
    const m = texto.match(re);
    if (!m) return null;
    const s = m[1].trim();
    if (!s || /^\(?vazio\)?$/i.test(s)) return null;
    return s;
  }
  return {
    voice: extrair(/##\s*voice\s*over/i),
    carrossel: extrair(/##\s*copy\s*(?:do|para)?\s*carrossel/i),
    legenda: extrair(/##\s*legenda/i),
  };
}
