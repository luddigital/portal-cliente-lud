# CLAUDE.md — Portal do Cliente (portal-cliente/)

App Next.js 14 do portal da Lud. (admin + clientes), integrado com Notion, Supabase, Drive, Z-API e Meta.
Produção: https://portal-cliente-lud.vercel.app · Idioma: PT-BR em tudo (código comentado, commits, respostas).

## Publicar (regra mais importante)

- Trabalhe sempre no ramo **main**. Ao terminar cada mudança: `npx tsc --noEmit`, depois **commit** (mensagem em PT-BR, terminando com a linha `Co-Authored-By` pedida pelo sistema).
- Publique **só** com `npm run publicar` (scripts/publicar.sh). Ele recusa se o ramo não for main ou se tiver qualquer mudança sem commit, confere os tipos, publica na Vercel e envia o main pro GitHub.
- **Nunca** rode `vercel --prod` / `vercel deploy --prod` direto: isso sobe a pasta inteira, inclusive trabalho pela metade de outra conversa.
- Se `git status` mostrar mudanças que você não fez, são de outra conversa: não faça commit delas nem publique; avise a Luiza.
- Uma conversa por vez mexendo no código do portal. Se a conversa estiver num worktree (cópia separada), junte o ramo dela no main antes de publicar.

## Regras do produto

- Design: ler `DESIGN_SYSTEM.md` antes de mexer em tela. Base neutra (estilo Notion) + cores semânticas `--cal-*` / `--prazo-*`; datas com `<ChipData>`; botão de envio ao cliente verde (`.btn-enviar`).
- **Não mudar a visão do cliente** sem a Luiza pedir; mudanças internas vão na "Visão Lud.".
- WhatsApp (Z-API): mensagens **só pro grupo do cliente, nunca no privado**.
- No admin, clicar num post abre o **popup de prévia** primeiro (`PreviaPostModal`), com "Abrir completo" e "Voltar" pra tela de origem.
- Notion: tarefas de um post seguem a ordem **Ordem → Ordem (1)**; a etapa do post é a tarefa aberta mais cedo nessa ordem (equivale à fórmula "Status Geral"). Datas sempre no fuso de São Paulo.
