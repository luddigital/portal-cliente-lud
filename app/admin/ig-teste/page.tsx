import { IgTesteView } from './IgTesteView';

export const dynamic = 'force-dynamic';

export default function IgTestePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-ink">
        Teste de publicação no Instagram
      </h1>
      <p className="mt-1 text-[14px] text-t2">
        Publica <b>agora</b> uma imagem no Instagram via API. Use pra validar o
        pipeline com a conta <b>@lud.digital</b> antes de ligar o agendamento.
      </p>
      <div className="mt-6">
        <IgTesteView />
      </div>
    </main>
  );
}
