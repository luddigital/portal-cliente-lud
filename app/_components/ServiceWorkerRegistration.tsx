'use client';

import { useEffect } from 'react';

/**
 * Registra o service worker do portal pra suportar push notifications.
 * Roda 1x quando o app monta. Tolerante a erro (browser sem suporte).
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[sw] falhou registrar:', err);
    });
  }, []);
  return null;
}
