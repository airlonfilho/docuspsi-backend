import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth.js";
import { findBillingPlan, listPublicPlans } from "../lib/billing-plans.js";
import { getStripeCancelUrl, getStripeClient, getStripeSuccessUrl } from "../lib/stripe.js";
import { logger } from "../lib/logger.js";
import {
  cancelDuplicateStripeSubscriptions,
  getStripeSubscriptionPriceId,
  listManagedStripeSubscriptions,
  syncSubscriptionFromStripe,
} from "../lib/subscriptions.js";

const router = Router();

function getBodyString(body: unknown, key: string): string | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

function isMissingStripeConfigError(err: unknown): boolean {
  return err instanceof Error && err.message === "STRIPE_SECRET_KEY is required";
}

function isStripeApiError(err: unknown): err is Error & { type?: string; code?: string; statusCode?: number } {
  return err instanceof Error && typeof (err as { type?: unknown }).type === "string";
}

function isMissingStripeResourceError(err: unknown): boolean {
  return isStripeApiError(err) && err.code === "resource_missing";
}

function withCheckoutSessionId(url: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}session_id={CHECKOUT_SESSION_ID}`;
}

function serializeStripeSyncedSubscription(subscription: Awaited<ReturnType<typeof syncSubscriptionFromStripe>>) {
  if (!subscription) return null;
  return {
    id: subscription.id,
    plan: subscription.planKey,
    status: subscription.status,
    stripeCustomerId: subscription.stripeCustomerId,
    stripeSubscriptionId: subscription.stripeSubscriptionId,
    currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() || null,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  };
}

router.get("/", (_req, res) => {
  res.json({ plans: listPublicPlans() });
});

router.post("/upgrade", requireAuth, async (req, res) => {
  const requestedPlan = getBodyString(req.body, "plan") || getBodyString(req.body, "planId");
  const billingCycle = getBodyString(req.body, "billingCycle") || "monthly";
  const plan = findBillingPlan(requestedPlan);

  if (!plan) {
    res.status(400).json({ error: "ValidationError", message: "Plano invalido" });
    return;
  }

  if (billingCycle !== "monthly") {
    res.status(400).json({ error: "ValidationError", message: "Somente billingCycle monthly esta disponivel neste momento" });
    return;
  }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    if (!user) {
      res.status(401).json({ error: "Unauthorized", message: "Usuario nao encontrado" });
      return;
    }

    const stripe = getStripeClient();
    let stripeCustomerId = user.stripeCustomerId;
    let shouldCreateCustomer = !stripeCustomerId;

    if (stripeCustomerId) {
      try {
        await stripe.customers.retrieve(stripeCustomerId);
      } catch (err) {
        if (!isMissingStripeResourceError(err)) throw err;
        shouldCreateCustomer = true;
      }
    }

    if (shouldCreateCustomer) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user.id },
      });
      stripeCustomerId = customer.id;

      await db.update(usersTable)
        .set({ stripeCustomerId, updatedAt: new Date() })
        .where(eq(usersTable.id, user.id));
    }

    const managedSubscriptions = await listManagedStripeSubscriptions(stripe, stripeCustomerId!);
    const existingSubscription = managedSubscriptions
      .sort((a, b) => b.created - a.created)[0];

    if (existingSubscription) {
      await cancelDuplicateStripeSubscriptions(stripe, managedSubscriptions, existingSubscription.id);

      const currentPriceId = getStripeSubscriptionPriceId(existingSubscription);
      if (currentPriceId === plan.stripePriceId) {
        const synced = await syncSubscriptionFromStripe(existingSubscription, user.id);
        res.json({
          checkoutUrl: null,
          subscriptionUpdated: false,
          message: "Usuario ja esta neste plano.",
          subscription: serializeStripeSyncedSubscription(synced),
        });
        return;
      }

      const subscriptionItemId = existingSubscription.items.data[0]?.id;
      if (!subscriptionItemId) {
        res.status(409).json({
          error: "SubscriptionUpdateUnavailable",
          message: "Assinatura atual nao possui item atualizavel.",
        });
        return;
      }

      const updatedSubscription = await stripe.subscriptions.update(existingSubscription.id, {
        cancel_at_period_end: false,
        metadata: {
          userId: user.id,
          plan: plan.key,
        },
        items: [
          {
            id: subscriptionItemId,
            price: plan.stripePriceId,
            quantity: 1,
          },
        ],
        payment_behavior: "allow_incomplete",
        proration_behavior: "create_prorations",
      });

      const synced = await syncSubscriptionFromStripe(updatedSubscription, user.id);
      res.json({
        checkoutUrl: null,
        subscriptionUpdated: true,
        message: "Plano atualizado com sucesso.",
        subscription: serializeStripeSyncedSubscription(synced),
      });
      return;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      client_reference_id: user.id,
      success_url: withCheckoutSessionId(getStripeSuccessUrl()),
      cancel_url: getStripeCancelUrl(),
      allow_promotion_codes: true,
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      metadata: {
        userId: user.id,
        plan: plan.key,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          plan: plan.key,
        },
      },
    });

    if (!session.url) {
      res.status(502).json({ error: "StripeError", message: "Stripe nao retornou URL de checkout" });
      return;
    }

    res.json({ checkoutUrl: session.url });
  } catch (err) {
    logger.error({ err, userId: req.userId }, "Create Stripe checkout session error");
    if (isMissingStripeConfigError(err)) {
      res.status(503).json({
        error: "StripeNotConfigured",
        message: "STRIPE_SECRET_KEY nao esta configurada no backend.",
      });
      return;
    }

    if (isStripeApiError(err)) {
      res.status(err.statusCode || 502).json({
        error: "StripeError",
        message: err.message,
        code: err.code,
        type: err.type,
      });
      return;
    }

    res.status(500).json({ error: "InternalError", message: "Erro ao iniciar checkout" });
  }
});

export default router;
