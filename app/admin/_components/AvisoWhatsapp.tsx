'use client';

import { useEffect, useState } from 'react';

/** Faixa vermelha no topo do admin quando o WhatsApp da Lud (Z-API) cai. Confere a cada 5 min. */
export function AvisoWhatsapp() {
  const [caiu, setCaiu] = useState(false);
  useEffect(() => {
    let vivo = true;
    const conferir = () =>
      fetch('/api/admin/zapi-status', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => vivo && setCaiu(j?.conectado === false))
        .catch(() => {});
    conferir();
    const t = setInterval(conferir, 5 * 60_000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, []);
  if (!caiu) return null;
  return (
    <div className="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-[#B42318] px-4 py-2 text-center text-[13px] text-white">
      <b>⚠️ WhatsApp desconectado.</b>
      <span>As mensagens pros clientes ficam presas até reconectar.</span>
      <a href="https://app.z-api.io" target="_blank" rel="noreferrer" className="rounded-full bg-white px-3 py-0.5 text-[12.5px] font-bold text-[#B42318] hover:bg-[#FDECEC]">
        Reconectar no Z-API ↗
      </a>
    </div>
  );
}
