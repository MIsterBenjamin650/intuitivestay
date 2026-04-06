import { db } from "@intuitive-stay/db"
import { feedback, organisations, properties, propertyScores, qrCodes, user } from "@intuitive-stay/db/schema"
import { env } from "@intuitive-stay/env/server"
import { TRPCError } from "@trpc/server"
import { and, count, desc, eq, inArray, max, sql } from "drizzle-orm"
import { z } from "zod"

import { adminProcedure, protectedProcedure, router } from "../index"
import { sendApprovalEmail, sendRejectionEmail } from "../lib/email"
import { generateMagicLinkUrl } from "../lib/generate-magic-link"
import { generateQrPdf, generateUniqueCode } from "../lib/generate-qr"

// ─── Insights helpers ─────────────────────────────────────────────────────────

const TIER_ORDER = ["7d", "30d", "180d", "365d"] as const
type TimeRange = (typeof TIER_ORDER)[number]

type Plan = "host" | "partner" | "founder"
const VALID_PLANS = ["host", "partner", "founder"] as const

function isPlan(p: string): p is Plan {
  return (VALID_PLANS as readonly string[]).includes(p)
}

const PLAN_MAX_RANGE: Record<Plan, TimeRange> = {
  host: "7d",
  partner: "30d",
  founder: "365d",
}

const RANGE_DAYS: Record<TimeRange, number> = {
  "7d": 7,
  "30d": 30,
  "180d": 180,
  "365d": 365,
}

function clampTimeRange(requested: string, plan: string): TimeRange {
  const max = PLAN_MAX_RANGE[plan as Plan] ?? "7d"
  const reqIdx = TIER_ORDER.indexOf(requested as TimeRange)
  const maxIdx = TIER_ORDER.indexOf(max)
  return reqIdx !== -1 && reqIdx <= maxIdx ? (requested as TimeRange) : max
}

function weekStart(date: Date): string {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1)
  d.setUTCDate(diff)
  return d.toISOString().slice(0, 10)
}

function mean(arr: number[]): number {
  if (!arr.length) return 0
  return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
}

const STOP_WORDS = new Set([
  "the","a","an","is","was","it","to","of","and","in","that","this","for","on",
  "with","at","by","from","i","my","we","me","very","so","but","not","be","are",
  "have","had","were","he","she","they","you","your","our","their","its","just",
  "really","when","what","how","did","got","get","no","also","would","could",
  "should","been","has","food","hotel","room","staff","service","time",
])

function extractKeywords(texts: (string | null)[]): { word: string; count: number }[] {
  const freq: Record<string, number> = {}
  for (const text of texts) {
    if (!text) continue
    const words = text
      .toLowerCase()
      .split(/[\s.,!?;:()"'\-]+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w) && /^[a-z]+$/.test(w))
    for (const word of words) {
      freq[word] = (freq[word] ?? 0) + 1
    }
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word, count]) => ({ word, count }))
}

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

      const magicLinkUrl = await generateMagicLinkUrl(property.ownerEmail).catch(() => null)

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
            sendApprovalEmail(property.ownerEmail, property.ownerName, property.name, pdfBuffer, magicLinkUrl ?? undefined),
          )
          .catch((err) => console.error("Failed to generate QR / send approval email:", err))
      } else {
        // QR already exists — just resend the approval email without regenerating
        sendApprovalEmail(property.ownerEmail, property.ownerName, property.name, undefined, magicLinkUrl ?? undefined).catch((err) =>
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

  getAllProperties: adminProcedure.query(async () => {
    // Subquery: MAX(submitted_at) per property
    const lastFeedbackSq = db
      .select({
        propertyId: feedback.propertyId,
        lastFeedbackAt: max(feedback.submittedAt).as("last_feedback_at"),
      })
      .from(feedback)
      .groupBy(feedback.propertyId)
      .as("last_feedback_sq")

    const [rows, [userCountRow]] = await Promise.all([
      db
        .select({
          id: properties.id,
          name: properties.name,
          status: properties.status,
          city: properties.city,
          country: properties.country,
          type: properties.type,
          ownerName: properties.ownerName,
          ownerEmail: properties.ownerEmail,
          createdAt: properties.createdAt,
          plan: organisations.plan,
          avgGcs: propertyScores.avgGcs,
          totalFeedback: propertyScores.totalFeedback,
          lastFeedbackAt: lastFeedbackSq.lastFeedbackAt,
        })
        .from(properties)
        .innerJoin(organisations, eq(properties.organisationId, organisations.id))
        .leftJoin(propertyScores, eq(propertyScores.propertyId, properties.id))
        .leftJoin(lastFeedbackSq, eq(lastFeedbackSq.propertyId, properties.id))
        .orderBy(desc(properties.createdAt)),
      db.select({ total: count() }).from(user),
    ])

    const totalCount = rows.length
    const approvedCount = rows.filter((r) => r.status === "approved").length

    const approvedGcsValues = rows
      .filter((r) => r.status === "approved" && r.avgGcs != null)
      .map((r) => Number(r.avgGcs))
      .filter((n) => !isNaN(n) && n > 0)

    const platformAvgGcs =
      approvedGcsValues.length > 0
        ? Math.round((approvedGcsValues.reduce((a, b) => a + b, 0) / approvedGcsValues.length) * 10) / 10
        : null

    const hostCount = rows.filter((r) => r.plan === "host").length
    const partnerCount = rows.filter((r) => r.plan === "partner").length
    const founderCount = rows.filter((r) => r.plan === "founder").length
    const platformTotalFeedback = rows.reduce((sum, r) => sum + (r.totalFeedback ?? 0), 0)
    const pendingCount = rows.filter((r) => r.status === "pending").length
    const inactiveCount = rows.filter(
      (r) => r.status === "approved" && (r.totalFeedback ?? 0) === 0,
    ).length
    const totalUsers = userCountRow?.total ?? 0

    return {
      properties: rows.map((r) => ({
        ...r,
        avgGcs: r.avgGcs != null ? Number(r.avgGcs) : null,
        totalFeedback: r.totalFeedback ?? 0,
        lastFeedbackAt: r.lastFeedbackAt ?? null,
      })),
      stats: {
        totalCount,
        approvedCount,
        platformAvgGcs,
        hostCount,
        partnerCount,
        founderCount,
        platformTotalFeedback,
        pendingCount,
        inactiveCount,
        totalUsers,
      },
    }
  }),

  getAdminPropertyDetail: adminProcedure
    .input(z.object({ propertyId: z.string() }))
    .query(async ({ input }) => {
      // 1. Property + org plan + scores + qr (single row)
      const [row] = await db
        .select({
          id: properties.id,
          name: properties.name,
          status: properties.status,
          city: properties.city,
          country: properties.country,
          address: properties.address,
          type: properties.type,
          ownerName: properties.ownerName,
          ownerEmail: properties.ownerEmail,
          createdAt: properties.createdAt,
          plan: organisations.plan,
          avgGcs: propertyScores.avgGcs,
          avgResilience: propertyScores.avgResilience,
          avgEmpathy: propertyScores.avgEmpathy,
          avgAnticipation: propertyScores.avgAnticipation,
          avgRecognition: propertyScores.avgRecognition,
          totalFeedback: propertyScores.totalFeedback,
          qrUniqueCode: qrCodes.uniqueCode,
          qrFeedbackUrl: qrCodes.feedbackUrl,
          qrCreatedAt: qrCodes.createdAt,
        })
        .from(properties)
        .innerJoin(organisations, eq(properties.organisationId, organisations.id))
        .leftJoin(propertyScores, eq(propertyScores.propertyId, properties.id))
        .leftJoin(qrCodes, eq(qrCodes.propertyId, properties.id))
        .where(eq(properties.id, input.propertyId))

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })
      }

      // 2. All feedback rows for this property (newest first)
      const feedbackRows = await db
        .select({
          id: feedback.id,
          submittedAt: feedback.submittedAt,
          gcs: feedback.gcs,
          resilience: feedback.resilience,
          empathy: feedback.empathy,
          anticipation: feedback.anticipation,
          recognition: feedback.recognition,
          namedStaffMember: feedback.namedStaffMember,
          ventText: feedback.ventText,
          source: feedback.source,
          mealTime: feedback.mealTime,
        })
        .from(feedback)
        .where(eq(feedback.propertyId, input.propertyId))
        .orderBy(desc(feedback.submittedAt))

      const hasScores = row.avgGcs != null

      return {
        property: {
          id: row.id,
          name: row.name,
          status: row.status,
          city: row.city,
          country: row.country,
          address: row.address,
          type: row.type,
          ownerName: row.ownerName,
          ownerEmail: row.ownerEmail,
          plan: row.plan,
          createdAt: row.createdAt,
        },
        scores: hasScores
          ? {
              avgGcs: Number(row.avgGcs),
              avgResilience: row.avgResilience != null ? Number(row.avgResilience) : null,
              avgEmpathy: row.avgEmpathy != null ? Number(row.avgEmpathy) : null,
              avgAnticipation: row.avgAnticipation != null ? Number(row.avgAnticipation) : null,
              avgRecognition: row.avgRecognition != null ? Number(row.avgRecognition) : null,
              totalFeedback: row.totalFeedback ?? 0,
            }
          : null,
        qrCode: row.qrUniqueCode
          ? {
              uniqueCode: row.qrUniqueCode,
              feedbackUrl: row.qrFeedbackUrl!,
              createdAt: row.qrCreatedAt!,
            }
          : null,
        feedback: feedbackRows.map((f) => ({
          id: f.id,
          submittedAt: f.submittedAt,
          gcs: Number(f.gcs),
          resilience: f.resilience,
          empathy: f.empathy,
          anticipation: f.anticipation,
          recognition: f.recognition,
          namedStaffMember: f.namedStaffMember,
          ventText: f.ventText,
          source: f.source,
          mealTime: f.mealTime,
        })),
      }
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

  getPropertyQrData: protectedProcedure
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

      const qrCode = await db.query.qrCodes.findFirst({
        where: eq(qrCodes.propertyId, input.propertyId),
      })

      const scores = await db.query.propertyScores.findFirst({
        where: eq(propertyScores.propertyId, input.propertyId),
      })

      return {
        qrCode: qrCode
          ? {
              uniqueCode: qrCode.uniqueCode,
              feedbackUrl: qrCode.feedbackUrl,
              createdAt: qrCode.createdAt,
            }
          : null,
        totalSubmissions: scores?.totalFeedback ?? 0,
      }
    }),

  getPropertyInsights: protectedProcedure
    .input(
      z.object({
        propertyId: z.string(),
        timeRange: z.enum(["7d", "30d", "180d", "365d"]).default("30d"),
      }),
    )
    .query(async ({ ctx, input }) => {
      // 1. Verify property belongs to the user's org
      const org = await db.query.organisations.findFirst({
        where: eq(organisations.ownerId, ctx.session.user.id),
      })
      if (!org) throw new TRPCError({ code: "FORBIDDEN" })

      const property = await db.query.properties.findFirst({
        where: eq(properties.id, input.propertyId),
      })
      if (!property) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })
      if (property.organisationId !== org.id) throw new TRPCError({ code: "FORBIDDEN" })

      // 2. Clamp time range to plan — restrict grace/expired orgs to host-level
      const effectivePlan: Plan =
        org.subscriptionStatus === "grace" || org.subscriptionStatus === "expired"
          ? "host"
          : isPlan(org.plan)
            ? org.plan
            : "host"
      const effectiveRange = clampTimeRange(input.timeRange, effectivePlan)
      const startDate = new Date(Date.now() - RANGE_DAYS[effectiveRange] * 24 * 60 * 60 * 1000)

      // 3. Fetch all feedback in range
      const rows = await db
        .select({
          gcs: feedback.gcs,
          resilience: feedback.resilience,
          empathy: feedback.empathy,
          anticipation: feedback.anticipation,
          recognition: feedback.recognition,
          mealTime: feedback.mealTime,
          namedStaffMember: feedback.namedStaffMember,
          ventText: feedback.ventText,
          submittedAt: feedback.submittedAt,
        })
        .from(feedback)
        .where(
          and(
            eq(feedback.propertyId, input.propertyId),
            sql`${feedback.submittedAt} >= ${startDate}`,
          ),
        )
        .orderBy(feedback.submittedAt)

      // 4. Weekly grouping
      const weekMap = new Map<string, number[]>()
      for (const row of rows) {
        const wk = weekStart(row.submittedAt)
        const existing = weekMap.get(wk) ?? []
        existing.push(Number(row.gcs))
        weekMap.set(wk, existing)
      }
      const sortedWeeks = Array.from(weekMap.entries()).sort(([a], [b]) => a.localeCompare(b))

      const gcsOverTime = sortedWeeks.map(([week, gcsList]) => ({
        week,
        avg: mean(gcsList),
      }))

      const submissionsPerWeek = sortedWeeks.map(([week, gcsList]) => ({
        week,
        count: gcsList.length,
      }))

      // 5. Pillar averages + spotlight
      const pillarAverages = {
        resilience: mean(rows.map((r) => r.resilience)),
        empathy: mean(rows.map((r) => r.empathy)),
        anticipation: mean(rows.map((r) => r.anticipation)),
        recognition: mean(rows.map((r) => r.recognition)),
      }
      const pillarEntries = Object.entries(pillarAverages) as [string, number][]
      const strongest = pillarEntries.reduce((a, b) => (b[1] > a[1] ? b : a))
      const weakest = pillarEntries.reduce((a, b) => (b[1] < a[1] ? b : a))

      // 6. Score distribution (1–10)
      const distMap: Record<number, number> = {}
      for (const row of rows) {
        const score = Math.round(Number(row.gcs))
        distMap[score] = (distMap[score] ?? 0) + 1
      }
      const scoreDistribution = Array.from({ length: 10 }, (_, i) => ({
        score: i + 1,
        count: distMap[i + 1] ?? 0,
      }))

      // 7. GCS by meal time
      const mealMap = new Map<string, number[]>()
      for (const row of rows) {
        const meal = row.mealTime ?? "N/A"
        const existing = mealMap.get(meal) ?? []
        existing.push(Number(row.gcs))
        mealMap.set(meal, existing)
      }
      const gcsByMealTime = Array.from(mealMap.entries()).map(([mealTime, gcsList]) => ({
        mealTime,
        avg: mean(gcsList),
      }))

      // 8. Engagement stats
      const totalSubmissions = rows.length
      const happyRows = rows.filter((r) => Number(r.gcs) >= 8)
      const nameDropCount = happyRows.filter((r) => r.namedStaffMember).length
      const nameDropRate =
        happyRows.length > 0 ? Math.round((nameDropCount / happyRows.length) * 100) : 0
      const lowRows = rows.filter((r) => Number(r.gcs) <= 5)
      const ventCount = lowRows.filter((r) => r.ventText).length
      const ventRate =
        lowRows.length > 0 ? Math.round((ventCount / lowRows.length) * 100) : 0

      // 9. Staff tag cloud
      const staffMap = new Map<string, { count: number; totalGcs: number }>()
      for (const row of rows) {
        if (!row.namedStaffMember) continue
        const existing = staffMap.get(row.namedStaffMember) ?? { count: 0, totalGcs: 0 }
        staffMap.set(row.namedStaffMember, {
          count: existing.count + 1,
          totalGcs: existing.totalGcs + Number(row.gcs),
        })
      }
      const staffTagCloud = Array.from(staffMap.entries())
        .map(([name, { count, totalGcs }]) => ({
          name,
          mentions: count,
          avgGcs: Math.round((totalGcs / count) * 10) / 10,
        }))
        .sort((a, b) => b.mentions - a.mentions)

      // 10. Vent keywords (Founder only)
      const ventKeywords =
        effectivePlan === "founder" ? extractKeywords(rows.map((r) => r.ventText)) : []

      return {
        gcsOverTime,
        pillarAverages,
        pillarSpotlight: totalSubmissions > 0
          ? {
              strongest: strongest[0],
              strongestScore: strongest[1],
              weakest: weakest[0],
              weakestScore: weakest[1],
            }
          : null,
        gcsByMealTime,
        submissionsPerWeek,
        scoreDistribution,
        engagementStats: { totalSubmissions, nameDropRate, ventRate },
        staffTagCloud,
        ventKeywords,
        allowedTimeRange: effectiveRange,
        userPlan: effectivePlan,
        subscriptionStatus: org.subscriptionStatus as "none" | "trial" | "active" | "grace" | "expired",
      }
    }),

  getCityLeaderboard: protectedProcedure
    .input(z.object({ propertyId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify ownership
      const org = await db.query.organisations.findFirst({
        where: eq(organisations.ownerId, ctx.session.user.id),
      })
      if (!org) throw new TRPCError({ code: "FORBIDDEN" })

      const property = await db.query.properties.findFirst({
        where: eq(properties.id, input.propertyId),
      })
      if (!property) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })
      if (property.organisationId !== org.id) throw new TRPCError({ code: "FORBIDDEN" })

      const city = property.city

      // Run within-city and national queries in parallel
      const [cityRows, nationalRows] = await Promise.all([
        db
          .select({
            id: properties.id,
            name: properties.name,
            gcs: propertyScores.avgGcs,
          })
          .from(properties)
          .innerJoin(propertyScores, eq(propertyScores.propertyId, properties.id))
          .where(
            and(
              eq(properties.city, city),
              eq(properties.status, "approved"),
              sql`${propertyScores.avgGcs} is not null`,
            ),
          )
          .orderBy(desc(propertyScores.avgGcs)),
        db
          .select({
            city: properties.city,
            avgGcs: sql<string>`round(avg(${propertyScores.avgGcs}::numeric), 2)`,
            propertyCount: count(properties.id),
          })
          .from(properties)
          .innerJoin(propertyScores, eq(propertyScores.propertyId, properties.id))
          .where(
            and(
              eq(properties.status, "approved"),
              sql`${propertyScores.avgGcs} is not null`,
            ),
          )
          .groupBy(properties.city)
          .orderBy(desc(sql`avg(${propertyScores.avgGcs}::numeric)`)),
      ])

      const withinCityRankings = cityRows.map((row, idx) => ({
        rank: idx + 1,
        name: row.id === input.propertyId ? row.name : null,
        isYou: row.id === input.propertyId,
        gcs: Math.round(Number(row.gcs) * 10) / 10,
      }))

      const yourEntry = withinCityRankings.find((r) => r.isYou)
      const yourRank = yourEntry?.rank ?? null
      const yourGcs = yourEntry?.gcs ?? null
      const cityAvgGcs =
        withinCityRankings.length > 0
          ? Math.round(
              (withinCityRankings.reduce((s, r) => s + r.gcs, 0) / withinCityRankings.length) * 10,
            ) / 10
          : null

      const nationalCityRankings = nationalRows.map((row, idx) => ({
        rank: idx + 1,
        city: row.city,
        avgGcs: Math.round(Number(row.avgGcs) * 10) / 10,
        propertyCount: row.propertyCount,
        isYou: row.city === city,
      }))

      return {
        cityName: city,
        yourRank,
        totalInCity: withinCityRankings.length,
        yourGcs,
        cityAvgGcs,
        gapToCityAvg: yourGcs !== null && cityAvgGcs !== null ? Math.round((yourGcs - cityAvgGcs) * 10) / 10 : null,
        withinCityRankings,
        nationalCityRankings,
        userPlan: isPlan(org.plan) ? org.plan : ("host" as Plan),
      }
    }),

  getFounderOverview: protectedProcedure.query(async ({ ctx }) => {
    const org = await db.query.organisations.findFirst({
      where: eq(organisations.ownerId, ctx.session.user.id),
    })
    if (!org) throw new TRPCError({ code: "FORBIDDEN" })
    if (org.plan !== "founder") throw new TRPCError({ code: "FORBIDDEN", message: "Founder plan required" })

    // All properties in org
    const orgProperties = await db
      .select({
        id: properties.id,
        name: properties.name,
        city: properties.city,
        status: properties.status,
      })
      .from(properties)
      .where(eq(properties.organisationId, org.id))

    if (orgProperties.length === 0) {
      return { aggregateGcs: null, totalSubmissions: 0, bestProperty: null, worstProperty: null, properties: [] }
    }

    const propertyIds = orgProperties.map((p) => p.id)

    // Scores and recent feedback in parallel
    const eightWeeksAgo = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000)
    const [scoreRows, recentFeedback] = await Promise.all([
      db
        .select({
          propertyId: propertyScores.propertyId,
          avgGcs: propertyScores.avgGcs,
          avgResilience: propertyScores.avgResilience,
          avgEmpathy: propertyScores.avgEmpathy,
          avgAnticipation: propertyScores.avgAnticipation,
          avgRecognition: propertyScores.avgRecognition,
          totalFeedback: propertyScores.totalFeedback,
        })
        .from(propertyScores)
        .where(inArray(propertyScores.propertyId, propertyIds)),
      db
        .select({
          propertyId: feedback.propertyId,
          gcs: feedback.gcs,
          submittedAt: feedback.submittedAt,
        })
        .from(feedback)
        .where(
          and(
            inArray(feedback.propertyId, propertyIds),
            sql`${feedback.submittedAt} >= ${eightWeeksAgo}`,
          ),
        )
        .orderBy(feedback.submittedAt),
    ])

    const scoreMap = new Map(scoreRows.map((s) => [s.propertyId, s]))

    // Group recent feedback by propertyId → week
    const feedbackByProperty = new Map<string, { week: string; gcs: number }[]>()
    for (const row of recentFeedback) {
      const existing = feedbackByProperty.get(row.propertyId) ?? []
      existing.push({ week: weekStart(row.submittedAt), gcs: Number(row.gcs) })
      feedbackByProperty.set(row.propertyId, existing)
    }

    // Build per-property data
    const propertyData = orgProperties.map((prop) => {
      const scores = scoreMap.get(prop.id)
      const avgGcs = scores?.avgGcs != null ? Math.round(Number(scores.avgGcs) * 10) / 10 : null
      const totalFeedback = scores?.totalFeedback ?? 0

      // Sparkline: last 4 weeks avg GCS
      const rows = feedbackByProperty.get(prop.id) ?? []
      const weekMap = new Map<string, number[]>()
      for (const r of rows) {
        const existing = weekMap.get(r.week) ?? []
        existing.push(r.gcs)
        weekMap.set(r.week, existing)
      }
      const sparkline = Array.from(weekMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-4)
        .map(([week, gcsList]) => ({ week, avg: mean(gcsList) }))

      // Trend delta: last 4 weeks avg vs previous 4 weeks avg
      const allWeeks = Array.from(weekMap.entries()).sort(([a], [b]) => a.localeCompare(b))
      const recentAvg = mean(allWeeks.slice(-4).flatMap(([, v]) => v))
      const prevAvg = mean(allWeeks.slice(-8, -4).flatMap(([, v]) => v))
      const hasPrevData = allWeeks.slice(-8, -4).length > 0
      const trendDelta = hasPrevData ? Math.round((recentAvg - prevAvg) * 10) / 10 : null

      // Pillar averages for strongest/weakest
      const pillars = scores
        ? {
            Resilience: scores.avgResilience != null ? Number(scores.avgResilience) : 0,
            Empathy: scores.avgEmpathy != null ? Number(scores.avgEmpathy) : 0,
            Anticipation: scores.avgAnticipation != null ? Number(scores.avgAnticipation) : 0,
            Recognition: scores.avgRecognition != null ? Number(scores.avgRecognition) : 0,
          }
        : null

      const pillarEntries = pillars ? (Object.entries(pillars) as [string, number][]) : []
      const allZero = pillarEntries.length > 0 && pillarEntries.every(([, v]) => v === 0)
      const strongestPillar =
        pillarEntries.length > 0 && !allZero
          ? pillarEntries.reduce((a, b) => (b[1] > a[1] ? b : a))[0]
          : null
      const weakestPillar =
        pillarEntries.length > 0 && !allZero
          ? pillarEntries.reduce((a, b) => (b[1] < a[1] ? b : a))[0]
          : null

      return {
        id: prop.id,
        name: prop.name,
        city: prop.city,
        status: prop.status,
        avgGcs,
        totalFeedback,
        trendDelta,
        strongestPillar,
        weakestPillar,
        sparkline,
      }
    })

    // Aggregate stats
    const propertiesWithGcs = propertyData.filter((p) => p.avgGcs != null)
    const aggregateGcs =
      propertiesWithGcs.length > 0
        ? Math.round(
            (propertiesWithGcs.reduce((s, p) => s + (p.avgGcs ?? 0), 0) /
              propertiesWithGcs.length) *
              10,
          ) / 10
        : null
    const totalSubmissions = propertyData.reduce((s, p) => s + p.totalFeedback, 0)
    const bestProperty =
      propertiesWithGcs.length > 0
        ? propertiesWithGcs.reduce((a, b) => ((b.avgGcs ?? 0) > (a.avgGcs ?? 0) ? b : a))
        : null
    const worstProperty =
      propertiesWithGcs.length > 1
        ? propertiesWithGcs.reduce((a, b) => ((b.avgGcs ?? 10) < (a.avgGcs ?? 10) ? b : a))
        : null

    return {
      aggregateGcs,
      totalSubmissions,
      bestProperty: bestProperty ? { name: bestProperty.name, avgGcs: bestProperty.avgGcs! } : null,
      worstProperty: worstProperty ? { name: worstProperty.name, avgGcs: worstProperty.avgGcs! } : null,
      properties: propertyData,
    }
  }),
})
