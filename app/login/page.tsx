'use client';

import { useState } from 'react';

export default function LoginPage({ searchParams }: { searchParams: { err?: string } }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errFromUrl = searchParams.err
    ? searchParams.err === 'expired'
      ? 'Seu link expirou. Pede um novo aqui embaixo.'
      : searchParams.err === 'notfound'
      ? 'Email não encontrado nos nossos clientes.'
      : 'Link inválido.'
    : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/send-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao enviar link');
      setSent(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden flex-1 overflow-hidden bg-ink p-12 md:flex md:flex-col md:justify-between">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 20% 80%, rgba(186,196,230,.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(119,157,191,.1) 0%, transparent 50%)',
          }}
        />
        <div className="relative z-10 text-[22px] font-bold tracking-[-0.02em] text-[#F8F8F8]">
          Lud<span className="font-light opacity-30">.</span>
        </div>
        <div className="relative z-10 flex-1 flex flex-col justify-center">
          <h1 className="text-[clamp(26px,4vw,42px)] font-semibold leading-[1.15] tracking-[-0.03em] text-[#F8F8F8]">
            Sua <span className="text-lavender">central de conteúdos</span>.
          </h1>
          <p className="mt-4 max-w-[320px] text-[14px] leading-[1.7] text-[rgba(248,248,248,0.38)]">
            Visualize. Envie. Aprove. Acompanhe. Seu projeto com a Lud., tudo num lugar só.
          </p>
        </div>
        <div className="relative z-10 font-mono text-[11px] text-[rgba(248,248,248,0.18)]">
          portal.cliente / v0.1
        </div>
      </div>

      <div className="relative flex w-full flex-col items-center justify-center bg-cream p-10 md:w-[480px]">
        <div
          className="absolute left-0 right-0 top-0 h-[3px]"
          style={{ background: 'linear-gradient(90deg, #BAC4E6, #B8D2EA, #779DBF)' }}
        />
        <div className="w-full max-w-[360px]">
          <h2 className="text-[23px] font-semibold tracking-[-0.02em] text-ink">Entrar</h2>
          <p className="mt-1 text-[13px] text-mauve">Use o email cadastrado com a Lud.</p>

          {sent ? (
            <div className="mt-8 rounded-xl bg-white p-6 text-center">
              <div className="text-[14px] font-semibold text-ink">Link enviado ✨</div>
              <p className="mt-2 text-[12px] text-mauve">
                Confira sua caixa de entrada. O link expira em 15 minutos.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-7">
              <label className="label">Email</label>
              <input
                type="email"
                required
                placeholder="voce@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
              />
              {(error || errFromUrl) && (
                <p className="mt-2 text-[11px] font-medium text-crimson">{error || errFromUrl}</p>
              )}
              <button type="submit" disabled={loading} className="btn-primary mt-4 w-full justify-center">
                {loading ? 'Enviando…' : 'Receber link de acesso'}
              </button>
            </form>
          )}
          <p className="mt-6 text-center text-[12px] text-[#ABABAB]">
            Problemas? <a className="font-medium text-navy" href="mailto:oi@lud.digital">oi@lud.digital</a>
          </p>
        </div>
      </div>
    </div>
  );
}
