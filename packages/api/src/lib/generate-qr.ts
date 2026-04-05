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
  // 1. Generate QR code as PNG buffer
  const qrPngBuffer = await QRCode.toBuffer(feedbackUrl, {
    width: 280,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  })

  // 2. Build PDF (400 × 520 points)
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([400, 520])

  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)

  // Embed QR image and scale to 260×260
  const qrImage = await pdfDoc.embedPng(qrPngBuffer)
  const qrSize = 260
  const qrX = (400 - qrSize) / 2 // horizontally centred

  page.drawImage(qrImage, { x: qrX, y: 195, width: qrSize, height: qrSize })

  // "IntuItiveStay" heading
  page.drawText("IntuItiveStay", {
    x: 50,
    y: 480,
    size: 20,
    font: boldFont,
    color: rgb(0, 0, 0),
  })

  // Property name
  page.drawText(propertyName, {
    x: 50,
    y: 450,
    size: 13,
    font: boldFont,
    color: rgb(0.25, 0.25, 0.25),
    maxWidth: 300,
  })

  // Instruction below QR
  page.drawText("Scan to share your feedback", {
    x: 50,
    y: 165,
    size: 11,
    font: regularFont,
    color: rgb(0.4, 0.4, 0.4),
  })

  // URL in small text
  page.drawText(feedbackUrl, {
    x: 50,
    y: 145,
    size: 8,
    font: regularFont,
    color: rgb(0.6, 0.6, 0.6),
    maxWidth: 300,
  })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}
