// packages/api/src/lib/activate-property.ts

import { db } from "@intuitive-stay/db"
import { qrCodes } from "@intuitive-stay/db/schema"
import { env } from "@intuitive-stay/env/server"
import { eq } from "drizzle-orm"

import { sendApprovalEmail } from "./email"
import { generateMagicLinkUrl } from "./generate-magic-link"
import { generateQrPdf, generateUniqueCode } from "./generate-qr"

export interface PropertyToActivate {
  id: string
  name: string
  ownerEmail: string
  ownerName: string
}

/**
 * Generates a QR code for the property (if it doesn't already have one),
 * then sends the approval email with the QR PDF attached.
 * Idempotent — safe to call multiple times.
 */
export async function generateAndActivateProperty(property: PropertyToActivate): Promise<void> {
  const existingQr = await db.query.qrCodes.findFirst({
    where: eq(qrCodes.propertyId, property.id),
  })

  const dashboardUrl = `${env.PUBLIC_PORTAL_URL}/properties/${property.id}/dashboard`
  const magicLinkUrl = await generateMagicLinkUrl(property.ownerEmail, dashboardUrl).catch(() => null)

  if (!existingQr) {
    const uniqueCode = generateUniqueCode()
    const feedbackUrl = `${env.PUBLIC_PORTAL_URL}/f/${uniqueCode}`

    await db.insert(qrCodes).values({
      id: crypto.randomUUID(),
      propertyId: property.id,
      uniqueCode,
      feedbackUrl,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    generateQrPdf(feedbackUrl, property.name)
      .then((pdfBuffer) =>
        sendApprovalEmail(
          property.ownerEmail,
          property.ownerName,
          property.name,
          pdfBuffer,
          magicLinkUrl ?? undefined,
        ),
      )
      .catch((err) => console.error("[activate-property] Failed to generate QR / send email:", err))
  } else {
    sendApprovalEmail(
      property.ownerEmail,
      property.ownerName,
      property.name,
      undefined,
      magicLinkUrl ?? undefined,
    ).catch((err) => console.error("[activate-property] Failed to send approval email:", err))
  }
}
