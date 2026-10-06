import { Suspense } from 'react';
import { env } from '@/lib/env';
import { montarRegua } from '@/lib/regua';
import { lerMensagensEditadas } from '@/lib/mensagens-padrao';
import { ReguaPainel } from './ReguaPainel';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default function ReguaPage() {
  return (
    <div className="px-6 py-8">
      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="h-[70px] animate-pulse rounded-xl bg-[rgba(55,53,47,0.05)]" />
            <div className="h-[320px] animate-pulse rounded-xl bg-[rgba(55,53,47,0.05)]" />
          </div>
        }
      >
        <Conteudo />
      </Suspense>
    </div>
  );
}

async function Conteudo() {
  const [regua, textos] = await Promise.all([montarRegua(), lerMensagensEditadas()]);
  return <ReguaPainel regua={regua} textos={textos} baseUrl={env.app.url} />;
}
