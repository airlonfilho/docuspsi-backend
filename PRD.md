# PRD — Backend DocusPsi

## 1. Visão geral

O **DocusPsi** é um micro SaaS para psicólogas(os) criarem, organizarem, visualizarem, enviarem e baixarem documentos profissionais em PDF, com modelos guiados, cabeçalho personalizado, histórico por paciente e aceite simples por link.

Este PRD tem como objetivo orientar o desenvolvimento e a validação do **backend**, garantindo que todas as funcionalidades necessárias para o MVP estejam completas, seguras e integradas ao frontend.

---

# 2. Objetivo do backend

O backend deve permitir que o sistema funcione de ponta a ponta:

```txt
Usuário cria conta
↓
Configura perfil profissional
↓
Cadastra pacientes
↓
Escolhe um modelo
↓
Preenche os dados
↓
Gera documento
↓
Visualiza e baixa PDF
↓
Envia link de aceite
↓
Paciente aceita
↓
Sistema registra aceite
↓
Documento fica salvo no histórico do paciente
```

---

# 3. Escopo do MVP

## O backend deve contemplar

* Autenticação de usuários.
* Perfil profissional.
* Upload de logo/assinatura.
* Cadastro e gestão de pacientes.
* Biblioteca de modelos de documentos.
* Criação de documentos a partir de modelos.
* Substituição de placeholders.
* Renderização HTML dos documentos.
* Geração de PDF.
* Download de PDF.
* Link público de aceite.
* Registro de aceite.
* Histórico por paciente.
* Captura de leads da landing do kit gratuito.
* Página de obrigado conectada ao funil.
* Integração futura com e-mail, WhatsApp e n8n.
* Controle de planos e limites básicos.
* Segurança e permissões.

---

# 4. Entidades principais

## 4.1 User

Representa o usuário do sistema, normalmente uma psicóloga, psicólogo ou administrador de clínica.

### Campos mínimos

```ts
User {
  id: string
  name: string
  email: string
  passwordHash: string
  role: "PROFESSIONAL" | "CLINIC_ADMIN" | "ADMIN"
  plan: "FREE" | "ESSENTIAL" | "PRO" | "CLINIC"
  createdAt: Date
  updatedAt: Date
}
```

### Regras

* O e-mail deve ser único.
* A senha deve ser armazenada com hash.
* Nunca retornar `passwordHash` em APIs públicas.
* Usuários comuns só podem acessar seus próprios dados.

---

## 4.2 ProfessionalProfile

Representa os dados profissionais usados nos documentos.

### Campos mínimos

```ts
ProfessionalProfile {
  id: string
  userId: string

  fullName: string
  displayName?: string
  crp: string
  professionalEmail?: string
  phone?: string
  documentNumber?: string

  clinicName?: string
  city?: string
  state?: string
  address?: string
  website?: string
  instagram?: string

  logoUrl?: string
  signatureUrl?: string

  documentPrimaryColor: string
  documentSecondaryColor: string
  documentFooterText?: string

  showGeneratedBy: boolean
  showDocumentCode: boolean
  showIssuedAt: boolean
  showPageNumber: boolean
  showQrCode: boolean

  createdAt: Date
  updatedAt: Date
}
```

### Regras

* Cada usuário deve ter no máximo um perfil profissional principal.
* Se não houver logo, o frontend/backend deve permitir uso de monograma.
* As cores devem ter fallback:

  * `#8B5CF6` para primária.
  * `#111111` para secundária.
* O perfil profissional deve ser usado para montar cabeçalho e rodapé dos documentos.

---

## 4.3 Patient

Representa o paciente cadastrado pelo usuário.

### Campos mínimos

```ts
Patient {
  id: string
  userId: string

  fullName: string
  cpf?: string
  birthDate?: Date
  email?: string
  phone?: string

  serviceType?: "ONLINE" | "PRESENTIAL" | "HYBRID"
  notes?: string

  legalGuardianName?: string
  legalGuardianCpf?: string
  legalGuardianRelationship?: string

  createdAt: Date
  updatedAt: Date
}
```

### Regras

* Um paciente pertence a um usuário.
* Um usuário não pode acessar pacientes de outro usuário.
* Pacientes podem ter documentos vinculados.
* Se o paciente for menor de idade, campos de responsável legal devem ser aceitos.

---

## 4.4 DocumentTemplate

Representa os modelos disponíveis no sistema.

### Campos mínimos

```ts
DocumentTemplate {
  id: string
  name: string
  slug: string
  description: string
  type: "CONTRACT" | "TERM" | "AUTHORIZATION" | "DECLARATION" | "RECEIPT" | "GUIDE" | "CHECKLIST"
  category: string

  contentHtml: string
  fieldsSchema: Json
  structure: Json
  usageNotes?: string

  isActive: boolean

  createdAt: Date
  updatedAt: Date
}
```

### Modelos obrigatórios

O seed inicial deve conter:

```txt
1. Contrato Terapêutico
2. Termo de Consentimento Livre e Informado
3. Termo de Atendimento Psicológico Online
4. Autorização para Atendimento de Menor de Idade
5. Declaração de Comparecimento
6. Recibo de Pagamento
```

Opcionalmente, também pode conter:

```txt
7. Checklist Documental
8. Guia de Organização por Paciente
```

### Regras

* `slug` deve ser único.
* `contentHtml` deve conter HTML estruturado.
* `fieldsSchema` deve orientar quais campos o frontend precisa exibir.
* Modelos inativos não devem aparecer para criação de documentos.
* A visualização de modelos deve usar dados mockados.

---

## 4.5 Document

Representa um documento gerado por um usuário para um paciente.

### Campos mínimos

```ts
Document {
  id: string
  userId: string
  patientId: string
  templateId: string

  title: string
  type: string
  status: "DRAFT" | "GENERATED" | "SENT" | "WAITING_ACCEPTANCE" | "ACCEPTED" | "REVOKED"

  formData: Json
  renderedContentHtml: string

  publicToken: string
  pdfUrl?: string

  professionalSnapshot: Json
  patientSnapshot: Json

  acceptedAt?: Date
  revokedAt?: Date

  createdAt: Date
  updatedAt: Date
}
```

### Regras

* Cada documento pertence a um usuário.
* Cada documento deve estar vinculado a um paciente.
* Cada documento deve ter um `publicToken` seguro e único.
* O documento deve salvar snapshot do perfil profissional e do paciente no momento da geração.
* O snapshot evita que documentos antigos mudem se o usuário alterar dados depois.
* Documentos revogados não devem permitir novo aceite.
* Documentos aceitos devem exibir selo/registro de aceite.

---

## 4.6 DocumentAcceptance

Representa o aceite público de um documento.

### Campos mínimos

```ts
DocumentAcceptance {
  id: string
  documentId: string

  acceptedName: string
  acceptedCpf?: string
  acceptedEmail?: string

  acceptedAt: Date
  ipAddress?: string
  userAgent?: string

  createdAt: Date
}
```

### Regras

* Um documento pode ter um aceite principal.
* Se o documento já estiver aceito, evitar duplicidade ou registrar nova tentativa conforme regra definida.
* Ao aceitar:

  * criar `DocumentAcceptance`;
  * atualizar `Document.status` para `ACCEPTED`;
  * preencher `Document.acceptedAt`.
* Aceite público não exige login.
* A rota pública deve validar apenas pelo token.

---

## 4.7 Lead

Representa interessados capturados pelo funil do Kit Documental.

### Campos mínimos

```ts
Lead {
  id: string

  name: string
  email: string
  phone?: string

  source?: "INSTAGRAM" | "TIKTOK" | "REFERRAL" | "OTHER"
  professionStage?: "NOT_ATTENDING" | "UP_TO_10_PATIENTS" | "MORE_THAN_10_PATIENTS" | "CLINIC_TEAM"
  mainPain?: "CONTRACT" | "CONSENT_TERM" | "RECEIPT" | "DECLARATION" | "PATIENT_ORGANIZATION" | "OTHER"

  consent: boolean
  downloadedKit: boolean

  createdAt: Date
  updatedAt: Date
}
```

### Regras

* E-mail pode ser único.
* Se o mesmo e-mail enviar novamente, atualizar dados.
* Só enviar comunicações se `consent = true`.
* Inicialmente, backend pode apenas salvar lead e retornar sucesso.

---

## 4.8 LeadEvent

Representa eventos simples do funil.

```ts
LeadEvent {
  id: string
  leadId?: string

  event: string
  source?: string
  metadata?: Json

  createdAt: Date
}
```

### Eventos esperados

```txt
kit_page_view
kit_form_submit
kit_thank_you_view
clicked_download_kit
clicked_create_account
clicked_main_landing
clicked_whatsapp
account_created
checkout_started
payment_completed
```

---

# 5. Funcionalidades obrigatórias

## 5.1 Autenticação

### Rotas esperadas

```txt
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### Cadastro

Entrada:

```json
{
  "name": "Ana Lima",
  "email": "ana@email.com",
  "password": "123456"
}
```

Regras:

* Validar nome, e-mail e senha.
* E-mail deve ser único.
* Senha deve ter hash.
* Criar usuário.
* Criar perfil profissional vazio ou inicial.
* Retornar sessão/token.

### Login

Entrada:

```json
{
  "email": "ana@email.com",
  "password": "123456"
}
```

Regras:

* Validar credenciais.
* Retornar token/sessão.
* Não retornar senha.

### Sessão

`GET /api/auth/me` deve retornar:

```json
{
  "id": "user_id",
  "name": "Ana Lima",
  "email": "ana@email.com",
  "role": "PROFESSIONAL",
  "plan": "PRO"
}
```

---

# 6. Perfil profissional

## Rotas esperadas

```txt
GET  /api/professional-profile
PUT  /api/professional-profile
POST /api/uploads/logo
POST /api/uploads/signature
DELETE /api/uploads/logo
DELETE /api/uploads/signature
```

## Regras

* Apenas usuário autenticado.
* Atualizar dados profissionais.
* Upload deve aceitar:

  * PNG
  * JPG
  * JPEG
  * WEBP
* Limite sugerido:

  * 2MB por imagem.
* Retornar URL pública/privada segura.
* Validar tipo e tamanho.
* Se não houver logo, frontend usa monograma.

---

# 7. Pacientes

## Rotas esperadas

```txt
GET    /api/patients
POST   /api/patients
GET    /api/patients/:id
PUT    /api/patients/:id
DELETE /api/patients/:id
GET    /api/patients/:id/documents
```

## Listagem

Deve permitir filtros:

```txt
search
serviceType
createdAt
```

## Criação

Entrada exemplo:

```json
{
  "fullName": "Mariana Souza",
  "cpf": "123.456.789-00",
  "birthDate": "1990-05-15",
  "email": "mariana@email.com",
  "phone": "(11) 99999-0000",
  "serviceType": "ONLINE"
}
```

## Regras

* Paciente pertence ao usuário autenticado.
* Validar campos.
* Não permitir acesso cruzado entre usuários.
* Exclusão deve ser bloqueada ou confirmada se houver documentos vinculados.

---

# 8. Modelos de documentos

## Rotas esperadas

```txt
GET /api/templates
GET /api/templates/:slug
GET /api/templates/:id/preview
```

## Listagem

Deve retornar:

```json
[
  {
    "id": "template_id",
    "name": "Contrato Terapêutico",
    "slug": "contrato-terapeutico",
    "description": "Modelo para formalizar combinados da prática clínica.",
    "type": "CONTRACT",
    "category": "Contrato",
    "isActive": true
  }
]
```

## Preview

O preview deve:

* Buscar `contentHtml`;
* Usar dados mockados;
* Substituir placeholders;
* Retornar HTML renderizado ou payload suficiente para o frontend renderizar.

---

# 9. Criação de documentos

## Rotas esperadas

```txt
GET    /api/documents
POST   /api/documents
GET    /api/documents/:id
PUT    /api/documents/:id
DELETE /api/documents/:id
POST   /api/documents/:id/revoke
GET    /api/documents/:id/pdf
```

## Fluxo de criação

Entrada exemplo:

```json
{
  "patientId": "patient_id",
  "templateId": "template_id",
  "formData": {
    "session": {
      "value": "R$ 180,00",
      "duration": "50 minutos",
      "modality": "Online",
      "frequency": "Semanal"
    },
    "payment": {
      "method": "Pix"
    },
    "cancellation": {
      "minimumNotice": "24 horas",
      "policy": "Faltas sem aviso prévio poderão ser cobradas integralmente."
    }
  }
}
```

Ao criar documento, o backend deve:

1. Validar usuário autenticado.
2. Validar se paciente pertence ao usuário.
3. Validar se template existe e está ativo.
4. Buscar perfil profissional.
5. Criar snapshot do profissional.
6. Criar snapshot do paciente.
7. Substituir placeholders no HTML.
8. Salvar `renderedContentHtml`.
9. Gerar `publicToken` seguro.
10. Salvar documento.
11. Retornar documento criado.

---

# 10. Substituição de placeholders

## Função esperada

O backend deve ter uma função para renderizar templates.

Exemplo conceitual:

```ts
renderTemplate(contentHtml, data)
```

## Placeholders esperados

```txt
{{professional.fullName}}
{{professional.displayName}}
{{professional.crp}}
{{professional.professionalEmail}}
{{professional.phone}}
{{professional.city}}
{{professional.state}}
{{professional.clinicName}}

{{patient.fullName}}
{{patient.cpf}}
{{patient.birthDate}}
{{patient.email}}
{{patient.phone}}
{{patient.legalGuardianName}}
{{patient.legalGuardianCpf}}

{{session.value}}
{{session.duration}}
{{session.modality}}
{{session.frequency}}

{{payment.amount}}
{{payment.amountInWords}}
{{payment.method}}
{{payment.date}}
{{payment.reference}}

{{cancellation.minimumNotice}}
{{cancellation.policy}}

{{online.platform}}
{{online.backupChannel}}
{{online.emergencyGuidance}}

{{document.issueDate}}
{{document.createdAt}}
{{document.id}}
```

## Regras

* Não deixar placeholders visíveis no documento final.
* Se valor não existir, usar string vazia ou fallback amigável.
* Sanitizar conteúdo para evitar HTML malicioso.
* Nunca permitir scripts no HTML do documento.
* Manter tags permitidas:

  * `section`
  * `h1`
  * `h2`
  * `h3`
  * `p`
  * `strong`
  * `em`
  * `ul`
  * `ol`
  * `li`
  * `div`
  * `span`
  * `br`

---

# 11. Geração de PDF

## Rota

```txt
GET /api/documents/:id/pdf
```

## Regras

* Usuário precisa estar autenticado.
* Documento precisa pertencer ao usuário.
* Backend deve montar HTML completo com:

  * CSS embutido;
  * cabeçalho;
  * conteúdo;
  * assinaturas;
  * rodapé;
  * selo de aceite, quando aceito.
* Retornar PDF A4.

## Headers esperados

```txt
Content-Type: application/pdf
Content-Disposition: attachment; filename="contrato-terapeutico-mariana-souza-2026-05-02.pdf"
```

## Nome do arquivo

Formato:

```txt
{tipo-documento}-{nome-paciente}-{data}.pdf
```

Exemplo:

```txt
contrato-terapeutico-mariana-souza-2026-05-02.pdf
```

## Requisitos

* PDF não pode sair em branco.
* PDF deve preservar layout visual.
* PDF deve usar identidade do profissional.
* PDF deve ser A4.
* Deve funcionar no ambiente de deploy escolhido.

## Implementação sugerida

Pode usar:

* Puppeteer;
* Playwright Chromium;
* outro motor HTML-to-PDF confiável.

Fallback aceitável:

* retornar HTML imprimível e permitir `window.print()` no frontend, caso PDF server-side não funcione no ambiente inicial.

---

# 12. Link público de aceite

## Rotas esperadas

```txt
GET  /api/public/documents/:token
POST /api/public/documents/:token/accept
GET  /api/public/documents/:token/pdf
```

## GET público

Deve retornar documento pelo token, com dados necessários para visualização.

Regras:

* Não exige login.
* Só retorna o documento vinculado ao token.
* Se token inválido, retornar 404.
* Se documento revogado, retornar status revogado.
* Não expor dados internos do usuário.

## POST aceite

Entrada:

```json
{
  "acceptedName": "Mariana Souza",
  "acceptedCpf": "123.456.789-00",
  "acceptedEmail": "mariana@email.com"
}
```

Ao aceitar:

1. Validar token.
2. Validar documento não revogado.
3. Criar registro em `DocumentAcceptance`.
4. Atualizar `Document.status = ACCEPTED`.
5. Atualizar `Document.acceptedAt`.
6. Salvar IP e User-Agent, se possível.
7. Retornar sucesso.

---

# 13. Funil do Kit Documental

## Rotas esperadas

```txt
POST /api/leads
POST /api/lead-events
```

## POST /api/leads

Entrada:

```json
{
  "name": "Mariana",
  "email": "mariana@email.com",
  "phone": "(88) 99999-0000",
  "source": "INSTAGRAM",
  "professionStage": "UP_TO_10_PATIENTS",
  "mainPain": "CONTRACT",
  "consent": true
}
```

Regras:

* Validar nome, e-mail e consentimento.
* Salvar lead.
* Se e-mail já existir, atualizar dados.
* Registrar evento `kit_form_submit`.
* Retornar sucesso.

## Integrações futuras

O backend deve estar preparado para futuramente disparar:

* e-mail via Resend/Brevo;
* webhook para n8n;
* WhatsApp;
* eventos de analytics.

Mas no primeiro momento pode apenas salvar o lead.

---

# 14. Planos e limites

## Planos

```txt
FREE
ESSENTIAL
PRO
CLINIC
```

## Limites sugeridos

### FREE ou Trial

```txt
3 documentos/mês
5 pacientes
sem logo personalizada
sem aceite digital
```

### ESSENTIAL

```txt
20 documentos/mês
30 pacientes
modelos essenciais
PDF profissional
cabeçalho simples
```

### PRO

```txt
documentos ilimitados
pacientes ilimitados
todos os modelos
logo personalizada
histórico por paciente
aceite simples por link
```

### CLINIC

```txt
até 3 profissionais
tudo do Pro
gestão por profissional
identidade da clínica
```

## Backend deve controlar

* Limite de documentos por mês.
* Limite de pacientes.
* Acesso ao aceite digital.
* Acesso ao upload de logo.
* Acesso a múltiplos profissionais, se implementado.

---

# 15. Segurança

## Requisitos obrigatórios

* Senhas com hash.
* Sessões seguras.
* APIs privadas exigem autenticação.
* Usuário não acessa dados de outro usuário.
* Tokens públicos devem ser aleatórios e difíceis de adivinhar.
* Uploads devem validar tipo e tamanho.
* HTML de documentos deve ser sanitizado.
* Não expor dados sensíveis desnecessários.
* Rate limit em rotas públicas sensíveis.
* Logs não devem salvar senhas ou dados sensíveis completos.

## Rotas que exigem autenticação

```txt
/api/professional-profile
/api/patients
/api/templates
/api/documents
/api/documents/:id/pdf
```

## Rotas públicas

```txt
/api/public/documents/:token
/api/public/documents/:token/accept
/api/public/documents/:token/pdf
/api/leads
/api/lead-events
```

---

# 16. Estados e erros esperados

## Respostas comuns

### 400 — Validação

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Campos obrigatórios não preenchidos.",
  "fields": {
    "email": "E-mail inválido."
  }
}
```

### 401 — Não autenticado

```json
{
  "error": "UNAUTHORIZED",
  "message": "Você precisa estar autenticado."
}
```

### 403 — Sem permissão

```json
{
  "error": "FORBIDDEN",
  "message": "Você não tem permissão para acessar este recurso."
}
```

### 404 — Não encontrado

```json
{
  "error": "NOT_FOUND",
  "message": "Recurso não encontrado."
}
```

### 409 — Conflito

```json
{
  "error": "CONFLICT",
  "message": "Este e-mail já está em uso."
}
```

### 500 — Erro interno

```json
{
  "error": "INTERNAL_SERVER_ERROR",
  "message": "Ocorreu um erro inesperado."
}
```

---

# 17. Seed obrigatório

O backend deve ter seed com:

## Usuário demo

```txt
Nome: Ana Lima
E-mail: demo@docuspsi.com
Senha: 123456
Plano: PRO
```

## Perfil demo

```txt
Nome: Ana Lima
CRP: 06/123456
Clínica: Consultório Ana Lima
E-mail: demo@docuspsi.com
Telefone: (11) 99999-0000
Cidade/UF: São Paulo/SP
Cor principal: #8B5CF6
```

## Pacientes demo

```txt
Mariana Souza
João Pereira
Carla Souza
```

## Modelos demo

```txt
Contrato Terapêutico
Termo de Consentimento
Termo de Atendimento Online
Autorização para Menor
Declaração de Comparecimento
Recibo de Pagamento
```

## Documentos demo

Pelo menos:

```txt
1 contrato terapêutico gerado
1 declaração de comparecimento
1 recibo de pagamento
1 documento com status aceito
```

---

# 18. Critérios de aceite do backend

O backend só será considerado completo se cumprir os pontos abaixo.

## Autenticação

* Usuário consegue criar conta.
* Usuário consegue logar.
* Usuário consegue sair.
* `GET /api/auth/me` retorna usuário autenticado.
* Senha é salva com hash.
* Rotas privadas bloqueiam usuário sem sessão.

## Perfil profissional

* Usuário consegue cadastrar/editar dados profissionais.
* Logo pode ser enviada.
* Dados profissionais aparecem nos documentos.
* Cores e rodapé são salvos.

## Pacientes

* Usuário consegue criar paciente.
* Usuário consegue listar pacientes.
* Usuário consegue editar paciente.
* Usuário consegue ver detalhes do paciente.
* Usuário consegue ver documentos do paciente.
* Usuário não acessa pacientes de outro usuário.

## Modelos

* Sistema possui 6 modelos obrigatórios.
* Modelos têm `contentHtml`.
* Modelos têm `fieldsSchema`.
* Modelos podem ser listados.
* Modelos podem ser visualizados.

## Documentos

* Usuário consegue criar documento a partir de modelo.
* Placeholders são substituídos.
* Documento salva `formData`.
* Documento salva `renderedContentHtml`.
* Documento salva snapshot profissional.
* Documento salva snapshot do paciente.
* Documento gera `publicToken`.
* Documento aparece na lista geral.
* Documento aparece no histórico do paciente.

## PDF

* Usuário consegue baixar PDF.
* PDF não sai em branco.
* PDF usa cabeçalho e rodapé.
* PDF usa conteúdo real do documento.
* PDF tem layout A4.
* PDF aceito mostra selo/registro de aceite.

## Aceite

* Link público abre sem login.
* Token inválido retorna erro.
* Documento revogado não permite aceite.
* Paciente consegue aceitar.
* Sistema registra nome, data, IP e User-Agent quando possível.
* Status muda para `ACCEPTED`.

## Leads

* Formulário do kit consegue enviar dados para backend.
* Lead é salvo.
* Lead duplicado por e-mail é atualizado.
* Evento `kit_form_submit` é registrado.

## Segurança

* Usuário não acessa dados de outro usuário.
* Uploads são validados.
* HTML é sanitizado.
* Tokens são seguros.
* Erros são tratados de forma padronizada.

---

# 19. Fora do escopo inicial

Não precisa implementar no MVP inicial:

* Assinatura digital avançada.
* Certificado digital ICP-Brasil.
* Integração real com WhatsApp.
* Integração real com n8n.
* Integração real com Brevo/Resend.
* Pagamento recorrente completo.
* Gestão avançada de clínicas.
* Permissões complexas por equipe.
* Laudos psicológicos automáticos.
* Diagnósticos automáticos.
* Prontuário clínico completo.

---

# 20. Riscos e cuidados

## Risco: promessa jurídica indevida

Evitar textos como:

```txt
validade jurídica garantida
documento 100% conforme
documento obrigatório
substitui orientação profissional
```

## Correto

Usar sempre:

```txt
modelo editável
apoio administrativo
revise antes de emitir
responsabilidade final da(o) profissional
```

---

# 21. Roadmap sugerido de implementação

## Fase 1 — Base

* Auth
* User
* ProfessionalProfile
* Patient
* Seed
* Templates

## Fase 2 — Documentos

* Document creation
* Placeholder rendering
* Document preview payload
* Document list/detail
* Patient history

## Fase 3 — PDF

* HTML completo
* CSS embutido
* PDF A4
* Download

## Fase 4 — Aceite

* Token público
* Página pública
* Registro de aceite
* Selo de aceite

## Fase 5 — Funil

* Lead
* LeadEvent
* Kit form
* Thank you tracking

## Fase 6 — Planos

* Plan field
* Limits
* Trial
* Checkout futuro

---

# 22. Resumo final

O backend do **DocusPsi** estará completo quando permitir:

```txt
Criar conta
Configurar perfil profissional
Cadastrar pacientes
Listar modelos
Criar documento
Renderizar conteúdo
Gerar PDF
Compartilhar link público
Registrar aceite
Salvar histórico por paciente
Capturar leads do kit
Controlar permissões e segurança
```

O foco do MVP deve ser:

> transformar modelos editáveis em documentos profissionais em PDF, organizados por paciente, com aceite simples por link e experiência confiável para psicólogas(os).
