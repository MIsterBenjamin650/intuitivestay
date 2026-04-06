import { db } from "@intuitive-stay/db"
import { organisations, properties, propertyMembers } from "@intuitive-stay/db/schema"
import { TRPCError } from "@trpc/server"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

import { protectedProcedure, router } from "../index"
import { sendStaffInviteEmail } from "../lib/email"

const permissionsSchema = z.object({
  viewFeedback: z.boolean(),
  viewAnalytics: z.boolean(),
  viewAiSummary: z.boolean(),
  viewWordCloud: z.boolean(),
  viewStaffCloud: z.boolean(),
  viewAlerts: z.boolean(),
})

async function assertOwner(userId: string, propertyId: string) {
  const row = await db
    .select({ orgId: organisations.id })
    .from(organisations)
    .innerJoin(properties, eq(properties.organisationId, organisations.id))
    .where(and(eq(organisations.ownerId, userId), eq(properties.id, propertyId)))
    .limit(1)

  if (!row.length) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not authorised for this property" })
  }
}

export const teamRouter = router({
  inviteStaff: protectedProcedure
    .input(
      z.object({
        propertyId: z.string(),
        email: z.string().email(),
        displayName: z.string().optional(),
        permissions: permissionsSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertOwner(ctx.session.user.id, input.propertyId)

      const existing = await db
        .select({ id: propertyMembers.id, status: propertyMembers.status })
        .from(propertyMembers)
        .where(
          and(
            eq(propertyMembers.propertyId, input.propertyId),
            eq(propertyMembers.invitedEmail, input.email),
          ),
        )
        .limit(1)

      if (existing.length && existing[0]?.status === "active") {
        throw new TRPCError({ code: "CONFLICT", message: "This email is already an active member" })
      }
      if (existing.length && existing[0]?.status === "pending") {
        throw new TRPCError({ code: "CONFLICT", message: "An invitation is already pending for this email" })
      }

      const prop = await db
        .select({ name: properties.name, ownerName: properties.ownerName })
        .from(properties)
        .where(eq(properties.id, input.propertyId))
        .limit(1)

      if (!prop.length || !prop[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })
      }

      const token = crypto.randomUUID()
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      const [member] = await db
        .insert(propertyMembers)
        .values({
          id: crypto.randomUUID(),
          propertyId: input.propertyId,
          invitedEmail: input.email,
          displayName: input.displayName ?? null,
          permissions: input.permissions,
          inviteToken: token,
          inviteExpiresAt: expiresAt,
        })
        .returning()

      await sendStaffInviteEmail(
        input.email,
        prop[0].name,
        prop[0].ownerName,
        token,
      )

      return member
    }),

  listMembers: protectedProcedure
    .input(z.object({ propertyId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertOwner(ctx.session.user.id, input.propertyId)

      return db
        .select()
        .from(propertyMembers)
        .where(eq(propertyMembers.propertyId, input.propertyId))
        .orderBy(propertyMembers.createdAt)
    }),

  updatePermissions: protectedProcedure
    .input(z.object({ memberId: z.string(), permissions: permissionsSchema }))
    .mutation(async ({ ctx, input }) => {
      const member = await db
        .select({ propertyId: propertyMembers.propertyId })
        .from(propertyMembers)
        .where(eq(propertyMembers.id, input.memberId))
        .limit(1)

      if (!member.length || !member[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" })
      }

      await assertOwner(ctx.session.user.id, member[0].propertyId)

      const [updated] = await db
        .update(propertyMembers)
        .set({ permissions: input.permissions })
        .where(eq(propertyMembers.id, input.memberId))
        .returning()

      return updated
    }),

  removeMember: protectedProcedure
    .input(z.object({ memberId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const member = await db
        .select({ propertyId: propertyMembers.propertyId })
        .from(propertyMembers)
        .where(eq(propertyMembers.id, input.memberId))
        .limit(1)

      if (!member.length || !member[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" })
      }

      await assertOwner(ctx.session.user.id, member[0].propertyId)

      await db.delete(propertyMembers).where(eq(propertyMembers.id, input.memberId))

      return { success: true }
    }),

  resendInvite: protectedProcedure
    .input(z.object({ memberId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const member = await db
        .select()
        .from(propertyMembers)
        .where(eq(propertyMembers.id, input.memberId))
        .limit(1)

      if (!member.length || !member[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" })
      }

      await assertOwner(ctx.session.user.id, member[0].propertyId)

      if (member[0].status === "active") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Member has already accepted" })
      }

      const prop = await db
        .select({ name: properties.name, ownerName: properties.ownerName })
        .from(properties)
        .where(eq(properties.id, member[0].propertyId))
        .limit(1)

      if (!prop.length || !prop[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })
      }

      const newToken = crypto.randomUUID()
      const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      const [updated] = await db
        .update(propertyMembers)
        .set({ inviteToken: newToken, inviteExpiresAt: newExpiry })
        .where(eq(propertyMembers.id, input.memberId))
        .returning()

      await sendStaffInviteEmail(
        member[0].invitedEmail,
        prop[0].name,
        prop[0].ownerName,
        newToken,
      )

      return updated
    }),
})
