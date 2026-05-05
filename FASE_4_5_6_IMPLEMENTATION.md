# Implementação das Fases 4, 5 e 6 - DocusPsi Backend

Documento descrevendo as tarefas de implementação para as próximas fases do DocusPsi backend.

---

## FASE 4 — ACEITE (Public Link + Acceptance Workflow)

### Objetivo
Permitir que pacientes aceitem documentos via link público, sem autenticação.

### Rotas da API

#### 1. GET `/public/documents/:publicToken`
**Descrição:** Página pública do documento (sem autenticação)
**Parâmetros:**
- `publicToken` (path): Token público único do documento

**Response (200):**
```json
{
  "document": {
    "id": "doc-uuid",
    "title": "Contrato Terapêutico",
    "renderedContent": "{...RenderedDocument JSON...}",
    "professionalSnapshot": {...},
    "patientSnapshot": {...},
    "status": "enviado"
  },
  "professional": {
    "fullName": "Dr. João Silva",
    "crp": "CRP/SP 123456",
    "city": "São Paulo",
    "state": "SP"
  },
  "acceptanceUrl": "/public/documents/{publicToken}/accept"
}
```

**Erros:**
- 404 Not Found: Token inválido ou documento não encontrado
- 410 Gone: Documento foi revogado

---

#### 2. POST `/public/documents/:publicToken/accept`
**Descrição:** Registra aceite do paciente (sem autenticação, rate limited)
**Parâmetros:**
- `publicToken` (path): Token público

**Request Body:**
```json
{
  "patientName": "Mariana Souza",
  "patientEmail": "mariana@exemplo.com",
  "ipAddress": "string (optional - capture from request)"
}
```

**Response (200):**
```json
{
  "message": "Documento aceito com sucesso",
  "acceptedAt": "2026-05-04T16:28:00.000Z",
  "sealUrl": "data:image/png;base64,..."
}
```

**Erros:**
- 404 Not Found: Token inválido
- 409 Conflict: Documento já foi aceito
- 410 Gone: Documento foi revogado
- 429 Too Many Requests: Rate limit excedido (máx 3 tentativas por token por dia)

---

### Schema de Banco de Dados

#### Tabela: `document_acceptances`
```typescript
export const documentAcceptancesTable = pgTable("document_acceptances", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull().references(() => documentsTable.id),
  patientName: text("patient_name").notNull(),
  patientEmail: text("patient_email").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  acceptedAt: timestamp("accepted_at").defaultNow().notNull(),
  sealImageUrl: text("seal_image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

#### Alteração: `documents` table
Adicionar:
- `status`: Novo valor `"aceito"` quando aceitação é registrada
- `acceptedAt`: timestamp quando document é aceito
- `acceptanceCount`: número de vezes que foi visualizado/aceito

---

### Funcionalidades Adicionais

#### 1. Selo de Aceite (Digital Stamp)
- Gerar imagem PNG com:
  - Data/hora de aceite
  - Nome do paciente
  - Hash ou QR code para validação
  - Assinatura do profissional (se disponível)
- Armazenar URL da imagem em `sealImageUrl`
- Incluir no PDF quando baixado após aceite

#### 2. Rate Limiting para Aceites
- Máximo 3 tentativas por publicToken por 24 horas
- Usar IP do cliente para tracking
- Endpoint: `/public/documents/:publicToken/accept`

#### 3. Email de Confirmação
- Enviar para `patientEmail` após aceite
- Incluir: data, profissional, documento, selo
- Template HTML com logo profissional (se disponível)

---

### Testes Necessários

```bash
# 1. Visualizar documento público
curl -X GET http://localhost:3333/public/documents/{publicToken}

# 2. Aceitar documento
curl -X POST http://localhost:3333/public/documents/{publicToken}/accept \
  -H "Content-Type: application/json" \
  -d '{
    "patientName": "Mariana Souza",
    "patientEmail": "mariana@exemplo.com"
  }'

# 3. Tentar aceitar novamente (deve retornar 409)
curl -X POST http://localhost:3333/public/documents/{publicToken}/accept \
  -H "Content-Type: application/json" \
  -d '{
    "patientName": "Mariana Souza",
    "patientEmail": "mariana@exemplo.com"
  }'

# 4. Visualizar histórico de aceites
curl -X GET http://localhost:3333/api/documents/{documentId}/acceptances \
  -H "Authorization: Bearer {token}"
```

---

## FASE 5 — FUNIL (Lead Capture + Kit Form)

### Objetivo
Capturar leads através de formulário de kit documental e rastrear jornada.

**Nota:** Leads table e LeadEvent table já foram criadas em Fase 1. 
Aqui implementamos endpoints e página web.

### Rotas da API

#### 1. GET `/public/kit-form`
**Descrição:** Retorna configuração do formulário do kit (sem autenticação)
**Response (200):**
```json
{
  "title": "Kit Documental para Psicólogos",
  "description": "Receba 5 modelos prontos de documentos...",
  "fields": [
    {
      "name": "name",
      "type": "text",
      "label": "Nome completo",
      "required": true
    },
    {
      "name": "email",
      "type": "email",
      "label": "Email profissional",
      "required": true
    },
    {
      "name": "phone",
      "type": "tel",
      "label": "WhatsApp",
      "required": false
    },
    {
      "name": "source",
      "type": "select",
      "label": "Como conheceu?",
      "options": ["INSTAGRAM", "TIKTOK", "REFERRAL", "OTHER"],
      "required": true
    },
    {
      "name": "professionStage",
      "type": "select",
      "label": "Quantos pacientes você atende?",
      "options": ["NOT_ATTENDING", "UP_TO_10_PATIENTS", "MORE_THAN_10_PATIENTS", "CLINIC_TEAM"],
      "required": true
    },
    {
      "name": "mainPain",
      "type": "select",
      "label": "Qual seu maior desafio?",
      "options": ["CONTRACT", "CONSENT_TERM", "RECEIPT", "DECLARATION", "PATIENT_ORGANIZATION", "OTHER"],
      "required": true
    },
    {
      "name": "consent",
      "type": "checkbox",
      "label": "Concordo em receber emails",
      "required": false
    }
  ],
  "ctaText": "Receber Kit Gratuito",
  "successMessage": "Obrigado! Verifique seu email para fazer download."
}
```

---

#### 2. POST `/public/kit-form/submit`
**Descrição:** Submete formulário do kit e captura lead (rate limited)
**Rate Limit:** 10 submissões por 5 minutos por IP

**Request Body:**
```json
{
  "name": "Dr. Carlos",
  "email": "carlos@psicologia.com",
  "phone": "(11) 99999-9999",
  "source": "INSTAGRAM",
  "professionStage": "UP_TO_10_PATIENTS",
  "mainPain": "CONTRACT",
  "consent": true
}
```

**Response (201):**
```json
{
  "message": "Lead capturado com sucesso",
  "leadId": "lead-uuid",
  "downloadUrl": "/public/kit/download",
  "kitFiles": [
    { "name": "Contrato Terapêutico", "url": "..." },
    { "name": "Termo de Consentimento", "url": "..." },
    { "name": "Recibo", "url": "..." },
    { "name": "Declaração", "url": "..." },
    { "name": "Guia de Organização", "url": "..." }
  ]
}
```

**Erros:**
- 429 Too Many Requests: Rate limit excedido
- 400 Bad Request: Email já existe, validação falhou

---

#### 3. POST `/public/kit/events`
**Descrição:** Rastreia eventos da jornada (sem autenticação, via leadId)

**Request Body:**
```json
{
  "leadId": "lead-uuid",
  "eventType": "kit_page_view | kit_form_focus | kit_download_start | kit_download_complete",
  "metadata": {
    "timeSpent": 120,
    "scrollDepth": 80,
    "deviceType": "mobile"
  }
}
```

**Response (200):**
```json
{
  "message": "Evento registrado"
}
```

---

#### 4. GET `/public/kit/download`
**Descrição:** Download do kit em ZIP (requer leadId via query param)

**Query Params:**
- `leadId` (required): ID do lead que fez submit

**Response:** Arquivo ZIP com PDFs dos 5 modelos

---

### Eventos a Rastrear

```typescript
export const leadEventTypeValues = [
  "kit_page_view",           // Usuário visitou página do kit
  "kit_form_focus",          // Usuário clicou no formulário
  "kit_form_submit",         // Usuário submeteu formulário ✓ (já existe)
  "kit_download_start",      // Iniciou download
  "kit_download_complete",   // Completou download
  "clicked_download_kit",    // ✓ (já existe)
  "email_opened",            // Email foi aberto (via pixel)
  "email_clicked",           // Email teve link clicado
] as const;
```

---

### Testes Necessários

```bash
# 1. Obter configuração do formulário
curl -X GET http://localhost:3333/public/kit-form

# 2. Submeter formulário (capturar lead)
curl -X POST http://localhost:3333/public/kit-form/submit \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dr. Carlos",
    "email": "carlos@test.com",
    "phone": "(11) 99999-9999",
    "source": "INSTAGRAM",
    "professionStage": "UP_TO_10_PATIENTS",
    "mainPain": "CONTRACT",
    "consent": true
  }'

# 3. Registrar evento
curl -X POST http://localhost:3333/public/kit/events \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "lead-uuid",
    "eventType": "kit_download_complete",
    "metadata": {"timeSpent": 45}
  }'

# 4. Download kit
curl -X GET "http://localhost:3333/public/kit/download?leadId=lead-uuid" \
  -o kit.zip

# 5. Dashboard de leads (autenticado - admin)
curl -X GET http://localhost:3333/api/dashboard/leads \
  -H "Authorization: Bearer {admin-token}"
```

---

## FASE 6 — PLANOS (Trial + Checkout)

### Objetivo
Implementar sistema de planos, trial period, e integração com checkout de pagamento.

### Rotas da API

#### 1. GET `/api/plans`
**Descrição:** Listar planos disponíveis (sem autenticação)

**Response (200):**
```json
{
  "plans": [
    {
      "id": "plan-free",
      "name": "Free",
      "description": "Para testar a plataforma",
      "price": 0,
      "currency": "BRL",
      "billingCycle": "monthly",
      "features": {
        "documentsPerMonth": 5,
        "maxPatients": 3,
        "storageGB": 0.5,
        "templates": ["contrato-terapeutico"],
        "publicLinks": false,
        "customBranding": false,
        "support": "community"
      },
      "trialDays": 14
    },
    {
      "id": "plan-essential",
      "name": "Essential",
      "description": "Para consultório solo",
      "price": 99,
      "currency": "BRL",
      "billingCycle": "monthly",
      "features": {
        "documentsPerMonth": 50,
        "maxPatients": 20,
        "storageGB": 5,
        "templates": ["*"],
        "publicLinks": true,
        "customBranding": false,
        "support": "email"
      },
      "trialDays": 0
    },
    {
      "id": "plan-pro",
      "name": "Pro",
      "description": "Para consultório com equipe",
      "price": 299,
      "currency": "BRL",
      "billingCycle": "monthly",
      "features": {
        "documentsPerMonth": 200,
        "maxPatients": 100,
        "storageGB": 50,
        "templates": ["*"],
        "publicLinks": true,
        "customBranding": true,
        "support": "priority"
      },
      "trialDays": 0
    },
    {
      "id": "plan-clinic",
      "name": "Clinic",
      "description": "Para clínicas e centros",
      "price": 999,
      "currency": "BRL",
      "billingCycle": "monthly",
      "features": {
        "documentsPerMonth": 1000,
        "maxPatients": -1,
        "storageGB": 500,
        "templates": ["*"],
        "publicLinks": true,
        "customBranding": true,
        "support": "24/7"
      },
      "trialDays": 0
    }
  ]
}
```

---

#### 2. POST `/api/plans/upgrade`
**Descrição:** Upgrade de plano (redireciona para checkout ou aplica imediatamente)
**Autenticação:** Requerida

**Request Body:**
```json
{
  "planId": "plan-pro",
  "billingCycle": "monthly" | "yearly",
  "couponCode": "WELCOME10" (opcional)
}
```

**Response (200):**
```json
{
  "checkoutUrl": "https://checkout.stripe.com/pay/...",
  "message": "Abra o link para completar pagamento"
}
```

Ou se for trial:

**Response (200):**
```json
{
  "message": "Trial iniciado",
  "plan": "Essential",
  "trialEndsAt": "2026-05-18T16:28:00.000Z",
  "upgradeRequired": true
}
```

---

#### 3. GET `/api/subscriptions/current`
**Descrição:** Obter assinatura atual do usuário
**Autenticação:** Requerida

**Response (200):**
```json
{
  "subscription": {
    "id": "sub-uuid",
    "userId": "user-uuid",
    "plan": "free",
    "status": "trial" | "active" | "past_due" | "canceled",
    "currentPeriodStart": "2026-05-04T16:28:00.000Z",
    "currentPeriodEnd": "2026-06-04T16:28:00.000Z",
    "trialEndsAt": "2026-05-18T16:28:00.000Z",
    "canceledAt": null,
    "features": {...}
  }
}
```

---

#### 4. POST `/api/subscriptions/cancel`
**Descrição:** Cancelar assinatura
**Autenticação:** Requerida

**Response (200):**
```json
{
  "message": "Assinatura cancelada",
  "canceledAt": "2026-05-04T16:28:00.000Z",
  "refundAmount": 0
}
```

---

### Schema de Banco de Dados

#### Tabela: `subscriptions`
```typescript
export const subscriptionsTable = pgTable("subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique().references(() => usersTable.id),
  planId: text("plan_id").notNull(),
  status: text("status").notNull().default("trial"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  billingCycle: text("billing_cycle").notNull().default("monthly"),
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  trialEndsAt: timestamp("trial_ends_at"),
  canceledAt: timestamp("canceled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const subscriptionStatusValues = ["trial", "active", "past_due", "canceled"] as const;
```

#### Tabela: `plan_features`
```typescript
export const planFeaturesTable = pgTable("plan_features", {
  id: text("id").primaryKey(),
  planId: text("plan_id").notNull(),
  documentsPerMonth: integer("documents_per_month").notNull(),
  maxPatients: integer("max_patients").notNull().default(-1), // -1 = unlimited
  storageGB: integer("storage_gb").notNull().default(0),
  supportsPublicLinks: boolean("supports_public_links").notNull().default(false),
  supportsCustomBranding: boolean("supports_custom_branding").notNull().default(false),
  supportLevel: text("support_level").notNull().default("community"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

#### Tabela: `stripe_events` (webhook logging)
```typescript
export const stripeEventsTable = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  stripeEventId: text("stripe_event_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").notNull(),
  processed: boolean("processed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

---

### Alterações na Tabela `users`

```typescript
// Já existem:
role: text("role").default("PROFESSIONAL").notNull(),
plan: text("plan").default("FREE").notNull(),

// Adicionar:
subscriptionId: text("subscription_id").references(() => subscriptionsTable.id),
trialStartedAt: timestamp("trial_started_at"),
trialEndsAt: timestamp("trial_ends_at"),
subscriptionStatus: text("subscription_status").default("free").notNull(),
lastPaymentAt: timestamp("last_payment_at"),
```

---

### Integração com Stripe

#### 1. Webhook Handler
**Endpoint:** `POST /webhooks/stripe`
**Descrição:** Recebe eventos do Stripe

**Eventos a processar:**
- `customer.subscription.updated` → Atualizar `subscriptions`
- `customer.subscription.deleted` → Marcar cancelada
- `invoice.payment_succeeded` → Log de pagamento
- `invoice.payment_failed` → Notificar usuário

---

#### 2. Middleware de Plano

```typescript
// Já existe: validatePlanLimits
// Melhorar para:
- Verificar se está em trial
- Verificar se assinatura está ativa
- Retornar 402 Payment Required se limites excedidos
- Retornar 403 se assinatura cancelada
```

---

### Testes Necessários

```bash
# 1. Listar planos
curl -X GET http://localhost:3333/api/plans

# 2. Iniciar trial
curl -X POST http://localhost:3333/api/plans/upgrade \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "plan-essential",
    "billingCycle": "monthly"
  }'

# 3. Verificar assinatura
curl -X GET http://localhost:3333/api/subscriptions/current \
  -H "Authorization: Bearer {token}"

# 4. Cancelar assinatura
curl -X POST http://localhost:3333/api/subscriptions/cancel \
  -H "Authorization: Bearer {token}"

# 5. Simular webhook do Stripe
curl -X POST http://localhost:3333/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{
    "type": "customer.subscription.updated",
    "data": {...}
  }'
```

---

## Resumo de Implementação

| Fase | Rotas | Tabelas | Features |
|------|-------|---------|----------|
| 4 | 2 GET + 1 POST | 1 nova | Aceite público, selo digital |
| 5 | 4 GET/POST | 0 novas | Funil leads, rastreamento eventos |
| 6 | 4 GET/POST + webhook | 3 novas | Planos, trial, Stripe |

---

## Checklist de Completude

- [x] Fase 4: Todos endpoints funcionando
- [ ] Fase 4: Testes passando (link público, aceite, rate limit)
- [x] Fase 5: Formulário kit capturando leads
- [x] Fase 5: Eventos sendo rastreados no dashboard
- [x] Fase 6: Planos listando corretamente
- [x] Fase 6: Checkout Stripe configurado
- [x] Fase 6: Customer Portal configurado para cancelamento/gestão
- [x] Fase 6: Webhook Stripe processando
- [x] Fase 6: Middleware validando plano antes de ação

---

## Checklist Detalhado de Execução

### Fase 4 — Aceite
- [x] Adicionar `GET /api/public/documents/:publicToken` no formato especificado, mantendo compatibilidade com rota pública antiga.
- [x] Adicionar `POST /api/public/documents/:publicToken/accept` no formato especificado.
- [x] Ajustar respostas de erro do aceite público para `409` em documento já aceito e `410` em documento revogado.
- [x] Implementar rate limit de aceite: 3 tentativas por token/IP em 24 horas.
- [x] Registrar aceite com IP, User-Agent e atualização de status/`acceptedAt`.
- [x] Implementar histórico autenticado de aceites em `GET /api/documents/:documentId/acceptances`.
- [x] Gerar selo digital de aceite e retornar URL/base64 conforme schema disponível.
- [x] Incluir dados de aceite no PDF pós-aceite.
- [x] Adicionar integração de email de confirmação via `ACCEPTANCE_EMAIL_WEBHOOK_URL`.
- [x] Adicionar ou validar testes manuais automatizáveis da Fase 4.

### Fase 5 — Funil
- [x] Adicionar `GET /api/public/kit-form`.
- [x] Adicionar `POST /api/public/kit-form/submit` com rate limit de 10 submissões por 5 minutos por IP.
- [x] Adicionar `POST /api/public/kit/events`.
- [x] Adicionar `GET /api/public/kit/download?leadId=...`.
- [x] Integrar leads/eventos ao dashboard.
- [x] Adicionar ou validar testes manuais automatizáveis da Fase 5.

### Fase 6 — Planos
- [x] Adicionar schemas/tabelas de assinaturas, features e eventos Stripe.
- [x] Adicionar `GET /api/plans`.
- [x] Adicionar `POST /api/plans/upgrade`.
- [x] Adicionar `GET /api/subscriptions/current`.
- [x] Adicionar `POST /api/subscriptions/cancel`.
- [x] Adicionar `POST /webhooks/stripe`.
- [x] Melhorar middleware de plano para trial, assinatura ativa, `402` e `403`.
- [x] Adicionar ou validar testes manuais automatizáveis da Fase 6.
