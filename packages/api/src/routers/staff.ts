import { db } from "@intuitive-stay/db"
import {
  organisations,
  properties,
  staffProfiles,
} from "@intuitive-stay/db/schema"
import { env } from "@intuitive-stay/env/server"
import { TRPCError } from "@trpc/server"
import { and, asc, eq } from "drizzle-orm"
import { z } from "zod"

import { protectedProcedure, publicProcedure, router } from "../index"

export const staffRouter = router({
  /**
   * Protected — owner generates (or regenerates) a staff invite link.
   * Regenerating creates a new token; all old links stop working.
   */
  generateInviteToken: protectedProcedure
    .input(z.object({ propertyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const org = await db.query.organisations.findFirst({
        where: eq(organisations.ownerId, ctx.session.user.id),
      })
      if (!org) throw new TRPCError({ code: "FORBIDDEN" })

      const property = await db.query.properties.findFirst({
        where: eq(properties.id, input.propertyId),
      })
      if (!property) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })
      if (property.organisationId !== org.id) throw new TRPCError({ code: "FORBIDDEN" })

      const token = crypto.randomUUID()
      await db
        .update(properties)
        .set({ staffInviteToken: token })
        .where(eq(properties.id, input.propertyId))

      return {
        token,
        inviteUrl: `${env.PUBLIC_PORTAL_URL}/staff-join/${token}`,
      }
    }),

  /**
   * Protected — returns the current invite URL for a property.
   * Returns null if no token has been generated yet.
   */
  getInviteUrl: protectedProcedure
    .input(z.object({ propertyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const org = await db.query.organisations.findFirst({
        where: eq(organisations.ownerId, ctx.session.user.id),
      })
      if (!org) throw new TRPCError({ code: "FORBIDDEN" })

      const property = await db.query.properties.findFirst({
        where: eq(properties.id, input.propertyId),
      })
      if (!property) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })
      if (property.organisationId !== org.id) throw new TRPCError({ code: "FORBIDDEN" })

      return {
        token: property.staffInviteToken ?? null,
        inviteUrl: property.staffInviteToken
          ? `${env.PUBLIC_PORTAL_URL}/staff-join/${property.staffInviteToken}`
          : null,
      }
    }),

  /**
   * Public — validates an invite token and returns the property name.
   * Used by the /staff-join page to show which property they're joining.
   */
  getInviteInfo: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const property = await db.query.properties.findFirst({
        where: eq(properties.staffInviteToken, input.token),
      })
      if (!property) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "This invite link is no longer valid.",
        })
      }
      return { propertyName: property.name }
    }),

  /**
   * Public — staff self-register using an invite token.
   * Creates a staff_profiles row for this property.
   */
  registerStaff: publicProcedure
    .input(
      z.object({
        token: z.string(),
        name: z.string().min(1).max(100),
        email: z.string().email(),
      }),
    )
    .mutation(async ({ input }) => {
      const property = await db.query.properties.findFirst({
        where: eq(properties.staffInviteToken, input.token),
      })
      if (!property) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "This invite link is no longer valid.",
        })
      }

      const existing = await db.query.staffProfiles.findFirst({
        where: and(
          eq(staffProfiles.propertyId, property.id),
          eq(staffProfiles.email, input.email.toLowerCase()),
        ),
      })
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You are already registered at this property.",
        })
      }

      const id = crypto.randomUUID()
      await db.insert(staffProfiles).values({
        id,
        name: input.name.trim(),
        email: input.email.toLowerCase(),
        propertyId: property.id,
        createdAt: new Date(),
      })

      return { ok: true, staffProfileId: id }
    }),

  /**
   * Protected — owner lists all registered staff profiles for their property.
   */
  listPropertyStaff: protectedProcedure
    .input(z.object({ propertyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const org = await db.query.organisations.findFirst({
        where: eq(organisations.ownerId, ctx.session.user.id),
      })
      if (!org) throw new TRPCError({ code: "FORBIDDEN" })

      const property = await db.query.properties.findFirst({
        where: eq(properties.id, input.propertyId),
      })
      if (!property) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })
      if (property.organisationId !== org.id) throw new TRPCError({ code: "FORBIDDEN" })

      const staff = await db
        .select()
        .from(staffProfiles)
        .where(eq(staffProfiles.propertyId, input.propertyId))
        .orderBy(asc(staffProfiles.name))

      return staff.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        createdAt: s.createdAt,
        nominations: 0,
      }))
    }),
})
