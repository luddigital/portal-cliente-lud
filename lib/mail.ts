import { Resend } from 'resend';
import { env } from './env';

export async function sendMagicLink(to: string, url: string): Promise<void> {
  if (!env.mail.resendKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n========================================');
      console.log('[mail-dev] RESEND_API_KEY vazio — imprimindo magic link no terminal');
      console.log(`[mail-dev] destino: ${to}`);
      console.log(`[mail-dev] link:   ${url}`);
      console.log('========================================\n');
      return;
    }
    throw new Error('RESEND_API_KEY não configurado. Preencha no .env.local antes de enviar emails.');
  }
  const resend = new Resend(env.mail.resendKey);
  await resend.emails.send({
    from: env.mail.from,
    to,
    subject: 'Seu acesso ao Portal da Lud.',
    html: `
      <div style="font-family: Inter, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; color: #151521;">
        <div style="font-size: 22px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 28px;">Lud<span style="color:#8485A3;">.</span></div>
        <h1 style="font-size: 20px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 12px;">Acesso ao portal</h1>
        <p style="font-size: 14px; color: #5C5B72; line-height: 1.55; margin: 0 0 24px;">
          Clique no botão abaixo para entrar. O link expira em 15 minutos.
        </p>
        <a href="${url}" style="display:inline-block; background:#151521; color:white; padding:12px 20px; border-radius:10px; text-decoration:none; font-weight:600; font-size:14px;">
          Entrar no portal
        </a>
        <p style="font-size: 12px; color: #9898AA; margin: 32px 0 0;">Se não foi você, pode ignorar esse email.</p>
      </div>
    `,
  });
}
