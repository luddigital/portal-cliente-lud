# WhatsApp no Portal — Setup completo

Espelha grupos selecionados do seu WhatsApp dentro do Portal do Cliente.
Clientes (e o time da Lud.) conseguem ler e responder — mensagens saem pelo
número da Lud. ninguém no grupo percebe que veio de outra pessoa.

---

## Visão geral

```
WhatsApp (seu número, vinculado como dispositivo)
   ↓ QR Code
Evolution API (VPS Hetzner ~R$ 25/mês)
   ↓ webhook
Portal do Cliente (Next.js / Vercel)
   ↓
Supabase Free (Postgres + Realtime)
```

---

## Pré-requisitos

1. **Conta Supabase** — https://supabase.com (free tier)
2. **VPS Linux** — Hetzner CX22, DigitalOcean droplet, Contabo, etc.
3. **Domínio próprio** — pra apontar `evolution.lud.digital` (ou similar) pro VPS
4. **WhatsApp ativo** no seu celular (qualquer número, vai virar mais 1 "WhatsApp Web")

---

## Passo 1 — Supabase

1. Crie um novo projeto em https://supabase.com
2. **SQL Editor** → cole o conteúdo de `supabase/migrations/0001_whatsapp.sql` → Run
3. **Settings → API**: copie e guarde:
   - `Project URL` → `SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` key → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ nunca expor no frontend)

---

## Passo 2 — VPS + Evolution API

### 2.1 Criar o servidor

Recomendação: **Hetzner CX22** (R$ 25/mês, 4GB RAM, sobra MUITA coisa).

### 2.2 Instalar Docker

```bash
ssh root@<seu-vps-ip>
curl -fsSL https://get.docker.com | sh
```

### 2.3 Apontar domínio

No seu provedor DNS (Cloudflare, Registro.br, etc.), crie um registro A:

```
evolution.lud.digital  →  <seu-vps-ip>
```

### 2.4 Configurar Nginx + Certbot (HTTPS)

```bash
apt install -y nginx certbot python3-certbot-nginx
```

Crie `/etc/nginx/sites-available/evolution`:

```nginx
server {
    listen 80;
    server_name evolution.lud.digital;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/evolution /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d evolution.lud.digital
```

### 2.5 Rodar Evolution API

Gere dois segredos fortes (cole num gerenciador de senhas):

```bash
openssl rand -hex 32   # → EVOLUTION_API_KEY
openssl rand -hex 32   # → EVOLUTION_WEBHOOK_SECRET
```

Rode:

```bash
docker run -d \
  --name evolution-api \
  --restart unless-stopped \
  -p 127.0.0.1:8080:8080 \
  -e AUTHENTICATION_API_KEY=<EVOLUTION_API_KEY> \
  -e DATABASE_PROVIDER=postgresql \
  -e DATABASE_CONNECTION_URI="postgresql://postgres:<senha>@<host>:5432/postgres?schema=evolution" \
  -e WEBHOOK_GLOBAL_URL=https://portal.lud.digital/api/whatsapp/webhook \
  -e WEBHOOK_GLOBAL_ENABLED=true \
  -e WEBHOOK_GLOBAL_WEBHOOK_BY_EVENTS=false \
  -e 'WEBHOOK_GLOBAL_HEADERS={"x-lud-webhook-secret":"<EVOLUTION_WEBHOOK_SECRET>"}' \
  -e CONFIG_SESSION_PHONE_CLIENT="Lud. Portal" \
  -e CONFIG_SESSION_PHONE_NAME=Chrome \
  -v evolution_instances:/evolution/instances \
  atendai/evolution-api:latest
```

> **Database**: pode reaproveitar o Postgres do Supabase (use a string de conexão de "Connection pooling" se for serverless, ou conexão direta).
> Como alternativa simples sem banco externo, omita `DATABASE_*` — Evolution roda com SQLite local (bom pro volume da Lud.).

### 2.6 Criar a instância e conectar WhatsApp

```bash
# Cria a instância
curl -X POST https://evolution.lud.digital/instance/create \
  -H "apikey: <EVOLUTION_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"instanceName":"lud-principal","qrcode":true}'

# Pega o QR Code (base64 de uma imagem PNG)
curl https://evolution.lud.digital/instance/connect/lud-principal \
  -H "apikey: <EVOLUTION_API_KEY>"
```

Salve o `base64` num arquivo `.png` (ou use https://base64.guru/converter/decode/image) e
**escaneie pelo seu WhatsApp → Aparelhos Conectados → Conectar um aparelho**.

Pronto. Sessão ativa. Seu WhatsApp Web atual continua funcionando — a Evolution é só mais um dispositivo.

---

## Passo 3 — Configurar o Portal (Vercel)

### 3.1 Variáveis de ambiente

Adicione na Vercel (Settings → Environment Variables):

```env
EVOLUTION_API_URL=https://evolution.lud.digital
EVOLUTION_API_KEY=<EVOLUTION_API_KEY>
EVOLUTION_INSTANCE_NAME=lud-principal
EVOLUTION_WEBHOOK_SECRET=<EVOLUTION_WEBHOOK_SECRET>

SUPABASE_URL=<copiada no passo 1>
SUPABASE_SERVICE_ROLE_KEY=<copiada no passo 1>
NEXT_PUBLIC_SUPABASE_URL=<copiada no passo 1>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<copiada no passo 1>
```

### 3.2 Instalar dependência do Supabase

```bash
npm install @supabase/supabase-js
```

Comite e faça deploy. Vercel rebuilda.

---

## Passo 4 — Operação

### 4.1 Sincronizar grupos (1ª vez)

1. Logue no Portal como admin (`oi@lud.digital`)
2. Sidebar → **WhatsApp**
3. Clique em **Sincronizar agora**
4. Todos os seus grupos aparecem listados (entram desativados por padrão)

### 4.2 Ativar grupos e dar acesso

Pra cada grupo de cliente:

1. Marque o toggle **Visível**
2. Clique em **Pessoas**
3. Adicione o email do cliente, marque **pode responder** se for o caso
4. Adicione quantas pessoas precisar (cliente, sócio do cliente, time da Lud., etc.)

### 4.3 O que o cliente vê

1. Cliente loga no Portal normalmente
2. Aparece um card **"Conversas com a Lud."** na home
3. Clica → vê só os grupos que você liberou pra ele
4. Lê histórico e responde — mensagem sai do seu número no WhatsApp

---

## Passo 5 — Manutenção

### Backup automático

- **Supabase Pro** ($25/mês): backup diário automático com 7 dias de retenção
- **Free tier**: configure cron na Vercel que exporta `whatsapp_mensagens` pro Drive
  (pode aproveitar `lib/drive.ts` existente)

### Sessão caiu (raro)

Se a Evolution perder conexão (celular ficou dias sem internet, etc.):

```bash
curl https://evolution.lud.digital/instance/connect/lud-principal \
  -H "apikey: <EVOLUTION_API_KEY>"
```

Escaneia novo QR e tudo volta. Histórico no banco intacto.

### Atualizar Evolution

```bash
docker pull atendai/evolution-api:latest
docker stop evolution-api && docker rm evolution-api
# rode o `docker run` de novo (mesma config) — o volume `evolution_instances` preserva a sessão
```

---

## Privacidade

- **Filtro no webhook**: só mensagens de grupos ATIVOS no admin são persistidas.
  Conversas pessoais e grupos não-ativados são descartados antes de tocar o banco.
- **Auditoria**: toda mensagem enviada pelo Portal grava `enviado_por_usuario = email`.
  Você vê quem do lado do cliente respondeu o quê.
- **RLS**: o banco está com Row Level Security ligado. Frontend só vê dados via API do
  Portal, que valida sessão JWT.

---

## Custos mensais

| Item | Custo |
|---|---|
| VPS Hetzner CX22 | ~R$ 25 |
| Domínio (já tem) | R$ 0 |
| Supabase Free | R$ 0 |
| Vercel Hobby (já tem) | R$ 0 |
| **Total** | **~R$ 25/mês** |

---

## Troubleshooting

**Webhook não chega no Portal**
- Cheque logs do Docker: `docker logs evolution-api -f`
- Confirme HTTPS no Nginx (Cloudflare bloqueia HTTP entre serviços)
- Header `x-lud-webhook-secret` precisa bater EXATAMENTE com `EVOLUTION_WEBHOOK_SECRET`

**Mensagem enviada pelo Portal não chegou**
- `connection.state` da instância (precisa ser `open`)
- Logs da rota `/api/whatsapp/send` no Vercel

**Realtime do chat não atualiza**
- Confira que as duas envs públicas estão setadas (`NEXT_PUBLIC_*`)
- Tabelas precisam estar na publicação Realtime do Supabase (o SQL faz isso automaticamente)

**"Supabase não configurado" no log**
- Cheque que `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` foram adicionadas e o deploy rodou de novo
