import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { leadsTable, leadEventsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../lib/logger.js";
import { leadsCaptureRateLimit } from "../middlewares/rate-limit.js";

const router = Router();

/**
 * POST /api/leads
 * Create or update lead from documental kit funnel
 * Body: { name, email, phone, source, professionStage, mainPain, consent, downloadedKit? }
 * Auto-creates kit_form_submit event
 */
router.post("/", leadsCaptureRateLimit, async (req: Request, res: Response) => {
  try {
    const { name, email, phone, source, professionStage, mainPain, consent, downloadedKit } = req.body;

    if (!email || !name) {
      res.status(400).json({ error: "BadRequest", message: "name and email are required" });
      return;
    }

    const leadId = uuidv4();
    const now = new Date();

    // Check if lead exists
    const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.email, email)).limit(1);

    let lead;
    if (existing) {
      // Update existing lead
      const [updated] = await db
        .update(leadsTable)
        .set({ name, phone, source, professionStage, mainPain, consent, downloadedKit, updatedAt: now })
        .where(eq(leadsTable.id, existing.id))
        .returning();
      lead = updated;
    } else {
      // Create new lead
      await db.insert(leadsTable).values({
        id: leadId,
        name,
        email,
        phone,
        source,
        professionStage,
        mainPain,
        consent,
        downloadedKit: downloadedKit ?? false,
        createdAt: now,
        updatedAt: now,
      });

      // Create kit_form_submit event
      await db.insert(leadEventsTable).values({
        id: uuidv4(),
        leadId: leadId,
        event: "kit_form_submit",
        source: source,
        metadata: { name, phone },
        createdAt: now,
      });

      const [created] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId)).limit(1);
      lead = created;
    }

    res.status(existing ? 200 : 201).json({ lead });
  } catch (err) {
    logger.error({ err, req }, "Create lead error");
    res.status(500).json({ error: "InternalError", message: "Failed to capture lead" });
  }
});

/**
 * POST /api/lead-events
 * Manual event tracking for leads
 * Body: { leadId?, event, source?, metadata? }
 */
router.post("/events", async (req: Request, res: Response) => {
  try {
    const { leadId, event, source, metadata } = req.body;

    if (!event) {
      res.status(400).json({ error: "BadRequest", message: "event is required" });
      return;
    }

    const eventId = uuidv4();
    const now = new Date();

    await db.insert(leadEventsTable).values({
      id: eventId,
      leadId: leadId,
      event,
      source: source,
      metadata: metadata,
      createdAt: now,
    });

    const [created] = await db.select().from(leadEventsTable).where(eq(leadEventsTable.id, eventId)).limit(1);

    res.status(201).json({ event: created });
  } catch (err) {
    logger.error({ err, req }, "Create event error");
    res.status(500).json({ error: "InternalError", message: "Failed to track event" });
  }
});

/**
 * POST /api/leads/:leadId/mark-downloaded
 * Mark kit as downloaded for a lead
 */
router.post("/:leadId/mark-downloaded", async (req: Request, res: Response) => {
  try {
    const { leadId } = req.params;
    const now = new Date();

    const [lead] = await db
      .update(leadsTable)
      .set({ downloadedKit: true, updatedAt: now })
      .where(eq(leadsTable.id, leadId))
      .returning();

    if (!lead) {
      res.status(404).json({ error: "NotFound", message: "Lead not found" });
      return;
    }

    // Log event
    await db.insert(leadEventsTable).values({
      id: uuidv4(),
      leadId: leadId,
      event: "clicked_download_kit",
      createdAt: now,
    });

    res.status(200).json({ lead });
  } catch (err) {
    logger.error({ err, req }, "Mark downloaded error");
    res.status(500).json({ error: "InternalError", message: "Failed to mark kit as downloaded" });
  }
});

export default router;
