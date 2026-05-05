import { Router } from "express";
import { db, documentTemplatesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GetTemplateParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth.js";
import { renderDocument } from "../lib/render-document.js";

const router = Router();

router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const templates = await db.select().from(documentTemplatesTable).where(eq(documentTemplatesTable.isActive, true)).orderBy(documentTemplatesTable.createdAt);
    res.json(templates);
  } catch (err) {
    req.log.error(err, "List templates error");
    res.status(500).json({ error: "InternalError", message: "Erro ao listar modelos" });
  }
});

router.get("/:slug/preview", async (req, res) => {
  const params = GetTemplateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ValidationError", message: params.error.message });
    return;
  }

  try {
    const [template] = await db.select().from(documentTemplatesTable).where(eq(documentTemplatesTable.slug, params.data.slug)).limit(1);
    if (!template) {
      res.status(404).json({ error: "NotFound", message: "Modelo não encontrado" });
      return;
    }

    const preview = renderDocument({
      template,
      patient: {
        id: "preview-patient",
        userId: "preview-user",
        name: "Mariana",
        fullName: "Mariana Souza",
        email: "mariana@exemplo.com",
        phone: "(11) 98888-1111",
        birthDate: "1990-05-15",
        cpf: "123.456.789-00",
        address: "",
        city: "Sao Paulo",
        state: "SP",
        serviceType: "online",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      profile: {
        id: "preview-profile",
        userId: "preview-user",
        fullName: "Dra. Ana Lima",
        crp: "06/123456",
        professionalEmail: "ana@exemplo.com",
        phone: "(11) 99999-0000",
        city: "Sao Paulo",
        state: "SP",
        clinicName: "Consultorio Ana Lima",
        address: "",
        website: "",
        instagram: "",
        logoUrl: null,
        signatureUrl: null,
        documentPrimaryColor: "#2563EB",
        documentSecondaryColor: "#675CF1",
        defaultCity: "Sao Paulo",
        defaultState: "SP",
        defaultFooter: "",
        defaultSessionDuration: 50,
        defaultSessionValue: 180,
        defaultPaymentMethod: "Pix",
        defaultCancellationPolicy: "",
        showGeneratedBy: true,
        showDocumentCode: true,
        showIssuedAt: true,
        showPageNumber: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      formData: {
        sessionValue: 180,
        sessionDuration: 50,
        paymentMethod: "Pix",
        paymentDate: "2026-05-05",
        sessionDate: "2026-05-05",
        modality: "online",
        observations: "Campo editavel para observacoes administrativas.",
      },
      documentId: "preview",
    });
    res.json(preview);
  } catch (err) {
    req.log.error(err, "Template preview error");
    res.status(500).json({ error: "InternalError", message: "Erro ao gerar preview do modelo" });
  }
});

router.get("/:slug", async (req, res) => {
  const params = GetTemplateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ValidationError", message: params.error.message });
    return;
  }

  try {
    const [template] = await db.select().from(documentTemplatesTable).where(eq(documentTemplatesTable.slug, params.data.slug)).limit(1);
    if (!template) {
      res.status(404).json({ error: "NotFound", message: "Modelo não encontrado" });
      return;
    }
    res.json(template);
  } catch (err) {
    req.log.error(err, "Get template error");
    res.status(500).json({ error: "InternalError", message: "Erro ao buscar modelo" });
  }
});

export default router;
