'use client';

import { useState } from 'react';
import type { MaterialBloco } from '@/lib/notion';
import { TarefaForm } from '../../tarefa/[id]/form';
import { AprovacaoSimples } from './AprovacaoSimples';

/**
 * Etapa de aprovação de PAUTA — 3 blocos independentes:
 *
 *  1. 📣 Informações — perguntas da equipe + campo pro cliente responder.
 *     Se não tem perguntas, vira campo livre "algum recado?".
 *  2. 🎬 Materiais — o que a gente precisa + upload/áudio/link.
 *     Se não tem lista de materiais, vira card opcional "quer adiantar algo?".
 *  3. ✅ Aprovar — botões Aprovar / Pedir alteração. O texto do bloco 1
 *     vai como comentário dessa ação.
 */
export function EtapaPautaCards({
  tarefaId,
  tarefaTitulo,
  voltarPara,
  aprovacaoColaborativa,
  informacoesNecessarias,
  materiaisNecessarios,
}: {
  tarefaId: string;
  tarefaTitulo: string;
  voltarPara: string;
  aprovacaoColaborativa: boolean;
  informacoesNecessarias: MaterialBloco[] | null;
  materiaisNecessarios: MaterialBloco[] | null;
}) {
  const [respostaInfo, setRespostaInfo] = useState('');

  const perguntas = (informacoesNecessarias ?? []).filter(
    (m) => m.cabecalho || m.detalhes.length > 0,
  );
  const temPerguntas = perguntas.length > 0;

  const materiaisComDetalhes =
    materiaisNecessarios?.filter((m) => m.detalhes.length > 0) ?? [];
  const materiaisSoTitulo =
    materiaisNecessarios?.filter((m) => m.detalhes.length === 0) ?? [];
  const temListaMateriais =
    materiaisComDetalhes.length > 0 || materiaisSoTitulo.length > 0;

  // Roteiro pro teleprompter (voice over) — descarta bullets/lista de materiais.
  const ehListaDeMateriais = (cab: string) =>
    /materia|fotos|vídeos|videos|kit|equipamento/.test(cab.toLowerCase());
  const ehLinhaDeLista = (linha: string) =>
    /^[→•▸▪►⮕\-–]\s/.test(linha.trim());
  const roteiroVoiceOver = (materiaisNecessarios ?? [])
    .filter((m) => !ehListaDeMateriais(m.cabecalho ?? ''))
    .flatMap((m) => m.detalhes)
    .filter((d) => d.trim() && !ehLinhaDeLista(d))
    .join('\n\n')
    .trim();

  return (
    <div className="space-y-4">
      {/* ============ BLOCO 1: INFORMAÇÕES ============ */}
      <div className="card p-5">
        <div className="mb-3 flex items-start gap-2.5">
          <span className="mt-0.5 text-[18px] leading-none" aria-hidden>📣</span>
          <div>
            <div className="text-[14px] font-semibold text-ink">Informações</div>
            <div className="text-[11px] text-t2">
              {temPerguntas
                ? 'Responde as perguntas abaixo pra a gente montar o post do jeito certo.'
                : 'A gente não pediu nada específico pra esse post — se quiser adicionar algo, escreve aqui (opcional).'}
            </div>
          </div>
        </div>

        {temPerguntas && (
          <div className="mb-4 space-y-3 rounded-xl bg-bgSoft/60 p-4">
            {perguntas.map((m, i) => (
              <div key={i}>
                {m.cabecalho && (
                  <div className="text-[12px] font-semibold text-ink">
                    {m.cabecalho}
                  </div>
                )}
                {m.detalhes.length > 0 && (
                  <div className={`space-y-1 ${m.cabecalho ? 'mt-1' : ''}`}>
                    {m.detalhes.map((d, j) => (
                      <p
                        key={j}
                        className="whitespace-pre-line text-[13px] leading-[1.55] text-t1"
                      >
                        {d}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <label className="label">
          {temPerguntas ? (
            <>
              Suas respostas{' '}
              <span className="font-normal text-[var(--prazo-atrasado)]">
                * obrigatório
              </span>
            </>
          ) : (
            'Alguma info pra gente? (opcional)'
          )}
        </label>
        <textarea
          rows={temPerguntas ? 6 : 3}
          value={respostaInfo}
          onChange={(e) => setRespostaInfo(e.target.value)}
          placeholder={
            temPerguntas
              ? 'Responde aqui as perguntas acima. Vai junto quando você clicar Aprovar embaixo.'
              : 'Se quiser deixar um recado pra equipe…'
          }
          className="input resize-y text-[13px]"
          style={
            temPerguntas && respostaInfo.trim() === ''
              ? { borderColor: 'rgba(199,161,46,0.6)' }
              : undefined
          }
        />
      </div>

      {/* ============ BLOCO 2: MATERIAIS ============ */}
      <div className="card p-5">
        <div className="mb-3 flex items-start gap-2.5">
          <span className="mt-0.5 text-[18px] leading-none" aria-hidden>🎬</span>
          <div>
            <div className="text-[14px] font-semibold text-ink">Materiais</div>
            <div className="text-[11px] text-t2">
              {temListaMateriais || roteiroVoiceOver
                ? 'Você pode adiantar fotos, vídeos, áudios ou link aqui — ou deixar pra próxima etapa.'
                : 'A gente não pediu nada específico. Se tiver algo pra mandar, joga aqui (opcional).'}
            </div>
          </div>
        </div>

        {materiaisSoTitulo.length > 0 && (
          <ul className="mb-4 space-y-1.5 rounded-xl bg-bgSoft/60 p-4">
            {materiaisSoTitulo.map((m, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-[13px] leading-snug text-t1"
              >
                <span className="mt-[7px] inline-block h-1 w-1 shrink-0 rounded-full bg-t3" />
                <span>{m.cabecalho}</span>
              </li>
            ))}
          </ul>
        )}

        {materiaisComDetalhes.length > 0 && !roteiroVoiceOver && (
          <div className="mb-4 space-y-3">
            {materiaisComDetalhes.map((m, i) => (
              <div key={i} className="rounded-xl bg-bgSoft/60 p-4">
                {m.cabecalho && (
                  <div className="text-[12px] font-semibold text-ink">
                    {m.cabecalho}
                  </div>
                )}
                <div className={`space-y-1 ${m.cabecalho ? 'mt-1' : ''}`}>
                  {m.detalhes.map((d, j) => (
                    <p
                      key={j}
                      className="whitespace-pre-line text-[13px] leading-[1.55] text-t1"
                    >
                      {d}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <TarefaForm
          tarefaId={tarefaId}
          voltarPara={voltarPara}
          naoFinalizarTarefa
          mostrarTexto={false}
          aceitarLink
          aceitarComentario={false}
          permitirGravarVoz={!roteiroVoiceOver}
          textoVoiceOver={roteiroVoiceOver || undefined}
          tituloUpload="Fotos, vídeos e áudios"
          ajudaUpload="Sem limite de quantidade — cada arquivo até 450 MB. Áudios também, ou grava uma mensagem de voz."
          textoBotao="📎 Anexar materiais"
        />
      </div>

      {/* ============ BLOCO 3: APROVAR ============ */}
      <div className="card p-5">
        <div className="mb-3 flex items-start gap-2.5">
          <span className="mt-0.5 text-[18px] leading-none" aria-hidden>✅</span>
          <div>
            <div className="text-[14px] font-semibold text-ink">
              Aprovar pauta
            </div>
            <div className="text-[11px] text-t2">
              Quando estiver tranquila(o), aprova pra a gente seguir. Se
              quiser mudar algo, clique em "Pedir alteração" — vai junto com
              suas respostas do bloco 1.
            </div>
          </div>
        </div>
        <AprovacaoSimples
          tarefaId={tarefaId}
          tarefaTitulo={tarefaTitulo}
          voltarPara={voltarPara}
          aprovacaoColaborativa={aprovacaoColaborativa}
          esconderTextarea
          comentarioExterno={respostaInfo}
          semCardWrapper
          respostasObrigatorias={temPerguntas}
          mensagemBloqueio="Suba lá pro bloco 📣 Informações e responde as perguntas — depois volta aqui pra aprovar."
        />
      </div>
    </div>
  );
}
