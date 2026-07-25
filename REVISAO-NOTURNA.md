# 🌙 Revisão Noturna — Portal da Lud.

> Trabalho autônomo da madrugada. **Nada foi publicado em produção.** Tudo está na branch
> `overnight/portal-melhorias`. Este documento é o handoff: o que fiz, o que revisei, o que
> projetei e as decisões que preciso de você. Qualquer sessão nova retoma daqui.

**Como revisar tudo:**
```bash
cd portal-cliente
git checkout overnight/portal-melhorias
npm run dev   # abre em localhost:3000 (o start é lento nesta máquina, ~2min)
```
Rotas pra olhar: `/admin/analise` (login oi@lud.digital) → abas Visão geral / Conteúdo / Insights / Público.

---

## 1. ✅ O que EU CONSTRUÍ (pronto, com typecheck limpo)

### Análise de Instagram — reformulada (commit `ad3c7c7`)
- **Abas** em `/admin/analise` e `/analise` (cliente): **Visão geral · Conteúdo · Insights · Público**.
- **Seguidores no topo** (tamanho médio, não mais o gigante) + fileira de KPIs (Views, Alcance, Novos seguidores, Interações).
- **Bloco Objetivo & Metas** (topo, todas as abas): puxa `getProjetoConfig` do Notion (objetivo + metas de seguidores/engajamento/alcance) e mostra **progresso ao vivo vs. meta**.
- **Aba Conteúdo**: busca por legenda/tema + filtro por métrica (views/alcance/interações/curtidas/comentários/salvos/compart.) + filtro por tipo + lista completa ordenável.
- **Aba Insights (IA)**: card "destaque + apoio", **dois tons** (interno tático no admin / cliente polido no portal), **priorizado pela meta do mês**, **cruza com Meta Ads** (sugere subir campanha com criativo orgânico vencedor). Detecção de eventos é determinística (nunca inventa número); o Claude só interpreta. Cache 12h + botão Atualizar.
- **Dados novos** (`lib/instagram.ts`): métrica `views` (total+série), breakdown por tipo de conteúdo e seguidores vs não-seguidores (com fallback se a conta não expõe), lista completa de conteúdos.
- **Fix importante**: o gráfico "Seguidores — entraram e saíram" era **falso** (a API só dá o saldo líquido; mostrava "0 saíram"). Agora é "variação líquida por dia", honesto.
- **`/admin/analise`**: agora lista **projetos ativos de IG do Notion** (antes vinha do Business Manager).

### Segurança — 1 correção aplicada
- **`/api/drive/preview`**: tinha `Cache-Control: public` num proxy protegido por sessão → o CDN da Vercel cacheava **arquivos privados** e servia pra qualquer um sem cookie. Corrigido pra `private`. **(Alta severidade — vale publicar isso logo.)**

---

## 2. 🔒 Revisão de Segurança (achados — corrigir depois)

A fronteira **cliente-vs-admin está correta em todas as rotas** (incluindo as que criei) — um cliente não acessa dados de outro. Achados restantes:

| Sev | Onde | Problema | Fix |
|-----|------|----------|-----|
| ✅ Alta | drive/preview | Cache público de arquivo privado | **JÁ CORRIGIDO** |
| Média | drive/preview | IDOR: qualquer logado baixa qualquer arquivo por fileId | validar fileId contra `session.projetoIds` |
| Média | setup/google/callback | refresh_token do Drive vai na URL (query string) | mostrar no corpo da página, não na URL |
| Média | auth.ts / middleware | sessão de 1 ano, re-assinada a cada request, sem revogação | reduzir TTL / re-checar vínculo / versionar sessão |
| Baixa | cron/* | endpoints de cron abertos quando `CRON_SECRET` não setado | exigir secret em produção |
| Baixa | auth/send-link | sem rate-limit + enumeração de usuário (404 pra email desconhecido) | rate-limit + 200 genérico |
| Baixa | env.ts | `AUTH_SECRET` sem mínimo de tamanho (HS256 forjável se fraco) | exigir ≥32 bytes |

---

## 3. 🎨 Revisão de UX / Completude (quick wins)

**Furos mais visíveis:**
1. **"Área do Cliente" no menu do admin leva a "Em construção"** (`Sidebar.tsx`) — item de nav de destaque caindo em tela vazia. Esconder ou tirar do menu.
2. **Badge "3" fixo** de notificações no sidebar (hardcoded) — mina a confiança nos contadores. Puxar real ou remover.
3. **`/analise` do cliente não tem link no dashboard** — a análise existe e é boa, mas o cliente não tem porta de entrada. Adicionar um card/atalho.
4. **`admin/cliente/[id]` e `admin/clientes/[id]` duplicados** — duas telas de detalhe de cliente. Unificar.
5. **"+ Novo post" no admin/postagens é fake** (só rascunho em memória, não persiste no Notion).

**Buracos maiores:** upload direto browser→Drive (arquivos grandes de vídeo frágeis, limite 4.5MB da Vercel); leitura via Supabase pela metade (sync é write-only hoje — custo sem benefício); catálogo de serviços 10/11 "em breve"; sem testes no repo.

---

## 4. ⭐ AGENTES GUIADOS POR DADOS — diagnóstico + a ponte (seu ponto principal)

**O diagnóstico (com prova no seu próprio processo):**
O `Processo_Social_Media.md` abre com *"Tudo começa por dados"* (Etapa 1 — Análise de Dados, dia 1). MAS hoje isso é uma **apresentação manual no Canva** que vive **desconectada** da produção de copy. O pipeline de copy (pesquisador → dor → hook → briefing → criar-copy) parte de **briefing + pesquisa + intuição**, e **não** consome os dados reais de performance. Confirmação no próprio `Template_Briefing_Cliente.md`: os campos "Melhores conteúdos performados (últimos 6 meses)", "Horários mais ativos" e "Público (demografia)" são preenchidos **na mão** — quando o portal **já tem esses dados vivos** (`getIgAnalytics`: top posts, formato campeão, breakdowns; `lib/insights.ts`).

**A ponte que eu proponho (concreta):**

1. **Portal expõe um "Brief de Inteligência" por cliente** — um endpoint/export (`/api/projeto/[id]/inteligencia`) que devolve, em texto estruturado: top posts do período, formato/editoria que mais performa, melhores ganchos (analisando as legendas dos vencedores), demografia, e o progresso vs. meta. Reaproveita 90% do que já construí (`detectarEventos` + analytics).

2. **As skills de conteúdo passam a CONSUMIR isso ANTES de produzir:**
   - `analista-de-dados-de-copy` e `pesquisador`: começam puxando o Brief de Inteligência (não partem do zero).
   - `estrategista-instagram` / `planejamento-mensal`: o calendário nasce dos padrões que já funcionam ("faça mais do formato X que está 3x acima da média").
   - `briefing-copy`: os campos de dados do briefing são **auto-preenchidos** pelo portal, não digitados à mão.
   - `hook-criativo`: recebe os ganchos dos posts que mais performaram como referência.

3. **Fecha o ciclo:** Etapa 1 (análise) → Etapa 2 (metas) → Etapa 3 (calendário) → Etapa 6 (briefing) todas alimentadas pela MESMA fonte de dados do portal. O que é publicado (Etapa 10) volta pro dado, e o ciclo reinicia — exatamente como seu processo desenha, mas **automatizado e conectado**.

> **Decisão sua:** quer que a ponte seja (a) um endpoint que as skills chamam via WebFetch, ou (b) o portal gera um arquivo de "Brief de Inteligência" que as skills leem? Recomendo começar por (b) — mais simples, e você já tem o hábito de trabalhar com arquivos.

---

## 5. 🗂️ GESTÃO DE PROJETOS — spec (grounded no seu processo real)

Seu `Processo_Social_Media.md` já é o sistema — está só num .md que ninguém abre. A página de Gestão traz isso pro portal, **claro e vivo**:

**MVP (o que faz ficar claro pra equipe agora):**
- **Página "Processo"** no portal: as **10 etapas** com quando / responsável / o que entregar / link do playbook. Referência sempre à mão. *(Vou tentar construir isso ainda hoje — ver seção 8.)*
- **Visão de ciclo por cliente**: onde cada cliente está no ciclo do mês (qual etapa), o que está atrasado, de quem é a bola. Mapeia direto no modelo do Notion (`TAREFAS_CATEGORIAS`, `EntregaItem`, `ProjetoDetalhe`) que já existe.

**Completo (fase 2):** timeline do mês por cliente, responsáveis por etapa, alertas de atraso, checklist por entrega ligado aos playbooks.

---

## 6. 🎮 ONBOARDING GAMIFICADO — design

**Cliente** (transforma a coleta de briefing/materiais numa jornada):
- Barra de progresso "Sua marca está 60% pronta pra decolar 🚀".
- Missões = os campos do `Template_Briefing_Cliente.md` + `TAREFAS_DO_CLIENTE` (conta a história da marca, sobe materiais, define tom de voz, conecta acessos).
- Cada missão concluída → checkmark + microcopy comemorativo + desbloqueia a próxima. Badge ao completar cada bloco (Identidade ✓, Público ✓, Materiais ✓).
- Reusa o que já existe em `/boas-vindas` e `/tarefa/[id]`; o novo é a camada de progresso/gamificação.

**Time/Gestão** (onboarding de novo membro):
- Trilha das 10 etapas do processo como "níveis" a destravar, cada uma com seu playbook. Novo membro entende o fluxo jogando por ele.

**MVP:** barra de progresso + missões do onboarding do cliente sobre os dados que já coletamos.

---

## 7. 🧭 Roadmap priorizado (minha recomendação)

1. **Publicar** a análise nova + fix de segurança #1 (já pronto, só revisar e dar deploy).
2. **Ponte de dados → agentes** (seção 4) — é o que muda o jogo na produção de conteúdo.
3. **Gestão de Projetos** MVP (seção 5) — urgente pro time.
4. Quick wins de UX (seção 3, itens 1-3 são triviais).
5. Onboarding gamificado (seção 6).
6. Segurança #2-#7 conforme prioridade.

---

## 8. Estado ao fim da madrugada

- ✅ Build de análise + insights + metas: **feito e commitado** (`ad3c7c7`).
- ✅ Fix de segurança #1: **feito**.
- ⏳ Página de Processo/Gestão: **em construção** (se aparecer commit depois de `ad3c7c7`, está lá; senão, a spec da seção 5 está pronta pra construir).
- 📋 Ponte de dados, onboarding, demais fixes: **projetados** aqui, aguardando seu OK pra construir.
- ⚠️ Não consegui rodar os agentes de revisão até o fim (instabilidade da API do ambiente) nem validar visualmente ao vivo (localhost lento/travado). Toda validação foi por `tsc` limpo.

**Bom dia! ☀️ Me diz por onde quer que eu siga.**
