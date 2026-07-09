# Portal do Cliente — Lud.

App separado pros clientes da Lud. enviarem materiais (fotos, vídeos, informações) direto pros posts do calendário. Tudo vai automaticamente pro Drive e pro Notion.

Rodando em produção: https://portal-cliente-lud.vercel.app

## Onboarding rápido pra dev novo

Se você é um dev entrando no projeto (não montando do zero), este é o caminho:

```bash
git clone <url-do-repo>
cd portal-cliente
npm install
npm i -g vercel     # se não tiver
vercel link         # associa o repo ao projeto na Vercel — precisa você ser membro do team oi-5696s-projects
vercel env pull .env.local
npm run dev         # http://localhost:3000
```

Login local: qualquer email listado em `ADMIN_EMAILS` (variável no `.env.local`). Você mesmo se adiciona lá se precisar.

Se `vercel env pull` não funcionar (sem acesso), peça pra Luiza (`oi@lud.digital`) as env vars via 1Password / Bitwarden — nunca por WhatsApp/Slack.

### Arquitetura em 60 segundos

- **Next.js 14 App Router** (React Server Components + Client Components onde precisa de interatividade)
- **`app/`** — rotas. Nomes em português:
  - `app/(cliente)` — telas do cliente (dashboard, tarefa, post, análise)
  - `app/admin/*` — telas da equipe interna Lud. (aprovações, análise, envio de materiais, entregas)
  - `app/api/*` — endpoints (uploads, aprovações, sync, drive proxy)
- **`lib/notion.ts`** — TODA lógica de Notion (query, cache, tarefas, posts, aprovações). Arquivo grande. Cache via `unstable_cache` com tags (`TAG_TAREFAS`, `TAG_POSTS`, `TAG_CLIENTES`) + camada in-memory (`makeCache`).
- **`lib/drive.ts`** — Google Drive (OAuth, criar pastas, upload)
- **`lib/instagram.ts`** — Meta Graph API (analytics)
- **`lib/auth.ts`** — JWT session (`jose`), magic link por email
- **`lib/sync.ts`** — sync gradual Notion → Supabase (em progresso, feature flag por cliente)
- **`app/_components`** — componentes compartilhados entre telas

### Deploy

- Vercel. Cada `git push` na `main` faz deploy automático se o repo estiver conectado (Vercel dashboard → Git). Caso contrário: `npm run deploy:prod` (roda `vercel deploy --prod --yes`).
- Preview branch por PR também rola quando GitHub↔Vercel tá plugado.

### Gotchas conhecidas

- **Limite de 4.5MB de body em serverless Vercel.** Uploads grandes precisam ir um arquivo por request (padrão em `/api/tarefas/[id]/anexar`) ou upload direto browser→Drive (não implementado ainda).
- **Notion tem rate limit apertado** (3 req/s por integration). `lib/notion.ts` usa `comRetry()` com backoff exponencial em 429/503/502/504. Não remova.
- **Notion sort por `last_edited_time` mente** em databases grandes (2k+ rows). Sempre filtre por janela de 90 dias + ordene local.
- **`makeCache` em vez de `React.cache()`** — a versão do React foi mordendo em route handlers; `makeCache` é in-memory + TTL + dedup de in-flight.
- **`unstable_cache` com tag** invalida via `revalidateTag()` em `invalidarCachesAposMudanca()`. Sempre chame depois de mutar Notion.
- **Vercel serverless functions maxDuration** — está em 300s onde precisa (uploads, sync). Não abaixa.
- **`.env.local` NUNCA sobe** — `.gitignore` cobre `.env*` e você já viu, mas confere de novo antes de commit.

### Como pedir ajuda

- Bugs em produção: `console.error` cai no Vercel Logs (Vercel dashboard → project → Logs). Filtra por rota.
- Contexto de decisões: converse com Luiza. Muitas escolhas (portais de admin, sync gradual, etc) têm contexto que não tá no código.

## Fluxo

1. Cliente entra com email (magic link). O email é matched contra `E-mail da empresa` na database **Clientes** do Notion. A partir do cliente, a relação `Projetos` define quais projetos ele vê.
2. Dashboard mostra **uma pendência por tarefa** (não por post). A tarefa aparece se:
   - Título é `Envio de Conteúdos Prévios` ou `Materiais para Produção`
   - Fórmula ` Pronto` retorna `true` (significa que prerequisitos foram concluídos e é hora do cliente)
   - Status NÃO está em `[Concluído, Cancelado, Reprovado, Excluída]`
   - O post da tarefa pertence a um projeto do cliente
   - Status do post NÃO está em `[Postado, Cancelado, Excluída]` (defesa em camadas)
3. Cliente abre uma tarefa (`/tarefa/[id]`) e vê o mesmo formulário em todos os casos: textarea de informações + upload de arquivos. Pode mandar um, outro, ou os dois.
4. Ao enviar:
   - Arquivos sobem no Drive (na conta Google conectada em `/setup`) em `[Cliente]/[Post]/[Data]/`.
   - Link da pasta aparece na property **Link do Google Drive** do post.
   - Texto é anexado como callout na página do post.
   - Comentário é adicionado no post: `✅ Tarefa "X" — recebida do cliente` + link do Drive + indicação se houve texto.
   - **Aquela tarefa específica** vira `Concluído`, `Finalizada em` vai pra hoje.
   - **O status do post não é alterado** (quem mexe nisso continua sendo o time da Lud.).

## Setup

### 1. Dependências

```bash
cd portal-cliente
npm install
```

### 2. Property no Notion

Cria no database **Projetos** uma property do tipo `Email` chamada **Email do Cliente** e preenche com o email de cada cliente. É esse email que o cliente usa pra entrar.

### 3. Notion integration

1. https://www.notion.so/profile/integrations → **New integration** (Internal)
2. Copia o token pra `NOTION_TOKEN`
3. Nos databases **Postagens**, **Tarefas** e **Projetos** (ou na página pai deles), abre o menu `•••` → **Connections** → adiciona a integration

### 4. Google Cloud — OAuth 2.0

**Não precisa service account, não precisa mexer em policies da org.**

1. https://console.cloud.google.com → seleciona o projeto (pode reusar o "My First Project")
2. **APIs e serviços → Biblioteca** → ativa a **Google Drive API**
3. **APIs e serviços → Tela de permissão OAuth**:
   - User Type: **Internal** (só usuários do Workspace lud.digital)
   - Nome do app: `Portal Lud.`, email de suporte: `oi@lud.digital`
   - Scopes: adiciona `../auth/drive` e `../auth/userinfo.email`
4. **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**:
   - Tipo: **Aplicação da Web**
   - Origens autorizadas: `http://localhost:3000` (dev) e sua URL de produção
   - Redirect URIs: `http://localhost:3000/api/setup/google/callback` e `https://SEU-DOMINIO/api/setup/google/callback`
   - Copia **Client ID** e **Client Secret** pro `.env.local`

### 5. Resend (email do magic link)

1. https://resend.com → cria API key em `RESEND_API_KEY`
2. Verifica o domínio `lud.digital` se quiser enviar de `oi@lud.digital`

### 6. Auth secret

```bash
openssl rand -base64 48
```

Cola em `AUTH_SECRET`.

### 7. `.env.local`

Copia `.env.example` pra `.env.local` e preenche tudo **menos** `GOOGLE_OAUTH_REFRESH_TOKEN` (esse fica em branco no primeiro boot).

### 8. Conectar o Google Drive

```bash
npm run dev
```

1. Abre http://localhost:3000/setup
2. Clica em **Conectar Google Drive**
3. Faz login com `oi@lud.digital` (ou o email que você pôs em `ADMIN_EMAILS`)
4. Autoriza os scopes
5. Copia o **refresh token** que aparecer na tela e cola em `GOOGLE_OAUTH_REFRESH_TOKEN` no `.env.local`
6. **Reinicia o servidor** (Ctrl+C → `npm run dev`)

Pronto. Agora `http://localhost:3000` funciona com login de cliente.

## Deploy na Vercel

1. Sobe o diretório como repo no GitHub, conecta na Vercel
2. Environment Variables: cola todas as envs do `.env.local`
3. Atualiza `NEXT_PUBLIC_APP_URL` pra URL final (ex: `https://portal.lud.digital`)
4. Em **Google Cloud → Credenciais → OAuth Client**, adiciona a URL de produção nos Redirect URIs
5. Deploy
6. Acessa `https://SEU-DOMINIO/setup` e repete os passos de conectar Drive (gera novo refresh token de produção, cola em env var na Vercel, redeploy)

## Estrutura de pastas no Drive

```
[Pasta raiz Materiais]/
  └── [Nome do Projeto]/
      └── [Título do Post]/
          └── [YYYY-MM-DD]/
              ├── arquivo-1.jpg
              ├── arquivo-2.mp4
              └── ...
```

Pastas são criadas on-the-fly se não existirem.

## Integração futura com o MVP

App montado em Next.js 14 App Router + TypeScript + Tailwind usando a mesma paleta do HTML do MVP. Quando rolar a integração:

- Rotas `/login`, `/` e `/post/[id]` viram sub-rotas tipo `/portal/*` dentro do MVP
- Libs `lib/notion.ts`, `lib/drive.ts`, `lib/auth.ts` e `lib/mail.ts` são drop-in
- API routes em `app/api/*` idem

## Limitações conhecidas

- Uploads grandes passam pela memória do servidor. Pra arquivos > 100 MB, depois a gente pode trocar por upload direto do browser pro Drive via resumable URL.
- A "tarefa atual" é a primeira tarefa do post onde a fórmula ` Pronto` retorna verdadeira. Se nenhuma bater, os materiais ainda são enviados e comentário postado, mas nenhuma tarefa é marcada como concluída.
- Se você mudar a senha da conta Google conectada, o refresh token pode invalidar — basta refazer o `/setup`.
- A OAuth consent screen como "Internal" limita o login a usuários `@lud.digital`. Se quiser permitir outras contas administradoras (ex: gmail pessoal seu), muda pra "External" em OAuth consent screen e adiciona o email como "Test user".
