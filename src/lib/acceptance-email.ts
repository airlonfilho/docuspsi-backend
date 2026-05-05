import { logger } from "./logger.js";

interface AcceptanceEmailInput {
  patientEmail: string | null;
  patientName: string;
  documentTitle: string;
  professionalName?: string | null;
  acceptedAt: Date;
  sealUrl: string;
}

export async function sendAcceptanceConfirmationEmail(input: AcceptanceEmailInput): Promise<void> {
  if (!input.patientEmail) return;

  const webhookUrl = process.env.ACCEPTANCE_EMAIL_WEBHOOK_URL;
  const payload = {
    to: input.patientEmail,
    subject: `Confirmação de aceite - ${input.documentTitle}`,
    template: "document_acceptance_confirmation",
    data: {
      patientName: input.patientName,
      documentTitle: input.documentTitle,
      professionalName: input.professionalName,
      acceptedAt: input.acceptedAt.toISOString(),
      sealUrl: input.sealUrl,
    },
  };

  if (!webhookUrl) {
    logger.info({ to: input.patientEmail, documentTitle: input.documentTitle }, "Acceptance confirmation email skipped: ACCEPTANCE_EMAIL_WEBHOOK_URL not configured");
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      logger.warn({ status: response.status, to: input.patientEmail }, "Acceptance confirmation email webhook failed");
    }
  } catch (err) {
    logger.warn({ err, to: input.patientEmail }, "Acceptance confirmation email webhook failed");
  }
}
