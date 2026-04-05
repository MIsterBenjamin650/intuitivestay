import { db } from "@intuitive-stay/db"
import { feedback, organisations, properties, propertyScores, qrCodes } from "@intuitive-stay/db/schema"
import { env } from "@intuitive-stay/env/server"
import { TRPCError } from "@trpc/server"
import { and, count, eq, inArray, sql } from "drizzle-orm"
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

  getPortfolioDashboard: protectedProcedure.query(async ({ ctx }) => {
    const org = await db.query.organisations.findFirst({
      where: eq(organisations.ownerId, ctx.session.user.id),
    })

    if (!org) {
      return { portfolioGcs: null, activeCount: 0, alertCount: 0, monthlyTrend: [] }
    }

    const orgProperties = await db
      .select({ id: properties.id, status: properties.status })
      .from(properties)
      .where(eq(properties.organisationId, org.id))

    const activeCount = orgProperties.filter((p) => p.status === "approved").length
    const propertyIds = orgProperties.map((p) => p.id)

    if (propertyIds.length === 0) {
      return { portfolioGcs: null, activeCount, alertCount: 0, monthlyTrend: [] }
    }

    // Portfolio GCS = average of all properties' avgGcs
    const scoreRows = await db
      .select({ avgGcs: propertyScores.avgGcs })
      .from(propertyScores)
      .where(inArray(propertyScores.propertyId, propertyIds))

    const validScores = scoreRows
      .map((r) => Number(r.avgGcs))
      .filter((n) => !isNaN(n) && n > 0)
    const portfolioGcs =
      validScores.length > 0
        ? Math.round((validScores.reduce((a, b) => a + b, 0) / validScores.length) * 10) / 10
        : null

    // Alert count = feedback where GCS <= 5
    const [alertResult] = await db
      .select({ total: count() })
      .from(feedback)
      .where(and(inArray(feedback.propertyId, propertyIds), sql`${feedback.gcs}::numeric <= 5`))
    const alertCount = alertResult?.total ?? 0

    // Monthly trend: avg GCS per month (last 6 months)
    const trendRows = await db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${feedback.submittedAt}), 'Mon YYYY')`,
        avgGcs: sql<string>`round(avg(${feedback.gcs}::numeric), 2)`,
      })
      .from(feedback)
      .where(
        and(
          inArray(feedback.propertyId, propertyIds),
          sql`${feedback.submittedAt} >= now() - interval '6 months'`,
        ),
      )
      .groupBy(sql`date_trunc('month', ${feedback.submittedAt})`)
      .orderBy(sql`date_trunc('month', ${feedback.submittedAt})`)

    const monthlyTrend = trendRows.map((r) => ({
      month: r.month,
      score: Number(r.avgGcs),
    }))

    return { portfolioGcs, activeCount, alertCount, monthlyTrend }
  }),

  getPropertyDashboard: protectedProcedure
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

      return {
        name: property.name,
        type: property.type,
        city: property.city,
        country: property.country,
        status: property.status,
        avgGcs: scores?.avgGcs != null ? Number(scores.avgGcs) : null,
        totalFeedback: scores?.totalFeedback ?? 0,
        avgResilience: scores?.avgResilience != null ? Number(scores.avgResilience) : null,
        avgEmpathy: scores?.avgEmpathy != null ? Number(scores.avgEmpathy) : null,
        avgAnticipation: scores?.avgAnticipation != null ? Number(scores.avgAnticipation) : null,
        avgRecognition: scores?.avgRecognition != null ? Number(scores.avgRecognition) : null,
      }
    }),
})
