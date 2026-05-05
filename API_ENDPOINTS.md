# API Endpoints — DocusPsi API

Base URL local: `http://localhost:3333/api`

Observações:
- Rotas autenticadas usam `Authorization: Bearer <token>`.
- Todas as rotas abaixo já incluem o prefixo `/api` implicitamente pela Base URL. Exemplo: `GET /auth/me` chama `http://localhost:3333/api/auth/me`.
- Requests/responses são JSON, exceto downloads de PDF/ZIP.
- Schemas de validação existentes ficam em `@workspace/api-zod`.

## Status Geral

Implementado:
- Health, Auth, Profile, Patients, Templates
- Documents
- Public document acceptance, incluindo endpoints novos e rotas legadas
- Lead capture / kit documental
- Dashboard básico e dashboard de leads
- Upload de logo/assinatura

Falta implementar:
- Fase 6 completa: planos, assinatura atual, upgrade/cancelamento e webhook Stripe
- Persistência de `sealImageUrl` no banco. Hoje o selo de aceite é retornado como `sealUrl`, mas a tabela atual não tem coluna para armazenar URL/base64.
- Tabela/campo `documents.acceptanceCount`. Hoje `acceptanceCount` é calculado no retorno público.

---

## Health

- `GET /healthz`
  - Auth: none
  - Status: implemented
  - Response: `{ "status": "ok" }`

## Auth

- `POST /auth/register`
  - Auth: none
  - Status: implemented
  - Body: `RegisterBody` (`name`, `email`, `password`)
  - Response: `{ user, token }`

- `POST /auth/login`
  - Auth: none
  - Status: implemented
  - Body: `LoginBody` (`email`, `password`)
  - Response: `{ user, token }`

- `POST /auth/logout`
  - Auth: none
  - Status: implemented
  - Response: `{ success: true }`

- `GET /auth/me`
  - Auth: required
  - Status: implemented
  - Response: user object

- `POST /auth/change-password`
  - Auth: required
  - Status: implemented
  - Body: `ChangePasswordBody` (`currentPassword`, `newPassword`)
  - Response: `{ success: true }`

## Profile

All `/profile` endpoints require auth.

- `GET /profile/`
  - Status: implemented
  - Response: professional profile object

- `POST /profile/`
  - Status: implemented
  - Body: `CreateProfileBody`
  - Action: creates or updates profile
  - Response: profile

- `PUT /profile/`
  - Status: implemented
  - Body: `CreateProfileBody`
  - Action: upserts profile
  - Response: profile

## Patients

All `/patients` endpoints require auth.

- `GET /patients/`
  - Status: implemented
  - Query: `search?`, `serviceType?`
  - Response: list of patients

- `POST /patients/`
  - Status: implemented
  - Body: `CreatePatientBody`
  - Response: created patient

- `GET /patients/:patientId`
  - Status: implemented
  - Response: patient

- `PUT /patients/:patientId`
  - Status: implemented
  - Body: `UpdatePatientBody`
  - Response: updated patient

- `DELETE /patients/:patientId`
  - Status: implemented
  - Response: `{ success: true }`

## Templates

All `/templates` endpoints require auth.

- `GET /templates/`
  - Status: implemented
  - Response: list of active templates

- `GET /templates/:slug/preview`
  - Status: implemented
  - Response: preview rendered document

- `GET /templates/:slug`
  - Status: implemented
  - Response: template object

## Documents

All `/documents` endpoints require auth.

- `GET /documents/`
  - Status: implemented
  - Query: `patientId?`, `templateType?`, `status?`
  - Response: list of documents with patient/template relations

- `POST /documents/`
  - Status: implemented
  - Body: `CreateDocumentBody`
  - Response: created document with patient/template relations

- `GET /documents/:documentId/acceptances`
  - Status: implemented
  - Response: `{ documentId, acceptances }`

- `GET /documents/:documentId`
  - Status: implemented
  - Response: document with relations

- `PUT /documents/:documentId`
  - Status: implemented
  - Body: `UpdateDocumentBody`
  - Response: updated document

- `POST /documents/:documentId/generate`
  - Status: implemented
  - Action: renders document, sets status `gerado`, creates `publicToken`
  - Response: updated document

- `POST /documents/:documentId/revoke`
  - Status: implemented
  - Action: sets status `revogado`
  - Response: updated document

- `GET /documents/:documentId/pdf`
  - Status: implemented
  - Response: PDF file
  - Notes: includes acceptance stamp when document has an acceptance record

## Public Document Acceptance

Public routes do not require auth.

- `GET /public/documents/:publicToken`
  - Status: implemented
  - Response:
    ```json
    {
      "document": {
        "id": "doc-id",
        "title": "Contrato Terapêutico",
        "renderedContent": "...",
        "professionalSnapshot": {},
        "patientSnapshot": {},
        "status": "gerado",
        "acceptedAt": null,
        "acceptanceCount": 0
      },
      "professional": {
        "fullName": "Dr. João",
        "crp": "CRP/SP 123456",
        "city": "São Paulo",
        "state": "SP"
      },
      "acceptanceUrl": "/api/public/documents/{publicToken}/accept"
    }
    ```
  - Errors: `404` invalid token, `410` revoked document

- `POST /public/documents/:publicToken/accept`
  - Status: implemented
  - Rate limit: 3 attempts per token/IP per 24h
  - Body:
    ```json
    {
      "patientName": "Mariana Souza",
      "patientEmail": "mariana@exemplo.com"
    }
    ```
  - Also accepts legacy aliases: `acceptedName`, `acceptedEmail`, `acceptedCpf`
  - Response:
    ```json
    {
      "message": "Documento aceito com sucesso",
      "acceptedAt": "2026-05-04T16:28:00.000Z",
      "sealUrl": "data:image/png;base64,..."
    }
    ```
  - Errors: `404`, `409`, `410`, `429`

- `GET /public/documents/:publicToken/pdf`
  - Status: implemented
  - Response: PDF file
  - Notes: includes acceptance stamp when document has an acceptance record

Legacy public acceptance routes still available:
- `GET /public/accept/:token`
- `POST /public/accept/:token/submit`

## Public Kit Funnel

Public routes do not require auth.

- `GET /public/kit-form`
  - Status: implemented
  - Response: form configuration with fields, options, CTA text and success message

- `POST /public/kit-form/submit`
  - Status: implemented
  - Rate limit: 10 submissions per 5 minutes per IP
  - Body:
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
  - Response:
    ```json
    {
      "message": "Lead capturado com sucesso",
      "leadId": "lead-id",
      "downloadUrl": "/api/public/kit/download?leadId=lead-id",
      "kitFiles": []
    }
    ```

- `POST /public/kit/events`
  - Status: implemented
  - Body:
    ```json
    {
      "leadId": "lead-id",
      "eventType": "kit_download_complete",
      "metadata": { "timeSpent": 45 }
    }
    ```
  - Valid `eventType`: `kit_page_view`, `kit_form_focus`, `kit_form_submit`, `kit_download_start`, `kit_download_complete`, `clicked_download_kit`, `email_opened`, `email_clicked`
  - Response: `{ "message": "Evento registrado" }`

- `GET /public/kit/download?leadId=:leadId`
  - Status: implemented
  - Response: ZIP file with 5 PDFs
  - Side effects: marks lead as downloaded and records download events

## Dashboard

All `/dashboard` endpoints require auth.

- `GET /dashboard/stats`
  - Status: implemented
  - Response: document/patient statistics

- `GET /dashboard/recent-documents`
  - Status: implemented
  - Response: latest 10 documents with relations

- `GET /dashboard/leads`
  - Status: implemented
  - Response:
    ```json
    {
      "summary": {
        "totalLeads": 0,
        "downloadedKit": 0,
        "consented": 0,
        "eventCounts": {}
      },
      "leads": []
    }
    ```

## Leads Legacy/Admin

These routes exist separately from the public kit funnel.

- `POST /leads`
  - Auth: none
  - Status: implemented
  - Body: `{ name, email, phone?, source?, professionStage?, mainPain?, consent?, downloadedKit? }`
  - Response: `{ lead }`

- `POST /leads/events`
  - Auth: none
  - Status: implemented
  - Body: `{ leadId?, event, source?, metadata? }`
  - Response: `{ event }`

- `POST /leads/:leadId/mark-downloaded`
  - Auth: none
  - Status: implemented
  - Response: `{ lead }`

## Uploads

- `POST /uploads/logo`
  - Auth: required
  - Status: implemented
  - Body: multipart form-data, field `logo`
  - Response: uploaded logo info

- `POST /uploads/signature`
  - Auth: required
  - Status: implemented
  - Body: multipart form-data, field `signature`
  - Response: uploaded signature info

- `DELETE /uploads/logo`
  - Auth: required
  - Status: implemented
  - Response: success message

- `DELETE /uploads/signature`
  - Auth: required
  - Status: implemented
  - Response: success message

---

## Missing Endpoints For Frontend

Fase 6 is not implemented yet. Frontend should not depend on these routes until backend work is done:

- `GET /plans`
  - Desired response: available plans
  - Status: missing

- `POST /plans/upgrade`
  - Auth: required
  - Desired body: `{ planId, billingCycle, couponCode? }`
  - Desired response: checkout URL or trial-start response
  - Status: missing

- `GET /subscriptions/current`
  - Auth: required
  - Desired response: current subscription and features
  - Status: missing

- `POST /subscriptions/cancel`
  - Auth: required
  - Desired response: cancellation info
  - Status: missing

- `POST /webhooks/stripe`
  - Desired behavior: process Stripe subscription/payment events
  - Status: missing
  - Note: this route may live outside `/api` depending on webhook routing decision.

Missing supporting backend pieces:
- `subscriptions` table
- `plan_features` table
- `stripe_events` table
- `users.subscriptionId`, `users.trialStartedAt`, `users.trialEndsAt`, `users.subscriptionStatus`, `users.lastPaymentAt`
- Improved plan middleware for trial/active/canceled/past_due states

## Frontend Notes

- Use the Base URL with `/api`; do not call bare `/public/...` unless the server mount changes.
- For PDF/ZIP routes, request a binary response and read `Content-Disposition`.
- Public acceptance should use the new `/public/documents/:publicToken` routes. Legacy `/public/accept/:token` routes are only for backward compatibility.
- For kit download, call `POST /public/kit-form/submit` first and use the returned `leadId`.
