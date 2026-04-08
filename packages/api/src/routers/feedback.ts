import { db } from "@intuitive-stay/db"
import { feedback, feedbackFingerprints, organisations, properties, propertyScores, qrCodes } from "@intuitive-stay/db/schema"
import { TRPCError } from "@trpc/server"
import { and, count, desc, eq, gt, inArray, isNotNull, sql } from "drizzle-orm"
import { z } from "zod"

import { protectedProcedure, publicProcedure, router } from "../index"
import { sendAlertEmail, sendVelocityAlertEmail } from "../lib/email"

/**
 * Recalculates running averages for a property after new feedback is submitted.
 * Uses incremental update: newAvg = (oldAvg * oldCount + newValue) / newCount
 * If no row exists yet, creates one with the new values.
 */
async function updatePropertyScores(
  propertyId: string,
  scores: { resilience: number; empathy: number; anticipation: number; recognition: number; gcs: number },
) {
  const existing = await db.query.propertyScores.findFirst({
    where: eq(propertyScores.propertyId, propertyId),
  })

  if (existing) {
    const total = existing.totalFeedback
    const newTotal = total + 1
    const prev = {
      gcs: Number(existing.avgGcs ?? 0),
      resilience: Number(existing.avgResilience ?? 0),
      empathy: Number(existing.avgEmpathy ?? 0),
      anticipation: Number(existing.avgAnticipation ?? 0),
      recognition: Number(existing.avgRecognition ?? 0),
    }

    await db
      .update(propertyScores)
      .set({
        avgGcs: String(((prev.gcs * total) + scores.gcs) / newTotal),
        avgResilience: String(((prev.resilience * total) + scores.resilience) / newTotal),
        avgEmpathy: String(((prev.empathy * total) + scores.empathy) / newTotal),
        avgAnticipation: String(((prev.anticipation * total) + scores.anticipation) / newTotal),
        avgRecognition: String(((prev.recognition * total) + scores.recognition) / newTotal),
        totalFeedback: newTotal,
        updatedAt: new Date(),
      })
      .where(eq(propertyScores.propertyId, propertyId))
  } else {
    await db.insert(propertyScores).values({
      id: crypto.randomUUID(),
      propertyId,
      avgGcs: String(scores.gcs),
      avgResilience: String(scores.resilience),
      avgEmpathy: String(scores.empathy),
      avgAnticipation: String(scores.anticipation),
      avgRecognition: String(scores.recognition),
      totalFeedback: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }
}

export const feedbackRouter = router({
  /** Public — returns property name for display at the top of the feedback form. */
  getFeedbackFormData: publicProcedure
    .input(z.object({ uniqueCode: z.string() }))
    .query(async ({ input }) => {
      const qrCode = await db.query.qrCodes.findFirst({
        where: eq(qrCodes.uniqueCode, input.uniqueCode),
      })

      if (!qrCode) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid feedback link" })
      }

      const property = await db.query.properties.findFirst({
        where: eq(properties.id, qrCode.propertyId),
      })

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })
      }

      return { propertyName: property.name }
    }),

  /**
   * Public — saves feedback, updates property scores, fires alert email if GCS ≤ 5.
   * Returns feedbackId and gcs so the client can branch to Name Drop or Vent Box.
   */
  submitFeedback: publicProcedure
    .input(
      z.object({
        uniqueCode: z.string(),
        resilience: z.number().int().min(1).max(10),
        empathy: z.number().int().min(1).max(10),
        anticipation: z.number().int().min(1).max(10),
        recognition: z.number().int().min(1).max(10),
        mealTime: z.enum(["breakfast", "lunch", "dinner", "none"]).nullable().optional(),
        guestEmail: z.string().email().optional(),
        adjectives: z.string().optional(),
        /** Browser-derived device fingerprint for duplicate prevention */
        fingerprint: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const qrCode = await db.query.qrCodes.findFirst({
        where: eq(qrCodes.uniqueCode, input.uniqueCode),
      })

      if (!qrCode) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid feedback link" })
      }

      // --- FRAUD CHECK 1: Device fingerprint deduplication (24-hour window) ---
      if (input.fingerprint) {
        const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000)
        const [existing] = await db
          .select({ id: feedbackFingerprints.id })
          .from(feedbackFingerprints)
          .where(
            and(
              eq(feedbackFingerprints.propertyId, qrCode.propertyId),
              eq(feedbackFingerprints.fingerprint, input.fingerprint),
              gt(feedbackFingerprints.submittedAt, windowStart),
            ),
          )
          .limit(1)

        if (existing) {
          // Already submitted from this device in the last 24 hours — silently block
          return { feedbackId: null, gcs: null, blocked: true }
        }
      }

      const gcs = (input.resilience + input.empathy + input.anticipation + input.recognition) / 4

      // --- FRAUD CHECK 2: Uniform score detection ---
      const isUniformScore =
        input.resilience === input.empathy &&
        input.empathy === input.anticipation &&
        input.anticipation === input.recognition

      const feedbackId = crypto.randomUUID()
      await db.insert(feedback).values({
        id: feedbackId,
        propertyId: qrCode.propertyId,
        qrCodeId: qrCode.id,
        resilience: input.resilience,
        empathy: input.empathy,
        anticipation: input.anticipation,
        recognition: input.recognition,
        gcs: gcs.toFixed(2),
        mealTime: input.mealTime ?? null,
        guestEmail: input.guestEmail ?? null,
        adjectives: input.adjectives ?? null,
        isUniformScore,
        source: "qr_form",
        submittedAt: new Date(),
      })

      // Save fingerprint to prevent duplicate submissions within 24 hours
      if (input.fingerprint) {
        await db.insert(feedbackFingerprints).values({
          id: crypto.randomUUID(),
          propertyId: qrCode.propertyId,
          fingerprint: input.fingerprint,
          submittedAt: new Date(),
        })
      }

      // Update running averages — awaited to keep scores fresh
      await updatePropertyScores(qrCode.propertyId, {
        resilience: input.resilience,
        empathy: input.empathy,
        anticipation: input.anticipation,
        recognition: input.recognition,
        gcs,
      })

      // Fire-and-forget alert email for low scores
      if (gcs <= 5) {
        const property = await db.query.properties.findFirst({
          where: eq(properties.id, qrCode.propertyId),
        })

        if (property) {
          sendAlertEmail(
            property.ownerEmail,
            property.ownerName,
            property.name,
            property.id,
            feedbackId,
            gcs,
            {
              resilience: input.resilience,
              empathy: input.empathy,
              anticipation: input.anticipation,
              recognition: input.recognition,
            },
          ).catch((err) => console.error("Failed to send alert email:", err))
        }
      }

      // --- FRAUD CHECK 3: Submission velocity alert (5+ in 30 minutes) ---
      const VELOCITY_WINDOW_MINUTES = 30
      const VELOCITY_THRESHOLD = 5
      const velocityWindowStart = new Date(Date.now() - VELOCITY_WINDOW_MINUTES * 60 * 1000)
      const [velocityResult] = await db
        .select({ total: count() })
        .from(feedback)
        .where(
          and(
            eq(feedback.propertyId, qrCode.propertyId),
            gt(feedback.submittedAt, velocityWindowStart),
          ),
        )

      const recentCount = velocityResult?.total ?? 0
      // Alert on the exact threshold and every 5 after (5, 10, 15…) to avoid email spam
      if (recentCount >= VELOCITY_THRESHOLD && recentCount % VELOCITY_THRESHOLD === 0) {
        const property = await db.query.properties.findFirst({
          where: eq(properties.id, qrCode.propertyId),
        })
        if (property) {
          sendVelocityAlertEmail(property.name, recentCount, VELOCITY_WINDOW_MINUTES).catch(
            (err) => console.error("Failed to send velocity alert email:", err),
          )
        }
      }

      return { feedbackId, gcs, blocked: false }
    }),

  /** Public — saves staff name nomination from Name Drop™ screen (GCS ≥ 8). */
  submitNameDrop: publicProcedure
    .input(z.object({ feedbackId: z.string(), uniqueCode: z.string(), staffName: z.string().min(1).max(100) }))
    .mutation(async ({ input }) => {
      // Verify the feedback row belongs to the QR code from this session
      const qrCode = await db.query.qrCodes.findFirst({
        where: eq(qrCodes.uniqueCode, input.uniqueCode),
      })

      if (!qrCode) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid feedback link" })
      }

      const row = await db.query.feedback.findFirst({
        where: and(eq(feedback.id, input.feedbackId), eq(feedback.qrCodeId, qrCode.id)),
      })

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Feedback not found" })
      }

      await db
        .update(feedback)
        .set({ namedStaffMember: input.staffName })
        .where(eq(feedback.id, input.feedbackId))
      return { ok: true }
    }),

  /** Public — saves private vent text from Vent Box™ screen (GCS ≤ 5). */
  submitVentText: publicProcedure
    .input(z.object({ feedbackId: z.string(), uniqueCode: z.string(), text: z.string().min(1).max(2000) }))
    .mutation(async ({ input }) => {
      // Verify the feedback row belongs to the QR code from this session
      const qrCode = await db.query.qrCodes.findFirst({
        where: eq(qrCodes.uniqueCode, input.uniqueCode),
      })

      if (!qrCode) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid feedback link" })
      }

      const row = await db.query.feedback.findFirst({
        where: and(eq(feedback.id, input.feedbackId), eq(feedback.qrCodeId, qrCode.id)),
      })

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Feedback not found" })
      }

      await db
        .update(feedback)
        .set({ ventText: input.text })
        .where(eq(feedback.id, input.feedbackId))
      return { ok: true }
    }),

  /**
   * Protected — returns count of all low-GCS feedback (GCS ≤ 5) across the
   * owner's properties. Used by the portal topbar notification badge.
   */
  getRedAlertCount: protectedProcedure.query(async ({ ctx }) => {
    const org = await db.query.organisations.findFirst({
      where: eq(organisations.ownerId, ctx.session.user.id),
    })

    if (!org) return 0

    const userProperties = await db
      .select({ id: properties.id })
      .from(properties)
      .where(eq(properties.organisationId, org.id))

    if (userProperties.length === 0) return 0

    const propertyIds = userProperties.map((p) => p.id)

    const [result] = await db
      .select({ total: count() })
      .from(feedback)
      .where(
        and(
          inArray(feedback.propertyId, propertyIds),
          sql`${feedback.gcs}::numeric <= 5`,
          eq(feedback.seenByOwner, false),
        ),
      )

    return result?.total ?? 0
  }),

  /**
   * Protected — returns the most recent unread low-score alerts (GCS ≤ 5, seenByOwner = false)
   * across all of the owner's properties. Used by the notification bell popover.
   * Capped at 10 entries.
   */
  getRecentUnreadAlerts: protectedProcedure.query(async ({ ctx }) => {
    const org = await db.query.organisations.findFirst({
      where: eq(organisations.ownerId, ctx.session.user.id),
    })
    if (!org) return []

    const userProperties = await db
      .select({ id: properties.id, name: properties.name })
      .from(properties)
      .where(eq(properties.organisationId, org.id))

    if (userProperties.length === 0) return []

    const propertyIds = userProperties.map((p) => p.id)
    const propertyNameMap = Object.fromEntries(userProperties.map((p) => [p.id, p.name]))

    const rows = await db
      .select({
        id: feedback.id,
        propertyId: feedback.propertyId,
        gcs: feedback.gcs,
        ventText: feedback.ventText,
        submittedAt: feedback.submittedAt,
      })
      .from(feedback)
      .where(
        and(
          inArray(feedback.propertyId, propertyIds),
          sql`${feedback.gcs}::numeric <= 5`,
          eq(feedback.seenByOwner, false),
        ),
      )
      .orderBy(desc(feedback.submittedAt))
      .limit(10)

    return rows.map((row) => ({
      id: row.id,
      propertyId: row.propertyId,
      propertyName: propertyNameMap[row.propertyId] ?? "Unknown",
      gcs: Number(row.gcs),
      ventText: row.ventText,
      submittedAt: row.submittedAt,
    }))
  }),

  /**
   * Protected — marks all low-score alerts (GCS ≤ 5) as seen for a property.
   * Called when the owner visits a property's Alerts page, clearing the badge count.
   */
  markAlertsRead: protectedProcedure
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

      await db
        .update(feedback)
        .set({ seenByOwner: true })
        .where(
          and(
            eq(feedback.propertyId, input.propertyId),
            sql`${feedback.gcs}::numeric <= 5`,
            eq(feedback.seenByOwner, false),
          ),
        )

      return { ok: true }
    }),

  getPropertyFeedbackSummary: protectedProcedure
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

      const scores = await db.query.propertyScores.findFirst({
        where: eq(propertyScores.propertyId, input.propertyId),
      })

      const pillarScores = [
        {
          pillar: "Resilience",
          score: scores?.avgResilience != null ? Number(scores.avgResilience) : 0,
        },
        {
          pillar: "Empathy",
          score: scores?.avgEmpathy != null ? Number(scores.avgEmpathy) : 0,
        },
        {
          pillar: "Anticipation",
          score: scores?.avgAnticipation != null ? Number(scores.avgAnticipation) : 0,
        },
        {
          pillar: "Recognition",
          score: scores?.avgRecognition != null ? Number(scores.avgRecognition) : 0,
        },
      ]

      const mentionRows = await db
        .select({ name: feedback.namedStaffMember })
        .from(feedback)
        .where(and(eq(feedback.propertyId, input.propertyId), isNotNull(feedback.namedStaffMember)))

      const mentionMap: Record<string, number> = {}
      for (const row of mentionRows) {
        if (row.name) {
          mentionMap[row.name] = (mentionMap[row.name] ?? 0) + 1
        }
      }
      const staffMentions = Object.entries(mentionMap)
        .map(([name, mentions]) => ({ name, mentions }))
        .sort((a, b) => b.mentions - a.mentions)
        .slice(0, 10)

      return {
        pillarScores,
        staffMentions,
        totalFeedback: scores?.totalFeedback ?? 0,
      }
    }),

  getPropertyAlertFeedback: protectedProcedure
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

      const alertRows = await db
        .select()
        .from(feedback)
        .where(
          and(
            eq(feedback.propertyId, input.propertyId),
            sql`${feedback.gcs}::numeric <= 5`,
          ),
        )
        .orderBy(desc(feedback.submittedAt))
        .limit(20)

      return alertRows.map((row) => ({
        id: row.id,
        gcs: Number(row.gcs),
        resilience: row.resilience,
        empathy: row.empathy,
        anticipation: row.anticipation,
        recognition: row.recognition,
        ventText: row.ventText,
        guestEmail: row.guestEmail,
        isUniformScore: row.isUniformScore,
        submittedAt: row.submittedAt,
      }))
    }),

  /**
   * Protected — returns all feedback flagged as uniform score (all 4 pillars identical)
   * for a property, ordered most recent first. Used on the Alerts page Flagged tab.
   */
  getUniformScoreFeedback: protectedProcedure
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

      const rows = await db
        .select()
        .from(feedback)
        .where(
          and(
            eq(feedback.propertyId, input.propertyId),
            eq(feedback.isUniformScore, true),
          ),
        )
        .orderBy(desc(feedback.submittedAt))
        .limit(50)

      return rows.map((row) => ({
        id: row.id,
        gcs: Number(row.gcs),
        resilience: row.resilience,
        empathy: row.empathy,
        anticipation: row.anticipation,
        recognition: row.recognition,
        mealTime: row.mealTime,
        submittedAt: row.submittedAt,
      }))
    }),

  /**
   * Protected — returns paginated raw feedback submissions for a property,
   * most recent first. Used on the Feedback Log page.
   */
  getFeedbackLog: protectedProcedure
    .input(z.object({ propertyId: z.string(), offset: z.number().int().min(0).default(0) }))
    .query(async ({ ctx, input }) => {
      const PAGE_SIZE = 50

      const org = await db.query.organisations.findFirst({
        where: eq(organisations.ownerId, ctx.session.user.id),
      })
      if (!org) throw new TRPCError({ code: "FORBIDDEN" })

      const property = await db.query.properties.findFirst({
        where: eq(properties.id, input.propertyId),
      })
      if (!property) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })
      if (property.organisationId !== org.id) throw new TRPCError({ code: "FORBIDDEN" })

      const [rows, totalResult] = await Promise.all([
        db
          .select()
          .from(feedback)
          .where(eq(feedback.propertyId, input.propertyId))
          .orderBy(desc(feedback.submittedAt))
          .limit(PAGE_SIZE)
          .offset(input.offset),
        db
          .select({ total: count() })
          .from(feedback)
          .where(eq(feedback.propertyId, input.propertyId)),
      ])

      return {
        rows: rows.map((row) => ({
          id: row.id,
          gcs: Number(row.gcs),
          resilience: row.resilience,
          empathy: row.empathy,
          anticipation: row.anticipation,
          recognition: row.recognition,
          ventText: row.ventText,
          guestEmail: row.guestEmail,
          namedStaffMember: row.namedStaffMember,
          mealTime: row.mealTime,
          isUniformScore: row.isUniformScore,
          submittedAt: row.submittedAt,
        })),
        total: totalResult[0]?.total ?? 0,
        pageSize: PAGE_SIZE,
      }
    }),
})
