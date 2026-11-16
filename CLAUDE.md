# CLAUDE.md — Portal do Cliente (portal-cliente/)

App Next.js 14 do portal da Lud. (admin + clientes), integrado com Notion, Supabase, Drive, Z-API e Meta.
Produção: https://portal-cliente-lud.vercel.app · Idioma: PT-BR em tudo (código comentado, commits, respostas).

## Publicar (regra mais importante)

- Trabalhe sempre no ramo **main**. Ao terminar cada mudança: `npx tsc --noEmit`, depois **commit** (mensagem em PT-BR, terminando com a linha `Co-Authored-By` pedida pelo sistema).
- Publique **só** com `npm run publicar` (scripts/publicar.sh). Ele recusa se o ramo não for main ou se tiver qualquer mudança sem commit, confere os tipos, publica na Vercel e envia o main pro GitHub.
- **Nunca** rode `vercel --prod` / `vercel deploy --prod` direto: isso sobe a pasta inteira, inclusive trabalho pela metade de outra conversa.
- Se `git status` mostrar mudanças que você não fez, são de outra conversa: não faça commit delas nem publique; avise a Luiza.
- Uma conversa por vez mexendo no código do portal. Se a conversa estiver num worktree (cópia separada), junte o ramo dela no main antes de publicar.

## Hierarquia e links (visão Lud.)

Todo link sai de `lib/rotas.ts` (`rotas.projeto(id)`, `rotas.entregaDoProjeto(projetoId, entregaId)`, `rotas.tarefa(id)`…). Não escreva caminho de admin à mão.

```
Projetos  /admin/projetos
└─ projeto  /admin/projetos/[id]
   └─ entrega do projeto  /admin/projetos/[id]/entregas/[entregaId]
      └─ tarefa  /admin/tarefas/[id]
Entregas  /admin/entregas  →  entrega (todos os clientes)  /admin/entregas/[id]  →  cada cliente leva pra entrega do projeto
Tarefas   /admin/tarefas  (todas as abertas, filtro por pessoa/projeto/entrega)  →  tarefa  /admin/tarefas/[id]
Post      prévia (popup PreviaPostModal) → "Abrir completo" /post/[id]
```

- O que o clique **representa** decide o destino: card/linha que junta várias tarefas de um tipo ("Aprovação | Post · 4 posts") = **entrega** (no projeto: a entrega do projeto; no geral: a entrega de todos). **Uma** tarefa ("Arte" de um post, quadradinho de concluir) = **página da tarefa**. Título do post = **prévia do post**. Nome/@ do projeto = **projeto**.
- Toda página interna mostra o caminho com `<Trilha>` (`app/admin/_components/Trilha.tsx`): Projetos › @projeto › entrega › tarefa.
- `/admin/entrega/[id]` é endereço antigo: só redireciona. `/tarefa/[id]` é a página da tarefa **do cliente** (envio de materiais), não usar no admin.

## Regras do produto

- Design: ler `DESIGN_SYSTEM.md` antes de mexer em tela. Base neutra (estilo Notion) + cores semânticas `--cal-*` / `--prazo-*`; datas com `<ChipData>`; botão de envio ao cliente verde (`.btn-enviar`).
- **Não mudar a visão do cliente** sem a Luiza pedir; mudanças internas vão na "Visão Lud.".
- WhatsApp (Z-API): mensagens **só pro grupo do cliente, nunca no privado**.
- No admin, clicar num post abre o **popup de prévia** primeiro (`PreviaPostModal`), com "Abrir completo" e "Voltar" pra tela de origem.
- Notion: tarefas de um post seguem a ordem **Ordem → Ordem (1)**; a etapa do post é a tarefa aberta mais cedo nessa ordem (equivale à fórmula "Status Geral"). Datas sempre no fuso de São Paulo.
