import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["professional", "admin"]);
export const userPlanEnum = pgEnum("user_plan", ["free", "starter", "pro"]);
export const patientServiceTypeEnum = pgEnum("patient_service_type", ["presencial", "online", "hibrido"]);
export const documentStatusEnum = pgEnum("document_status", ["rascunho", "gerado", "enviado", "aguardando_aceite", "aceito", "revogado"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
};

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("professional"),
  plan: userPlanEnum("plan").notNull().default("free"),
  ...timestamps,
});

export const professionalProfilesTable = pgTable("professional_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  crp: text("crp").notNull(),
  professionalEmail: text("professional_email"),
  phone: text("phone"),
  city: text("city"),
  state: text("state"),
  clinicName: text("clinic_name"),
  address: text("address"),
  website: text("website"),
  instagram: text("instagram"),
  logoUrl: text("logo_url"),
  signatureUrl: text("signature_url"),
  documentPrimaryColor: text("document_primary_color"),
  documentSecondaryColor: text("document_secondary_color"),
  defaultCity: text("default_city"),
  defaultState: text("default_state"),
  defaultFooter: text("default_footer"),
  defaultSessionDuration: integer("default_session_duration"),
  defaultSessionValue: integer("default_session_value"),
  defaultPaymentMethod: text("default_payment_method"),
  defaultCancellationPolicy: text("default_cancellation_policy"),
  showGeneratedBy: boolean("show_generated_by").default(true),
  showDocumentCode: boolean("show_document_code").default(true),
  showIssuedAt: boolean("show_issued_at").default(true),
  showPageNumber: boolean("show_page_number").default(true),
  ...timestamps,
});

export const patientsTable = pgTable("patients", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name"),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  birthDate: text("birth_date"),
  cpf: text("cpf"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  serviceType: patientServiceTypeEnum("service_type").notNull().default("presencial"),
  ...timestamps,
});

export const documentTemplatesTable = pgTable("document_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  category: text("category"),
  type: text("type").notNull(),
  contentHtml: text("content_html").notNull(),
  fieldsSchema: jsonb("fields_schema").notNull().default({ fields: [] }),
  usageNotes: text("usage_notes"),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const documentsTable = pgTable("documents", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  patientId: text("patient_id").notNull().references(() => patientsTable.id, { onDelete: "restrict" }),
  templateId: text("template_id").notNull().references(() => documentTemplatesTable.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  type: text("type").notNull(),
  status: documentStatusEnum("status").notNull().default("rascunho"),
  formData: jsonb("form_data").notNull().default({}),
  professionalSnapshot: jsonb("professional_snapshot").notNull().default({}),
  patientSnapshot: jsonb("patient_snapshot").notNull().default({}),
  renderedContent: text("rendered_content"),
  publicToken: text("public_token").unique(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "date" }),
  sealImageUrl: text("seal_image_url"),
  acceptanceCount: integer("acceptance_count").notNull().default(0),
  ...timestamps,
});

export const documentAcceptancesTable = pgTable("document_acceptances", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull().references(() => documentsTable.id, { onDelete: "cascade" }),
  acceptedName: text("accepted_name").notNull(),
  acceptedCpf: text("accepted_cpf"),
  acceptedEmail: text("accepted_email"),
  acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "date" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  ...timestamps,
});

export const leadsTable = pgTable("leads", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  source: text("source"),
  professionStage: text("profession_stage"),
  mainPain: text("main_pain"),
  consent: boolean("consent").notNull().default(false),
  downloadedKit: boolean("downloaded_kit").notNull().default(false),
  ...timestamps,
});

export const leadEventsTable = pgTable("lead_events", {
  id: text("id").primaryKey(),
  leadId: text("lead_id").references(() => leadsTable.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  source: text("source"),
  metadata: jsonb("metadata").notNull().default({}),
  ...timestamps,
});

export type User = typeof usersTable.$inferSelect;
export type ProfessionalProfile = typeof professionalProfilesTable.$inferSelect;
export type Patient = typeof patientsTable.$inferSelect;
export type DocumentTemplate = typeof documentTemplatesTable.$inferSelect;
export type Document = typeof documentsTable.$inferSelect;
export type DocumentAcceptance = typeof documentAcceptancesTable.$inferSelect;
export type Lead = typeof leadsTable.$inferSelect;
export type LeadEvent = typeof leadEventsTable.$inferSelect;