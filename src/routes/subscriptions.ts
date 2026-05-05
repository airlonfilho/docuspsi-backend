import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth.js";
import { BILLING_PLANS, FREE_PLAN, findBillingPlan } from "../lib/billing-plans.js";
import { getCurrentUserSubscription, reconcileSubscriptionFromStripeCustomer, subscriptionIsUsable } from "../lib/subscriptions.js";
import { getStripeClient, getStripePortalReturnUrl } from "../lib/stripe.js";
import { logger } from "../lib/logger.js";

const router = Router();

function serializeCurrentSubscription(subscription: Awaited<ReturnType<typeof getCurrentUserSubscription>>) {
  if (!subscription) {
    return {
      plan: FREE_PLAN.key,
      status: "FREE",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      features: FREE_PLAN.features,
    };
  }

  const plan = findBillingPlan(subscription.planKey) || BILLING_PLANS[0];

  return {
    id: subscription.id,
    userId: subscription.userId,
    plan: subscription.planKey,
    status: subscription.status,
    stripeCustomerId: subscription.stripeCustomerId,
    stripeSubscriptionId: subscription.stripeSubscriptionId,
    currentPeriodStart: subscription.currentPeriodStart?.toISOString() || null,
    currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() || null,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    trialEndsAt: subscription.trialEndsAt?.toISOString() || null,
    features: plan.features,
  };
}

router.get("/current", requireAuth, async (req, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    const subscription = user?.stripeCustomerId
      ? await reconcileSubscriptionFromStripeCustomer(getStripeClient(), req.userId!, user.stripeCustomerId)
      : await getCurrentUserSubscription(req.userId!);

    res.json({ subscription: serializeCurrentSubscription(subscription) });
  } catch (err) {
    logger.error({ err, userId: req.userId }, "Get current subscription error");
    res.status(500).json({ error: "InternalError", message: "Erro ao buscar assinatura" });
  }
});

router.post("/cancel", requireAuth, async (req, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    const subscription = await getCurrentUserSubscription(req.userId!);

    if (!user?.stripeCustomerId || !subscription || !subscriptionIsUsable(subscription.status)) {
      res.status(400).json({
        error: "NoActiveSubscription",
        message: "Nao ha assinatura ativa para gerenciar.",
      });
      return;
    }

    const stripe = getStripeClient();
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: getStripePortalReturnUrl(),
    });

    res.json({ portalUrl: portalSession.url });
  } catch (err) {
    logger.error({ err, userId: req.userId }, "Create Stripe portal session error");
    res.status(500).json({ error: "InternalError", message: "Erro ao abrir portal de cobranca" });
  }
});

export default router;
