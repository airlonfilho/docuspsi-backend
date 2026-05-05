import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { db, professionalProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateProfileBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const [profile] = await db.select().from(professionalProfilesTable).where(eq(professionalProfilesTable.userId, req.userId!)).limit(1);
    if (!profile) {
      res.status(404).json({ error: "NotFound", message: "Perfil não encontrado" });
      return;
    }
    res.json(profile);
  } catch (err) {
    req.log.error(err, "Get profile error");
    res.status(500).json({ error: "InternalError", message: "Erro ao buscar perfil" });
  }
});

router.post("/", async (req, res) => {
  const parsed = CreateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "ValidationError", message: parsed.error.message });
    return;
  }

  try {
    const existing = await db.select().from(professionalProfilesTable).where(eq(professionalProfilesTable.userId, req.userId!)).limit(1);
    if (existing.length > 0) {
      // Update existing
      const [updated] = await db.update(professionalProfilesTable)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(professionalProfilesTable.userId, req.userId!))
        .returning();
      res.status(201).json(updated);
      return;
    }

    const now = new Date();
    const [profile] = await db.insert(professionalProfilesTable).values({
      id: uuidv4(),
      userId: req.userId!,
      ...parsed.data,
      createdAt: now,
      updatedAt: now,
    }).returning();

    res.status(201).json(profile);
  } catch (err) {
    req.log.error(err, "Create profile error");
    res.status(500).json({ error: "InternalError", message: "Erro ao criar perfil" });
  }
});

router.put("/", async (req, res) => {
  const parsed = CreateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "ValidationError", message: parsed.error.message });
    return;
  }

  try {
    const existing = await db.select().from(professionalProfilesTable).where(eq(professionalProfilesTable.userId, req.userId!)).limit(1);
    if (existing.length === 0) {
      const now = new Date();
      const [profile] = await db.insert(professionalProfilesTable).values({
        id: uuidv4(),
        userId: req.userId!,
        ...parsed.data,
        createdAt: now,
        updatedAt: now,
      }).returning();
      res.json(profile);
      return;
    }

    const [updated] = await db.update(professionalProfilesTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(professionalProfilesTable.userId, req.userId!))
      .returning();

    res.json(updated);
  } catch (err) {
    req.log.error(err, "Update profile error");
    res.status(500).json({ error: "InternalError", message: "Erro ao atualizar perfil" });
  }
});

export default router;
