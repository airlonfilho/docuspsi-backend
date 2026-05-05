import type Stripe from "stripe";
import { eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db, subscriptionsTable, usersTable, type Subscription } from "@workspace/db";
import { findBillingPlanByPriceId, toLegacyUserPlan, type BillingPlanKey } from "./billing-plans.js";

export type SubscriptionStatus =
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELED"
  | "INCOMPLETE"
  | "INCOMPLETE_EXPIRED"
  | "UNPAID";

function fromUnixTime(value: unknown): Date | null {
  return typeof value === "number" ? new Date(value * 1000) : null;
}

export function normalizeStripeSubscriptionStatus(status: string | null | undefined): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return "TRIALING";
    case "active":
      return "ACTIVE";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
      return "CANCELED";
    case "incomplete":
      return "INCOMPLETE";
    case "incomplete_expired":
      return "INCOMPLETE_EXPIRED";
    case "unpaid":
      return "UNPAID";
    default:
      return "INCOMPLETE";
  }
}

export function subscriptionIsUsable(status: string | null | undefined): boolean {
  return status === "ACTIVE" || status === "TRIALING";
}

function stripeSubscriptionIsManaged(subscription: Stripe.Subscription): boolean {
  return ["active", "trialing", "past_due", "incomplete"].includes(subscription.status);
}

function choosePrimaryStripeSubscription(subscriptions: Stripe.Subscription[]): Stripe.Subscription | undefined {
  return subscriptions
    .sort((a, b) => {
      const aUsable = subscriptionIsUsable(normalizeStripeSubscriptionStatus(a.status)) ? 1 : 0;
      const bUsable = subscriptionIsUsable(normalizeStripeSubscriptionStatus(b.status)) ? 1 : 0;
      if (aUsable !== bUsable) return bUsable - aUsable;
      return b.created - a.created;
    })[0];
}

export async function listManagedStripeSubscriptions(stripe: Stripe, stripeCustomerId: string): Promise<Stripe.Subscription[]> {
  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "all",
    limit: 100,
  });

  return subscriptions.data.filter(stripeSubscriptionIsManaged);
}

export async function cancelDuplicateStripeSubscriptions(
  stripe: Stripe,
  subscriptions: Stripe.Subscription[],
  keepSubscriptionId: string,
): Promise<void> {
  for (const subscription of subscriptions) {
    if (subscription.id === keepSubscriptionId) continue;
    await stripe.subscriptions.cancel(subscription.id, {
      cancellation_details: {
        comment: "Canceled automatically by DocusPsi to enforce one active subscription per customer.",
      },
    });
  }
}

export function getStripeSubscriptionPriceId(subscription: Stripe.Subscription | any): string | null {
  return subscription.items?.data?.[0]?.price?.id || null;
}

async function findUserIdForStripeSubscription(subscription: Stripe.Subscription | any, fallbackUserId?: string | null): Promise<string | null> {
  if (fallbackUserId) return fallbackUserId;

  const metadataUserId = typeof subscription.metadata?.userId === "string" ? subscription.metadata.userId : null;
  if (metadataUserId) return metadataUserId;

  const subscriptionId = typeof subscription.id === "string" ? subscription.id : null;
  if (subscriptionId) {
    const [existingSubscription] = await db.select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.stripeSubscriptionId, subscriptionId))
      .limit(1);
    if (existingSubscription) return existingSubscription.userId;
  }

  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  if (customerId) {
    const [user] = await db.select()
      .from(usersTable)
      .where(eq(usersTable.stripeCustomerId, customerId))
      .limit(1);
    if (user) return user.id;
  }

  return null;
}

export async function syncSubscriptionFromStripe(
  subscription: Stripe.Subscription | any,
  fallbackUserId?: string | null,
): Promise<Subscription | null> {
  const userId = await findUserIdForStripeSubscription(subscription, fallbackUserId);
  if (!userId) return null;

  const stripeSubscriptionId = subscription.id as string;
  const stripeCustomerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id || null;
  const stripePriceId = getStripeSubscriptionPriceId(subscription);
  const plan = findBillingPlanByPriceId(stripePriceId);
  const planKey = (plan?.key || "FREE") as BillingPlanKey;
  const status = normalizeStripeSubscriptionStatus(subscription.status);
  const now = new Date();
  const currentPeriodStart = fromUnixTime(subscription.current_period_start);
  const currentPeriodEnd = fromUnixTime(subscription.current_period_end);
  const trialEndsAt = fromUnixTime(subscription.trial_end);
  const cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);

  await db.execute(sql`
    INSERT INTO subscriptions (
      id,
      user_id,
      plan_key,
      status,
      stripe_customer_id,
      stripe_subscription_id,
      stripe_price_id,
      current_period_start,
      current_period_end,
      cancel_at_period_end,
      trial_ends_at,
      created_at,
      updated_at
    )
    VALUES (
      ${uuidv4()},
      ${userId},
      ${planKey},
      ${status},
      ${stripeCustomerId},
      ${stripeSubscriptionId},
      ${stripePriceId},
      ${currentPeriodStart},
      ${currentPeriodEnd},
      ${cancelAtPeriodEnd},
      ${trialEndsAt},
      ${now},
      ${now}
    )
    ON CONFLICT (user_id) DO UPDATE SET
      plan_key = EXCLUDED.plan_key,
      status = EXCLUDED.status,
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      stripe_price_id = EXCLUDED.stripe_price_id,
      current_period_start = EXCLUDED.current_period_start,
      current_period_end = EXCLUDED.current_period_end,
      cancel_at_period_end = EXCLUDED.cancel_at_period_end,
      trial_ends_at = EXCLUDED.trial_ends_at,
      updated_at = EXCLUDED.updated_at
  `);

  const [stored] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId)).limit(1);
  await syncUserSubscriptionColumns(userId, stored || null);
  return stored || null;
}

export async function markSubscriptionDeleted(stripeSubscriptionId: string): Promise<Subscription | null> {
  const now = new Date();
  const [stored] = await db.update(subscriptionsTable)
    .set({ status: "CANCELED", cancelAtPeriodEnd: false, updatedAt: now })
    .where(eq(subscriptionsTable.stripeSubscriptionId, stripeSubscriptionId))
    .returning();

  if (stored) {
    await syncUserSubscriptionColumns(stored.userId, stored);
  }

  return stored || null;
}

export async function updateSubscriptionPaymentStatus(
  stripeSubscriptionId: string,
  status: Extract<SubscriptionStatus, "ACTIVE" | "PAST_DUE">,
): Promise<Subscription | null> {
  const now = new Date();
  const [stored] = await db.update(subscriptionsTable)
    .set({ status, updatedAt: now })
    .where(eq(subscriptionsTable.stripeSubscriptionId, stripeSubscriptionId))
    .returning();

  if (stored) {
    await syncUserSubscriptionColumns(stored.userId, stored, status === "ACTIVE" ? now : undefined);
  }

  return stored || null;
}

export async function syncUserSubscriptionColumns(userId: string, subscription: Subscription | null, lastPaymentAt?: Date) {
  const hasUsableSubscription = subscriptionIsUsable(subscription?.status);
  const planKey = hasUsableSubscription ? subscription?.planKey as BillingPlanKey : "FREE";

  await db.update(usersTable)
    .set({
      plan: toLegacyUserPlan(planKey),
      subscriptionId: subscription?.id || null,
      stripeCustomerId: subscription?.stripeCustomerId || undefined,
      subscriptionStatus: subscription?.status || "free",
      trialEndsAt: subscription?.trialEndsAt || null,
      lastPaymentAt,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, userId));
}

export async function getCurrentUserSubscription(userId: string): Promise<Subscription | null> {
  const [subscription] = await db.select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId))
    .limit(1);

  return subscription || null;
}

export async function reconcileSubscriptionFromStripeCustomer(
  stripe: Stripe,
  userId: string,
  stripeCustomerId: string,
): Promise<Subscription | null> {
  const managedSubscriptions = await listManagedStripeSubscriptions(stripe, stripeCustomerId);
  const selected = choosePrimaryStripeSubscription(managedSubscriptions);

  if (!selected) {
    return getCurrentUserSubscription(userId);
  }

  await cancelDuplicateStripeSubscriptions(stripe, managedSubscriptions, selected.id);
  return syncSubscriptionFromStripe(selected, userId);
}
