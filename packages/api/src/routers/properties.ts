import { db } from "@intuitive-stay/db"
import { organisations, properties, qrCodes } from "@intuitive-stay/db/schema"
import { env } from "@intuitive-stay/env/server"
import { TRPCError } from "@trpc/server"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { adminProcedure, protectedProcedure, router } from "../index"
import { sendApprovalEmail, sendRejectionEmail } from "../lib/email"
import { generateQrPdf, generateUniqueCode } from "../lib/generate-qr"

export const propertiesRouter = router({
  getPendingProperties: adminProcedure.query(async () => {
    return db
      .select()
      .from(properties)
      .where(eq(properties.status, "pending"))
      .orderBy(properties.createdAt)
  }),

  approveProperty: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const [property] = await db
        .update(properties)
        .set({ status: "approved", updatedAt: new Date() })
        .where(eq(properties.id, input.id))
        .returning()

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })
      }

      // Check if a QR code already exists (idempotency — re-approving should not create a duplicate)
      const existingQr = await db.query.qrCodes.findFirst({
        where: eq(qrCodes.propertyId, property.id),
      })

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

        // Fire-and-forget: generate PDF then send approval email with attachment
        generateQrPdf(feedbackUrl, property.name)
          .then((pdfBuffer) =>
            sendApprovalEmail(property.ownerEmail, property.ownerName, property.name, pdfBuffer),
          )
          .catch((err) => console.error("Failed to generate QR / send approval email:", err))
      } else {
        // QR already exists — just resend the approval email without regenerating
        sendApprovalEmail(property.ownerEmail, property.ownerName, property.name).catch((err) =>
          console.error("Failed to send approval email:", err),
        )
      }

      return property
    }),

  rejectProperty: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const [property] = await db
        .update(properties)
        .set({ status: "rejected", updatedAt: new Date() })
        .where(eq(properties.id, input.id))
        .returning()

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })
      }

      // Fire-and-forget: email failure must not block the rejection action
      sendRejectionEmail(property.ownerEmail, property.ownerName, property.name).catch(
        (err) => console.error("Failed to send rejection email:", err),
      )

      return property
    }),

  getMyProperties: protectedProcedure.query(async ({ ctx }) => {
    const org = await db.query.organisations.findFirst({
      where: eq(organisations.ownerId, ctx.session.user.id),
    })

    if (!org) {
      return []
    }

    return db
      .select()
      .from(properties)
      .where(eq(properties.organisationId, org.id))
  }),
})
