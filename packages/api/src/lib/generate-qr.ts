import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import QRCode from "qrcode"

/** Generates an 8-character alphanumeric unique code for a QR URL. */
export function generateUniqueCode(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8)
}

/**
 * Generates a branded PDF containing a QR code pointing to feedbackUrl.
 * Returns a Buffer of the PDF bytes suitable for email attachment.
 */
export async function generateQrPdf(feedbackUrl: string, propertyName: string): Promise<Buffer> {
  // 1. Generate QR code as PNG — orange dots on white, reliable at any modern scanner
  const qrPngBuffer = await QRCode.toBuffer(feedbackUrl, {
    width: 300,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  })

  // 2. Build PDF (420 × 580 points)
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([420, 580])

  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)

  // ── Background: cream ─────────────────────────────────────────────────────
  page.drawRectangle({
    x: 0, y: 0, width: 420, height: 580,
    color: rgb(254 / 255, 243 / 255, 226 / 255), // #fef3e2
  })

  // ── Orange header bar ─────────────────────────────────────────────────────
  page.drawRectangle({
    x: 0, y: 508, width: 420, height: 72,
    color: rgb(249 / 255, 115 / 255, 22 / 255), // #f97316
  })

  // "IntuitiveStay" in white on header
  page.drawText("IntuitiveStay", {
    x: 30,
    y: 536,
    size: 22,
    font: boldFont,
    color: rgb(1, 1, 1),
  })

  // Tagline in header
  page.drawText("Guest Feedback Platform", {
    x: 30,
    y: 518,
    size: 9,
    font: regularFont,
    color: rgb(1, 0.9, 0.8),
  })

  // ── White card behind QR ──────────────────────────────────────────────────
  const cardX = 30
  const cardY = 155
  const cardW = 360
  const cardH = 340
  page.drawRectangle({
    x: cardX, y: cardY, width: cardW, height: cardH,
    color: rgb(1, 1, 1),
    borderColor: rgb(253 / 255, 186 / 255, 116 / 255), // #fdba74 orange-300
    borderWidth: 1.5,
  })

  // Property name inside card
  const propName = propertyName.length > 36 ? propertyName.slice(0, 33) + "…" : propertyName
  const propNameWidth = boldFont.widthOfTextAtSize(propName, 13)
  page.drawText(propName, {
    x: cardX + (cardW - propNameWidth) / 2,
    y: cardY + cardH - 30,
    size: 13,
    font: boldFont,
    color: rgb(0.15, 0.15, 0.15),
  })

  // QR code image — centred in card
  const qrImage = await pdfDoc.embedPng(qrPngBuffer)
  const qrSize = 260
  const qrX = cardX + (cardW - qrSize) / 2
  const qrY = cardY + (cardH - qrSize) / 2 - 10
  page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize })

  // ── Instruction beneath card ───────────────────────────────────────────────
  const instruction = "Scan to share your feedback"
  const instrWidth = boldFont.widthOfTextAtSize(instruction, 12)
  page.drawText(instruction, {
    x: (420 - instrWidth) / 2,
    y: 128,
    size: 12,
    font: boldFont,
    color: rgb(249 / 255, 115 / 255, 22 / 255),
  })

  // Small URL
  page.drawText(feedbackUrl, {
    x: 30,
    y: 108,
    size: 7.5,
    font: regularFont,
    color: rgb(0.55, 0.55, 0.55),
    maxWidth: 360,
  })

  // Footer line
  page.drawRectangle({ x: 30, y: 92, width: 360, height: 1, color: rgb(0.88, 0.88, 0.88) })
  page.drawText("intuitivestay.com", {
    x: 30, y: 76, size: 8, font: regularFont,
    color: rgb(249 / 255, 115 / 255, 22 / 255),
  })
  page.drawText("Powered by IntuitiveStay", {
    x: 30, y: 62, size: 7.5, font: regularFont,
    color: rgb(0.6, 0.6, 0.6),
  })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}
