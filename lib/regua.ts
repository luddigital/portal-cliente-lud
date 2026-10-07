import { listAllProjetos, listarTarefasDaRegua } from '@/lib/notion';
import { lerVisualizacoes, supabaseAdmin } from '@/lib/supabase';
import { hojeEmSaoPaulo, somarDias } from '@/lib/lembrete-aprovacao';
import type { MomentoRegua } from '@/lib/regua-mensagens';
import {
  agruparPorPost,
  diaDaSemana,
  momentoDoDia,
  montarCiclo,
  quintasDoCiclo,
  type CicloRegua,
} from '@/lib/regua-ciclo';

export type EnvioRegistrado = {
  projetoId: string;
  ciclo: string;
  momento: string;
  variante: string | null;
  enviadoEm: string;
};

export type Regua = {
  hoje: string;
  hora: number;
  diaSemana: number;
  momentoHoje: MomentoRegua | null;
  proximo: CicloRegua;
  anterior: CicloRegua;
  envios: EnvioRegistrado[];
};

function horaEmSaoPaulo(): number {
  return (
    Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo',
        hour: 'numeric',
        hour12: false,
      }).format(new Date()),
    ) % 24
  );
}

export async function montarRegua(): Promise<Regua> {
  const hoje = hojeEmSaoPaulo();
  const { proxima, anterior } = quintasDoCiclo(hoje);

  const [tarefas, projetos] = await Promise.all([
    listarTarefasDaRegua(somarDias(anterior, -4), somarDias(proxima, 6)),
    listAllProjetos().catch(() => []),
  ]);
  const porPost = agruparPorPost(tarefas);
  const visualizacoes = await lerVisualizacoes([...porPost.keys()]);

  const sb = await supabaseAdmin();
  const [{ data: grupos }, { data: envios }] = await Promise.all([
    sb
      .from('whatsapp_grupos')
      .select('nome, apelido, projeto_id, principal')
      .eq('ativo', true)
      .order('principal', { ascending: false })
      .order('nome', { ascending: true }),
    sb
      .from('regua_envios')
      .select('projeto_id, ciclo, momento, variante, enviado_em')
      .in('ciclo', [anterior, proxima]),
  ]);

  const mapaGrupos = new Map<string, { nome: string; apelido: string | null }>();
  for (const g of grupos ?? []) {
    if (g.projeto_id && !mapaGrupos.has(g.projeto_id)) {
      mapaGrupos.set(g.projeto_id, { nome: g.nome, apelido: g.apelido });
    }
  }
  const mapaProjetos = new Map(projetos.map((p) => [p.id, { nome: p.nome, clienteNome: p.clienteNome }]));
  const base = { porPost, visualizacoes, projetos: mapaProjetos, grupos: mapaGrupos };

  const hora = horaEmSaoPaulo();
  return {
    hoje,
    hora,
    diaSemana: diaDaSemana(hoje),
    momentoHoje: momentoDoDia(hoje, anterior, hora),
    proximo: montarCiclo({ ...base, quinta: proxima }),
    anterior: montarCiclo({ ...base, quinta: anterior }),
    envios: (envios ?? []).map((e: any) => ({
      projetoId: e.projeto_id,
      ciclo: e.ciclo,
      momento: e.momento,
      variante: e.variante,
      enviadoEm: e.enviado_em,
    })),
  };
}
