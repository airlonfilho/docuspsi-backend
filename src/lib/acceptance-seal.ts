import puppeteer from "puppeteer";

interface AcceptanceSealInput {
  documentId: string;
  patientName: string;
  patientEmail?: string | null;
  acceptedAt: Date;
  ipAddress?: string | null;
  professionalName?: string | null;
}

function escHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Fortaleza",
  }).format(value);
}

function createValidationHash(input: AcceptanceSealInput): string {
  const raw = `${input.documentId}:${input.patientName}:${input.patientEmail || ""}:${input.acceptedAt.toISOString()}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).toUpperCase().padStart(8, "0");
}

export async function generateAcceptanceSeal(input: AcceptanceSealInput): Promise<string> {
  const hash = createValidationHash(input);
  const acceptedAt = formatDate(input.acceptedAt);
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { margin: 0; background: transparent; font-family: Arial, sans-serif; }
    .seal {
      width: 720px;
      min-height: 240px;
      box-sizing: border-box;
      border: 4px solid #166534;
      border-radius: 18px;
      padding: 26px 30px;
      color: #14532d;
      background: #f7fee7;
    }
    .title { font-size: 30px; font-weight: 700; margin-bottom: 20px; text-transform: uppercase; }
    .row { font-size: 21px; line-height: 1.45; margin: 4px 0; }
    .label { font-weight: 700; }
    .hash { margin-top: 18px; font-family: monospace; font-size: 20px; letter-spacing: 1px; }
  </style>
</head>
<body>
  <div class="seal">
    <div class="title">Aceite Digital Registrado</div>
    <div class="row"><span class="label">Paciente:</span> ${escHtml(input.patientName)}</div>
    ${input.patientEmail ? `<div class="row"><span class="label">Email:</span> ${escHtml(input.patientEmail)}</div>` : ""}
    <div class="row"><span class="label">Data/hora:</span> ${escHtml(acceptedAt)}</div>
    ${input.professionalName ? `<div class="row"><span class="label">Profissional:</span> ${escHtml(input.professionalName)}</div>` : ""}
    ${input.ipAddress ? `<div class="row"><span class="label">IP:</span> ${escHtml(input.ipAddress)}</div>` : ""}
    <div class="hash">VALIDACAO-${hash}</div>
  </div>
</body>
</html>`;

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  try {
    browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setViewport({ width: 760, height: 280, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 10000 });
    const seal = await page.$(".seal");
    const buffer = seal
      ? await seal.screenshot({ type: "png", omitBackground: true })
      : await page.screenshot({ type: "png", omitBackground: true });

    return `data:image/png;base64,${Buffer.from(buffer).toString("base64")}`;
  } catch {
    return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8BQDwAFgwJ/lYtW2QAAAABJRU5ErkJggg==";
  } finally {
    await browser?.close();
  }
}
