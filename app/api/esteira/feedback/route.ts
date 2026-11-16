import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { EMAIL_FEEDBACK_COPY } from '@/lib/esteira';
import { ajustarCopyComFeedback } from '@/lib/ajustarCopy';
import { editarCopyNoPost, feedbacksAnterioresDoCliente, invalidarCachesAposMudanca, lerCopyDoPost, lerInfoDoPostEsteira, salvarFeedbackCopy, type CampoCopy } from '@/lib/notion';

export const runtime = 'nodejs';
export const maxDuration = 120;

const ROTULO: Record<CampoCopy, 'Voice over' | 'Carrossel' | 'Legenda'> = { voice: 'Voice over', carrossel: 'Carrossel', legenda: 'Legenda' };


const TIPOS = {
  geral: 'Copy geral',
  post: 'Post inteiro',
  frase: 'Frase',
  'edicao-geral': 'Edição da copy',
  'edicao-frase': 'Edição da frase',
} as const;

/**
 * POST { tipo, campo, postId, titulo, handle, texto?, original?, novo?, skills? }
 * Edições já mudam a copy no Notion. Todo feedback vai pro banco
 * "LudHub — Feedbacks de Copy" (Status Novo), que alimenta a melhoria contínua.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  if (session.email.trim().toLowerCase() !== EMAIL_FEEDBACK_COPY) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }
  const b = (await req.json().catch(() => ({}))) as {
    tipo?: keyof typeof TIPOS;
    campo?: CampoCopy | null;
    postId?: string;
    titulo?: string;
    handle?: string;
    texto?: string;
    original?: string;
    novo?: string;
    skills?: string[];
  };
  if (!b.tipo || !TIPOS[b.tipo] || !b.postId) return NextResponse.json({ error: 'dados faltando' }, { status: 400 });
  const texto = (b.texto ?? '').trim();
  const ehEdicao = b.tipo === 'edicao-geral' || b.tipo === 'edicao-frase';
  if (!ehEdicao && texto.length < 2) return NextResponse.json({ error: 'Escreve o feedback.' }, { status: 400 });
  // Edição de frase pode vir vazia: é apagar a linha.
  if (ehEdicao && (!b.campo || (b.tipo === 'edicao-geral' && !b.novo?.trim()))) return NextResponse.json({ error: 'Faltou o texto novo.' }, { status: 400 });
  try {
    let original = b.original?.trim() || null;
    let novo = b.novo?.trim() || null;
    let aviso: string | null = null;
    if (b.tipo === 'post') {
      // Feedback do post inteiro: ajusta cada campo escrito (voice, carrossel, legenda) na hora.
      try {
        const [copy, info, anteriores] = await Promise.all([
          lerCopyDoPost(b.postId),
          lerInfoDoPostEsteira(b.postId).catch(() => null),
          feedbacksAnterioresDoCliente(b.handle ?? ''),
        ]);
        const campos = (['voice', 'carrossel', 'legenda'] as CampoCopy[]).filter((c) => (copy[c] ?? '').trim());
        if (!campos.length) throw new Error('O post ainda não tem copy escrita.');
        const outros = (c: CampoCopy) =>
          campos.filter((x) => x !== c).map((x) => `${ROTULO[x].toUpperCase()} (só pra contexto, não reescreva):\n${copy[x]}`).join('\n\n');
        const resultados = await Promise.all(
          campos.map(async (c) => {
            const novoCampo = await ajustarCopyComFeedback({
              modo: 'geral',
              campo: ROTULO[c],
              feedback: `${texto}\n\n(Feedback sobre o post inteiro. Aplique neste campo só o que couber nele; se nada do feedback se aplica a este campo, devolva o texto igual.)`,
              textoCampo: copy[c]!,
              frase: null,
              cliente: b.handle ?? '',
              titulo: b.titulo ?? '',
              ideia: info?.ideia ?? null,
              briefing: [info?.briefing, outros(c)].filter(Boolean).join('\n\n'),
              feedbacksAnteriores: anteriores,
            });
            return { c, antes: copy[c]!, depois: novoCampo };
          }),
        );
        const mudou = resultados.filter((r) => r.depois.trim() && r.depois.trim() !== r.antes.trim());
        for (const r of mudou) await editarCopyNoPost(b.postId, r.c, r.antes, r.depois, 'geral');
        original = mudou.map((r) => `${ROTULO[r.c]}:\n${r.antes}`).join('\n\n') || null;
        novo = mudou.map((r) => `${ROTULO[r.c]}:\n${r.depois}`).join('\n\n') || null;
        if (!mudou.length) aviso = 'Feedback registrado. O Claude não viu nada pra mudar na copy com esse feedback.';
      } catch (e: any) {
        console.error('[esteira/feedback]', b.tipo, e?.message);
        aviso = `${e?.message ?? 'Não consegui aplicar o ajuste.'} Seu feedback ficou salvo.`;
      }
    } else if (ehEdicao) {
      await editarCopyNoPost(b.postId, b.campo!, b.original ?? '', b.novo ?? '', b.tipo === 'edicao-frase' ? 'frase' : 'geral');
      if (!novo) novo = '(linha apagada)';
    } else if (b.campo) {
      // Feedback de frase ou da copy geral: o Claude aplica na hora, com as regras da Lud.
      try {
        const [copy, info, anteriores] = await Promise.all([
          lerCopyDoPost(b.postId),
          lerInfoDoPostEsteira(b.postId).catch(() => null),
          feedbacksAnterioresDoCliente(b.handle ?? ''),
        ]);
        const textoCampo = copy[b.campo] ?? '';
        if (!textoCampo) throw new Error('O post não tem esse campo escrito.');
        const modo = b.tipo === 'frase' ? 'frase' : 'geral';
        const resultado = await ajustarCopyComFeedback({
          modo,
          campo: ROTULO[b.campo],
          feedback: texto,
          textoCampo,
          frase: b.original ?? null,
          cliente: b.handle ?? '',
          titulo: b.titulo ?? '',
          ideia: info?.ideia ?? null,
          briefing: info?.briefing ?? null,
          feedbacksAnteriores: anteriores,
        });
        await editarCopyNoPost(b.postId, b.campo, modo === 'frase' ? b.original ?? '' : textoCampo, resultado, modo);
        original = modo === 'frase' ? b.original?.trim() || null : textoCampo;
        novo = resultado || '(trecho apagado)';
      } catch (e: any) {
        console.error('[esteira/feedback]', b.tipo, e?.message);
        aviso = `${e?.message ?? 'Não consegui aplicar o ajuste.'} Seu feedback ficou salvo.`;
      }
    }
    await salvarFeedbackCopy({
      tipo: TIPOS[b.tipo],
      campo: b.campo ?? null,
      texto,
      cliente: b.handle ?? '',
      post: b.titulo ?? '',
      postId: b.postId,
      link: `${env.app.url}/post/${b.postId}`,
      original,
      novo,
      skills: b.skills ?? [],
    });
    invalidarCachesAposMudanca();
    return NextResponse.json({ ok: true, aplicado: !aviso && (ehEdicao || !!novo), novo, aviso });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Não consegui salvar.' }, { status: 500 });
  }
}
