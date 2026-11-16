/**
 * fetch usado pelos clientes do Notion. O Notion aceita poucas requisições por
 * segundo por integração e devolve 429 (rate limited) quando passa disso.
 * Aqui:
 *  - no máximo MAX_SIMULTANEAS (6) requisições ao mesmo tempo por instância;
 *  - 429 e 5xx tentam de novo, esperando o Retry-After que o Notion manda
 *    (ou um intervalo crescente), antes de o erro chegar na tela.
 */
const MAX_SIMULTANEAS = 6;
const TENTATIVAS = 5;

let emAndamento = 0;
const fila: Array<() => void> = [];

async function vaga(): Promise<void> {
  if (emAndamento < MAX_SIMULTANEAS) {
    emAndamento++;
    return;
  }
  await new Promise<void>((ok) => fila.push(ok));
  emAndamento++;
}

function liberar() {
  emAndamento--;
  const proximo = fila.shift();
  if (proximo) proximo();
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const fetchDoNotion: typeof fetch = async (input: any, init?: any) => {
  for (let tentativa = 0; ; tentativa++) {
    await vaga();
    let res: Response;
    try {
      res = await fetch(input, init);
    } catch (e) {
      liberar();
      if (tentativa >= TENTATIVAS - 1) throw e;
      await esperar(500 * (tentativa + 1));
      continue;
    }
    liberar();
    const repetir = res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504;
    if (!repetir || tentativa >= TENTATIVAS - 1) return res;
    const retryAfter = Number(res.headers.get('retry-after'));
    const ms = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 700 * 2 ** tentativa;
    await esperar(Math.min(ms, 8000) + Math.floor(Math.random() * 300));
  }
};
