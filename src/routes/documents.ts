import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { db, documentsTable, patientsTable, documentTemplatesTable, professionalProfilesTable, documentAcceptancesTable } from "@workspace/db";
import { eq, and, desc, or, ilike } from "drizzle-orm";
import { CreateDocumentBody, UpdateDocumentBody, GetDocumentParams, ListDocumentsQueryParams, UpdateDocumentParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth.js";
import { requirePlanFeature, validatePlanLimits } from "../middlewares/plan-limits.js";
import { renderDocument } from "../lib/render-document.js";
import { generatePdf } from "../lib/generate-pdf.js";
import type { AcceptanceInfo } from "../lib/build-document-html.js";

const router = Router();

router.use(requireAuth);

/**
 * GET /documents/
 * List documents with optional filters for patientId, type, and status
 */
router.get("/", async (req, res) => {
  try {
    const query = ListDocumentsQueryParams.safeParse(req.query);
    const patientId = query.success ? query.data.patientId : undefined;
    const templateType = query.success ? query.data.templateType : undefined;
    const status = query.success ? query.data.status : undefined;

    let conditions = [eq(documentsTable.userId, req.userId!)];

    if (patientId) {
      conditions.push(eq(documentsTable.patientId, patientId));
    }
    if (templateType) {
      conditions.push(eq(documentsTable.type, templateType));
    }
    if (status) {
      conditions.push(eq(documentsTable.status, status));
    }

    const docs = await db.select().from(documentsTable)
      .where(and(...conditions))
      .orderBy(desc(documentsTable.createdAt));

    // Fetch related data for each document
    const docsWithRelations = await Promise.all(docs.map(async (doc) => {
      const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, doc.patientId)).limit(1);
      const [template] = await db.select().from(documentTemplatesTable).where(eq(documentTemplatesTable.id, doc.templateId)).limit(1);
      return { ...doc, patient, template };
    }));

    res.json(docsWithRelations);
  } catch (err) {
    req.log.error(err, "List documents error");
    res.status(500).json({ error: "InternalError", message: "Erro ao listar documentos" });
  }
});

/**
 * POST /documents/
 * Create a new document
 */
router.post("/", validatePlanLimits, async (req, res) => {
  const parsed = CreateDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "ValidationError", message: parsed.error.message });
    return;
  }

  try {
    // Verify patient belongs to user
    const [patient] = await db.select().from(patientsTable)
      .where(and(eq(patientsTable.id, parsed.data.patientId), eq(patientsTable.userId, req.userId!)))
      .limit(1);

    if (!patient) {
      res.status(404).json({ error: "NotFound", message: "Paciente não encontrado" });
      return;
    }

    // Verify template exists
    const [template] = await db.select().from(documentTemplatesTable)
      .where(eq(documentTemplatesTable.id, parsed.data.templateId))
      .limit(1);

    if (!template) {
      res.status(404).json({ error: "NotFound", message: "Modelo não encontrado" });
      return;
    }

    // Get professional profile for snapshot
    const [profile] = await db.select().from(professionalProfilesTable)
      .where(eq(professionalProfilesTable.userId, req.userId!))
      .limit(1);

    if (!profile) {
      res.status(404).json({ error: "NotFound", message: "Perfil profissional não encontrado" });
      return;
    }

    const now = new Date();
    const documentId = uuidv4();
    const professionalSnapshot = {
      fullName: profile.fullName,
      displayName: (profile as any).displayName || profile.fullName,
      crp: profile.crp,
      professionalEmail: profile.professionalEmail,
      phone: profile.phone,
      city: profile.city,
      state: profile.state,
      clinicName: profile.clinicName,
      documentNumber: documentId,
      logoUrl: profile.logoUrl,
      signatureUrl: profile.signatureUrl,
      documentFooterText: (profile as any).documentFooterText || profile.defaultFooter,
      documentPrimaryColor: profile.documentPrimaryColor,
      documentSecondaryColor: profile.documentSecondaryColor,
      showGeneratedBy: profile.showGeneratedBy,
      showDocumentCode: profile.showDocumentCode,
      showIssuedAt: profile.showIssuedAt,
      showPageNumber: profile.showPageNumber,
      capturedAt: now.toISOString(),
    };
    const patientSnapshot = {
      fullName: patient.fullName,
      email: patient.email,
      phone: patient.phone,
      cpf: patient.cpf,
      birthDate: patient.birthDate,
      capturedAt: now.toISOString(),
    };
    const rendered = renderDocument({
      template,
      patient,
      profile,
      formData: parsed.data.formData || {},
      documentId,
    });

    const [doc] = await db.insert(documentsTable).values({
      id: documentId,
      userId: req.userId!,
      patientId: parsed.data.patientId,
      templateId: parsed.data.templateId,
      title: parsed.data.title,
      type: template.slug,
      status: "gerado",
      formData: parsed.data.formData || {},
      professionalSnapshot,
      patientSnapshot,
      renderedContent: JSON.stringify(rendered),
      createdAt: now,
      updatedAt: now,
    }).returning();

    // Fetch relations
    const docWithRelations = { ...doc, patient, template };
    res.status(201).json(docWithRelations);
  } catch (err) {
    req.log.error(err, "Create document error");
    res.status(500).json({ error: "InternalError", message: "Erro ao criar documento" });
  }
});

function toAcceptanceInfo(acceptance: typeof documentAcceptancesTable.$inferSelect | undefined): AcceptanceInfo | undefined {
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

/**
 * GET /documents/:documentId
 * Get a specific document with relations
 */
router.get("/:documentId/acceptances", async (req, res) => {
  const params = GetDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ValidationError", message: params.error.message });
    return;
  }

  try {
    const [doc] = await db.select().from(documentsTable)
      .where(and(eq(documentsTable.id, params.data.documentId), eq(documentsTable.userId, req.userId!)))
      .limit(1);

    if (!doc) {
      res.status(404).json({ error: "NotFound", message: "Documento não encontrado" });
      return;
    }

    const acceptances = await db.select()
      .from(documentAcceptancesTable)
      .where(eq(documentAcceptancesTable.documentId, doc.id))
      .orderBy(desc(documentAcceptancesTable.acceptedAt));

    res.json({ documentId: doc.id, acceptances });
  } catch (err) {
    req.log.error(err, "List document acceptances error");
    res.status(500).json({ error: "InternalError", message: "Erro ao listar aceites do documento" });
  }
});

router.get("/:documentId", async (req, res) => {
  const params = GetDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ValidationError", message: params.error.message });
    return;
  }

  try {
    const [doc] = await db.select().from(documentsTable)
      .where(and(eq(documentsTable.id, params.data.documentId), eq(documentsTable.userId, req.userId!)))
      .limit(1);

    if (!doc) {
      res.status(404).json({ error: "NotFound", message: "Documento não encontrado" });
      return;
    }

    const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, doc.patientId)).limit(1);
    const [template] = await db.select().from(documentTemplatesTable).where(eq(documentTemplatesTable.id, doc.templateId)).limit(1);

    res.json({ ...doc, patient, template });
  } catch (err) {
    req.log.error(err, "Get document error");
    res.status(500).json({ error: "InternalError", message: "Erro ao buscar documento" });
  }
});

/**
 * PUT /documents/:documentId
 * Update a document
 */
router.put("/:documentId", async (req, res) => {
  const params = UpdateDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ValidationError", message: params.error.message });
    return;
  }

  const parsed = UpdateDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "ValidationError", message: parsed.error.message });
    return;
  }

  try {
    const [doc] = await db.update(documentsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(documentsTable.id, params.data.documentId), eq(documentsTable.userId, req.userId!)))
      .returning();

    if (!doc) {
      res.status(404).json({ error: "NotFound", message: "Documento não encontrado" });
      return;
    }

    const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, doc.patientId)).limit(1);
    const [template] = await db.select().from(documentTemplatesTable).where(eq(documentTemplatesTable.id, doc.templateId)).limit(1);

    res.json({ ...doc, patient, template });
  } catch (err) {
    req.log.error(err, "Update document error");
    res.status(500).json({ error: "InternalError", message: "Erro ao atualizar documento" });
  }
});

/**
 * POST /documents/:documentId/generate
 * Generate the document (render HTML, create public token, set status to "gerado")
 */
router.post("/:documentId/generate", requirePlanFeature("acceptance_link"), async (req, res) => {
  const params = GetDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ValidationError", message: params.error.message });
    return;
  }

  try {
    const [doc] = await db.select().from(documentsTable)
      .where(and(eq(documentsTable.id, params.data.documentId), eq(documentsTable.userId, req.userId!)))
      .limit(1);

    if (!doc) {
      res.status(404).json({ error: "NotFound", message: "Documento não encontrado" });
      return;
    }

    // Fetch template and related data for rendering
    const [template] = await db.select().from(documentTemplatesTable)
      .where(eq(documentTemplatesTable.id, doc.templateId))
      .limit(1);

    const [patient] = await db.select().from(patientsTable)
      .where(eq(patientsTable.id, doc.patientId))
      .limit(1);

    const [profile] = await db.select().from(professionalProfilesTable)
      .where(eq(professionalProfilesTable.userId, req.userId!))
      .limit(1);

    if (!template || !patient || !profile) {
      res.status(404).json({ error: "NotFound", message: "Dados necessários não encontrados" });
      return;
    }

    // Render document
    const rendered = renderDocument({
      template,
      patient,
      profile,
      formData: doc.formData || {},
      documentId: doc.id,
    });

    // Generate public token
    const publicToken = uuidv4();
    const now = new Date();

    const [updatedDoc] = await db.update(documentsTable)
      .set({
        status: "gerado",
        renderedContent: JSON.stringify(rendered),
        publicToken: publicToken,
        updatedAt: now,
      })
      .where(eq(documentsTable.id, doc.id))
      .returning();

    const docWithRelations = { ...updatedDoc, patient, template };
    res.json(docWithRelations);
  } catch (err) {
    req.log.error(err, "Generate document error");
    res.status(500).json({ error: "InternalError", message: "Erro ao gerar documento" });
  }
});

/**
 * POST /documents/:documentId/revoke
 * Revoke a document (set status to "revogado")
 */
router.post("/:documentId/revoke", async (req, res) => {
  const params = GetDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ValidationError", message: params.error.message });
    return;
  }

  try {
    const [doc] = await db.select().from(documentsTable)
      .where(and(eq(documentsTable.id, params.data.documentId), eq(documentsTable.userId, req.userId!)))
      .limit(1);

    if (!doc) {
      res.status(404).json({ error: "NotFound", message: "Documento não encontrado" });
      return;
    }

    const now = new Date();
    const [updatedDoc] = await db.update(documentsTable)
      .set({
        status: "revogado",
        revokedAt: now,
        updatedAt: now,
      })
      .where(eq(documentsTable.id, doc.id))
      .returning();

    const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, doc.patientId)).limit(1);
    const [template] = await db.select().from(documentTemplatesTable).where(eq(documentTemplatesTable.id, doc.templateId)).limit(1);

    res.json({ ...updatedDoc, patient, template });
  } catch (err) {
    req.log.error(err, "Revoke document error");
    res.status(500).json({ error: "InternalError", message: "Erro ao revogar documento" });
  }
});

/**
 * GET /documents/:documentId/pdf
 * Download document as PDF
 */
router.get("/:documentId/pdf", async (req, res) => {
  const params = GetDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ValidationError", message: params.error.message });
    return;
  }

  try {
    const [doc] = await db.select().from(documentsTable)
      .where(and(eq(documentsTable.id, params.data.documentId), eq(documentsTable.userId, req.userId!)))
      .limit(1);

    if (!doc) {
      res.status(404).json({ error: "NotFound", message: "Documento não encontrado" });
      return;
    }

    if (!doc.renderedContent) {
      res.status(400).json({ error: "BadRequest", message: "Documento ainda não foi gerado" });
      return;
    }

    const rendered = JSON.parse(doc.renderedContent);
    const acceptances = await db.select()
      .from(documentAcceptancesTable)
      .where(eq(documentAcceptancesTable.documentId, doc.id))
      .orderBy(desc(documentAcceptancesTable.acceptedAt))
      .limit(1);

    const pdf = await generatePdf(rendered, toAcceptanceInfo(acceptances[0]));

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${doc.title}.pdf"`);
    res.send(pdf);
  } catch (err) {
    req.log.error(err, "Generate PDF error");
    res.status(500).json({ error: "InternalError", message: "Erro ao gerar PDF" });
  }
});

export default router;
