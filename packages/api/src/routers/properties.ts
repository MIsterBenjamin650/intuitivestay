import { db } from "@intuitive-stay/db"
import { organisations, properties } from "@intuitive-stay/db/schema"
import { TRPCError } from "@trpc/server"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { adminProcedure, protectedProcedure, router } from "../index"
import { sendApprovalEmail, sendRejectionEmail } from "../lib/email"

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

      // Fire-and-forget: email failure must not block the approval action
      sendApprovalEmail(property.ownerEmail, property.ownerName, property.name).catch(
        (err) => console.error("Failed to send approval email:", err),
      )

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
