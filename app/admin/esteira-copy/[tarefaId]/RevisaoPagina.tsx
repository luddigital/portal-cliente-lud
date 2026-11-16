'use client';

import { useRouter } from 'next/navigation';
import { Revisao, type CardEsteira, type Contagem } from '../EsteiraNova';

/** Revisão completa: depois de aprovar, vai pro próximo da fila (ou volta pra esteira). */
export function RevisaoPagina({ card, souLuiza, posicao, total, proximoId, anteriorId, contagem }: { card: CardEsteira; souLuiza: boolean; posicao: number | null; total: number; proximoId: string | null; anteriorId: string | null; contagem: Contagem | null }) {
  const router = useRouter();
  return (
    <Revisao
      card={card}
      souLuiza={souLuiza}
      posicao={posicao}
      total={total}
      proximoId={proximoId}
      anteriorId={anteriorId}
      contagem={contagem}
      onFeito={() => setTimeout(() => router.push(proximoId ? `/admin/esteira-copy/${proximoId}` : '/admin/esteira-copy'), 1500)}
    />
  );
}
