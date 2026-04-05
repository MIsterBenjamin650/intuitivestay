import { db } from "@intuitive-stay/db"
import { feedback, organisations, properties, propertyScores, qrCodes } from "@intuitive-stay/db/schema"
import { TRPCError } from "@trpc/server"
import { and, count, eq, inArray, isNotNull, sql } from "drizzle-orm"
import { z } from "zod"

import { protectedProcedure, publicProcedure, router } from "../index"
import { sendAlertEmail } from "../lib/email"

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
      }),
    )
    .mutation(async ({ input }) => {
      const qrCode = await db.query.qrCodes.findFirst({
        where: eq(qrCodes.uniqueCode, input.uniqueCode),
      })

      if (!qrCode) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid feedback link" })
      }

      const gcs = (input.resilience + input.empathy + input.anticipation + input.recognition) / 4

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
        source: "qr_form",
        submittedAt: new Date(),
      })

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
          sendAlertEmail(property.ownerEmail, property.ownerName, property.name, gcs, {
            resilience: input.resilience,
            empathy: input.empathy,
            anticipation: input.anticipation,
            recognition: input.recognition,
          }).catch((err) => console.error("Failed to send alert email:", err))
        }
      }

      return { feedbackId, gcs }
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
          sql`${feedback.gcs} <= 5`,
        ),
      )

    return result?.total ?? 0
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
})
