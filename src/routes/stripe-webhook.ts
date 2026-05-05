import type { Request, Response } from "express";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db, stripeEventsTable } from "@workspace/db";
import { getStripeClient, getStripeWebhookSecret } from "../lib/stripe.js";
import {
  markSubscriptionDeleted,
  syncSubscriptionFromStripe,
  updateSubscriptionPaymentStatus,
} from "../lib/subscriptions.js";
import { logger } from "../lib/logger.js";

function getInvoiceSubscriptionId(invoice: Stripe.Invoice | any): string | null {
  if (typeof invoice.subscription === "string") return invoice.subscription;
  if (invoice.subscription?.id) return invoice.subscription.id;
  if (typeof invoice.parent?.subscription_details?.subscription === "string") {
    return invoice.parent.subscription_details.subscription;
  }
  return null;
}

async function processStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const stripe = getStripeClient();
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await syncSubscriptionFromStripe(subscription, session.client_reference_id || session.metadata?.userId || null);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      await syncSubscriptionFromStripe(event.data.object as Stripe.Subscription);
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await markSubscriptionDeleted(subscription.id);
      break;
    }
    case "invoice.paid": {
      const subscriptionId = getInvoiceSubscriptionId(event.data.object as Stripe.Invoice);
      if (subscriptionId) {
        await updateSubscriptionPaymentStatus(subscriptionId, "ACTIVE");
      }
      break;
    }
    case "invoice.payment_failed": {
      const subscriptionId = getInvoiceSubscriptionId(event.data.object as Stripe.Invoice);
      if (subscriptionId) {
        await updateSubscriptionPaymentStatus(subscriptionId, "PAST_DUE");
      }
      break;
    }
    default:
      break;
  }
}

export async function stripeWebhookHandler(req: Request, res: Response) {
  const signature = req.headers["stripe-signature"];
  if (!signature || Array.isArray(signature)) {
    res.status(400).json({ error: "InvalidSignature", message: "Assinatura Stripe ausente" });
    return;
  }

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(req.body, signature, getStripeWebhookSecret());
  } catch (err) {
    logger.warn({ err }, "Invalid Stripe webhook signature");
    res.status(400).json({ error: "InvalidSignature", message: "Assinatura Stripe invalida" });
    return;
  }

  try {
    const [existing] = await db.select()
      .from(stripeEventsTable)
      .where(eq(stripeEventsTable.stripeEventId, event.id))
      .limit(1);

    if (existing?.processed) {
      res.json({ received: true, duplicate: true });
      return;
    }

    const now = new Date();
    if (!existing) {
      await db.insert(stripeEventsTable).values({
        id: uuidv4(),
        stripeEventId: event.id,
        type: event.type,
        processed: false,
        payload: event as any,
        createdAt: now,
      });
    }

    await processStripeEvent(event);

    await db.update(stripeEventsTable)
      .set({ processed: true, processedAt: new Date() })
      .where(eq(stripeEventsTable.stripeEventId, event.id));

    res.json({ received: true });
  } catch (err) {
    logger.error({ err, stripeEventId: event.id, type: event.type }, "Stripe webhook processing error");
    res.status(500).json({ error: "InternalError", message: "Erro ao processar webhook Stripe" });
  }
}
