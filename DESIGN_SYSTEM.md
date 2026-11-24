# Design System do Portal Lud.

Inspirado no Notion (e um pouco na Apple, no que diz respeito à hierarquia e ao respiro). **Adaptação principal**: enquanto o Notion original usa azul `#0075DE` como cor de ação, **o portal Lud. é 100% P&B** — todos os azuis, verdes, vermelhos e roxos viram tons de cinza. A ideia é preservar o *ritmo* do Notion sem herdar sua paleta.

Este é o único guia de referência de design do portal. Sempre que uma tela nova for feita, ou uma velha for retrabalhada, ela deve seguir isto.

---

## 1. Filosofia

- **Flat**: sem sombras pesadas, sem gradientes. Cor de fundo + bordas hairline resolvem hierarquia.
- **Respiro**: espaço em branco é o principal recurso pra hierarquia visual.
- **Tipografia carrega o peso**: peso e tamanho definem "importante", não cor.
- **P&B**: cor colorida no portal indica um bug do design system, não um estado.
- **Interações discretas**: hover é um `background` cinza ~5% sobre uma superfície branca. Sem transform, sem glow.

---

## 2. Cores

Tudo em tons de cinza. As cores foram calibradas contra o Notion original mas **removendo qualquer matiz** — os cinzas do Notion têm um leve tom quente (`#37352F` é quase preto com bege), e essa escolha foi preservada porque ele resulta em contraste mais agradável que preto puro (`#000000`).

### Tokens neutros

| Token             | Hex / rgba                | Uso                                                  |
| ----------------- | ------------------------- | ---------------------------------------------------- |
| `canvas`          | `#FFFFFF`                 | Fundo da página, cartões, superfícies elevadas.      |
| `surface`         | `#FBFBFA`                 | Alternativa muito sutil ao canvas (opcional).        |
| `hover`           | `rgba(55,53,47,0.05)`     | Fundo de hover em qualquer alvo clicável.            |
| `active`          | `rgba(55,53,47,0.10)`     | Fundo de estado pressionado / selecionado.           |
| `hairline`        | `rgba(0,0,0,0.09)`        | Bordas padrão de tudo (cartões, botões, inputs).     |
| `hairline-hover`  | `rgba(0,0,0,0.14)`        | Borda no hover — a mesma borda um pouco mais forte.  |
| `hairline-strong` | `rgba(0,0,0,0.20)`        | Reforço em estado ativo / foco / seleção.            |
| `ink`             | `#37352F`                 | Texto principal, ícones fortes.                      |
| `ink-muted`       | `#787774`                 | Texto secundário, legendas.                          |
| `ink-tertiary`    | `rgba(55,53,47,0.45)`     | Placeholder, texto auxiliar bem discreto.            |

### Superfícies "fantasma"

Pra estados que precisam se destacar sem cor (chip "Postado", célula "hoje", card selecionado), usar **peso da borda + fundo do texto** em vez de matiz:

| Estado                        | Fundo                     | Texto        | Borda                     |
| ----------------------------- | ------------------------- | ------------ | ------------------------- |
| Concluído / finalizado        | `#37352F`                 | `#FFFFFF`    | `#37352F`                 |
| Em andamento / na fila        | `#E9E9E7`                 | `#37352F`    | `#E9E9E7`                 |
| Pronto pra ação / a fazer     | `#F4F4F2`                 | `#37352F`    | `rgba(0,0,0,0.06)`        |
| Neutro / outros               | `#FFFFFF`                 | `#787774`    | `rgba(0,0,0,0.14)`        |
| Destaque atual ("hoje")       | `rgba(55,53,47,0.02)`     | `#37352F`    | `#37352F`                 |

---

## 3. Tipografia

### Fonte

Stack de fonte de sistema — não carregar fonte externa:
```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
```

O Notion no site usa Inter/NotionInter, mas **prefira system font stack** — a app deles também usa. Renderiza mais rápido e cada plataforma pega sua fonte nativa (que é o que os usuários já esperam ver).

### Escala

| Uso                                | Tamanho  | Peso | Tracking     | Line-height |
| ---------------------------------- | -------- | ---- | ------------ | ----------- |
| Título de página (h1)              | 22px     | 600  | `-0.02em`    | 1.2         |
| Seção (h2)                         | 17px     | 600  | `-0.02em`    | 1.3         |
| Subseção (h3)                      | 14px     | 600  | `-0.01em`    | 1.3         |
| Título de card                     | 12.5px   | 500  | `-0.005em`   | 1.35        |
| Body / corpo                       | 13px     | 400  | `0`          | 1.5         |
| Meta / secundário                  | 11px     | 400  | `0`          | 1.4         |
| Micro (uppercase, tag)             | 10.5px   | 600  | `0.06em`     | 1           |
| Micro (uppercase, chip)            | 10px     | 500  | `0.03em`     | 1           |

### Regras

- **Nunca** use peso 700+ em texto de UI (só em display / hero).
- Peso 600 é o "bold" — reserva pra títulos e chips ativos.
- Peso 500 = "medium", pra ações e botões.
- Uppercase só em micro-labels (10-11px). Nunca em texto de body.

---

## 4. Espaçamento

Base **4px**. Todo padding, margin e gap é múltiplo de 4.

| Token   | Valor  | Uso                                           |
| ------- | ------ | --------------------------------------------- |
| `2xs`   | 4px    | Espaçamento entre itens quase colados.        |
| `xs`    | 8px    | Padding interno de chips, gap entre inputs.   |
| `sm`    | 12px   | Padding interno padrão de cards compactos.    |
| `md`    | 16px   | Padding padrão de card, gap entre elementos.  |
| `lg`    | 24px   | Espaço vertical entre grupos.                 |
| `xl`    | 32px   | Padding lateral de main / seções grandes.     |
| `2xl`   | 48px   | Separação vertical entre grandes áreas.       |

**Regra prática:**
- Card compacto (post no calendário): `p-2` (8px)
- Card padrão (form field, cartão de dashboard): `p-4` (16px)
- Grid gap padrão em listas: `gap-2` (8px)
- Padding lateral do main: `px-8` (32px)

---

## 5. Bordas e raio

### Border radius

| Elemento              | Raio    |
| --------------------- | ------- |
| Chip / tag / pill     | 4px     |
| Botão, input, card    | 6px     |
| Card grande / painel  | 8px     |
| Modal / dialog        | 12px    |
| Avatar circular       | 9999px  |

Nunca `rounded-2xl` (16px) em elementos comuns — o Notion não faz.

### Bordas

Sempre `1px solid`. **Nunca borda mais grossa que 1px** — se precisar de mais peso, use cor mais escura em vez de mais grossura.

- Padrão: `rgba(0,0,0,0.09)`
- Hover: `rgba(0,0,0,0.14)`
- Ativo / foco: `#37352F` (o próprio ink)

---

## 6. Sombras

**Não use.** O Notion evita sombras. Se você precisa de elevação:
1. Primeiro tente adicionar borda `hairline-strong`.
2. Se ainda não bastar, use `shadow-[0_1px_3px_rgba(0,0,0,0.04)]` no máximo.
3. Nunca use `shadow-md` ou mais forte — quebra o visual flat.

Exceção: modal e popover levam `shadow-[0_8px_24px_rgba(0,0,0,0.12)]`, porque estão explicitamente flutuando sobre o resto.

---

## 7. Transições

Sempre `transition-colors duration-150`. Nunca:
- Transform (scale, translate) em hover.
- Blur, glow, filter.
- Duração > 200ms.

Cursor sempre `cursor-pointer` em alvos clicáveis (Link, button).

---

## 8. Componentes

### Botão

**Primário** (uma ação principal por tela):
```html
<button class="rounded-md bg-[#37352F] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#2E2C28]">
  Programar →
</button>
```

**Secundário** (todo o resto):
```html
<button class="rounded-md border border-[rgba(0,0,0,0.09)] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[#787774] transition-colors hover:bg-[rgba(55,53,47,0.05)] hover:text-[#37352F] hover:border-[rgba(0,0,0,0.14)]">
  Sincronizar
</button>
```

**Ícone puro** (só glyph, sem texto):
```html
<button class="rounded-md p-1.5 text-[#787774] transition-colors hover:bg-[rgba(55,53,47,0.05)] hover:text-[#37352F]" aria-label="…">
  ↺
</button>
```

### Card / superfície

```html
<div class="rounded-md border border-[rgba(0,0,0,0.09)] bg-white p-4">
  …
</div>
```

Se clicável, adiciona `transition-colors hover:bg-[rgba(55,53,47,0.05)] hover:border-[rgba(0,0,0,0.14)]`.

### Chip / tag de status

Ver a tabela em **Superfícies "fantasma"** — quatro variantes: `sólido`, `médio`, `claro`, `outline`. Sempre `rounded px-1.5 py-[1px] text-[10px] font-medium`.

### Chip de data / prazo

Toda data com prazo (entrega, aprovação, tarefa) usa o mesmo chip, **discreto**: fundo branco, contorno fino, data em `ink` e uma **bolinha** com a cor da urgência. Atrasado também pinta texto e contorno de vermelho. (A versão sólida, toda colorida, ficou chamativa demais e foi trocada em 08/10/2026.)

| Classe                    | Quando                  | Bolinha                  |
| ------------------------- | ----------------------- | ------------------------ |
| `chip-data atrasado`      | já venceu (texto vermelho) | `var(--prazo-atrasado)`  |
| `chip-data hoje`          | vence hoje              | `var(--prazo-hoje)`      |
| `chip-data chegando`      | em 1–2 dias             | `var(--prazo-chegando)`  |
| `chip-data em-dia`        | em 3–7 dias             | `var(--prazo-em-dia)`    |
| `chip-data tranquilo`     | mais de 7 dias          | `var(--prazo-tranquilo)` |
| `chip-data sem-prazo`     | sem data                | sem bolinha, contorno tracejado |

- Em React, use `<ChipData prazo hoje />` (`app/_components/ChipData.tsx`): calcula a urgência, mostra `dd/mm` e põe "vence em N dias" no tooltip. `texto` troca o rótulo ("hoje", "atrasado 3 dias"…) sem mudar o visual.
- Classes em `app/globals.css` (`.chip-data`).

### Botão Concluir

Concluir uma etapa/tarefa é sempre verde, em qualquer tela (Hoje, Tarefas, popup do post): fundo `#2E7D4F`, texto branco, `rounded-full`, hover `#256A42`, texto "✓ Concluir". Em lista densa pode ser a versão contorno (fundo branco, borda `#2E7D4F`, texto `#2E5520`). Nunca preto.

### Botão de envio ao cliente

Ação positiva de mandar algo pro cliente (enviar pra aprovação, mensagem da entrega): verde `var(--prazo-em-dia)`, texto branco, `rounded-full` — classe `.btn-enviar`. Só aparece quando a ação está liberada (ex.: todos os posts do cliente prontos); **não mostrar botão desabilitado** no lugar, mostrar o que falta no texto do card.

### Input

```html
<input class="w-full rounded-md border border-[rgba(0,0,0,0.09)] bg-white px-3 py-2 text-[13px] text-[#37352F] placeholder:text-[rgba(55,53,47,0.45)] transition-colors focus:border-[#37352F] focus:outline-none" />
```

Zero ring de foco colorido — só borda escurece.

### Select

Igual input, mesma classe. Nunca use `appearance-none` sem substituir a seta — deixa a seta nativa por enquanto.

### Divider

```html
<div class="border-t border-[rgba(0,0,0,0.09)]"></div>
```

Nunca `border-2`.

---

## 9. Ícones e emoji

- **Ícones textuais** (`↺`, `‹`, `›`, `←`): use com moderação. Cor `#787774`, mesmo tamanho do texto ao redor.
- **Emoji**: OK em contextos de conteúdo (título de post do Notion), evitar em UI puro (não coloque 🎯 num botão).
- **Ícone de biblioteca** (Heroicons, Lucide): mesma cor `#787774`, stroke width `1.5`, tamanho `16px` (`h-4 w-4`).

---

## 10. Aplicação no portal (o que ainda falta)

Estado em `2026-09-15`:
- ✅ `/admin/calendario` — atualizado.
- ✅ `/admin/ia-acesso` — segue o padrão de forma geral.
- ⏳ `/programacao` — ainda usa cores semânticas (chips coloridos por status).
- ⏳ `/post/[id]` — parcialmente P&B, mas sidebar interna tem cores.
- ⏳ `/admin` (home) — usa `var(--cal-*)` coloridas em vários lugares.
- ⏳ `/gestao`, `/pipeline`, `/esteira`, `/post` (todas as sub-telas) — precisam varredura.

**Direção**: quando qualquer uma dessas for aberta pra edição, migrar pro P&B no mesmo turno. Não fazer varredura de refactor visual sozinha (perde tempo em telas que a Luiza talvez decida repensar do zero).

---

## 11. Nada cortado, nada piscando (regras obrigatórias)

**Caixa nunca pode aparecer cortada.**
- Toda faixa com rolagem lateral (`overflow-x-auto`: abas, chips, linhas de cards) leva `min-h-fit`. Num pai `flex flex-col` com altura fixa (popup, painel lateral, modal), um filho com `overflow` diferente de visible pode ser espremido na altura e corta o conteúdo (foi o que cortou as abas Post / Tarefas / Comentários / Histórico do popup do post).
- Em popup e painel com altura fixa (`flex flex-col h-…` ou `max-h-…`), cabeçalho, abas e rodapé levam `shrink-0`; só o corpo leva `flex-1 overflow-y-auto`.
- `overflow-hidden` só em caixa com altura livre (pra arredondar canto) ou em texto com `truncate` / `line-clamp`. Nunca em caixa de altura fixa com conteúdo variável.
- Ao criar ou mexer numa tela, abrir no navegador e conferir que nenhuma caixa tem conteúdo escondido (scrollHeight maior que a altura visível sem barra de rolagem).

**Tudo centralizado na linha.**
- Linha de lista (post, tarefa, entrega): todos os elementos com `items-center` na mesma altura (data, título, tag, trilha, botão).
- Texto auxiliar embaixo de um ícone (data embaixo do círculo, nome embaixo do avatar) fica pendurado com `absolute top-full`, pra não aumentar a altura e tirar o ícone do centro. Dê espaço com `py` na linha.
- Tag ao lado de ícones: mesma altura dos ícones (h-7) e centralizada.

**A tela nunca pode piscar em branco ao atualizar.**
- Não usar `<Suspense>` dentro de página do servidor nem `loading.tsx` nas rotas. No Next 14 os dois fazem todo `router.refresh()` mostrar o esqueleto cinza de novo (a tela pisca). Use `SemPiscar` (`app/_ui/SemPiscar.tsx`) se precisar manter a estrutura. Ao trocar de página, quem mostra que está carregando é a barrinha fina no topo (nextjs-toploader, no layout raiz).
- Depois de uma ação (concluir, aprovar, salvar, mandar), atualizar o que mudou na própria tela (estado local) e, se precisar, `router.refresh()` dentro de `startTransition`. Nunca `window.location.reload()`.
- Lista que perde um item depois da ação (aprovado, concluído): tirar o item da lista na hora, sem recarregar a página.

## Referências consultadas

- [DesignMD — Notion Design Tokens](https://designmd.cc/benchmarks/notion) (403 no fetch, mas listado)
- [oh-my-design — Notion Design System](https://oh-my-design.kr/design-systems/notion)
- [Fudge — Notion.com design](https://design.withfudge.com/share/notion.com-design)
- [OpenDesign — Notion design system plugin](https://open-design.ai/plugins/design-system-notion/)
- [shadcn — Notion Design System for React](https://www.shadcn.io/design/notion)

## Paleta da Lud. — sistema de uso (out/2026)

Só cores da paleta oficial: #151521, #313D65, #082640, #F8F8F8, #F1EBE5, #8485A3,
#90181A, #642223, #3A1D1E, #FFD5D6, #FFABAC, #3B4A33, #6A7464, #889F7B,
#1E476A, #436F95, #779DBF, #B8D2EA, #BAC4E6.

1. **Base neutra:** fundo #F8F8F8, cartão branco, área secundária #F1EBE5, texto #151521.
2. **Cor só com significado:** vinho #90181A = atrasado · salmão #FFABAC (texto #3A1D1E) = vence hoje ou em até 2 dias · verde #3B4A33 = feito/folga · azuis = informação (programado, conferir, links #436F95).
3. **Família não mistura:** rosa/vinho só com rosa/vinho; azul só com azul/marinho; verde só com verde. Nunca texto rosa sobre azul.
4. **Pouca cor cheia:** um destaque marinho #313D65 (texto branco ou lavanda #BAC4E6) e o vinho cheio só no atrasado.
5. **Nunca** caixa com tracinho colorido do lado (border-left). Marque com o fundo suave da família ou com a bolinha.
6. Sobre salmão e sálvia o texto é sempre escuro (branco fica ilegível).

As variáveis `--prazo-*` e `--cal-*` do globals.css já seguem essas regras.
