import type { RenderedDocument } from "./render-document.js";
import { buildDocumentHtml, type AcceptanceInfo } from "./build-document-html.js";
import puppeteer from "puppeteer";

export async function generatePdf(
  doc: RenderedDocument,
  acceptanceInfo?: AcceptanceInfo
): Promise<Buffer> {
  const html = buildDocumentHtml(doc, acceptanceInfo);

  const browser = await puppeteer.launch({
    headless: "new",
  });

  try {
    const page = await browser.newPage();
    
    // Set viewport to A4 size
    await page.setViewport({ width: 1240, height: 1754 });
    
    // Set content with minimal wait condition
    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 10000,
    });

    await page.evaluate(async () => {
      const images = Array.from(document.images);
      await Promise.all(images.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        });
      }));
    });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "0mm",
        right: "0mm",
        bottom: "0mm",
        left: "0mm",
      },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
