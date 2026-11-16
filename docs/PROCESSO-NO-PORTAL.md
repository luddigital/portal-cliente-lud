# Processo de conteúdo 100% no portal — piloto Emanuel Transfer Paris

Decidido com a Luiza em 15/10/2026:

- A partir do **conteúdo de dezembro/2026**, o Emanuel Transfer Paris roda o processo de social media **só no portal**.
- Posts, tarefas e comentários ficam no **banco do próprio portal** (Supabase), não no Notion. É o piloto pra um dia largar o Notion.
- O calendário de dezembro **nasce no portal**. O Notion já tem 8 posições vazias ("Novo Post") que servem só pra pegar as datas.
- **Toda a equipe** trabalha nele pelo portal: social media/copy, design, gestão e cliente.

Continuam no Notion por enquanto: cadastro de **cliente e projeto** (login, grupo do WhatsApp, Instagram) e os posts **até novembro**.

## Identificação

- Projeto do Emanuel no Notion: `191d04d2-3b4a-80c0-9ed0-cf33333be3d0`. É a chave de cliente/login/WhatsApp.
- A tabela `conteudo_projetos` diz quais projetos rodam no portal e a partir de quando.
- Ids próprios com prefixo, pra qualquer tela saber de onde vem o dado sem consultar nada:
  - post `lud_…`
  - tarefa `ludt_…`
  - tudo que não tem prefixo continua sendo do Notion.

## Modelo de dados (migração 0021)

- `conteudo_posts`: título, data/horário de postagem, formato, editoria/funil/objetivo, ideia (pauta), informações e materiais necessários, referências, briefing, roteiro, legenda, links da arte e dos materiais.
- `conteudo_tarefas`: mesmos nomes de tarefa do Notion ("Aprovação | Pauta", "Arte", "Enviar Post Aprovação"…), `ordem` + `ordem_um` (01 original, 02 alteração, 03 nova aprovação), status (Iniciar/Em Andamento/Concluído/Reprovado/Cancelado), responsável, prazo, finalizada_em, mãe.
- `conteudo_comentarios`: cliente e equipe, por post (e tarefa, quando houver).

## Ponte com as telas que já existem

As telas de hoje (post, popup, aprovação do cliente, entregas, home, régua, histórico, programação) chamam `lib/notion.ts`. As funções principais ganham um desvio: **id com prefixo `lud_`/`ludt_` → `lib/conteudo-portal.ts`**. Assim, o post do Emanuel aparece e funciona nas mesmas telas, sem tela duplicada.

## Prazos (mesma régua do Notion)

S = segunda-feira da semana da postagem, D = dia da postagem.

| Tarefa | Prazo |
|---|---|
| Materiais para Produção (cliente) | S − 22 (domingo) |
| Aprovação \| Materiais para Produção | S − 21 (segunda) |
| Arte | S − 14 (segunda) |
| Aprovação \| Arte · Aprovação \| Geral | S − 13 (terça) |
| Enviar Post Aprovação | S − 11 (quinta) |
| Aprovação \| Post (cliente) | S − 7 (segunda) |
| Programar | S − 3 (sexta) |
| Conferir Postagem | D |

Etapas do mês (pra posts do mês M):

- calendário até o dia 5 de M−2;
- reunião/aprovação de pauta por volta do dia 15 de M−2;
- conteúdos prévios em seguida;
- Briefing & Copy até o dia 28 de M−2.

## Fases

1. **Pauta (agora → ~25/10)**
   - Calendário do mês no portal: criar e editar pautas, aprovação interna.
   - Enviar o calendário pro cliente e o cliente aprovar cada pauta pelo portal.
   - "Produzir post" cria a cadeia de tarefas com os prazos acima.
2. **Copy e materiais (→ início de novembro)**
   - Briefing & Copy pelo pipeline do método, gravando no post.
   - Pedido e envio de conteúdos prévios e materiais (upload no Drive, igual hoje).
   - Curadoria.
3. **Arte e aprovação (→ meados de novembro)**
   - A designer sobe a arte.
   - Aprovação interna e geral.
   - Envio pro cliente, aprovação, alteração e reaprovação, com lembretes no WhatsApp.
4. **Programação e publicação (→ antes de 01/12)**
   - Programar, publicar no Instagram e conferir postagem.
   - Entregas e home somando os posts do portal.

Fora do portal por enquanto: análise de dados (etapa 1) e as reuniões (etapas 2 e 4). Viram tarefas de checklist do mês numa fase seguinte.
