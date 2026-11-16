'use client';

/**
 * Programar um post (proposta NOVA): arte e legenda no mesmo bloco, com prévia
 * Carrossel / Reels (na aba Reels, a escolha da capa), e os passos na lateral:
 * Quando, Onde aparece, Collab, Plataformas e Pronto pra programar.
 *
 * O que é enviado continua igual ao fluxo antigo (/api/programar/config):
 * data, horário, plataformas, formato e legenda. Capa do Reels e Collab ainda
 * não são enviados pro Instagram (lib/instagramPublish.ts não suporta): a tela
 * mostra isso com clareza.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ProgramacaoConfig } from '@/lib/supabase';
import type { PreviewArquivo } from '@/app/post/[id]/PostPreview';
import { nomeCurtoDoProjeto } from '@/lib/rotas';
import { ST, Tag, dataCurta } from '@/app/admin/_ui/lud';

type Plataforma = { id: string; nome: string; sigla: string; disponivel: boolean };

const PLATAFORMAS: Plataforma[] = [
  { id: 'instagram', nome: 'Instagram', sigla: 'IG', disponivel: true },
  { id: 'facebook', nome: 'Facebook', sigla: 'FB', disponivel: true },
  { id: 'tiktok', nome: 'TikTok', sigla: 'TT', disponivel: false },
  { id: 'youtube', nome: 'YouTube Shorts', sigla: 'YT', disponivel: false },
  { id: 'threads', nome: 'Threads', sigla: 'TH', disponivel: false },
];

const LUGARES: { id: string; nome: string }[] = [
  { id: 'feed', nome: 'Feed' },
  { id: 'stories', nome: 'Stories' },
  { id: 'reels', nome: 'Reels' },
];

const LIMITE_LEGENDA = 2200;

function tituloSeguro(t: string): string {
  const trim = t.trim();
  if (!trim) return 'Sem título';
  if (/^https?:\/\/\S+$/.test(trim)) return 'Sem título';
  return trim;
}

function lugaresIniciais(formato: string, formatoTipo: string): string[] {
  const salvos = formato
    .split(',')
    .map((s) => s.trim())
    .filter((s) => LUGARES.some((l) => l.id === s));
  if (salvos.length) return salvos;
  if (formatoTipo === 'reels') return ['reels'];
  if (formatoTipo === 'story') return ['stories'];
  return ['feed'];
}

const ehImagem = (a: PreviewArquivo) => (a.mimeType ?? '').startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(a.name);
const ehVideo = (a: PreviewArquivo) => (a.mimeType ?? '').startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(a.name);
const src = (a: PreviewArquivo) => `/api/drive/preview/${a.id}`;

// ------------------------------------------------------------- peças visuais
function Passo({ n, st, titulo, sub, children }: { n: number; st: keyof typeof ST; titulo: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-[20px] border border-[#E9E9EB] bg-white p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold" style={{ background: ST[st][0], color: ST[st][1] }}>
          {n}
        </span>
        <span className="flex flex-col">
          <b className="text-[15px] font-bold">{titulo}</b>
          <span className="text-[12px] text-[#636369]">{sub}</span>
        </span>
      </div>
      {children}
    </section>
  );
}

function Chave({ ligado, onClick, disabled, rotulo }: { ligado: boolean; onClick?: () => void; disabled?: boolean; rotulo: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      disabled={disabled}
      onClick={onClick}
      className={`relative h-[24px] w-[42px] shrink-0 rounded-full transition ${ligado ? 'bg-[#2E7D4F]' : 'bg-[#D6D6D9]'} disabled:opacity-40`}
    >
      <span className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all ${ligado ? 'left-[21px]' : 'left-[3px]'}`} />
    </button>
  );
}

function AvisoNaoEnviado({ children }: { children: React.ReactNode }) {
  return <p className="rounded-[10px] bg-[#EFE4D8] px-3 py-2 text-[11.5px] leading-snug text-[#5A4634]">{children}</p>;
}

// ------------------------------------------------------------- prévia carrossel
function PreviaCarrossel({ arquivos, titulo }: { arquivos: PreviewArquivo[]; titulo: string }) {
  const [i, setI] = useState(0);
  const a = arquivos[i];
  if (arquivos.length === 0) {
    return <div className="flex aspect-[4/5] w-full max-w-[420px] items-center justify-center self-center rounded-[18px] bg-[#F4F4F5] text-[13px] text-[#636369]">Nenhuma arte anexada no Drive ainda.</div>;
  }
  return (
    <div className="flex flex-col items-center gap-2.5">
      <div className="relative aspect-[4/5] w-full max-w-[420px] overflow-hidden rounded-[18px] bg-[#EFE4D8]">
        {ehVideo(a) ? (
          <video key={a.id} src={src(a)} controls playsInline preload="metadata" className="absolute inset-0 h-full w-full bg-black object-contain" />
        ) : ehImagem(a) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={a.id} src={src(a)} alt={a.name} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <iframe key={a.id} src={`https://drive.google.com/file/d/${a.id}/preview`} className="absolute inset-0 h-full w-full" />
        )}
        {arquivos.length > 1 && (
          <>
            <span className="absolute right-3 top-3 rounded-full bg-[#111113]/80 px-2 py-0.5 text-[11px] font-extrabold text-white">
              {i + 1} / {arquivos.length}
            </span>
            <button type="button" aria-label="Anterior" disabled={i === 0} onClick={() => setI(i - 1)} className="absolute left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[16px] font-bold shadow disabled:opacity-30">
              ‹
            </button>
            <button type="button" aria-label="Próxima" disabled={i === arquivos.length - 1} onClick={() => setI(i + 1)} className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[16px] font-bold shadow disabled:opacity-30">
              ›
            </button>
          </>
        )}
      </div>
      {arquivos.length > 1 && (
        <div className="flex max-w-full gap-1.5 overflow-x-auto min-h-fit">
          {arquivos.map((x, k) => (
            <button key={x.id} type="button" onClick={() => setI(k)} className={`h-[60px] w-[50px] shrink-0 overflow-hidden rounded-[8px] border-2 bg-[#F4F4F5] ${k === i ? 'border-[#111113]' : 'border-transparent opacity-70 hover:opacity-100'}`}>
              {ehImagem(x) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src(x)} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <span className="text-[14px]">▶</span>
              )}
            </button>
          ))}
        </div>
      )}
      <span className="text-[12px] text-[#636369]">
        {arquivos.length > 1 ? `Carrossel · ${arquivos.length} artes` : '1 arte'} · {tituloSeguro(titulo)}
      </span>
    </div>
  );
}

// ------------------------------------------------------------- prévia reels + capa
async function capturarQuadros(url: string, n: number): Promise<string[]> {
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';
  v.src = url;
  await new Promise<void>((ok, erro) => {
    v.onloadedmetadata = () => ok();
    v.onerror = () => erro(new Error('vídeo não carregou'));
  });
  const dur = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 1;
  const canvas = document.createElement('canvas');
  const w = 216;
  canvas.width = w;
  canvas.height = Math.round((w * (v.videoHeight || 16)) / (v.videoWidth || 9));
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  const out: string[] = [];
  for (let k = 0; k < n; k++) {
    v.currentTime = Math.min(dur - 0.05, (dur * (k + 0.5)) / n);
    await new Promise<void>((ok) => {
      v.onseeked = () => ok();
    });
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    out.push(canvas.toDataURL('image/jpeg', 0.75));
  }
  return out;
}

function PreviaReels({ arquivos }: { arquivos: PreviewArquivo[] }) {
  const video = arquivos.find(ehVideo) ?? null;
  const [quadros, setQuadros] = useState<string[]>([]);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [capa, setCapa] = useState<string | null>(null);
  const [posY, setPosY] = useState(50);
  const [noFeed, setNoFeed] = useState(true);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!video) return;
    let cancelado = false;
    setLendo(true);
    setErro(null);
    capturarQuadros(src(video), 6)
      .then((q) => {
        if (cancelado) return;
        setQuadros(q);
        setCapa((c) => c ?? q[0] ?? null);
      })
      .catch(() => !cancelado && setErro('Não consegui ler os quadros do vídeo. Suba uma imagem pra capa.'))
      .finally(() => !cancelado && setLendo(false));
    return () => {
      cancelado = true;
    };
  }, [video?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function subir(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setCapa(URL.createObjectURL(f));
  }

  if (!video) {
    return <div className="flex aspect-[9/16] w-full max-w-[300px] items-center justify-center self-center rounded-[18px] bg-[#F4F4F5] px-6 text-center text-[13px] text-[#636369]">Esse post não tem vídeo no Drive. A prévia de Reels aparece quando tiver.</div>;
  }
  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[18px] bg-black">
        <video src={src(video)} controls playsInline preload="metadata" className="absolute inset-0 h-full w-full object-contain" />
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <b className="text-[14px]">Capa do Reels</b>
        <span className="text-[12px] text-[#636369]">Escolha um quadro do vídeo ou suba uma imagem.</span>
        <div className="grid grid-cols-6 gap-1.5">
          {lendo && quadros.length === 0
            ? Array.from({ length: 6 }).map((_, k) => <span key={k} className="aspect-[9/16] animate-pulse rounded-[8px] bg-[#F1F1F2]" />)
            : quadros.map((q, k) => (
                <button key={k} type="button" onClick={() => setCapa(q)} className={`aspect-[9/16] overflow-hidden rounded-[8px] border-2 ${capa === q ? 'border-[#111113]' : 'border-transparent'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={q} alt={`Quadro ${k + 1}`} className="h-full w-full object-cover" />
                </button>
              ))}
        </div>
        {erro && <span className="text-[12px] text-[#7E211C]">{erro}</span>}
        <div>
          <input ref={inputRef} type="file" accept="image/*" onChange={subir} className="hidden" />
          <button type="button" onClick={() => inputRef.current?.click()} className="rounded-[11px] border border-[#D6D6D9] bg-white px-3 py-1.5 text-[12.5px] font-extrabold hover:bg-[#F4F4F5]">
            Subir imagem
          </button>
        </div>
        {capa && (
          <div className="flex items-start gap-3">
            <div className="aspect-[4/5] w-[120px] shrink-0 overflow-hidden rounded-[10px] bg-[#F4F4F5]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={capa} alt="Capa no feed" className="h-full w-full object-cover" style={{ objectPosition: `50% ${posY}%` }} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="text-[12px] font-bold">Corte 4:5 no feed</span>
              <input type="range" min={0} max={100} value={posY} onChange={(e) => setPosY(Number(e.target.value))} aria-label="Posição do corte" />
              <label className="flex items-center justify-between gap-2 text-[12.5px]">
                Mostrar no feed
                <Chave ligado={noFeed} onClick={() => setNoFeed(!noFeed)} rotulo="Mostrar no feed" />
              </label>
            </div>
          </div>
        )}
        <AvisoNaoEnviado>Capa, corte e “mostrar no feed” ainda não são enviados pro Instagram. O Reels sobe com a capa padrão; troque a capa no app depois de publicar.</AvisoNaoEnviado>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- página
export function ConfigProgramacao({
  postId,
  titulo,
  dataPostagem,
  projetoNome,
  formatoTipo,
  legendaOriginal,
  arquivos,
  configInicial,
  horarioDefault,
  horarioProjeto,
  igLigado,
  statusGeral,
}: {
  postId: string;
  titulo: string;
  dataPostagem: string;
  projetoNome: string;
  formatoTipo: string;
  legendaOriginal: string;
  arquivos: PreviewArquivo[];
  configInicial: ProgramacaoConfig;
  /** Horário do projeto já com 5 min de antecedência (fallback 09:55). */
  horarioDefault: string;
  /** "Time" do projeto no Notion (HH:MM), quando existe. */
  horarioProjeto: string | null;
  /** O projeto tem conta do Instagram ligada (IG_ACCOUNTS). */
  igLigado: boolean;
  statusGeral: string | null;
}) {
  const router = useRouter();
  const dataCal = (dataPostagem ?? '').slice(0, 10);
  const [data, setData] = useState(configInicial.data || dataCal);
  const [horario, setHorario] = useState(configInicial.horario || horarioDefault);
  const [lugares, setLugares] = useState<string[]>(() => lugaresIniciais(configInicial.formato, formatoTipo));
  const [plataformas, setPlataformas] = useState<string[]>(configInicial.plataformas.length > 0 ? configInicial.plataformas : ['instagram', 'facebook']);
  const [legenda, setLegenda] = useState(configInicial.legenda || legendaOriginal);
  const [aba, setAba] = useState<'carrossel' | 'reels'>(formatoTipo === 'reels' ? 'reels' : 'carrossel');
  const [collab, setCollab] = useState(false);
  const [perfis, setPerfis] = useState<string[]>([]);
  const [novoPerfil, setNovoPerfil] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [loading, setLoading] = useState<'confirmar' | 'postado' | 'rascunho' | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<'confirmar' | 'postado' | 'rascunho' | null>(null);
  const legendaRef = useRef<HTMLTextAreaElement | null>(null);

  const handle = nomeCurtoDoProjeto(projetoNome);
  const hashtags = useMemo(() => Array.from(new Set(legenda.match(/#[\p{L}0-9_]+/gu) ?? [])), [legenda]);
  const temIg = plataformas.includes('instagram');
  const temFb = plataformas.includes('facebook');
  const destino = temFb ? 'Instagram e Facebook' : 'Instagram';

  function togglePlataforma(id: string, disponivel: boolean) {
    if (!disponivel) return;
    setPlataformas((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));
  }
  function toggleLugar(id: string) {
    setLugares((atual) => (atual.includes(id) ? (atual.length > 1 ? atual.filter((x) => x !== id) : atual) : [...atual, id]));
  }
  function addPerfil() {
    const h = novoPerfil.trim().replace(/^@/, '');
    if (!h) return;
    setPerfis((p) => (p.includes(h) ? p : [...p, h]));
    setNovoPerfil('');
  }
  async function copiar() {
    try {
      await navigator.clipboard.writeText(legenda);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      /* sem permissão de área de transferência */
    }
  }

  async function submit(acao: 'confirmar' | 'postado' | 'rascunho') {
    setLoading(acao);
    setErro(null);
    try {
      const r = await fetch('/api/programar/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ postId, data, horario, plataformas, formato: lugares.join(','), legenda, acao }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setFeito(acao);
      setTimeout(() => {
        router.push('/programacao');
        router.refresh();
      }, 1000);
    } catch (e: any) {
      setErro(e?.message ?? 'erro');
    } finally {
      setLoading(null);
    }
  }

  const checklist: { ok: boolean; texto: string }[] = [
    { ok: arquivos.length > 0, texto: arquivos.length > 0 ? `Arte no Drive · ${arquivos.length} arquivo${arquivos.length > 1 ? 's' : ''}` : 'Arte ainda não anexada no Drive' },
    { ok: legenda.trim().length > 0 && legenda.length <= LIMITE_LEGENDA, texto: legenda.trim() ? (legenda.length > LIMITE_LEGENDA ? 'Legenda passou de 2.200 caracteres' : 'Legenda pronta') : 'Legenda vazia' },
    { ok: !!data && !!horario, texto: data && horario ? `${dataCurta(data)} às ${horario}` : 'Falta data ou horário' },
    { ok: !temIg || igLigado, texto: temIg ? (igLigado ? 'Conta do Instagram ligada' : 'Conta do Instagram não ligada (IG_ACCOUNTS)') : 'Sem Instagram nesta programação' },
  ];
  const ocupado = loading !== null || feito !== null;

  return (
    <main className="lud-admin mx-auto flex w-full max-w-[1280px] flex-col gap-[18px] px-4 py-7 sm:px-8">
      <header className="flex flex-col gap-1">
        <Link href="/programacao" className="text-[12.5px] text-[#636369] hover:text-[#111113]">
          ← Programação
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[12.5px] font-bold text-[#46464B]">{handle !== 'Projeto' ? handle : projetoNome}</span>
            <h1 className="text-[30px] font-extrabold leading-tight tracking-[-0.02em]">Programar post</h1>
            <span className="text-[13.5px] text-[#46464B]">{tituloSeguro(titulo)}</span>
          </div>
          <span className="flex items-center gap-2 text-[12.5px] text-[#46464B]">
            <Tag st="prog">{statusGeral ? statusGeral.replace(/[\p{Extended_Pictographic}️]/gu, '').trim() || 'Programar' : 'Programar'}</Tag>
            {dataCal && (
              <span>
                no calendário: <b className="text-[#111113]">{dataCurta(dataCal)}</b>
              </span>
            )}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Arte e legenda */}
        <section className="flex min-w-0 flex-col gap-4 rounded-[20px] border border-[#E9E9EB] bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <b className="text-[16px] font-bold">Arte e legenda</b>
              <Tag st="ok">arte do Drive</Tag>
            </span>
            <span className="flex rounded-[12px] bg-[#F4F4F5] p-1" role="tablist">
              {(['carrossel', 'reels'] as const).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={aba === t} onClick={() => setAba(t)} className={`rounded-[9px] px-3.5 py-1.5 text-[12.5px] font-extrabold ${aba === t ? 'bg-white text-[#111113] shadow-sm' : 'text-[#636369]'}`}>
                  {t === 'carrossel' ? 'Carrossel' : 'Reels'}
                </button>
              ))}
            </span>
          </div>

          {aba === 'carrossel' ? <PreviaCarrossel arquivos={arquivos} titulo={titulo} /> : <PreviaReels arquivos={arquivos} />}

          <div className="flex flex-col gap-2 border-t border-[#F4F4F5] pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-[12px] text-[#636369]">
                <Tag st="areia">Legenda</Tag> pré-carregada do post · ajuste se precisar
              </span>
              <span className="flex gap-4 text-[12.5px] font-extrabold">
                <button type="button" onClick={copiar} className="hover:underline">
                  {copiado ? 'Copiada' : 'Copiar'}
                </button>
                <button type="button" onClick={() => legendaRef.current?.focus()} className="hover:underline">
                  Editar
                </button>
              </span>
            </div>
            <textarea
              ref={legendaRef}
              value={legenda}
              onChange={(e) => setLegenda(e.target.value)}
              placeholder="Escreva a legenda do post"
              className="min-h-[220px] w-full resize-y rounded-[14px] border border-[#E9E9EB] bg-[#FAFAFA] px-4 py-3 text-[13.5px] leading-[1.6] text-[#111113] outline-none focus:border-[#111113] focus:bg-white"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex flex-wrap gap-1.5">
                {hashtags.slice(0, 12).map((h) => (
                  <Tag key={h} st="lima" className="!min-w-0">
                    {h}
                  </Tag>
                ))}
              </span>
              <span className={`text-[12px] ${legenda.length > LIMITE_LEGENDA ? 'font-bold text-[#7E211C]' : 'text-[#636369]'}`}>
                {legenda.length.toLocaleString('pt-BR')} / 2.200 caracteres · {hashtags.length} hashtag{hashtags.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        </section>

        {/* Passos */}
        <div className="flex min-w-0 flex-col gap-[18px]">
          <Passo n={1} st="cheg" titulo="Quando" sub={horarioProjeto ? `vem do horário do projeto (${horarioProjeto}), 5 min antes` : 'sem horário no projeto: padrão 09:55'}>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-[#636369]">Data</span>
                <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="rounded-[11px] border border-[#D6D6D9] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#111113]" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-[#636369]">Horário</span>
                <input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} className="rounded-[11px] border border-[#D6D6D9] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#111113]" />
              </label>
            </div>
            <span className="text-[11.5px] text-[#636369]">
              Horário de Brasília.{data && dataCal && data !== dataCal ? ` No calendário estava ${dataCurta(dataCal)}.` : ''}
            </span>
          </Passo>

          <Passo n={2} st="hoje" titulo="Onde aparece" sub="escolha um ou mais">
            <div className="flex flex-wrap gap-2">
              {LUGARES.map((l) => {
                const on = lugares.includes(l.id);
                return (
                  <button key={l.id} type="button" onClick={() => toggleLugar(l.id)} className="rounded-[11px] px-3 py-1.5 text-[12.5px] font-extrabold" style={on ? { background: ST.hoje[0], color: ST.hoje[1] } : { background: '#F4F4F5', color: '#46464B' }}>
                    {on ? '✓ ' : ''}
                    {l.nome}
                  </button>
                );
              })}
            </div>
            {lugares.includes('stories') && <AvisoNaoEnviado>A publicação automática ainda não manda pros Stories. Fica salvo aqui pra quem for postar na mão.</AvisoNaoEnviado>}
          </Passo>

          <Passo n={3} st="areia" titulo="Collab" sub="o post aparece nos dois perfis">
            <label className="flex items-center justify-between gap-2 text-[13px]">
              Convidar colaborador
              <Chave ligado={collab} onClick={() => setCollab(!collab)} rotulo="Convidar colaborador" />
            </label>
            {collab && (
              <>
                {perfis.map((p) => (
                  <div key={p} className="flex items-center justify-between rounded-[12px] border border-[#E9E9EB] px-3 py-2">
                    <span className="text-[13px] font-bold">@{p}</span>
                    <button type="button" onClick={() => setPerfis(perfis.filter((x) => x !== p))} aria-label={`Tirar @${p}`} className="text-[13px] text-[#636369] hover:text-[#111113]">
                      ✕
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    value={novoPerfil}
                    onChange={(e) => setNovoPerfil(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPerfil())}
                    placeholder="@perfil"
                    className="min-w-0 flex-1 rounded-[11px] border border-[#D6D6D9] px-3 py-1.5 text-[13px] outline-none focus:border-[#111113]"
                  />
                  <button type="button" onClick={addPerfil} className="rounded-[11px] border border-[#D6D6D9] px-3 py-1.5 text-[12.5px] font-extrabold hover:bg-[#F4F4F5]">
                    + Adicionar perfil
                  </button>
                </div>
                <AvisoNaoEnviado>O convite de collab ainda não é enviado pro Instagram e não fica salvo. Convide pelo app depois de publicar. Só entra no perfil do colaborador depois que ele aceitar.</AvisoNaoEnviado>
              </>
            )}
          </Passo>

          <Passo n={4} st="info" titulo="Plataformas" sub="liga e desliga onde publicar">
            <div className="flex flex-col">
              {PLATAFORMAS.map((p) => {
                const ativo = plataformas.includes(p.id);
                return (
                  <div key={p.id} className={`flex items-center gap-3 border-t border-[#F4F4F5] py-2.5 first:border-t-0 ${p.disponivel ? '' : 'opacity-50'}`}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-[10.5px] font-extrabold" style={p.disponivel ? { background: ST.cli[0], color: ST.cli[1] } : { background: '#F4F4F5', color: '#636369' }}>
                      {p.sigla}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <b className="text-[13px]">{p.nome}</b>
                      {p.id === 'instagram' && <span className="truncate text-[11.5px] text-[#636369]">{handle !== 'Projeto' ? handle : projetoNome}</span>}
                    </span>
                    {p.disponivel ? <Chave ligado={ativo} onClick={() => togglePlataforma(p.id, p.disponivel)} rotulo={p.nome} /> : <Tag st="neu" className="!min-w-0">em breve</Tag>}
                  </div>
                );
              })}
            </div>
          </Passo>

          <Passo n={5} st="ok" titulo="Pronto pra programar" sub={checklist.every((c) => c.ok) ? 'tudo conferido' : 'confira antes de programar'}>
            <ul className="flex flex-col gap-1.5">
              {checklist.map((c) => (
                <li key={c.texto} className="flex items-center gap-2 text-[13px]">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold" style={c.ok ? { background: ST.ok[0], color: ST.ok[1] } : { background: ST.atr[0], color: ST.atr[1] }}>
                    {c.ok ? '✓' : '!'}
                  </span>
                  {c.texto}
                </li>
              ))}
              {collab && perfis.length > 0 && (
                <li className="flex items-center gap-2 text-[13px] text-[#636369]">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#EFE4D8] text-[10px] font-extrabold text-[#5A4634]">i</span>
                  Collab com {perfis.map((p) => '@' + p).join(', ')}: convidar pelo app
                </li>
              )}
            </ul>
            {erro && <p className="rounded-[10px] bg-[#F6CFCB] px-3 py-2 text-[12.5px] font-bold text-[#7E211C]">Não deu certo: {erro}</p>}
            <button
              type="button"
              onClick={() => submit('confirmar')}
              disabled={ocupado || !temIg}
              title={!temIg ? 'Ligue o Instagram nas plataformas' : undefined}
              className="w-full rounded-[11px] bg-[#111113] px-4 py-2.5 text-[13px] font-extrabold text-white hover:bg-[#2C2C30] disabled:opacity-40"
            >
              {feito === 'confirmar' ? `✓ Programado no ${destino}` : loading === 'confirmar' ? 'Programando…' : `Programar no ${destino}`}
            </button>
            {!temIg && <span className="text-[11.5px] text-[#7E211C]">Ligue o Instagram nas plataformas pra programar.</span>}
            <span className="text-[11.5px] leading-snug text-[#636369]">O robô publica sozinho na hora marcada e marca Agendado no Notion.</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => submit('rascunho')} disabled={ocupado} className="rounded-[11px] border border-[#D6D6D9] bg-white px-3.5 py-2 text-[13px] font-extrabold hover:bg-[#F4F4F5] disabled:opacity-40">
                {feito === 'rascunho' ? '✓ Rascunho salvo' : loading === 'rascunho' ? 'Salvando…' : 'Salvar rascunho'}
              </button>
              <button type="button" onClick={() => submit('postado')} disabled={ocupado} className="rounded-[11px] bg-[#D8EDCF] px-3.5 py-2 text-[13px] font-extrabold text-[#2E5520] hover:bg-[#C7E3BB] disabled:opacity-40">
                {feito === 'postado' ? '✓ Marcado como postado' : loading === 'postado' ? 'Marcando…' : '✓ Marcar como postado'}
              </button>
            </div>
            <span className="text-[11.5px] leading-snug text-[#636369]">Rascunho salva só aqui no portal, sem tocar no Notion. Marcar como postado é pra quando já foi publicado na mão.</span>
          </Passo>
        </div>
      </div>
    </main>
  );
}
