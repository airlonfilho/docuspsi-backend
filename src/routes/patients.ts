import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { db, patientsTable } from "@workspace/db";
import { eq, and, ilike, or } from "drizzle-orm";
import { CreatePatientBody, UpdatePatientBody, GetPatientParams, UpdatePatientParams, DeletePatientParams, ListPatientsQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth.js";
import { validatePatientLimit } from "../middlewares/plan-limits.js";

const router = Router();

router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const query = ListPatientsQueryParams.safeParse(req.query);
    const search = query.success ? query.data.search : undefined;
    const serviceType = query.success ? query.data.serviceType : undefined;

    let conditions = [eq(patientsTable.userId, req.userId!)];

    if (serviceType) {
      conditions.push(eq(patientsTable.serviceType, serviceType));
    }

    let patients;
    if (search) {
      patients = await db.select().from(patientsTable).where(
        and(
          eq(patientsTable.userId, req.userId!),
          serviceType ? eq(patientsTable.serviceType, serviceType) : undefined,
          or(
            ilike(patientsTable.fullName, `%${search}%`),
            ilike(patientsTable.email, `%${search}%`),
          )
        )
      ).orderBy(patientsTable.createdAt);
    } else {
      patients = await db.select().from(patientsTable).where(
        and(...conditions)
      ).orderBy(patientsTable.createdAt);
    }

    res.json(patients);
  } catch (err) {
    req.log.error(err, "List patients error");
    res.status(500).json({ error: "InternalError", message: "Erro ao listar pacientes" });
  }
});

router.post("/", validatePatientLimit, async (req, res) => {
  const parsed = CreatePatientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "ValidationError", message: parsed.error.message });
    return;
  }

  try {
    const now = new Date();
    const [patient] = await db.insert(patientsTable).values({
      id: uuidv4(),
      userId: req.userId!,
      ...parsed.data,
      createdAt: now,
      updatedAt: now,
    }).returning();

    res.status(201).json(patient);
  } catch (err) {
    req.log.error(err, "Create patient error");
    res.status(500).json({ error: "InternalError", message: "Erro ao criar paciente" });
  }
});

router.get("/:patientId", async (req, res) => {
  const params = GetPatientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ValidationError", message: params.error.message });
    return;
  }

  try {
    const [patient] = await db.select().from(patientsTable).where(
      and(eq(patientsTable.id, params.data.patientId), eq(patientsTable.userId, req.userId!))
    ).limit(1);

    if (!patient) {
      res.status(404).json({ error: "NotFound", message: "Paciente não encontrado" });
      return;
    }

    res.json(patient);
  } catch (err) {
    req.log.error(err, "Get patient error");
    res.status(500).json({ error: "InternalError", message: "Erro ao buscar paciente" });
  }
});

router.put("/:patientId", async (req, res) => {
  const params = UpdatePatientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ValidationError", message: params.error.message });
    return;
  }

  const parsed = UpdatePatientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "ValidationError", message: parsed.error.message });
    return;
  }

  try {
    const [patient] = await db.update(patientsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(patientsTable.id, params.data.patientId), eq(patientsTable.userId, req.userId!)))
      .returning();

    if (!patient) {
      res.status(404).json({ error: "NotFound", message: "Paciente não encontrado" });
      return;
    }

    res.json(patient);
  } catch (err) {
    req.log.error(err, "Update patient error");
    res.status(500).json({ error: "InternalError", message: "Erro ao atualizar paciente" });
  }
});

router.delete("/:patientId", async (req, res) => {
  const params = DeletePatientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ValidationError", message: params.error.message });
    return;
  }

  try {
    await db.delete(patientsTable).where(
      and(eq(patientsTable.id, params.data.patientId), eq(patientsTable.userId, req.userId!))
    );

    res.json({ success: true, message: "Paciente excluído" });
  } catch (err) {
    req.log.error(err, "Delete patient error");
    res.status(500).json({ error: "InternalError", message: "Erro ao excluir paciente" });
  }
});

export default router;
