import { db } from "@intuitive-stay/db"
import { properties, propertyMembers } from "@intuitive-stay/db/schema"
import { TRPCError } from "@trpc/server"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { protectedProcedure, publicProcedure, router } from "../index"

export const inviteRouter = router({
  getDetails: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const member = await db
        .select({
          id: propertyMembers.id,
          invitedEmail: propertyMembers.invitedEmail,
          status: propertyMembers.status,
          inviteExpiresAt: propertyMembers.inviteExpiresAt,
          propertyId: propertyMembers.propertyId,
        })
        .from(propertyMembers)
        .where(eq(propertyMembers.inviteToken, input.token))
        .limit(1)

      if (!member.length || !member[0]) {
        return { valid: false as const, reason: "invalid" as const }
      }

      const m = member[0]

      if (m.status === "active") {
        return { valid: false as const, reason: "already_accepted" as const }
      }

      if (new Date() > m.inviteExpiresAt) {
        return { valid: false as const, reason: "expired" as const }
      }

      const prop = await db
        .select({ name: properties.name })
        .from(properties)
        .where(eq(properties.id, m.propertyId))
        .limit(1)

      return {
        valid: true as const,
        propertyName: prop[0]?.name ?? "your property",
        propertyId: m.propertyId,
      }
    }),

  accept: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const member = await db
        .select()
        .from(propertyMembers)
        .where(eq(propertyMembers.inviteToken, input.token))
        .limit(1)

      if (!member.length || !member[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found" })
      }

      const m = member[0]

      if (m.status === "active") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invite already accepted" })
      }

      if (new Date() > m.inviteExpiresAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invite has expired" })
      }

      if (ctx.session.user.email.toLowerCase().trim() !== m.invitedEmail.toLowerCase().trim()) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You must sign in with the email address this invitation was sent to",
        })
      }

      const [updated] = await db
        .update(propertyMembers)
        .set({
          status: "active",
          userId: ctx.session.user.id,
          acceptedAt: new Date(),
        })
        .where(eq(propertyMembers.id, m.id))
        .returning()

      return { propertyId: m.propertyId, member: updated }
    }),
})
