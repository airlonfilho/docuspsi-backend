import { Router, type Request, type Response } from "express";
import { db, documentsTable, patientsTable, professionalProfilesTable, documentAcceptancesTable, leadsTable, leadEventsTable, type DocumentAcceptance } from "@workspace/db";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { AcceptDocumentBody, GetPublicDocumentParams, AcceptDocumentParams } from "@workspace/api-zod";
import { documentAcceptanceRateLimit, leadsCaptureRateLimit } from "../middlewares/rate-limit.js";
import { generateAcceptanceSeal } from "../lib/acceptance-seal.js";
import { sendAcceptanceConfirmationEmail } from "../lib/acceptance-email.js";
import { generatePdf } from "../lib/generate-pdf.js";
import type { AcceptanceInfo } from "../lib/build-document-html.js";
import { createKitZip, kitArchiveFilename, kitFileDefinitions } from "../lib/kit-files.js";

const router = Router();

const sourceValues = ["INSTAGRAM", "TIKTOK", "REFERRAL", "OTHER"] as const;
const professionStageValues = ["NOT_ATTENDING", "UP_TO_10_PATIENTS", "MORE_THAN_10_PATIENTS", "CLINIC_TEAM"] as const;
const mainPainValues = ["CONTRACT", "CONSENT_TERM", "RECEIPT", "DECLARATION", "PATIENT_ORGANIZATION", "OTHER"] as const;
const leadEventTypeValues = [
  "kit_page_view",
  "kit_form_focus",
  "kit_form_submit",
  "kit_download_start",
  "kit_download_complete",
  "clicked_download_kit",
  "email_opened",
  "email_clicked",
] as const;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isOneOf<T extends readonly string[]>(value: string, values: T): value is T[number] {
  return values.includes(value);
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseKitSubmitBody(body: unknown) {
  const data = asRecord(body);
  const name = asText(data.name).trim();
  const email = asText(data.email).trim().toLowerCase();
  const phone = asText(data.phone).trim();
  const source = asText(data.source).trim();
  const professionStage = asText(data.professionStage).trim();
  const mainPain = asText(data.mainPain).trim();
  const consent = data.consent === true;

  if (!name || !email || !source || !professionStage || !mainPain) {
    return { success: false as const, message: "Campos obrigatórios ausentes" };
  }
  if (!isEmail(email)) {
    return { success: false as const, message: "Email inválido" };
  }
  if (!isOneOf(source, sourceValues)) {
    return { success: false as const, message: "Fonte inválida" };
  }
  if (!isOneOf(professionStage, professionStageValues)) {
    return { success: false as const, message: "Estágio profissional inválido" };
  }
  if (!isOneOf(mainPain, mainPainValues)) {
    return { success: false as const, message: "Dor principal inválida" };
  }

  return {
    success: true as const,
    data: { name, email, phone: phone || null, source, professionStage, mainPain, consent },
  };
}

function kitFilesResponse(leadId?: string) {
  return kitFileDefinitions.map((file) => ({
    name: file.name,
    url: leadId ? `/api/public/kit/download?leadId=${encodeURIComponent(leadId)}#${file.filename}` : `/api/public/kit/download#${file.filename}`,
  }));
}

function getClientIp(req: Request): string {
  return (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() || req.ip || req.socket.remoteAddress || "";
}

function parsePublicAcceptanceBody(body: unknown) {
  const data = asRecord(body);
  const patientName = asText(data.patientName || data.acceptedName).trim();
  const patientEmail = asText(data.patientEmail || data.acceptedEmail).trim();
  const acceptedCpf = asText(data.acceptedCpf).trim();

  if (!patientName) {
    return { success: false as const, message: "Nome do paciente é obrigatório" };
  }

  if (patientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patientEmail)) {
    return { success: false as const, message: "Email do paciente inválido" };
  }

  return {
    success: true as const,
    data: {
      patientName,
      patientEmail: patientEmail || null,
      acceptedCpf: acceptedCpf || null,
    },
  };
}

async function getLatestAcceptance(documentId: string) {
  const acceptances = await db.select()
    .from(documentAcceptancesTable)
    .where(eq(documentAcceptancesTable.documentId, documentId));

  return acceptances.sort((a, b) => b.acceptedAt.getTime() - a.acceptedAt.getTime())[0];
}

function toAcceptanceInfo(acceptance: DocumentAcceptance | undefined): AcceptanceInfo | undefined {
  if (!acceptance) return undefined;
  return {
    name: acceptance.acceptedName,
    cpf: acceptance.acceptedCpf || undefined,
    ip: acceptance.ipAddress || undefined,
    date: new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "medium",
      timeZone: "America/Fortaleza",
    }).format(acceptance.acceptedAt),
  };
}

async function acceptDocument(publicToken: string, body: unknown, req: Request, res: Response) {
  const parsed = parsePublicAcceptanceBody(body);
  if (!parsed.success) {
    res.status(400).json({ error: "ValidationError", message: parsed.message });
    return;
  }

  const [doc] = await db.select().from(documentsTable).where(eq(documentsTable.publicToken, publicToken)).limit(1);
  if (!doc) {
    res.status(404).json({ error: "NotFound", message: "Documento não encontrado" });
    return;
  }

  if (doc.status === "aceito") {
    res.status(409).json({ error: "Conflict", message: "Documento já foi aceito" });
    return;
  }

  if (doc.status === "revogado") {
    res.status(410).json({ error: "Gone", message: "Documento foi revogado" });
    return;
  }

  const now = new Date();
  const ipAddress = getClientIp(req);
  const userAgent = req.headers["user-agent"] || "";
  const professionalSnapshot = asRecord(doc.professionalSnapshot);
  const professionalName = asText(professionalSnapshot.fullName);

  await db.insert(documentAcceptancesTable).values({
    id: uuidv4(),
    documentId: doc.id,
    acceptedName: parsed.data.patientName,
    acceptedCpf: parsed.data.acceptedCpf,
    acceptedEmail: parsed.data.patientEmail,
    acceptedAt: now,
    ipAddress,
    userAgent,
    createdAt: now,
  });

  await db.update(documentsTable)
    .set({ status: "aceito", acceptedAt: now, updatedAt: now })
    .where(eq(documentsTable.id, doc.id));

  const sealUrl = await generateAcceptanceSeal({
    documentId: doc.id,
    patientName: parsed.data.patientName,
    patientEmail: parsed.data.patientEmail,
    acceptedAt: now,
    ipAddress,
    professionalName,
  });

  await sendAcceptanceConfirmationEmail({
    patientEmail: parsed.data.patientEmail,
    patientName: parsed.data.patientName,
    documentTitle: doc.title,
    professionalName,
    acceptedAt: now,
    sealUrl,
  });

  res.json({
    message: "Documento aceito com sucesso",
    acceptedAt: now.toISOString(),
    sealUrl,
  });
}

router.get("/kit-form", async (_req, res) => {
  res.json({
    title: "Kit Documental para Psicólogos",
    description: "Receba 9 modelos prontos de documentos para organizar seu atendimento.",
    fields: [
      { name: "name", type: "text", label: "Nome completo", required: true },
      { name: "email", type: "email", label: "Email profissional", required: true },
      { name: "phone", type: "tel", label: "WhatsApp", required: false },
      { name: "source", type: "select", label: "Como conheceu?", options: sourceValues, required: true },
      { name: "professionStage", type: "select", label: "Quantos pacientes você atende?", options: professionStageValues, required: true },
      { name: "mainPain", type: "select", label: "Qual seu maior desafio?", options: mainPainValues, required: true },
      { name: "consent", type: "checkbox", label: "Concordo em receber emails", required: false },
    ],
    ctaText: "Receber Kit Gratuito",
    successMessage: "Obrigado! Seu download ja esta disponivel.",
  });
});

router.post("/kit-form/submit", leadsCaptureRateLimit, async (req, res) => {
  const parsed = parseKitSubmitBody(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "ValidationError", message: parsed.message });
    return;
  }

  try {
    const now = new Date();
    const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.email, parsed.data.email)).limit(1);

    let leadId = existing?.id || uuidv4();
    if (existing) {
      await db.update(leadsTable)
        .set({
          name: parsed.data.name,
          phone: parsed.data.phone,
          source: parsed.data.source,
          professionStage: parsed.data.professionStage,
          mainPain: parsed.data.mainPain,
          consent: parsed.data.consent,
          updatedAt: now,
        })
        .where(eq(leadsTable.id, existing.id));
    } else {
      await db.insert(leadsTable).values({
        id: leadId,
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        source: parsed.data.source,
        professionStage: parsed.data.professionStage,
        mainPain: parsed.data.mainPain,
        consent: parsed.data.consent,
        downloadedKit: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    await db.insert(leadEventsTable).values({
      id: uuidv4(),
      leadId,
      event: "kit_form_submit",
      source: parsed.data.source,
      metadata: {
        phone: parsed.data.phone,
        professionStage: parsed.data.professionStage,
        mainPain: parsed.data.mainPain,
        consent: parsed.data.consent,
        existingLead: Boolean(existing),
      },
      createdAt: now,
    });

    res.status(201).json({
      message: "Lead capturado com sucesso",
      leadId,
      downloadUrl: `/api/public/kit/download?leadId=${encodeURIComponent(leadId)}`,
      kitFiles: kitFilesResponse(leadId),
    });
  } catch (err) {
    req.log.error(err, "Submit kit form error");
    res.status(500).json({ error: "InternalError", message: "Erro ao capturar lead" });
  }
});

router.post("/kit/events", async (req, res) => {
  const body = asRecord(req.body);
  const leadId = asText(body.leadId).trim();
  const eventType = asText(body.eventType || body.event).trim();
  const metadata = asRecord(body.metadata);

  if (!leadId || !eventType) {
    res.status(400).json({ error: "ValidationError", message: "leadId e eventType são obrigatórios" });
    return;
  }
  if (!isOneOf(eventType, leadEventTypeValues)) {
    res.status(400).json({ error: "ValidationError", message: "Tipo de evento inválido" });
    return;
  }

  try {
    const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId)).limit(1);
    if (!lead) {
      res.status(404).json({ error: "NotFound", message: "Lead não encontrado" });
      return;
    }

    await db.insert(leadEventsTable).values({
      id: uuidv4(),
      leadId,
      event: eventType,
      source: lead.source,
      metadata,
      createdAt: new Date(),
    });

    res.json({ message: "Evento registrado" });
  } catch (err) {
    req.log.error(err, "Track kit event error");
    res.status(500).json({ error: "InternalError", message: "Erro ao registrar evento" });
  }
});

router.get("/kit/download", async (req, res) => {
  const leadId = asText(req.query.leadId).trim();
  if (!leadId) {
    res.status(400).json({ error: "ValidationError", message: "leadId é obrigatório" });
    return;
  }

  try {
    const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId)).limit(1);
    if (!lead) {
      res.status(404).json({ error: "NotFound", message: "Lead não encontrado" });
      return;
    }

    const now = new Date();
    await db.update(leadsTable)
      .set({ downloadedKit: true, updatedAt: now })
      .where(eq(leadsTable.id, leadId));

    await db.insert(leadEventsTable).values({
      id: uuidv4(),
      leadId,
      event: "kit_download_start",
      source: lead.source,
      metadata: { userAgent: req.headers["user-agent"] || "", ipAddress: getClientIp(req) },
      createdAt: now,
    });

    const zip = await createKitZip();
    res.once("finish", () => {
      db.insert(leadEventsTable).values({
        id: uuidv4(),
        leadId,
        event: "kit_download_complete",
        source: lead.source,
        metadata: { bytes: zip.length },
        createdAt: new Date(),
      }).catch((err) => req.log.error(err, "Track kit download complete error"));
    });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${kitArchiveFilename}"`);
    res.send(zip);
  } catch (err) {
    req.log.error(err, "Download kit error");
    res.status(500).json({ error: "InternalError", message: "Erro ao baixar kit" });
  }
});

router.get("/documents/:publicToken", async (req, res) => {
  const publicToken = req.params.publicToken?.trim();
  if (!publicToken) {
    res.status(400).json({ error: "ValidationError", message: "Token público é obrigatório" });
    return;
  }

  try {
    const [doc] = await db.select().from(documentsTable).where(eq(documentsTable.publicToken, publicToken)).limit(1);
    if (!doc) {
      res.status(404).json({ error: "NotFound", message: "Documento não encontrado" });
      return;
    }

    if (doc.status === "revogado") {
      res.status(410).json({ error: "Gone", message: "Documento foi revogado" });
      return;
    }

    const professionalSnapshot = asRecord(doc.professionalSnapshot);
    const patientSnapshot = asRecord(doc.patientSnapshot);
    const [profile] = await db.select().from(professionalProfilesTable).where(eq(professionalProfilesTable.userId, doc.userId)).limit(1);
    const acceptances = await db.select()
      .from(documentAcceptancesTable)
      .where(eq(documentAcceptancesTable.documentId, doc.id));

    res.json({
      document: {
        id: doc.id,
        title: doc.title,
        renderedContent: doc.renderedContent || "",
        professionalSnapshot,
        patientSnapshot,
        status: doc.status,
        acceptedAt: doc.acceptedAt,
        acceptanceCount: acceptances.length,
      },
      professional: {
        fullName: profile?.fullName || asText(professionalSnapshot.fullName),
        crp: profile?.crp || asText(professionalSnapshot.crp),
        city: profile?.city || asText(professionalSnapshot.city),
        state: profile?.state || asText(professionalSnapshot.state),
      },
      acceptanceUrl: `/api/public/documents/${publicToken}/accept`,
    });
  } catch (err) {
    req.log.error(err, "Get public document by token error");
    res.status(500).json({ error: "InternalError", message: "Erro ao buscar documento" });
  }
});

router.post("/documents/:publicToken/accept", documentAcceptanceRateLimit, async (req, res) => {
  const publicToken = req.params.publicToken?.trim();
  if (!publicToken) {
    res.status(400).json({ error: "ValidationError", message: "Token público é obrigatório" });
    return;
  }

  try {
    await acceptDocument(publicToken, req.body, req, res);
  } catch (err) {
    req.log.error(err, "Accept public document by token error");
    res.status(500).json({ error: "InternalError", message: "Erro ao aceitar documento" });
  }
});

router.get("/documents/:publicToken/pdf", async (req, res) => {
  const publicToken = req.params.publicToken?.trim();
  if (!publicToken) {
    res.status(400).json({ error: "ValidationError", message: "Token público é obrigatório" });
    return;
  }

  try {
    const [doc] = await db.select().from(documentsTable).where(eq(documentsTable.publicToken, publicToken)).limit(1);
    if (!doc) {
      res.status(404).json({ error: "NotFound", message: "Documento não encontrado" });
      return;
    }

    if (doc.status === "revogado") {
      res.status(410).json({ error: "Gone", message: "Documento foi revogado" });
      return;
    }

    if (!doc.renderedContent) {
      res.status(400).json({ error: "BadRequest", message: "Documento ainda não foi gerado" });
      return;
    }

    const acceptanceInfo = toAcceptanceInfo(await getLatestAcceptance(doc.id));
    const pdf = await generatePdf(JSON.parse(doc.renderedContent), acceptanceInfo);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${doc.title}.pdf"`);
    res.send(pdf);
  } catch (err) {
    req.log.error(err, "Generate public PDF error");
    res.status(500).json({ error: "InternalError", message: "Erro ao gerar PDF" });
  }
});

router.get("/accept/:token", async (req, res) => {
  const params = GetPublicDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ValidationError", message: params.error.message });
    return;
  }

  try {
    const [doc] = await db.select().from(documentsTable).where(eq(documentsTable.publicToken, params.data.token)).limit(1);
    if (!doc) {
      res.status(404).json({ error: "NotFound", message: "Documento não encontrado" });
      return;
    }

    if (doc.status === "revogado") {
      res.status(410).json({ error: "Gone", message: "Documento foi revogado" });
      return;
    }

    const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, doc.patientId)).limit(1);
    const [profile] = await db.select().from(professionalProfilesTable).where(eq(professionalProfilesTable.userId, doc.userId)).limit(1);

    res.json({
      id: doc.id,
      title: doc.title,
      type: doc.type,
      status: doc.status,
      renderedContent: doc.renderedContent || "",
      patientName: patient?.fullName || "Paciente",
      psychologistName: profile?.fullName || "Profissional",
      crp: profile?.crp || "",
      clinicName: profile?.clinicName,
      createdAt: doc.createdAt,
      acceptedAt: doc.acceptedAt,
    });
  } catch (err) {
    req.log.error(err, "Get public document error");
    res.status(500).json({ error: "InternalError", message: "Erro ao buscar documento" });
  }
});

router.post("/accept/:token/submit", documentAcceptanceRateLimit, async (req, res) => {
  const params = AcceptDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ValidationError", message: params.error.message });
    return;
  }

  const parsed = AcceptDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "ValidationError", message: parsed.error.message });
    return;
  }

  try {
    await acceptDocument(params.data.token, parsed.data, req, res);
  } catch (err) {
    req.log.error(err, "Accept document error");
    res.status(500).json({ error: "InternalError", message: "Erro ao aceitar documento" });
  }
});

export default router;
