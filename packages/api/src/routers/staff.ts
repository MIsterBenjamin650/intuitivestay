import { db } from "@intuitive-stay/db"
import { feedback, organisations, properties, staffProfiles } from "@intuitive-stay/db/schema"
import { env } from "@intuitive-stay/env/server"
import { TRPCError } from "@trpc/server"
import { and, asc, count, eq, isNotNull, isNull, sql } from "drizzle-orm"
import Stripe from "stripe"
import { z } from "zod"

import { sendStaffVerificationEmail } from "../lib/email"
import { protectedProcedure, publicProcedure, router } from "../index"

const stripe = new Stripe(env.STRIPE_SECRET_KEY)

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
        if (existing.removedAt) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Your registration was removed from this property. Please contact the property owner.",
          })
        }
        throw new TRPCError({
          code: "CONFLICT",
          message: "You are already registered at this property.",
        })
      }

      const id = crypto.randomUUID()
      const verificationToken = crypto.randomUUID()

      await db.insert(staffProfiles).values({
        id,
        name: input.name.trim(),
        email: input.email.toLowerCase(),
        propertyId: property.id,
        emailVerificationToken: verificationToken,
        createdAt: new Date(),
      })

      // Fire-and-forget — don't block registration if email fails
      sendStaffVerificationEmail(
        input.email.toLowerCase(),
        input.name.trim(),
        property.name,
        verificationToken,
      ).catch(console.error)

      return { ok: true, staffProfileId: id }
    }),

  /**
   * Public — verifies a staff member's email using their verification token.
   */
  verifyStaffEmail: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      const staff = await db.query.staffProfiles.findFirst({
        where: eq(staffProfiles.emailVerificationToken, input.token),
      })
      if (!staff) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "This verification link is invalid or has already been used.",
        })
      }

      if (staff.removedAt) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This verification link is no longer valid.",
        })
      }

      await db
        .update(staffProfiles)
        .set({
          emailVerifiedAt: new Date(),
          emailVerificationToken: null,
        })
        .where(eq(staffProfiles.id, staff.id))

      return { ok: true, name: staff.name, propertyId: staff.propertyId, staffProfileId: staff.id }
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
        .where(
          and(
            eq(staffProfiles.propertyId, input.propertyId),
            isNull(staffProfiles.removedAt),
          ),
        )
        .orderBy(asc(staffProfiles.name))

      return staff.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        createdAt: s.createdAt,
        emailVerifiedAt: s.emailVerifiedAt,
        nominations: 0,
      }))
    }),

  /**
   * Protected — owner soft-deletes a staff member by setting removedAt.
   * Validates that the staff member belongs to a property owned by the calling user's org.
   */
  removeStaff: protectedProcedure
    .input(z.object({ staffProfileId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const org = await db.query.organisations.findFirst({
        where: eq(organisations.ownerId, ctx.session.user.id),
      })
      if (!org) throw new TRPCError({ code: "FORBIDDEN" })

      const staff = await db.query.staffProfiles.findFirst({
        where: eq(staffProfiles.id, input.staffProfileId),
      })
      if (!staff) throw new TRPCError({ code: "NOT_FOUND", message: "Staff member not found." })

      // Verify the staff member belongs to a property owned by this org
      const property = await db.query.properties.findFirst({
        where: and(
          eq(properties.id, staff.propertyId),
          eq(properties.organisationId, org.id),
        ),
      })
      if (!property) throw new TRPCError({ code: "FORBIDDEN" })

      await db
        .update(staffProfiles)
        .set({ removedAt: new Date() })
        .where(eq(staffProfiles.id, input.staffProfileId))

      return { ok: true }
    }),

  /**
   * Public — returns verified staff at a property for the feedback form picker.
   * Display name is "Firstname L." to protect staff surnames from guests.
   * Only staff with emailVerifiedAt set are returned.
   */
  getVerifiedStaffAtProperty: publicProcedure
    .input(z.object({ propertyId: z.string() }))
    .query(async ({ input }) => {
      const staff = await db
        .select({
          id: staffProfiles.id,
          name: staffProfiles.name,
        })
        .from(staffProfiles)
        .where(
          and(
            eq(staffProfiles.propertyId, input.propertyId),
            isNotNull(staffProfiles.emailVerifiedAt),
            isNull(staffProfiles.removedAt),
          ),
        )
        .orderBy(asc(staffProfiles.name))

      return staff.map((s) => {
        const parts = s.name.trim().split(/\s+/)
        const displayName =
          parts.length === 1
            ? parts[0]
            : `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`
        return { id: s.id, displayName }
      })
    }),

  /**
   * Public — returns a staff member's profile and attribution stats.
   * Email is never returned (public endpoint).
   * Stats only include feedback rows with staffProfileId set (Phase 2+).
   */
  getStaffProfile: publicProcedure
    .input(z.object({ staffProfileId: z.string() }))
    .query(async ({ input }) => {
      const staff = await db.query.staffProfiles.findFirst({
        where: eq(staffProfiles.id, input.staffProfileId),
      })
      if (!staff) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found." })
      }
      if (staff.removedAt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "This profile is no longer active." })
      }

      const property = await db.query.properties.findFirst({
        where: eq(properties.id, staff.propertyId),
      })

      const [stats] = await db
        .select({
          nominations: count(),
          avgGcs: sql<string>`COALESCE(avg(${feedback.gcs}::numeric), 0)`,
          avgResilience: sql<string>`COALESCE(avg(${feedback.resilience}::numeric), 0)`,
          avgEmpathy: sql<string>`COALESCE(avg(${feedback.empathy}::numeric), 0)`,
          avgAnticipation: sql<string>`COALESCE(avg(${feedback.anticipation}::numeric), 0)`,
          avgRecognition: sql<string>`COALESCE(avg(${feedback.recognition}::numeric), 0)`,
        })
        .from(feedback)
        .where(eq(feedback.staffProfileId, input.staffProfileId))

      return {
        id: staff.id,
        name: staff.name,
        propertyName: property?.name ?? "Unknown Property",
        createdAt: staff.createdAt,
        activatedAt: staff.activatedAt ?? null,
        nominations: stats?.nominations ?? 0,
        avgGcs: Number(stats?.avgGcs ?? 0),
        pillarAverages: {
          resilience: Number(stats?.avgResilience ?? 0),
          empathy: Number(stats?.avgEmpathy ?? 0),
          anticipation: Number(stats?.avgAnticipation ?? 0),
          recognition: Number(stats?.avgRecognition ?? 0),
        },
      }
    }),

  /**
   * Public — creates a £9.99 one-time Stripe checkout session for staff activation.
   * Validates that the profile exists and is not already activated.
   */
  createStaffActivationCheckout: publicProcedure
    .input(z.object({ staffProfileId: z.string() }))
    .mutation(async ({ input }) => {
      const staff = await db.query.staffProfiles.findFirst({
        where: eq(staffProfiles.id, input.staffProfileId),
      })
      if (!staff) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found." })
      }
      if (staff.removedAt) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This profile is no longer active." })
      }
      if (staff.activatedAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Profile is already activated." })
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "gbp",
              unit_amount: 999,
              product_data: {
                name: "Service Signature — Lifetime Access",
                description: "One-time fee. Unlock your digital staff passport and shareable link.",
              },
            },
            quantity: 1,
          },
        ],
        metadata: { staffProfileId: input.staffProfileId },
        success_url: `${env.PUBLIC_PORTAL_URL}/staff-profile/${input.staffProfileId}?activated=true`,
        cancel_url: `${env.PUBLIC_PORTAL_URL}/staff-profile/${input.staffProfileId}`,
      })

      if (!session.url) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe did not return a checkout URL." })
      }

      return { checkoutUrl: session.url }
    }),
})
