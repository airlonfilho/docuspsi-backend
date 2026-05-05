import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable, documentsTable, patientsTable, subscriptionsTable } from "@workspace/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { reconcileSubscriptionFromStripeCustomer, subscriptionIsUsable } from "../lib/subscriptions.js";
import { getStripeClient } from "../lib/stripe.js";

export type Plan = "FREE" | "ESSENTIAL" | "PRO" | "CLINIC";

const PLAN_LIMITS: Record<Plan, { documentsPerMonth: number; maxPatients: number; features: string[] }> = {
  FREE: {
    documentsPerMonth: 0,
    maxPatients: 0,
    features: [],
  },
  ESSENTIAL: {
    documentsPerMonth: 20,
    maxPatients: 30,
    features: ["basic_templates", "pdf_export", "document_history"],
  },
  PRO: {
    documentsPerMonth: -1,
    maxPatients: -1,
    features: ["all_templates", "pdf_export", "patient_signatures", "document_history", "custom_branding", "acceptance_link"],
  },
  CLINIC: {
    documentsPerMonth: -1,
    maxPatients: -1,
    features: ["all_features", "team_collaboration", "advanced_analytics", "priority_support", "acceptance_link"],
  },
};

function legacyPlanToBillingPlan(plan: string): Plan {
  if (plan === "starter") return "ESSENTIAL";
  if (plan === "pro") return "PRO";
  return "FREE";
}

function normalizePlanKey(planKey: string): Plan {
  if (planKey === "ESSENTIAL" || planKey === "PRO" || planKey === "CLINIC") return planKey;
  return "FREE";
}

async function getEffectivePlan(userId: string): Promise<{ plan: Plan; source: "subscription" | "legacy" | "free"; status?: string }> {
  const [subscription] = await db.select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId))
    .limit(1);

  if (subscription) {
    if (subscriptionIsUsable(subscription.status)) {
      return { plan: normalizePlanKey(subscription.planKey), source: "subscription", status: subscription.status };
    }
  }

  const [user] = await db.select({
    plan: usersTable.plan,
    stripeCustomerId: usersTable.stripeCustomerId,
  }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) return { plan: "FREE", source: "free" };

  if (user.stripeCustomerId) {
    try {
      const reconciled = await reconcileSubscriptionFromStripeCustomer(getStripeClient(), userId, user.stripeCustomerId);
      if (subscriptionIsUsable(reconciled?.status)) {
        return {
          plan: normalizePlanKey(reconciled!.planKey),
          source: "subscription",
          status: reconciled!.status,
        };
      }
      if (reconciled) {
        return { plan: "FREE", source: "subscription", status: reconciled.status };
      }
    } catch (err) {
      logger.warn({ err, userId }, "Failed to reconcile subscription during plan validation");
    }
  }

  if (subscription) {
    return { plan: "FREE", source: "subscription", status: subscription.status };
  }

  const legacyPlan = legacyPlanToBillingPlan(user.plan);
  return {
    plan: legacyPlan,
    source: legacyPlan === "FREE" ? "free" : "legacy",
  };
}

function getPlanPaymentError(plan: Plan, source: string, status?: string) {
  if (plan !== "FREE") return null;
  if (source === "subscription" && status) {
    return `Sua assinatura esta ${status}. Atualize o pagamento para continuar.`;
  }
  return "Assinatura ativa necessaria para usar este recurso.";
}

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

    const effectivePlan = await getEffectivePlan(userId);
    const plan = effectivePlan.plan;
    const limits = PLAN_LIMITS[plan];
    const paymentError = getPlanPaymentError(plan, effectivePlan.source, effectivePlan.status);

    if (paymentError) {
      res.status(402).json({ error: "PaymentRequired", message: paymentError });
      return;
    }

    if (limits.documentsPerMonth > -1) {
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
        res.status(402).json({
          error: "PlanLimitExceeded",
          message: `Voce atingiu o limite mensal de ${limits.documentsPerMonth} documentos. Faca upgrade para criar mais.`,
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
        res.status(402).json({
          error: "PlanLimitExceeded",
          message: `Voce atingiu o limite de ${limits.maxPatients} pacientes. Faca upgrade para adicionar mais.`,
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

export async function validatePatientLimit(
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

    const effectivePlan = await getEffectivePlan(userId);
    const paymentError = getPlanPaymentError(effectivePlan.plan, effectivePlan.source, effectivePlan.status);
    if (paymentError) {
      res.status(402).json({ error: "PaymentRequired", message: paymentError });
      return;
    }

    const limits = PLAN_LIMITS[effectivePlan.plan];
    if (limits.maxPatients > -1) {
      const patientList = await db.select().from(patientsTable)
        .where(eq(patientsTable.userId, userId));

      const patientCount = patientList.length;
      if (patientCount >= limits.maxPatients) {
        res.status(402).json({
          error: "PlanLimitExceeded",
          message: `Voce atingiu o limite de ${limits.maxPatients} pacientes. Faca upgrade para adicionar mais.`,
          limit: limits.maxPatients,
          current: patientCount,
        });
        return;
      }
    }

    next();
  } catch (err) {
    logger.error({ err, userId: req.userId }, "Patient limit validation error");
    res.status(500).json({ error: "InternalError", message: "Failed to validate patient limit" });
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

export function requirePlanFeature(feature: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized", message: "User ID not found" });
        return;
      }

      const effectivePlan = await getEffectivePlan(userId);
      const paymentError = getPlanPaymentError(effectivePlan.plan, effectivePlan.source, effectivePlan.status);
      if (paymentError) {
        res.status(402).json({ error: "PaymentRequired", message: paymentError });
        return;
      }

      if (!hasFeature(feature, effectivePlan.plan)) {
        res.status(403).json({
          error: "Forbidden",
          message: "Seu plano atual nao permite este recurso.",
          feature,
          plan: effectivePlan.plan,
        });
        return;
      }

      (req as any).userPlan = effectivePlan.plan;
      next();
    } catch (err) {
      logger.error({ err, userId: req.userId, feature }, "Plan feature validation error");
      res.status(500).json({ error: "InternalError", message: "Failed to validate plan feature" });
    }
  };
}
