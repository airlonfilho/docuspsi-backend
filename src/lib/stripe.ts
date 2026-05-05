import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is required");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: "2026-04-22.dahlia",
    });
  }

  return stripeClient;
}

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is required");
  }
  return secret;
}

export function getStripeSuccessUrl(): string {
  return process.env.STRIPE_SUCCESS_URL || `${getDefaultFrontendUrl()}/app/billing/success`;
}

export function getStripeCancelUrl(): string {
  return process.env.STRIPE_CANCEL_URL || `${getDefaultFrontendUrl()}/app/billing/cancel`;
}

export function getStripePortalReturnUrl(): string {
  return process.env.STRIPE_PORTAL_RETURN_URL || `${getDefaultFrontendUrl()}/app/billing`;
}

function getDefaultFrontendUrl(): string {
  const frontendUrl = process.env.FRONTEND_URL?.split(",")[0]?.trim();
  if (frontendUrl) return frontendUrl;
  return process.env.NODE_ENV === "production" ? "https://docuspsi.vercel.app" : "http://localhost:5173";
}
