export type BillingPlanKey = "FREE" | "ESSENTIAL" | "PRO" | "CLINIC";
export type BillingCycle = "monthly";

export interface BillingPlan {
  key: Exclude<BillingPlanKey, "FREE">;
  name: string;
  description: string;
  price: number;
  priceInCents: number;
  currency: "BRL";
  interval: "month";
  recommended?: boolean;
  stripePriceId: string;
  documentsLimit: number;
  patientsLimit: number;
  professionalsLimit?: number;
  features: string[];
  featureFlags: {
    acceptanceLink: boolean;
    customLogo: boolean;
  };
}

export const FREE_PLAN = {
  key: "FREE" as const,
  name: "Free",
  documentsLimit: 0,
  patientsLimit: 0,
  features: [],
  featureFlags: {
    acceptanceLink: false,
    customLogo: false,
  },
};

export const BILLING_PLANS: BillingPlan[] = [
  {
    key: "ESSENTIAL",
    name: "Essencial",
    description: "Para psicologas(os) que querem comecar com documentos basicos, PDF profissional e organizacao inicial por paciente.",
    price: 29,
    priceInCents: 2900,
    currency: "BRL",
    interval: "month",
    stripePriceId: process.env.STRIPE_PRICE_ESSENTIAL_MONTHLY || "price_1TTia3P4IQlsgvP8OFPIC2GK",
    documentsLimit: 20,
    patientsLimit: 30,
    features: [
      "20 documentos/mes",
      "30 pacientes",
      "PDF profissional",
    ],
    featureFlags: {
      acceptanceLink: false,
      customLogo: false,
    },
  },
  {
    key: "PRO",
    name: "Pro",
    description: "Para psicologas(os) que querem profissionalizar a rotina documental com documentos ilimitados e aceite por link.",
    price: 59,
    priceInCents: 5900,
    currency: "BRL",
    interval: "month",
    recommended: true,
    stripePriceId: process.env.STRIPE_PRICE_PRO_MONTHLY || "price_1TTiaMP4IQlsgvP89XmlNq96",
    documentsLimit: -1,
    patientsLimit: -1,
    features: [
      "Documentos ilimitados",
      "Pacientes ilimitados",
      "Aceite por link",
      "Logo personalizada",
    ],
    featureFlags: {
      acceptanceLink: true,
      customLogo: true,
    },
  },
  {
    key: "CLINIC",
    name: "Clinica",
    description: "Para clinicas pequenas ou consultorios com equipe que precisam de multiplos profissionais e gestao documental.",
    price: 149,
    priceInCents: 14900,
    currency: "BRL",
    interval: "month",
    stripePriceId: process.env.STRIPE_PRICE_CLINIC_MONTHLY || "price_1TTiagP4IQlsgvP8G8g7QgNe",
    documentsLimit: -1,
    patientsLimit: -1,
    professionalsLimit: 3,
    features: [
      "Documentos ilimitados",
      "Pacientes ilimitados",
      "Aceite por link",
      "Logo personalizada",
      "Ate 3 profissionais",
    ],
    featureFlags: {
      acceptanceLink: true,
      customLogo: true,
    },
  },
];

export function listPublicPlans() {
  return BILLING_PLANS.map((plan) => ({
    key: plan.key,
    name: plan.name,
    description: plan.description,
    price: plan.price,
    currency: plan.currency,
    interval: plan.interval,
    recommended: plan.recommended || undefined,
    features: plan.features,
    stripePriceId: plan.stripePriceId,
  }));
}

export function findBillingPlan(value: string | undefined): BillingPlan | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase();
  const key = normalized.startsWith("PLAN-") ? normalized.slice(5) : normalized;
  return BILLING_PLANS.find((plan) => plan.key === key);
}

export function findBillingPlanByPriceId(priceId: string | null | undefined): BillingPlan | undefined {
  if (!priceId) return undefined;
  return BILLING_PLANS.find((plan) => plan.stripePriceId === priceId);
}

export function toLegacyUserPlan(planKey: BillingPlanKey): "free" | "starter" | "pro" {
  if (planKey === "ESSENTIAL") return "starter";
  if (planKey === "PRO" || planKey === "CLINIC") return "pro";
  return "free";
}
