# Briefing — Conectar Evolution API + WhatsApp ao Portal já existente

> **Para freelancer técnico com experiência em Evolution API, Docker e WhatsApp Multi-Device.**
> Este briefing já tem 90% do trabalho feito — falta só destravar a última peça.

---

## Resumo em uma frase

Tenho um Portal em Next.js já deployado na Vercel com toda a integração de WhatsApp codada (chat, webhook, banco, admin). **Falta apenas conectar uma instância da Evolution API rodando no meu VPS ao meu WhatsApp Business.**

---

## O que já está pronto (você NÃO precisa mexer)

✅ **Portal Next.js 14** deployado em Vercel
- Código com integração completa: `/api/whatsapp/webhook`, `/api/whatsapp/send`, `/api/whatsapp/sync-groups`, `/chat`, `/admin/whatsapp`
- Frontend de chat com Realtime

✅ **Supabase Postgres** configurado
- Schema rodado (`whatsapp_grupos`, `whatsapp_permissoes`, `whatsapp_mensagens`)
- Realtime habilitado nas tabelas
- Envs já configuradas na Vercel

✅ **VPS DigitalOcean (NYC1)** rodando — IP `104.248.229.204`
- Ubuntu 22.04, 1GB RAM, 1 vCPU, $6/mês
- Docker instalado e rodando
- Nginx instalado e configurado pra `evolution.lud.digital`
- Certbot rodado, HTTPS ativo
- Postgres container rodando na rede `evolution-net`
- Evolution API v2.1.1 container rodando

✅ **DNS configurado**
- `evolution.lud.digital` aponta corretamente pro IP do VPS
- Acessar `https://evolution.lud.digital` retorna o JSON de boas-vindas da Evolution API

✅ **Variáveis de ambiente da Evolution API ainda NÃO foram adicionadas no Vercel**
- `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME`, `EVOLUTION_WEBHOOK_SECRET`
- (Após você fazer o item abaixo funcionar, vou adicionar — não precisa se preocupar)

---

## O QUE PRECISA SER FEITO (escopo do trabalho)

### Objetivo único
Fazer com que a instância `lud-principal` da Evolution API **realmente conecte** ao meu WhatsApp Business e gere QR Code ou pairing code que eu consiga escanear/digitar pra autenticar.

### O problema específico

Quando rodo:
```bash
curl -X POST https://evolution.lud.digital/instance/create \
  -H "apikey: $EVO_KEY" \
  -H "Content-Type: application/json" \
  -d '{"instanceName":"lud-principal","qrcode":true,"integration":"WHATSAPP-BAILEYS","number":"5511970186212"}'
```

A instância é criada com status `connecting`, **mas nunca gera QR/pairing code**. O `/instance/connect/lud-principal` sempre retorna `{"count":0}`.

Nos logs aparece loop infinito de `[ChannelStartupService] Browser/Baileys version env / Group Ignore` se repetindo a cada 2-5 segundos, sem nenhuma mensagem de erro nem de conexão estabelecida.

### Hipóteses que eu tenho (você confirma ou descarta)

1. **Incompatibilidade da versão da Baileys** (env mostra `2,3000,1015901307`) com a versão atual do WhatsApp Web
2. **Variável de ambiente faltando** que faz a Baileys travar (talvez `CONFIG_SESSION_PHONE_VERSION` ou similar)
3. **Bug específico da v2.1.1** que requer downgrade/upgrade
4. Outra coisa que eu não enxerguei

### O que esperar de você

- Diagnosticar a causa real
- Corrigir (provavelmente trocar versão da Evolution, ajustar envs, ou usar fork específico tipo `evolution-api-pro`)
- Conectar meu WhatsApp via QR/pairing code
- Validar que mensagens fluem (mandar uma mensagem do meu WhatsApp e ver no banco Postgres)
- Configurar o webhook pra apontar pro Portal (`https://portal-cliente-lud.vercel.app/api/whatsapp/webhook` com header `x-lud-webhook-secret`)
- Confirmar que o webhook chega no Portal (testar com 1 mensagem real)
- Me passar os 2 segredos finais: `EVOLUTION_API_KEY` e `EVOLUTION_WEBHOOK_SECRET`

---

## O que NÃO está no escopo

- Não precisa mexer no código do Portal (Next.js) — já tá pronto
- Não precisa mexer no Supabase — já tá configurado
- Não precisa configurar DNS — já tá apontado
- Não precisa cuidar do frontend / UX — não é seu problema

---

## Tempo estimado

**1 a 3 horas** pra alguém que já conhece Evolution API. Provavelmente 1h se o problema for trivial, até 3h se precisar testar versões/forks.

---

## Valor sugerido

**R$ 200 a R$ 400 (entrega única, valor fixo, pagamento contra entrega).**

Não pagamento por hora — quero certeza de entrega.

---

## Critério de aceite (só pago quando todos verificados)

- [ ] Demonstrar via call ou vídeo que conectou o WhatsApp Business no número `+55 11 97018-6212`
- [ ] Status `open` no endpoint `https://evolution.lud.digital/instance/connectionState/lud-principal`
- [ ] Enviar uma mensagem de teste no meu WhatsApp e mostrar que ela aparece na tabela `whatsapp_mensagens` do Supabase (eu te mostro como conferir)
- [ ] Webhook chegando sem erro 401 (vou ter adicionado as envs no Vercel até esse momento)
- [ ] Acesso ao VPS continua funcional pra eu poder gerenciar depois

---

## Acessos que vou fornecer (após selecionar você)

- IP do VPS, usuário (root) e senha (DigitalOcean)
- Domínio: `evolution.lud.digital` (já apontado)
- Credenciais da Evolution API atual (`EVO_KEY` gerada)
- Logs completos da Evolution se necessário

---

## Anexos importantes

### Stack atual do VPS

```
Ubuntu 22.04
Docker (versão atual)
Nginx + Certbot
Containers rodando:
  - postgres:15-alpine (banco da Evolution)
  - atendai/evolution-api:v2.1.1 (na rede evolution-net)
```

### Variáveis usadas no docker run da Evolution

```
AUTHENTICATION_API_KEY=<gerada>
DATABASE_ENABLED=true
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=postgresql://evolution:evolution@postgres:5432/evolution?schema=public
DATABASE_CONNECTION_CLIENT_NAME=evolution_lud
DATABASE_SAVE_DATA_INSTANCE=true
DATABASE_SAVE_DATA_NEW_MESSAGE=true
DATABASE_SAVE_MESSAGE_UPDATE=true
DATABASE_SAVE_DATA_CONTACTS=true
DATABASE_SAVE_DATA_CHATS=true
CACHE_REDIS_ENABLED=false
CACHE_LOCAL_ENABLED=true
WEBHOOK_GLOBAL_ENABLED=false   (desabilitado temporariamente; precisa ativar pro Portal)
CONFIG_SESSION_PHONE_CLIENT=Lud. Portal
CONFIG_SESSION_PHONE_NAME=Chrome
```

### Histórico de tentativas que já fiz (pra você economizar tempo)

- Versão `atendai/evolution-api:latest` (v2.2.3): mesmo problema
- Versão `atendai/evolution-api:v2.1.1`: mesmo problema
- Provedores testados: Hostinger (IP em blacklist) → migrei pra DigitalOcean (mesmo bug, não é IP)
- Limpeza completa: volume Docker + schema do Postgres recriados várias vezes
- Tentativas: com `number` (pairing code) e sem (QR code) — ambos `{"count":0}`
- Sleep até 60s entre criação e tentativa de connect — sem diferença
- Restart de instância via API e restart de container — sem diferença

### URL do webhook que precisa ser configurada (após você resolver o connect)

```
WEBHOOK_GLOBAL_URL=https://portal-cliente-lud.vercel.app/api/whatsapp/webhook
WEBHOOK_GLOBAL_ENABLED=true
WEBHOOK_GLOBAL_WEBHOOK_BY_EVENTS=false
WEBHOOK_GLOBAL_HEADERS={"x-lud-webhook-secret":"<EVOLUTION_WEBHOOK_SECRET>"}
```

---

## Sobre mim

Sou desenvolvedora do Portal (Next.js, Supabase, integração Notion/Drive). Conheço código, sei revisar o que você fizer, mas não tenho experiência específica com Evolution + Baileys. Comunicação direta, sem enrolação, pago no dia da entrega validada.

---

## Como aplicar

Cola na sua proposta:

1. Já trabalhou com Evolution API antes? Quais versões?
2. Já lidou com esse problema de `{"count":0}` em loop?
3. Tempo estimado e valor fixo da sua proposta
4. Se topa demo de validação em call no fim

Não pago adiantado. Trabalho com escrow da plataforma (Workana / 99freelas).
