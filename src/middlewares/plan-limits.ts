import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable, documentsTable, patientsTable } from "@workspace/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { logger } from "../lib/logger.js";

export type Plan = "FREE" | "ESSENTIAL" | "PRO" | "CLINIC";

// Plan limits configuration
const PLAN_LIMITS: Record<Plan, { documentsPerMonth: number; maxPatients: number; features: string[] }> = {
  FREE: {
    documentsPerMonth: 5,
    maxPatients: 3,
    features: ["basic_templates", "pdf_export"],
  },
  ESSENTIAL: {
    documentsPerMonth: 50,
    maxPatients: 20,
    features: ["basic_templates", "pdf_export", "patient_signatures", "document_history"],
  },
  PRO: {
    documentsPerMonth: 200,
    maxPatients: 100,
    features: [
      "all_templates",
      "pdf_export",
      "patient_signatures",
      "document_history",
      "custom_branding",
      "api_access",
    ],
  },
  CLINIC: {
    documentsPerMonth: 1000,
    maxPatients: -1, // unlimited
    features: ["all_features", "team_collaboration", "advanced_analytics", "priority_support"],
  },
};

/**
 * Middleware para validar se usuário tem permissão para criar novo documento
 * Verifica limite mensal e limite de pacientes
 */
export async function validatePlanLimits(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized", message: "User ID not found" });
      return;
    }

    // Get user's plan
    const [user] = await db.select({ plan: usersTable.plan }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);

    if (!user) {
      res.status(404).json({ error: "NotFound", message: "User not found" });
      return;
    }

    const plan = user.plan as Plan;
    const limits = PLAN_LIMITS[plan];

    // Check documents per month limit (only for paid plans)
    if (plan !== "CLINIC") {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // Count documents created this month
      const monthDocs = await db.select().from(documentsTable)
        .where(
          and(eq(documentsTable.userId, userId), gte(documentsTable.createdAt, startOfMonth))
        );

      const currentCount = monthDocs.length;
      if (currentCount >= limits.documentsPerMonth) {
        res.status(403).json({
          error: "PlanLimitExceeded",
          message: `You have reached your monthly limit of ${limits.documentsPerMonth} documents. Upgrade your plan to create more.`,
          limit: limits.documentsPerMonth,
          current: currentCount,
        });
        return;
      }
    }

    // Check patient limit
    if (limits.maxPatients > 0) {
      const patientList = await db.select().from(patientsTable)
        .where(eq(patientsTable.userId, userId));

      const patientCount = patientList.length;
      if (patientCount >= limits.maxPatients) {
        res.status(403).json({
          error: "PlanLimitExceeded",
          message: `You have reached your patient limit of ${limits.maxPatients}. Upgrade your plan to add more patients.`,
          limit: limits.maxPatients,
          current: patientCount,
        });
        return;
      }
    }

    // Attach plan info to request
    (req as any).userPlan = plan;
    (req as any).planLimits = limits;

    next();
  } catch (err) {
    logger.error({ err, userId: req.userId }, "Plan validation error");
    res.status(500).json({ error: "InternalError", message: "Failed to validate plan limits" });
  }
}

/**
 * Check if user has access to a specific feature
 */
export function hasFeature(feature: string, plan: Plan): boolean {
  const limits = PLAN_LIMITS[plan];
  return limits.features.includes(feature) || limits.features.includes("all_features");
}

export function getPlanLimits(plan: Plan) {
  return PLAN_LIMITS[plan];
}
