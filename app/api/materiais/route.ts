import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getNomeDoCliente } from '@/lib/notion';
import { ensureMateriaisFolder, uploadFile } from '@/lib/drive';
import { sendAvisoMateriais } from '@/lib/mail';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Envio livre de materiais pelo cliente (fora de uma tarefa específica).
 * Sobe os arquivos pra uma pasta do cliente no Drive e avisa a equipe.
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
    }

    const form = await req.formData();
    const nota = (form.get('nota') as string | null)?.trim() ?? '';
    const arquivos = form
      .getAll('arquivos')
      .filter((f): f is File => f instanceof File && f.size > 0);

    if (arquivos.length === 0) {
      return NextResponse.json(
        { error: 'Anexe pelo menos um arquivo.' },
        { status: 400 },
      );
    }

    const nomeCliente = (await getNomeDoCliente(session.email)) ?? session.email;
    const folder = await ensureMateriaisFolder(nomeCliente);

    let total = 0;
    for (const file of arquivos) {
      const buf = Buffer.from(await file.arrayBuffer());
      await uploadFile({
        folderId: folder.folderId,
        name: file.name,
        mimeType: file.type,
        buffer: buf,
      });
      total++;
    }

    // Avisa a equipe — sem derrubar o envio se o e-mail falhar.
    try {
      await sendAvisoMateriais({
        to: env.auth.adminEmails,
        cliente: nomeCliente,
        qtd: total,
        nota,
        driveLink: folder.webViewLink,
      });
    } catch (err: any) {
      console.warn('[materiais] aviso por e-mail falhou:', err?.message);
    }

    return NextResponse.json({ ok: true, qtd: total, driveLink: folder.webViewLink });
  } catch (err: any) {
    console.error('[materiais] erro:', err);
    let msg = err?.message ?? 'Erro inesperado';
    if (err?.body) try { msg = JSON.parse(err.body).message ?? msg; } catch {}
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
