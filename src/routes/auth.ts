import { Router } from "express";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { db, usersTable, professionalProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { RegisterBody, LoginBody, ChangePasswordBody } from "@workspace/api-zod";
import { generateToken, requireAuth } from "../middlewares/auth.js";

const router = Router();

router.post("/register", async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "ValidationError", message: parsed.error.message });
    return;
  }

  const { name, email, password } = parsed.data;

  try {
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "Conflict", message: "E-mail já cadastrado" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = uuidv4();
    const now = new Date();

    const [user] = await db.insert(usersTable).values({
      id,
      name,
      email,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    }).returning();

    const profile = await db.select().from(professionalProfilesTable).where(eq(professionalProfilesTable.userId, id)).limit(1);

    const token = generateToken({ userId: user.id, email: user.email });

    res.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        hasProfile: profile.length > 0,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (err) {
    req.log.error(err, "Register error");
    res.status(500).json({ error: "InternalError", message: "Erro ao criar conta" });
  }
});

router.post("/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "ValidationError", message: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user) {
      res.status(401).json({ error: "Unauthorized", message: "E-mail ou senha inválidos" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Unauthorized", message: "E-mail ou senha inválidos" });
      return;
    }

    const profile = await db.select().from(professionalProfilesTable).where(eq(professionalProfilesTable.userId, user.id)).limit(1);
    const token = generateToken({ userId: user.id, email: user.email });

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        hasProfile: profile.length > 0,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (err) {
    req.log.error(err, "Login error");
    res.status(500).json({ error: "InternalError", message: "Erro ao fazer login" });
  }
});

router.post("/logout", (req, res) => {
  res.json({ success: true, message: "Logout realizado" });
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    if (!user) {
      res.status(401).json({ error: "Unauthorized", message: "Usuário não encontrado" });
      return;
    }

    const profile = await db.select().from(professionalProfilesTable).where(eq(professionalProfilesTable.userId, user.id)).limit(1);

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      hasProfile: profile.length > 0,
      createdAt: user.createdAt,
    });
  } catch (err) {
    req.log.error(err, "Get me error");
    res.status(500).json({ error: "InternalError", message: "Erro ao buscar usuário" });
  }
});

router.post("/change-password", requireAuth, async (req, res) => {
  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "ValidationError", message: parsed.error.message });
    return;
  }

  const { currentPassword, newPassword } = parsed.data;

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    if (!user) {
      res.status(401).json({ error: "Unauthorized", message: "Usuário não encontrado" });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(400).json({ error: "BadRequest", message: "Senha atual incorreta" });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(usersTable.id, user.id));

    res.json({ success: true, message: "Senha alterada com sucesso" });
  } catch (err) {
    req.log.error(err, "Change password error");
    res.status(500).json({ error: "InternalError", message: "Erro ao alterar senha" });
  }
});

export default router;
