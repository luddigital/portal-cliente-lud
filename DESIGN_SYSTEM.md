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

**Exceção à regra P&B, aprovada pela Luiza em 08/10/2026.** Toda data com prazo (entrega, aprovação, tarefa) usa o mesmo chip: **sólido, texto branco, negrito, arredondado** — o mesmo visual do selo "SÓ A EQUIPE". A cor é a urgência:

| Classe                    | Quando                  | Fundo                    |
| ------------------------- | ----------------------- | ------------------------ |
| `chip-data atrasado`      | já venceu               | `var(--prazo-atrasado)`  |
| `chip-data hoje`          | vence hoje              | `var(--prazo-hoje)`      |
| `chip-data chegando`      | em 1–2 dias             | `var(--prazo-chegando)`  |
| `chip-data em-dia`        | em 3–7 dias             | `var(--prazo-em-dia)`    |
| `chip-data tranquilo`     | mais de 7 dias          | `var(--prazo-tranquilo)` |
| `chip-data sem-prazo`     | sem data                | transparente, contorno   |

- Em React, use `<ChipData prazo hoje />` (`app/_components/ChipData.tsx`): ele calcula a urgência, mostra `dd/mm` e põe o "vence em N dias" no tooltip. `texto` troca o rótulo quando a tela precisa de "hoje", "atrasado 3 dias" etc. — o visual continua o mesmo.
- Não crie chip de data com fundo claro / texto colorido: isso era o padrão antigo.
- Classes definidas em `app/globals.css` (`.chip-data`).

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

## Referências consultadas

- [DesignMD — Notion Design Tokens](https://designmd.cc/benchmarks/notion) (403 no fetch, mas listado)
- [oh-my-design — Notion Design System](https://oh-my-design.kr/design-systems/notion)
- [Fudge — Notion.com design](https://design.withfudge.com/share/notion.com-design)
- [OpenDesign — Notion design system plugin](https://open-design.ai/plugins/design-system-notion/)
- [shadcn — Notion Design System for React](https://www.shadcn.io/design/notion)
