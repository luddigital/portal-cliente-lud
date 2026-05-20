'use client';

import { useEffect, useState } from 'react';

type Estado = 'idle' | 'unsupported' | 'granted' | 'denied' | 'asking' | 'subscribing';

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) out[i] = rawData.charCodeAt(i);
  return out;
}

export function AvisosToggle() {
  const [estado, setEstado] = useState<Estado>('idle');
  const [iosTutorial, setIosTutorial] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setEstado('unsupported');
      return;
    }
    if (Notification.permission === 'granted') {
      // Já permitiu antes — checa se ainda tem subscription ativa
      navigator.serviceWorker.ready.then((reg) =>
        reg.pushManager.getSubscription().then((sub) => {
          setEstado(sub ? 'granted' : 'asking');
        }),
      );
    } else if (Notification.permission === 'denied') {
      setEstado('denied');
    } else {
      setEstado('asking');
    }
  }, []);

  function isIosSafariStandalone() {
    if (typeof window === 'undefined') return { ios: false, standalone: false };
    const ua = window.navigator.userAgent || '';
    const ios = /iPad|iPhone|iPod/.test(ua);
    const standalone =
      (window.navigator as any).standalone === true ||
      window.matchMedia?.('(display-mode: standalone)').matches;
    return { ios, standalone };
  }

  async function ativar() {
    const { ios, standalone } = isIosSafariStandalone();
    if (ios && !standalone) {
      // No iOS, push só funciona se app foi instalado (Add to Home Screen)
      setIosTutorial(true);
      return;
    }
    setEstado('subscribing');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setEstado(perm === 'denied' ? 'denied' : 'asking');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC).buffer as ArrayBuffer,
      });
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) throw new Error('Falhou ao salvar a inscrição');
      setEstado('granted');
    } catch (err) {
      console.error('[avisos] erro:', err);
      setEstado('asking');
    }
  }

  async function desativar() {
    setEstado('subscribing');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setEstado('asking');
    } catch (err) {
      console.error('[avisos] erro:', err);
    }
  }

  if (estado === 'unsupported' || estado === 'idle') return null;

  if (iosTutorial) {
    return (
      <div className="card p-4 bg-bgSoft text-[12.5px] leading-[1.55] text-ink space-y-2">
        <div className="font-semibold">Pra receber avisos no iPhone:</div>
        <ol className="list-decimal pl-5 space-y-1 text-t2">
          <li>Toque no ícone <b>Compartilhar</b> aqui no Safari (quadrado com seta pra cima).</li>
          <li>Escolha <b>"Adicionar à Tela de Início"</b>.</li>
          <li>Abra o Portal pelo ícone que apareceu no celular.</li>
          <li>Volte aqui e ative os avisos.</li>
        </ol>
        <button onClick={() => setIosTutorial(false)} className="text-[11px] text-mauve underline-offset-2 hover:underline">
          ok, fechar
        </button>
      </div>
    );
  }

  if (estado === 'granted') {
    return (
      <div className="card p-4 flex items-center justify-between gap-3 bg-[var(--prazo-em-dia-soft)]">
        <div className="text-[13px] text-[var(--prazo-em-dia)] font-medium">
          ✓ Avisos ativados nesse dispositivo
        </div>
        <button onClick={desativar} className="text-[12px] text-mauve hover:text-ink">
          desativar
        </button>
      </div>
    );
  }

  if (estado === 'denied') {
    return (
      <div className="card p-4 text-[12.5px] text-t2 leading-[1.5]">
        Você bloqueou os avisos no navegador. Pra ativar, vai nas configurações
        do site no seu celular e libera notificações pra esse portal.
      </div>
    );
  }

  // asking | subscribing
  return (
    <div className="card p-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-ink">Receber avisos do portal</div>
        <p className="mt-0.5 text-[11.5px] text-t2 leading-[1.4]">
          Te aviso quando tiver post pra aprovar, material pra enviar, etc.
        </p>
      </div>
      <button
        onClick={ativar}
        disabled={estado === 'subscribing'}
        className="btn-primary shrink-0 text-[12px]"
        style={{ background: 'var(--prazo-hoje)' }}
      >
        {estado === 'subscribing' ? 'Ativando…' : 'Ativar'}
      </button>
    </div>
  );
}
