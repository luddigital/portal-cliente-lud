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
  const result = await resend.emails.send({
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
  if (result.error) {
    console.error('[mail] Resend retornou erro:', result.error);
    throw new Error(`Resend: ${result.error.message ?? 'erro desconhecido'}`);
  }
  console.log(`[mail] enviado pra ${to} (id=${result.data?.id})`);
}

/** Avisa a equipe quando um cliente sobe materiais avulsos pelo portal. */
export async function sendAvisoMateriais(opts: {
  to: string | string[];
  cliente: string;
  qtd: number;
  nota: string;
  driveLink: string;
}): Promise<void> {
  if (!env.mail.resendKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[mail-dev] materiais de ${opts.cliente}: ${opts.qtd} arquivo(s) — ${opts.driveLink}`,
      );
      return;
    }
    throw new Error('RESEND_API_KEY não configurado.');
  }
  const resend = new Resend(env.mail.resendKey);
  const notaHtml = opts.nota
    ? `<p style="font-size:14px; color:#5C5B72; line-height:1.55; margin:0 0 16px; border-left:3px solid #BAC4E6; padding-left:14px;">${opts.nota}</p>`
    : '';
  const result = await resend.emails.send({
    from: env.mail.from,
    to: opts.to,
    subject: `${opts.cliente} enviou ${opts.qtd} material${opts.qtd > 1 ? 'is' : ''}`,
    html: `
      <div style="font-family: Inter, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; color: #151521;">
        <div style="font-size: 22px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 28px;">Lud<span style="color:#8485A3;">.</span></div>
        <h1 style="font-size: 20px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 12px;">
          Novo material de ${opts.cliente}
        </h1>
        <p style="font-size: 14px; color: #5C5B72; line-height: 1.55; margin: 0 0 16px;">
          O cliente subiu <b>${opts.qtd}</b> arquivo${opts.qtd > 1 ? 's' : ''} pelo portal.
        </p>
        ${notaHtml}
        <a href="${opts.driveLink}" style="display:inline-block; background:#151521; color:white; padding:12px 20px; border-radius:10px; text-decoration:none; font-weight:600; font-size:14px;">
          Ver no Drive →
        </a>
      </div>
    `,
  });
  if (result.error) {
    console.error('[mail-materiais] Resend erro:', result.error);
    throw new Error(`Resend: ${result.error.message ?? 'erro desconhecido'}`);
  }
  console.log(`[mail-materiais] enviado (cliente=${opts.cliente}, id=${result.data?.id})`);
}

type AvisoCategoria = {
  label: string;
  count: number;
};

export async function sendAvisoTarefas(opts: {
  to: string;
  nome: string;
  categorias: AvisoCategoria[];
  portalUrl: string;
}): Promise<void> {
  if (!env.mail.resendKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[mail-dev] aviso pra ${opts.to}: ${opts.categorias.map((c) => `${c.count} ${c.label}`).join(', ')}`);
      console.log(`[mail-dev] link: ${opts.portalUrl}`);
      return;
    }
    throw new Error('RESEND_API_KEY não configurado.');
  }

  const total = opts.categorias.reduce((s, c) => s + c.count, 0);
  const subject =
    total === 1
      ? `${opts.nome}, você tem 1 tarefa esperando no portal`
      : `${opts.nome}, você tem ${total} tarefas esperando no portal`;

  const itensHtml = opts.categorias
    .map(
      (c) =>
        `<li style="padding:6px 0; font-size:14px; color:#151521;"><b>${c.count}</b> ${c.label}</li>`,
    )
    .join('');

  const resend = new Resend(env.mail.resendKey);
  const result = await resend.emails.send({
    from: env.mail.from,
    to: opts.to,
    subject,
    html: `
      <div style="font-family: Inter, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; color: #151521;">
        <div style="font-size: 22px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 28px;">Lud<span style="color:#8485A3;">.</span></div>
        <h1 style="font-size: 20px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 12px;">
          Oi ${opts.nome}!
        </h1>
        <p style="font-size: 14px; color: #5C5B72; line-height: 1.55; margin: 0 0 16px;">
          Tem coisinha esperando você no portal da Lud:
        </p>
        <ul style="margin: 0 0 24px; padding: 0; list-style: none; border-left: 3px solid #BAC4E6; padding-left: 14px;">
          ${itensHtml}
        </ul>
        <a href="${opts.portalUrl}" style="display:inline-block; background:#151521; color:white; padding:12px 20px; border-radius:10px; text-decoration:none; font-weight:600; font-size:14px;">
          Entrar no portal →
        </a>
        <p style="font-size: 12px; color: #9898AA; margin: 32px 0 0;">
          Se já cuidou disso, é só ignorar esse email.
        </p>
      </div>
    `,
  });
  if (result.error) {
    console.error('[mail-aviso] Resend erro:', result.error);
    throw new Error(`Resend: ${result.error.message ?? 'erro desconhecido'}`);
  }
  console.log(`[mail-aviso] enviado pra ${opts.to} (id=${result.data?.id}, total=${total})`);
}
