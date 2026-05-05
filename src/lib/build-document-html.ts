import type { RenderedDocument } from "./render-document.js";

export const documentCss = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: #e5e7eb;
}

.pdf-preview-wrapper {
  width: 100%;
  min-height: 100vh;
  background: #e5e7eb;
  padding: 32px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.pdf-page {
  width: 794px;
  min-height: 1123px;
  background: #ffffff;
  color: #0f172a;
  font-family: Arial, Helvetica, sans-serif;
  padding: 48px;
  padding-bottom: 88px;
  box-sizing: border-box;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.15);
  position: relative;
}

.document-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 2px solid var(--document-primary-color, #2563eb);
  padding-bottom: 20px;
  margin-bottom: 32px;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-logo {
  width: 64px;
  height: 64px;
  object-fit: contain;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  padding: 6px;
  background: #ffffff;
}

.header-monogram {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  background: linear-gradient(135deg, #2563eb, #675cf1);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
  flex-shrink: 0;
}

.header-title-group {
  display: flex;
  flex-direction: column;
}

.professional-name {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.professional-crp {
  font-size: 12px;
  color: #64748b;
  margin-top: 4px;
  display: block;
}

.clinic-name {
  font-size: 13px;
  color: #334155;
  margin-top: 4px;
  display: block;
}

.header-contact {
  text-align: right;
  font-size: 11px;
  color: #64748b;
  line-height: 1.6;
}

.document-title-area {
  text-align: center;
  margin-bottom: 28px;
}

.document-type-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--document-primary-color, #2563eb);
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  padding: 6px 12px;
  margin-bottom: 12px;
}

.document-title {
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
  line-height: 1.3;
}

.document-subtitle {
  font-size: 12px;
  color: #64748b;
  margin-top: 8px;
}

.info-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 18px;
  margin-bottom: 28px;
}

.info-card-title {
  font-size: 12px;
  font-weight: 700;
  color: #334155;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 24px;
}

.info-item {
  font-size: 11px;
  color: #475569;
  line-height: 1.4;
}

.info-label {
  font-weight: 700;
  color: #0f172a;
}

.document-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 8px;
}

.section-text {
  font-size: 12px;
  color: #334155;
  line-height: 1.65;
  text-align: justify;
  margin: 0 0 6px 0;
}

.section-highlight {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-left: 4px solid var(--document-primary-color, #2563eb);
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 20px;
}

.section-highlight .section-title {
  color: var(--document-primary-color, #2563eb);
  margin-bottom: 10px;
}

.notice-box {
  background: #f8fafc;
  border-left: 4px solid var(--document-primary-color, #2563eb);
  border-radius: 10px;
  padding: 14px 16px;
  margin: 24px 0;
  font-size: 11px;
  color: #475569;
  line-height: 1.5;
}

.notice-box-gray {
  background: #f8fafc;
  border-left: 4px solid #94a3b8;
  border-radius: 10px;
  padding: 14px 16px;
  margin: 24px 0;
  font-size: 11px;
  color: #64748b;
  line-height: 1.5;
  font-style: italic;
}

.signature-date {
  margin-top: 40px;
  margin-bottom: 8px;
  font-size: 11px;
  color: #64748b;
}

.signature-area {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 48px;
  margin-top: 16px;
}

.signature-block {
  text-align: center;
  font-size: 11px;
  color: #334155;
}

.signature-line {
  border-top: 1px solid #334155;
  margin-bottom: 8px;
}

.signature-name {
  font-weight: 700;
  color: #0f172a;
}

.signature-role {
  color: #64748b;
  margin-top: 2px;
}

.document-footer {
  position: absolute;
  left: 48px;
  right: 48px;
  bottom: 24px;
  border-top: 1px solid #e2e8f0;
  padding-top: 12px;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  font-size: 9px;
  color: #94a3b8;
  line-height: 1.4;
}

.footer-left { max-width: 55%; }
.footer-right { max-width: 45%; text-align: right; }

.acceptance-stamp {
  margin-top: 24px;
  border: 1px solid #10b981;
  background: #ecfdf5;
  color: #065f46;
  border-radius: 12px;
  padding: 14px 16px;
  font-size: 11px;
  line-height: 1.6;
}

.acceptance-stamp strong {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
}

.payment-highlight {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 20px;
  text-align: center;
  margin: 0 0 24px 0;
}

.payment-amount-label {
  font-size: 11px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 8px;
}

.payment-amount {
  font-size: 32px;
  font-weight: 800;
  color: var(--document-primary-color, #2563eb);
}

@media print {
  body { margin: 0; background: #ffffff; }
  .pdf-preview-wrapper { padding: 0; background: #ffffff; }
  .pdf-page {
    width: 210mm;
    min-height: 297mm;
    box-shadow: none;
    padding: 18mm;
    padding-bottom: 28mm;
    page-break-after: always;
  }
  .document-footer { left: 18mm; right: 18mm; bottom: 12mm; }
}

@page { size: A4; margin: 0; }
`;

function escHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function contentToHtml(content: string): string {
  const paragraphs = content.split(/\n\n+/);
  return paragraphs
    .map((p) => {
      const lines = p.split("\n").map((l) => escHtml(l));
      return `<p class="section-text">${lines.join("<br/>")}</p>`;
    })
    .join("");
}

function renderHeaderHtml(doc: RenderedDocument): string {
  const h = doc.professionalHeader;
  const primary = doc.primaryColor || "#2563EB";
  const secondary = doc.secondaryColor || "#675CF1";

  const logoHtml =
    doc.logoUrl
      ? `<img src="${doc.logoUrl}" class="header-logo" alt="Logo" />`
      : `<div class="header-monogram" style="background: linear-gradient(135deg, ${primary}, ${secondary});">${getInitials(h.clinicName || h.fullName)}</div>`;

  const contactParts = [
    h.email ? `<div>${escHtml(h.email)}</div>` : "",
    h.phone ? `<div>${escHtml(h.phone)}</div>` : "",
    h.city || h.state ? `<div>${escHtml(h.city)}/${escHtml(h.state)}</div>` : "",
    h.address ? `<div>${escHtml(h.address)}</div>` : "",
    h.website ? `<div>${escHtml(h.website)}</div>` : "",
    h.instagram ? `<div>${escHtml(h.instagram)}</div>` : "",
  ]
    .filter(Boolean)
    .join("");

  return `
<header class="document-header">
  <div class="header-brand">
    ${logoHtml}
    <div class="header-title-group">
      <p class="professional-name">${escHtml(h.fullName)}</p>
      <span class="professional-crp">CRP ${escHtml(h.crp)}</span>
      ${h.clinicName ? `<span class="clinic-name">${escHtml(h.clinicName)}</span>` : ""}
    </div>
  </div>
  <div class="header-contact">${contactParts}</div>
</header>`;
}

function renderTitleAreaHtml(doc: RenderedDocument): string {
  return `
<div class="document-title-area">
  <div class="document-type-badge">${escHtml(doc.type)}</div>
  <h1 class="document-title">${escHtml(doc.title)}</h1>
  <p class="document-subtitle">Emitido em ${escHtml(doc.issueDate)}</p>
</div>`;
}

function renderInfoBlockHtml(doc: RenderedDocument): string {
  const rows = doc.infoBlock.rows
    .map(
      (row) =>
        `<div class="info-item"><span class="info-label">${escHtml(row.label)}:</span> ${escHtml(row.value)}</div>`
    )
    .join("");

  return `
<section class="info-card">
  <div class="info-card-title">Identificação</div>
  <div class="info-grid">${rows}</div>
</section>`;
}

function renderSectionsHtml(doc: RenderedDocument): string {
  let paymentHighlight = "";
  if (doc.slug === "recibo-pagamento") {
    const amountRow = doc.infoBlock.rows.find((r) => r.label === "Valor recebido");
    if (amountRow) {
      paymentHighlight = `
<div class="payment-highlight">
  <div class="payment-amount-label">Valor recebido</div>
  <div class="payment-amount">${escHtml(amountRow.value)}</div>
</div>`;
    }
  }

  const sectionsHtml = doc.sections
    .map((section) => {
      if (section.highlight) {
        return `
<div class="section-highlight">
  <h2 class="section-title">${escHtml(section.title)}</h2>
  ${contentToHtml(section.content)}
</div>`;
      }
      return `
<section class="document-section">
  <h2 class="section-title">${escHtml(section.title)}</h2>
  ${contentToHtml(section.content)}
</section>`;
    })
    .join("");

  return paymentHighlight + sectionsHtml;
}

function renderSignatureHtml(doc: RenderedDocument): string {
  const sig = doc.signatureBlock;
  const secondSigner = sig.patient || sig.guardian;
  const signatureImage = doc.signatureUrl
    ? `<img src="${doc.signatureUrl}" alt="Assinatura" style="max-width: 180px; max-height: 56px; object-fit: contain; margin-bottom: 4px;" />`
    : "";

  return `
<div class="signature-date">${escHtml(sig.city)}/${escHtml(sig.state)}, ${escHtml(sig.date)}</div>
<div class="signature-area">
  <div class="signature-block">
    ${signatureImage}
    <div class="signature-line"></div>
    <div class="signature-name">${escHtml(sig.professional.name)}</div>
    <div class="signature-role">CRP ${escHtml(sig.professional.crp)}</div>
    <div class="signature-role">${escHtml(sig.professional.role)}</div>
  </div>
  ${
    secondSigner
      ? `<div class="signature-block">
    <div class="signature-line"></div>
    <div class="signature-name">${escHtml(secondSigner.name)}</div>
    <div class="signature-role">${escHtml(secondSigner.role)}</div>
  </div>`
      : ""
  }
</div>`;
}

function renderFooterHtml(doc: RenderedDocument): string {
  const prefs = doc.footerPrefs;

  const leftText = prefs?.text || (prefs?.showGeneratedBy !== false ? "Gerado por DocusPsi" : "");

  const rightParts: string[] = [];
  if (prefs?.showDocumentCode !== false && doc.documentId) {
    rightParts.push(`Doc. ${doc.documentId.substring(0, 8).toUpperCase()}`);
  }
  if (prefs?.showIssuedAt !== false) {
    rightParts.push(`Emitido em ${doc.issueDate}`);
  }
  if (prefs?.showPageNumber !== false) {
    rightParts.push("Página 1");
  }

  return `
<footer class="document-footer">
  <div class="footer-left">${escHtml(leftText)}</div>
  <div class="footer-right">${escHtml(rightParts.join(" · "))}</div>
</footer>`;
}

export interface AcceptanceInfo {
  name: string;
  date: string;
  cpf?: string;
  ip?: string;
}

export function renderDocumentBody(doc: RenderedDocument, acceptanceInfo?: AcceptanceInfo): string {
  const primary = doc.primaryColor || "#2563EB";

  const acceptanceStamp = acceptanceInfo
    ? `
<div class="acceptance-stamp">
  <strong>Aceite Digital Registrado</strong>
  Aceito por: ${escHtml(acceptanceInfo.name)}${acceptanceInfo.cpf ? ` · CPF: ${escHtml(acceptanceInfo.cpf)}` : ""}<br/>
  Data e hora: ${escHtml(acceptanceInfo.date)}${acceptanceInfo.ip ? ` · IP: ${escHtml(acceptanceInfo.ip)}` : ""}
</div>`
    : "";

  return `
<div class="pdf-preview-wrapper">
  <div class="pdf-page" style="--document-primary-color: ${primary};">
    ${renderHeaderHtml(doc)}
    <main class="document-content">
      ${renderTitleAreaHtml(doc)}
      ${renderInfoBlockHtml(doc)}
      ${renderSectionsHtml(doc)}
      ${acceptanceStamp}
      <div class="notice-box-gray">${escHtml(doc.notice)}</div>
      ${renderSignatureHtml(doc)}
    </main>
    ${renderFooterHtml(doc)}
  </div>
</div>`;
}

export function buildDocumentHtml(doc: RenderedDocument, acceptanceInfo?: AcceptanceInfo): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(doc.title)}</title>
  <style>${documentCss}</style>
</head>
<body>
  ${renderDocumentBody(doc, acceptanceInfo)}
</body>
</html>`;
}
