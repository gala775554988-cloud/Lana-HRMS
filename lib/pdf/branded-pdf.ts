import path from "path";
import { readFile } from "fs/promises";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { getAppSetting, getCompanyLogo } from "@/lib/settings";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 50;
const BOTTOM_MARGIN = 40;

function scalarSetting(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "value" in value) {
    const inner = (value as { value?: unknown }).value;
    return typeof inner === "string" ? inner : "";
  }
  return "";
}

function sanitizeAscii(value: string) {
  return value.normalize("NFKD").replace(/[^\x20-\x7E]/g, "?");
}

async function loadLogoPngBytes(logoUrl: string | null): Promise<Buffer | null> {
  if (!logoUrl) return null;
  try {
    let bytes: Buffer;
    if (logoUrl.startsWith("data:")) {
      const base64 = logoUrl.split(",")[1] ?? "";
      bytes = Buffer.from(base64, "base64");
    } else if (/^https?:\/\//.test(logoUrl)) {
      const response = await fetch(logoUrl);
      if (!response.ok) return null;
      bytes = Buffer.from(await response.arrayBuffer());
    } else {
      const filePath = path.join(process.cwd(), "public", logoUrl.replace(/^\//, ""));
      bytes = await readFile(filePath);
    }
    const sharp = (await import("sharp")).default;
    return await sharp(bytes, { failOn: "none" }).resize({ width: 240, height: 240, fit: "inside" }).png().toBuffer();
  } catch {
    return null;
  }
}

async function getBrandingInfo() {
  const [companyNameRaw, crNumberRaw, taxIdRaw, logoUrl] = await Promise.all([
    getAppSetting("company.name", ""),
    getAppSetting("company.crNumber", ""),
    getAppSetting("company.taxId", ""),
    getCompanyLogo(),
  ]);
  const companyName = scalarSetting(companyNameRaw) || "Lana HRMS";
  const crNumber = scalarSetting(crNumberRaw);
  const taxId = scalarSetting(taxIdRaw);
  const logoPng = await loadLogoPngBytes(logoUrl);
  return { companyName, crNumber, taxId, logoPng };
}

/** Builds a simple single-column text PDF branded with the company logo/name/CR/Tax ID header. */
export async function buildBrandedPdf(title: string, bodyLines: string[]): Promise<Buffer> {
  const { companyName, crNumber, taxId, logoPng } = await getBrandingInfo();
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const logoImage = logoPng ? await pdfDoc.embedPng(logoPng).catch(() => null) : null;

  function newPage(): { page: PDFPage; y: number } {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    return { page, y: PAGE_HEIGHT - 50 };
  }

  function drawHeader(page: PDFPage, y: number): number {
    let textX = MARGIN_X;
    if (logoImage) {
      const maxDim = 46;
      const scale = Math.min(maxDim / logoImage.width, maxDim / logoImage.height, 1);
      const w = logoImage.width * scale;
      const h = logoImage.height * scale;
      page.drawImage(logoImage, { x: MARGIN_X, y: y - h + 10, width: w, height: h });
      textX = MARGIN_X + 60;
    }
    page.drawText(sanitizeAscii(companyName), { x: textX, y, size: 14, font: bold, color: rgb(0.1, 0.1, 0.1) });
    let cursorY = y - 16;
    const subParts = [crNumber ? `CR: ${crNumber}` : null, taxId ? `Tax ID: ${taxId}` : null].filter(Boolean) as string[];
    if (subParts.length) {
      page.drawText(sanitizeAscii(subParts.join("   |   ")), { x: textX, y: cursorY, size: 9, font, color: rgb(0.45, 0.45, 0.45) });
      cursorY -= 14;
    }
    cursorY -= 18;
    page.drawText(sanitizeAscii(title), { x: MARGIN_X, y: cursorY, size: 12, font: bold });
    return cursorY - 20;
  }

  let { page, y } = newPage();
  y = drawHeader(page, y);

  for (const rawLine of bodyLines) {
    if (y < BOTTOM_MARGIN) {
      ({ page, y } = newPage());
    }
    page.drawText(sanitizeAscii(rawLine).slice(0, 130), { x: MARGIN_X, y, size: 9.5, font });
    y -= 15;
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
