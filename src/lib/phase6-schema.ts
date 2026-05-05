import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { BILLING_PLANS } from "./billing-plans.js";
import { logger } from "./logger.js";

export async function initializePhase6Schema() {
  logger.info("Initializing billing schema...");

  await db.execute(sql`ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS category text`);
  await db.execute(sql`ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS content_html text NOT NULL DEFAULT ''`);
  await db.execute(sql`ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS usage_notes text`);
  await db.execute(sql`ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS fields_schema jsonb NOT NULL DEFAULT '{"fields":[]}'::jsonb`);
  await db.execute(sql`ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS structure jsonb NOT NULL DEFAULT '{"sections":[]}'::jsonb`);
  await db.execute(sql`ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS modality text`);
  await db.execute(sql`ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS audience text`);
  await db.execute(sql`ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS use_case text`);
  await db.execute(sql`ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]'::jsonb`);
  await db.execute(sql`ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true`);

  await db.execute(sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS public_token text`);
  await db.execute(sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS accepted_at timestamptz`);
  await db.execute(sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS seal_image_url text`);
  await db.execute(sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS acceptance_count integer NOT NULL DEFAULT 0`);
  await db.execute(sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS professional_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb`);
  await db.execute(sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS patient_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb`);
  await db.execute(sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS rendered_content text`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS documents_public_token_unique ON documents (public_token)`);

  await db.execute(sql`ALTER TABLE patients ADD COLUMN IF NOT EXISTS name text`);
  await db.execute(sql`ALTER TABLE patients ADD COLUMN IF NOT EXISTS email text`);
  await db.execute(sql`ALTER TABLE patients ADD COLUMN IF NOT EXISTS phone text`);
  await db.execute(sql`ALTER TABLE patients ADD COLUMN IF NOT EXISTS birth_date text`);
  await db.execute(sql`ALTER TABLE patients ADD COLUMN IF NOT EXISTS cpf text`);
  await db.execute(sql`ALTER TABLE patients ADD COLUMN IF NOT EXISTS address text`);
  await db.execute(sql`ALTER TABLE patients ADD COLUMN IF NOT EXISTS city text`);
  await db.execute(sql`ALTER TABLE patients ADD COLUMN IF NOT EXISTS state text`);
  await db.execute(sql`ALTER TABLE patients ADD COLUMN IF NOT EXISTS service_type patient_service_type NOT NULL DEFAULT 'presencial'`);
  await db.execute(sql`ALTER TABLE patients ALTER COLUMN name DROP NOT NULL`);
  await db.execute(sql`ALTER TABLE patients ALTER COLUMN email DROP NOT NULL`);
  await db.execute(sql`ALTER TABLE patients ALTER COLUMN phone DROP NOT NULL`);
  await db.execute(sql`ALTER TABLE patients ALTER COLUMN birth_date DROP NOT NULL`);
  await db.execute(sql`ALTER TABLE patients ALTER COLUMN cpf DROP NOT NULL`);
  await db.execute(sql`ALTER TABLE patients ALTER COLUMN address DROP NOT NULL`);
  await db.execute(sql`ALTER TABLE patients ALTER COLUMN city DROP NOT NULL`);
  await db.execute(sql`ALTER TABLE patients ALTER COLUMN state DROP NOT NULL`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS document_acceptances (
      id text PRIMARY KEY,
      document_id text NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      accepted_name text NOT NULL,
      accepted_cpf text,
      accepted_email text,
      accepted_at timestamptz NOT NULL,
      ip_address text,
      user_agent text,
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`ALTER TABLE document_acceptances ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS leads (
      id text PRIMARY KEY,
      name text NOT NULL,
      email text NOT NULL UNIQUE,
      phone text,
      source text,
      profession_stage text,
      main_pain text,
      consent boolean NOT NULL DEFAULT false,
      downloaded_kit boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS lead_events (
      id text PRIMARY KEY,
      lead_id text REFERENCES leads(id) ON DELETE CASCADE,
      event text NOT NULL,
      source text,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS plans (
      id text PRIMARY KEY,
      key text NOT NULL UNIQUE,
      name text NOT NULL,
      description text,
      price_monthly integer NOT NULL,
      price_yearly integer,
      stripe_monthly_price_id text,
      stripe_yearly_price_id text,
      documents_limit integer NOT NULL,
      patients_limit integer NOT NULL,
      acceptance_enabled boolean NOT NULL DEFAULT false,
      custom_logo_enabled boolean NOT NULL DEFAULT false,
      professionals_limit integer,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id text PRIMARY KEY,
      user_id text NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      plan_key text NOT NULL,
      status text NOT NULL DEFAULT 'TRIALING',
      stripe_customer_id text,
      stripe_subscription_id text UNIQUE,
      stripe_price_id text,
      current_period_start timestamptz,
      current_period_end timestamptz,
      cancel_at_period_end boolean NOT NULL DEFAULT false,
      trial_ends_at timestamptz,
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS stripe_events (
      id text PRIMARY KEY,
      stripe_event_id text NOT NULL UNIQUE,
      type text NOT NULL,
      processed boolean NOT NULL DEFAULT false,
      payload jsonb NOT NULL,
      created_at timestamptz NOT NULL,
      processed_at timestamptz
    )
  `);

  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id text`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_id text`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_started_at timestamptz`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'free'`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_payment_at timestamptz`);

  const now = new Date();
  for (const plan of BILLING_PLANS) {
    await db.execute(sql`
      INSERT INTO plans (
        id,
        key,
        name,
        description,
        price_monthly,
        price_yearly,
        stripe_monthly_price_id,
        documents_limit,
        patients_limit,
        acceptance_enabled,
        custom_logo_enabled,
        professionals_limit,
        is_active,
        created_at,
        updated_at
      )
      VALUES (
        ${`plan-${plan.key.toLowerCase()}`},
        ${plan.key},
        ${plan.name},
        ${plan.description},
        ${plan.priceInCents},
        NULL,
        ${plan.stripePriceId},
        ${plan.documentsLimit},
        ${plan.patientsLimit},
        ${plan.featureFlags.acceptanceLink},
        ${plan.featureFlags.customLogo},
        ${plan.professionalsLimit ?? null},
        true,
        ${now},
        ${now}
      )
      ON CONFLICT (key) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        price_monthly = EXCLUDED.price_monthly,
        stripe_monthly_price_id = EXCLUDED.stripe_monthly_price_id,
        documents_limit = EXCLUDED.documents_limit,
        patients_limit = EXCLUDED.patients_limit,
        acceptance_enabled = EXCLUDED.acceptance_enabled,
        custom_logo_enabled = EXCLUDED.custom_logo_enabled,
        professionals_limit = EXCLUDED.professionals_limit,
        is_active = EXCLUDED.is_active,
        updated_at = EXCLUDED.updated_at
    `);
  }
}
