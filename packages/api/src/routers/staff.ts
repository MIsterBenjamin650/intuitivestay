import { db } from "@intuitive-stay/db"
import { feedback, organisations, properties, staffCommendations, staffProfiles } from "@intuitive-stay/db/schema"
import { env } from "@intuitive-stay/env/server"
import { TRPCError } from "@trpc/server"
import { and, asc, count, desc, eq, isNotNull, isNull, sql } from "drizzle-orm"
import Stripe from "stripe"
import { z } from "zod"

import { sendProfileLinkEmail, sendStaffCommendationEmail, sendStaffVerificationEmail } from "../lib/email"
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
        emailVerificationTokenExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
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

      if (staff.emailVerificationTokenExpiresAt && staff.emailVerificationTokenExpiresAt < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Verification link has expired. Please request a new one.",
        })
      }

      await db
        .update(staffProfiles)
        .set({
          emailVerifiedAt: new Date(),
          emailVerificationToken: null,
          emailVerificationTokenExpiresAt: null,
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
        .select({
          id: staffProfiles.id,
          name: staffProfiles.name,
          email: staffProfiles.email,
          role: staffProfiles.role,
          createdAt: staffProfiles.createdAt,
          emailVerifiedAt: staffProfiles.emailVerifiedAt,
          nominations: count(feedback.id),
          avgGcs: sql<string>`COALESCE(avg(${feedback.gcs}::numeric), 0)`,
        })
        .from(staffProfiles)
        .leftJoin(feedback, eq(feedback.staffProfileId, staffProfiles.id))
        .where(
          and(
            eq(staffProfiles.propertyId, input.propertyId),
            isNull(staffProfiles.removedAt),
          ),
        )
        .groupBy(staffProfiles.id)
        .orderBy(desc(count(feedback.id)), asc(staffProfiles.name))

      return staff.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        role: s.role ?? null,
        createdAt: s.createdAt,
        emailVerifiedAt: s.emailVerifiedAt,
        nominations: s.nominations,
        avgGcs: Number(s.avgGcs),
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
   * Protected — owner updates the job title/role for a staff member at their property.
   */
  updateStaffRole: protectedProcedure
    .input(z.object({ staffProfileId: z.string(), role: z.string().max(80) }))
    .mutation(async ({ ctx, input }) => {
      const org = await db.query.organisations.findFirst({
        where: eq(organisations.ownerId, ctx.session.user.id),
      })
      if (!org) throw new TRPCError({ code: "FORBIDDEN" })

      const staff = await db.query.staffProfiles.findFirst({
        where: eq(staffProfiles.id, input.staffProfileId),
      })
      if (!staff) throw new TRPCError({ code: "NOT_FOUND", message: "Staff member not found." })

      const property = await db.query.properties.findFirst({
        where: and(
          eq(properties.id, staff.propertyId),
          eq(properties.organisationId, org.id),
        ),
      })
      if (!property) throw new TRPCError({ code: "FORBIDDEN" })

      await db
        .update(staffProfiles)
        .set({ role: input.role.trim() || null })
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

      const peakMealRows = await db
        .select({
          mealTime: feedback.mealTime,
          nominations: count(),
        })
        .from(feedback)
        .where(and(eq(feedback.staffProfileId, input.staffProfileId), isNotNull(feedback.mealTime)))
        .groupBy(feedback.mealTime)
        .orderBy(desc(count()))
        .limit(1)
      const peakMealTime = peakMealRows[0]?.mealTime ?? null

      const [trendStats] = await db
        .select({
          avgLast30: sql<string>`COALESCE(avg(${feedback.gcs}::numeric) FILTER (WHERE ${feedback.submittedAt} >= NOW() - INTERVAL '30 days'), 0)`,
          avgPrior30: sql<string>`COALESCE(avg(${feedback.gcs}::numeric) FILTER (WHERE ${feedback.submittedAt} >= NOW() - INTERVAL '60 days' AND ${feedback.submittedAt} < NOW() - INTERVAL '30 days'), 0)`,
        })
        .from(feedback)
        .where(and(eq(feedback.staffProfileId, input.staffProfileId), sql`${feedback.submittedAt} >= NOW() - INTERVAL '60 days'`))
      const avgLast30 = Number(trendStats?.avgLast30 ?? 0)
      const avgPrior30 = Number(trendStats?.avgPrior30 ?? 0)
      const scoreTrend: "up" | "stable" | "down" =
        avgLast30 === 0 && avgPrior30 === 0 ? "stable"
        : avgLast30 >= avgPrior30 + 0.5 ? "up"
        : avgLast30 <= avgPrior30 - 0.5 ? "down"
        : "stable"

      const [consistencyStats] = await db
        .select({ stddev: sql<string>`COALESCE(stddev_pop(${feedback.gcs}::numeric), 0)` })
        .from(feedback)
        .where(eq(feedback.staffProfileId, input.staffProfileId))
      const stddev = Number(consistencyStats?.stddev ?? 0)
      const consistencyRating: "Very Consistent" | "Consistent" | "Variable" =
        stddev < 1.0 ? "Very Consistent" : stddev < 2.0 ? "Consistent" : "Variable"

      const adjectiveRows = await db
        .select({
          adjective: sql<string>`trim(unnest(string_to_array(${feedback.adjectives}, ',')))`,
          occurrences: sql<string>`count(*)`,
        })
        .from(feedback)
        .where(and(eq(feedback.staffProfileId, input.staffProfileId), isNotNull(feedback.adjectives), sql`${feedback.adjectives} <> ''`))
        .groupBy(sql`trim(unnest(string_to_array(${feedback.adjectives}, ',')))`)
        .orderBy(desc(sql`count(*)`))
        .limit(8)
      const topAdjectives = adjectiveRows.map((r) => r.adjective).filter(Boolean)

      const [nomMonthStats] = await db
        .select({
          total: count(),
          firstAt: sql<string>`min(${feedback.submittedAt})`,
          last30: sql<string>`count(*) FILTER (WHERE ${feedback.submittedAt} >= NOW() - INTERVAL '30 days')`,
        })
        .from(feedback)
        .where(eq(feedback.staffProfileId, input.staffProfileId))
      const totalNoms = Number(nomMonthStats?.total ?? 0)
      const last30Nominations = Number(nomMonthStats?.last30 ?? 0)
      const firstAt = nomMonthStats?.firstAt ? new Date(nomMonthStats.firstAt) : null
      const monthsActive = firstAt ? Math.max(1, (Date.now() - firstAt.getTime()) / (1000 * 60 * 60 * 24 * 30)) : 1
      const nominationsPerMonth = totalNoms === 0 ? 0 : Math.round((totalNoms / monthsActive) * 10) / 10

      return {
        id: staff.id,
        name: staff.name,
        propertyName: property?.name ?? "Unknown Property",
        createdAt: staff.createdAt,
        nominations: stats?.nominations ?? 0,
        avgGcs: Number(stats?.avgGcs ?? 0),
        pillarAverages: {
          resilience: Number(stats?.avgResilience ?? 0),
          empathy: Number(stats?.avgEmpathy ?? 0),
          anticipation: Number(stats?.avgAnticipation ?? 0),
          recognition: Number(stats?.avgRecognition ?? 0),
        },
        role: staff.role ?? null,
        peakMealTime,
        scoreTrend,
        consistencyRating,
        topAdjectives,
        nominationsPerMonth,
        last30Nominations,
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

  /**
   * Protected — owner writes a commendation for a verified, non-removed staff member
   * at their own property. authorName is stored at write time from the session.
   */
  addCommendation: protectedProcedure
    .input(
      z.object({
        staffProfileId: z.string(),
        body: z.string().min(10).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const org = await db.query.organisations.findFirst({
        where: eq(organisations.ownerId, ctx.session.user.id),
      })
      if (!org) throw new TRPCError({ code: "FORBIDDEN" })

      const staff = await db.query.staffProfiles.findFirst({
        where: eq(staffProfiles.id, input.staffProfileId),
      })
      if (!staff) throw new TRPCError({ code: "NOT_FOUND", message: "Staff member not found." })
      if (staff.removedAt) throw new TRPCError({ code: "FORBIDDEN", message: "This staff member has been removed." })
      if (!staff.emailVerifiedAt) throw new TRPCError({ code: "FORBIDDEN", message: "Staff member has not verified their email." })

      // Verify staff belongs to a property owned by this org
      const property = await db.query.properties.findFirst({
        where: and(
          eq(properties.id, staff.propertyId),
          eq(properties.organisationId, org.id),
        ),
      })
      if (!property) throw new TRPCError({ code: "FORBIDDEN" })

      await db.insert(staffCommendations).values({
        id: crypto.randomUUID(),
        staffProfileId: input.staffProfileId,
        propertyId: staff.propertyId,
        authorName: ctx.session.user.name ?? "Property Manager",
        body: input.body.trim(),
        createdAt: new Date(),
      })

      // Fire-and-forget — don't block response if email fails
      sendStaffCommendationEmail(
        staff.email,
        staff.name,
        ctx.session.user.name ?? "Property Manager",
        property.name,
        input.staffProfileId,
      ).catch(console.error)

      return { ok: true }
    }),

  /**
   * Public — returns all commendations for a staff member, newest first.
   * Joins properties to include propertyName alongside each entry.
   */
  getCommendations: publicProcedure
    .input(z.object({ staffProfileId: z.string() }))
    .query(async ({ input }) => {
      const rows = await db
        .select({
          id: staffCommendations.id,
          authorName: staffCommendations.authorName,
          body: staffCommendations.body,
          createdAt: staffCommendations.createdAt,
          propertyName: properties.name,
        })
        .from(staffCommendations)
        .innerJoin(properties, eq(staffCommendations.propertyId, properties.id))
        .where(eq(staffCommendations.staffProfileId, input.staffProfileId))
        .orderBy(desc(staffCommendations.createdAt))

      return rows
    }),

  /**
   * Public — staff enter their email to receive profile link(s).
   * Always returns { ok: true } — never reveals if an email has a profile.
   * Verified profiles get a profile link; unverified profiles get a verification email.
   */
  requestProfileLink: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const normalizedEmail = input.email.toLowerCase()

      // Verified profiles → send profile link
      const verifiedProfiles = await db
        .select({
          id: staffProfiles.id,
          name: staffProfiles.name,
          propertyId: staffProfiles.propertyId,
        })
        .from(staffProfiles)
        .where(
          and(
            eq(staffProfiles.email, normalizedEmail),
            isNotNull(staffProfiles.emailVerifiedAt),
            isNull(staffProfiles.removedAt),
          ),
        )

      if (verifiedProfiles.length > 0) {
        const profilesWithProperty = await Promise.all(
          verifiedProfiles.map(async (p) => {
            const property = await db.query.properties.findFirst({
              where: eq(properties.id, p.propertyId),
            })
            return {
              name: p.name,
              propertyName: property?.name ?? "Unknown Property",
              staffProfileId: p.id,
            }
          }),
        )
        sendProfileLinkEmail(normalizedEmail, profilesWithProperty).catch(console.error)
      }

      // Unverified profiles → resend verification email
      const unverifiedProfiles = await db
        .select({
          id: staffProfiles.id,
          name: staffProfiles.name,
          propertyId: staffProfiles.propertyId,
          emailVerificationToken: staffProfiles.emailVerificationToken,
        })
        .from(staffProfiles)
        .where(
          and(
            eq(staffProfiles.email, normalizedEmail),
            isNull(staffProfiles.emailVerifiedAt),
            isNull(staffProfiles.removedAt),
          ),
        )

      for (const p of unverifiedProfiles) {
        const property = await db.query.properties.findFirst({
          where: eq(properties.id, p.propertyId),
        })
        const token = crypto.randomUUID()
        await db
          .update(staffProfiles)
          .set({
            emailVerificationToken: token,
            emailVerificationTokenExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
          })
          .where(eq(staffProfiles.id, p.id))
        sendStaffVerificationEmail(
          normalizedEmail,
          p.name,
          property?.name ?? "Unknown Property",
          token,
        ).catch(console.error)
      }

      return { ok: true }
    }),

  /**
   * Protected — owner resends the verification email for a pending (unverified) staff member.
   * Regenerates the token each time so old links are invalidated.
   */
  resendVerificationEmail: protectedProcedure
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
      if (staff.removedAt) throw new TRPCError({ code: "FORBIDDEN", message: "This staff member has been removed." })
      if (staff.emailVerifiedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "This staff member has already verified their email." })

      const property = await db.query.properties.findFirst({
        where: and(
          eq(properties.id, staff.propertyId),
          eq(properties.organisationId, org.id),
        ),
      })
      if (!property) throw new TRPCError({ code: "FORBIDDEN" })

      const newToken = crypto.randomUUID()
      await db
        .update(staffProfiles)
        .set({
          emailVerificationToken: newToken,
          emailVerificationTokenExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
        })
        .where(eq(staffProfiles.id, input.staffProfileId))

      sendStaffVerificationEmail(
        staff.email,
        staff.name,
        property.name,
        newToken,
      ).catch(console.error)

      return { ok: true }
    }),
})
