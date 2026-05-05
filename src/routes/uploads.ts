import { Router, Request, Response } from "express";
import multer, { Multer } from "multer";
import { db } from "@workspace/db";
import { professionalProfilesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";

const router = Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

/**
 * POST /api/uploads/logo
 * Upload logo for professional profile
 * Max 2MB, accepts PNG/JPG/WEBP
 * Returns updated profile with logoUrl as base64 dataUrl
 */
router.post(
  "/logo",
  requireAuth,
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "BadRequest", message: "No file provided" });
        return;
      }

      const validMimes = ["image/png", "image/jpeg", "image/webp"];
      if (!validMimes.includes(req.file.mimetype)) {
        res.status(400).json({ error: "BadRequest", message: "Invalid file type. Allowed: PNG, JPG, WEBP" });
        return;
      }

      if (req.file.size > 2 * 1024 * 1024) {
        res.status(413).json({ error: "PayloadTooLarge", message: "File must be smaller than 2MB" });
        return;
      }

      const base64 = req.file.buffer.toString("base64");
      const mimeType = req.file.mimetype;
      const dataUrl = `data:${mimeType};base64,${base64}`;

      const [profile] = await db
        .update(professionalProfilesTable)
        .set({ logoUrl: dataUrl })
        .where(eq(professionalProfilesTable.userId, req.userId!))
        .returning();

      res.status(200).json({ message: "Logo uploaded", profile });
    } catch (err) {
      logger.error({ err, req }, "Upload logo error");
      res.status(500).json({ error: "InternalError", message: "Failed to upload logo" });
    }
  }
);

/**
 * POST /api/uploads/signature
 * Upload signature image for professional profile
 * Max 2MB, accepts PNG/JPG/WEBP
 * Returns updated profile with signatureUrl as base64 dataUrl
 */
router.post(
  "/signature",
  requireAuth,
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "BadRequest", message: "No file provided" });
        return;
      }

      const validMimes = ["image/png", "image/jpeg", "image/webp"];
      if (!validMimes.includes(req.file.mimetype)) {
        res.status(400).json({ error: "BadRequest", message: "Invalid file type. Allowed: PNG, JPG, WEBP" });
        return;
      }

      if (req.file.size > 2 * 1024 * 1024) {
        res.status(413).json({ error: "PayloadTooLarge", message: "File must be smaller than 2MB" });
        return;
      }

      const base64 = req.file.buffer.toString("base64");
      const mimeType = req.file.mimetype;
      const dataUrl = `data:${mimeType};base64,${base64}`;

      const [profile] = await db
        .update(professionalProfilesTable)
        .set({ signatureUrl: dataUrl })
        .where(eq(professionalProfilesTable.userId, req.userId!))
        .returning();

      res.status(200).json({ message: "Signature uploaded", profile });
    } catch (err) {
      logger.error({ err, req }, "Upload signature error");
      res.status(500).json({ error: "InternalError", message: "Failed to upload signature" });
    }
  }
);

/**
 * DELETE /api/uploads/logo
 * Remove logo from professional profile
 */
router.delete("/logo", requireAuth, async (req: Request, res: Response) => {
  try {
    const [profile] = await db
      .update(professionalProfilesTable)
      .set({ logoUrl: null })
      .where(eq(professionalProfilesTable.userId, req.userId!))
      .returning();

    res.status(200).json({ message: "Logo removed", profile });
  } catch (err) {
    logger.error({ err, req }, "Delete logo error");
    res.status(500).json({ error: "InternalError", message: "Failed to remove logo" });
  }
});

/**
 * DELETE /api/uploads/signature
 * Remove signature from professional profile
 */
router.delete("/signature", requireAuth, async (req: Request, res: Response) => {
  try {
    const [profile] = await db
      .update(professionalProfilesTable)
      .set({ signatureUrl: null })
      .where(eq(professionalProfilesTable.userId, req.userId!))
      .returning();

    res.status(200).json({ message: "Signature removed", profile });
  } catch (err) {
    logger.error({ err, req }, "Delete signature error");
    res.status(500).json({ error: "InternalError", message: "Failed to remove signature" });
  }
});

export default router;
