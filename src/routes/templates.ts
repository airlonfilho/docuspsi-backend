import { Router } from "express";
import { db, documentTemplatesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GetTemplateParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth.js";
import { renderDocumentWithMockData } from "../lib/render-document.js";

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
    const preview = renderDocumentWithMockData(params.data.slug);
    if (!preview) {
      res.status(404).json({ error: "NotFound", message: "Preview não disponível para este modelo" });
      return;
    }
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
