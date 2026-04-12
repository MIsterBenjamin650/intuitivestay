import { db } from "@intuitive-stay/db"
import { aiDailySummaries, dashboardCache, feedback, leaderboardCache, organisations, properties, propertyScores, propertyTiers, qrCodes, user } from "@intuitive-stay/db/schema"
import { env } from "@intuitive-stay/env/server"
import { TRPCError } from "@trpc/server"
import { and, avg, count, desc, eq, gte, inArray, isNotNull, isNull, lt, max, ne, or, sql } from "drizzle-orm"
import Stripe from "stripe"
import { z } from "zod"

import { adminProcedure, protectedProcedure, publicProcedure, router } from "../index"
import { generateAndActivateProperty } from "../lib/activate-property"
import { assertPropertyAccess } from "../lib/access"
import { sendAdditionalPropertyPaymentEmail, sendApprovalEmail, sendBusinessEmailVerification, sendNewPropertyNotificationEmail, sendRejectionEmail } from "../lib/email"
import { generateQrPdf } from "../lib/generate-qr"

const stripe = new Stripe(env.STRIPE_SECRET_KEY)

// ─── Insights helpers ─────────────────────────────────────────────────────────

const TIER_ORDER = ["7d", "30d", "180d", "365d"] as const
type TimeRange = (typeof TIER_ORDER)[number]

type Plan = "member" | "host" | "partner" | "founder"
const VALID_PLANS = ["member", "host", "partner", "founder"] as const

function isPlan(p: string): p is Plan {
  return (VALID_PLANS as readonly string[]).includes(p)
}

const PLAN_MAX_RANGE: Record<Plan, TimeRange> = {
  member: "7d",
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

// ─── Additional property billing ─────────────────────────────────────────────

/** Number of properties included at no extra charge per plan */
export const PLAN_PROPERTY_LIMITS: Record<string, number> = {
  member: 0,
  host: 1,
  partner: 1,
  founder: 5,
}

/** Display prices for the cost breakdown shown in the Add Property form */
export const PLAN_BASE_PRICES: Record<string, string> = {
  host: "£34.99",
  partner: "£79.99",
  founder: "£189.99",
}

/** Additional property monthly charge */
export const ADDITIONAL_PROPERTY_PRICE = 25.00

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

// ─── Dashboard cache helpers ──────────────────────────────────────────────────

const CACHE_TTL_MS = 24 * 60 * 60 * 1000  // 24 hours

type DashboardCachePayload = {
  stats:        { totalFeedback: number; avgGcs: number | null }
  gcsHistory:   Array<{ bucket: string; gcs: number | null; resilience: number | null; empathy: number | null; anticipation: number | null; recognition: number | null }>
  wordCloud:    Array<{ word: string; count: number }>
  staffBubbles: Array<{ name: string; count: number; sentiment: "positive" | "neutral" | "negative" }>
}

export async function computeDashboardCache(propertyId: string, days: number): Promise<DashboardCachePayload> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  // Stats
  const [statsRow] = await db
    .select({ totalFeedback: count(), avgGcs: avg(feedback.gcs) })
    .from(feedback)
    .where(and(eq(feedback.propertyId, propertyId), gte(feedback.submittedAt, since)))
  const stats = {
    totalFeedback: statsRow?.totalFeedback ?? 0,
    avgGcs: statsRow?.avgGcs != null ? Number(statsRow.avgGcs) : null,
  }

  // GCS history
  const bucketExpr = days > 30
    ? sql<string>`to_char(date_trunc('week', ${feedback.submittedAt}), 'YYYY-MM-DD')`
    : sql<string>`to_char(${feedback.submittedAt}, 'YYYY-MM-DD')`
  const historyRows = await db
    .select({
      bucket: bucketExpr,
      gcs: avg(feedback.gcs),
      resilience: avg(sql<number>`${feedback.resilience}::numeric`),
      empathy: avg(sql<number>`${feedback.empathy}::numeric`),
      anticipation: avg(sql<number>`${feedback.anticipation}::numeric`),
      recognition: avg(sql<number>`${feedback.recognition}::numeric`),
    })
    .from(feedback)
    .where(and(eq(feedback.propertyId, propertyId), gte(feedback.submittedAt, since)))
    .groupBy(bucketExpr)
    .orderBy(bucketExpr)
  const gcsHistory = historyRows.map((r) => ({
    bucket: r.bucket ?? "",
    gcs: r.gcs != null ? Number(r.gcs) : null,
    resilience: r.resilience != null ? Number(r.resilience) : null,
    empathy: r.empathy != null ? Number(r.empathy) : null,
    anticipation: r.anticipation != null ? Number(r.anticipation) : null,
    recognition: r.recognition != null ? Number(r.recognition) : null,
  }))

  // Word cloud
  const adjRows = await db
    .select({ adjectives: feedback.adjectives })
    .from(feedback)
    .where(and(eq(feedback.propertyId, propertyId), gte(feedback.submittedAt, since), isNotNull(feedback.adjectives)))
  const freq: Record<string, number> = {}
  for (const row of adjRows) {
    if (!row.adjectives) continue
    for (const word of row.adjectives.split(",").map((w) => w.trim().toLowerCase()).filter(Boolean)) {
      freq[word] = (freq[word] ?? 0) + 1
    }
  }
  const wordCloud = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([word, c]) => ({ word, count: c }))

  // Staff bubbles
  const staffRows = await db
    .select({ name: feedback.namedStaffMember, gcs: feedback.gcs })
    .from(feedback)
    .where(and(eq(feedback.propertyId, propertyId), gte(feedback.submittedAt, since), isNotNull(feedback.namedStaffMember)))
  const staffMap: Record<string, { count: number; totalGcs: number }> = {}
  for (const row of staffRows) {
    if (!row.name) continue
    const entry = staffMap[row.name] ?? { count: 0, totalGcs: 0 }
    entry.count += 1
    entry.totalGcs += Number(row.gcs)
    staffMap[row.name] = entry
  }
  const staffBubbles = Object.entries(staffMap).map(([name, { count, totalGcs }]) => {
    const avgGcs = totalGcs / count
    const sentiment: "positive" | "neutral" | "negative" = avgGcs >= 7 ? "positive" : avgGcs < 6 ? "negative" : "neutral"
    return { name, count, sentiment }
  })

  const payload: DashboardCachePayload = { stats, gcsHistory, wordCloud, staffBubbles }

  // Persist to cache
  const cacheId = `${propertyId}:${days}`
  await db
    .insert(dashboardCache)
    .values({ id: cacheId, propertyId, days, stats, gcsHistory, wordCloud, staffBubbles, computedAt: new Date() })
    .onConflictDoUpdate({
      target: dashboardCache.id,
      set: { stats, gcsHistory, wordCloud, staffBubbles, computedAt: new Date() },
    })

  return payload
}

async function getCachedOrCompute(propertyId: string, days: number): Promise<DashboardCachePayload> {
  const cached = await db.query.dashboardCache.findFirst({
    where: eq(dashboardCache.id, `${propertyId}:${days}`),
  })

  if (cached) {
    const age = Date.now() - new Date(cached.computedAt).getTime()
    if (age < CACHE_TTL_MS) {
      return cached as unknown as DashboardCachePayload
    }
    // Stale — trigger background refresh, return stale data immediately
    void computeDashboardCache(propertyId, days).catch(console.error)
    return cached as unknown as DashboardCachePayload
  }

  // No cache — compute now (first load or new property)
  return computeDashboardCache(propertyId, days)
}

/**
 * Creates a Stripe Checkout Session for an additional property subscription (£25/month).
 * Attaches to the existing Stripe customer if one exists.
 * Returns the checkout URL.
 */
async function createAdditionalPropertyCheckoutSession(
  propertyId: string,
  propertyName: string,
  stripeCustomerId: string | null,
): Promise<string> {
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: env.STRIPE_PRICE_ADDITIONAL_PROPERTY, quantity: 1 }],
    subscription_data: {
      description: `Additional Property: ${propertyName}`,
      metadata: { propertyId },
    },
    metadata: { propertyId },
    success_url: `${env.PUBLIC_PORTAL_URL}/properties?payment=success`,
    cancel_url: `${env.PUBLIC_PORTAL_URL}/properties`,
  }

  if (stripeCustomerId) {
    params.customer = stripeCustomerId
  }

  const session = await stripe.checkout.sessions.create(params)

  if (!session.url) {
    throw new Error("[createAdditionalPropertyCheckoutSession] Stripe did not return a URL")
  }

  return session.url
}

export const propertiesRouter = router({
  getPendingProperties: adminProcedure.query(async () => {
    return db
      .select()
      .from(properties)
      .where(
        and(
          eq(properties.status, "pending"),
          // Only surface submissions where the business email has been verified
          // (or where businessEmail was never set, for backwards compatibility)
          or(isNull(properties.businessEmail), eq(properties.businessEmailVerified, true)),
        ),
      )
      .orderBy(properties.createdAt)
  }),

  approveProperty: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      // Fetch the property and its organisation before updating
      const property = await db.query.properties.findFirst({
        where: eq(properties.id, input.id),
      })
      if (!property) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })

      const org = await db.query.organisations.findFirst({
        where: eq(organisations.id, property.organisationId),
      })
      if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organisation not found" })

      // Count currently approved + paid properties for this org (excluding this one)
      const [countResult] = await db
        .select({ total: count() })
        .from(properties)
        .where(
          and(
            eq(properties.organisationId, org.id),
            eq(properties.status, "approved"),
            ne(properties.id, input.id),
            or(isNull(properties.paymentStatus), eq(properties.paymentStatus, "paid")),
          ),
        )

      const approvedCount = countResult?.total ?? 0
      const planLimit = PLAN_PROPERTY_LIMITS[org.plan ?? "member"] ?? 0

      // If the org has no active subscription yet, don't treat any property as
      // "additional" — approve it normally and let the portal redirect them to
      // choose a plan when they first log in.
      const hasActiveSubscription =
        !!org.stripeCustomerId &&
        !!org.subscriptionStatus &&
        !["none", "cancelled"].includes(org.subscriptionStatus)

      const isAdditional = hasActiveSubscription && approvedCount >= planLimit

      if (isAdditional) {
        // ── Additional property: needs payment ──────────────────────────────
        const [updatedProperty] = await db
          .update(properties)
          .set({ status: "approved", paymentStatus: "pending", updatedAt: new Date() })
          .where(eq(properties.id, input.id))
          .returning()

        if (!updatedProperty) throw new TRPCError({ code: "NOT_FOUND" })

        // Create Stripe checkout session
        let checkoutUrl: string
        try {
          checkoutUrl = await createAdditionalPropertyCheckoutSession(
            updatedProperty.id,
            updatedProperty.name,
            org.stripeCustomerId ?? null,
          )
        } catch (err) {
          console.error("[approveProperty] Stripe checkout session failed:", err)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create payment link. Property approved but email not sent.",
          })
        }

        // Store checkout session URL for reference
        await db
          .update(properties)
          .set({ stripeCheckoutSessionId: checkoutUrl })
          .where(eq(properties.id, input.id))

        // Fire-and-forget payment email (no QR code yet)
        const basePrice = PLAN_BASE_PRICES[org.plan ?? "host"] ?? "£34.99"
        sendAdditionalPropertyPaymentEmail(
          updatedProperty.ownerEmail,
          updatedProperty.ownerName,
          updatedProperty.name,
          checkoutUrl,
          org.plan ?? "host",
          basePrice,
        ).catch((err) => console.error("[approveProperty] Payment email failed:", err))

        return updatedProperty
      }

      // ── Standard approval: within plan limit ────────────────────────────
      const [updatedPropertyStandard] = await db
        .update(properties)
        .set({ status: "approved", updatedAt: new Date() })
        .where(eq(properties.id, input.id))
        .returning()

      if (!updatedPropertyStandard) throw new TRPCError({ code: "NOT_FOUND" })

      // Fire-and-forget: generate QR code and send standard approval email
      generateAndActivateProperty(updatedPropertyStandard).catch((err) =>
        console.error("[approveProperty] Activation failed:", err),
      )

      return updatedPropertyStandard
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
      db.select({ total: count() }).from(user).where(ne(user.email, env.ADMIN_EMAIL)),
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

    const memberCount = rows.filter((r) => r.plan === "member").length
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
        memberCount,
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
          adminNotes: properties.adminNotes,
          isVip: properties.isVip,
          plan: organisations.plan,
          subscriptionStatus: organisations.subscriptionStatus,
          trialEndsAt: organisations.trialEndsAt,
          subscriptionEndsAt: organisations.subscriptionEndsAt,
          stripeCustomerId: organisations.stripeCustomerId,
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
          subscriptionStatus: row.subscriptionStatus,
          adminNotes: row.adminNotes,
          isVip: row.isVip,
          trialEndsAt: row.trialEndsAt,
          subscriptionEndsAt: row.subscriptionEndsAt,
          stripeCustomerId: row.stripeCustomerId,
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

  resendApprovalEmail: adminProcedure
    .input(z.object({ propertyId: z.string() }))
    .mutation(async ({ input }) => {
      const property = await db.query.properties.findFirst({
        where: eq(properties.id, input.propertyId),
      })

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })
      }

      await sendApprovalEmail(property.ownerEmail, property.ownerName, property.name)

      return { success: true }
    }),

  resendQrCode: adminProcedure
    .input(z.object({ propertyId: z.string() }))
    .mutation(async ({ input }) => {
      const property = await db.query.properties.findFirst({
        where: eq(properties.id, input.propertyId),
      })
      if (!property) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })

      const qrCode = await db.query.qrCodes.findFirst({
        where: eq(qrCodes.propertyId, input.propertyId),
      })
      if (!qrCode) throw new TRPCError({ code: "NOT_FOUND", message: "No QR code found for this property" })

      const pdfBuffer = await generateQrPdf(qrCode.feedbackUrl, property.name)
      await sendApprovalEmail(property.ownerEmail, property.ownerName, property.name, pdfBuffer)

      return { success: true }
    }),

  deleteProperty: adminProcedure
    .input(z.object({ propertyId: z.string() }))
    .mutation(async ({ input }) => {
      const [deleted] = await db
        .delete(properties)
        .where(eq(properties.id, input.propertyId))
        .returning()

      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })
      }

      return { success: true }
    }),

  updatePropertyDetails: adminProcedure
    .input(
      z.object({
        propertyId: z.string(),
        name: z.string().optional(),
        city: z.string().optional(),
        country: z.string().optional(),
        postcode: z.string().optional(),
        type: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { propertyId, name, city, country, postcode, type } = input

      const [updated] = await db
        .update(properties)
        .set({
          ...(name !== undefined && { name }),
          ...(city !== undefined && { city }),
          ...(country !== undefined && { country }),
          ...(postcode !== undefined && { postcode }),
          ...(type !== undefined && { type }),
          updatedAt: new Date(),
        })
        .where(eq(properties.id, propertyId))
        .returning()

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })
      }

      return { success: true }
    }),

  updateAdminNote: adminProcedure
    .input(z.object({ propertyId: z.string(), note: z.string() }))
    .mutation(async ({ input }) => {
      const [updated] = await db
        .update(properties)
        .set({ adminNotes: input.note, updatedAt: new Date() })
        .where(eq(properties.id, input.propertyId))
        .returning()

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })
      }

      return { success: true }
    }),

  toggleVip: adminProcedure
    .input(z.object({ propertyId: z.string(), isVip: z.boolean() }))
    .mutation(async ({ input }) => {
      const [updated] = await db
        .update(properties)
        .set({ isVip: input.isVip, updatedAt: new Date() })
        .where(eq(properties.id, input.propertyId))
        .returning()

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })
      }

      return { success: true }
    }),

  resetOwnerPassword: adminProcedure
    .input(z.object({ propertyId: z.string() }))
    .mutation(async ({ input }) => {
      const property = await db.query.properties.findFirst({
        where: eq(properties.id, input.propertyId),
      })

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })
      }

      const response = await fetch(`${env.BETTER_AUTH_URL}/api/auth/request-password-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: property.ownerEmail,
          redirectTo: `${env.PUBLIC_PORTAL_URL}/reset-password`,
        }),
      })

      if (!response.ok) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to send password reset email" })
      }

      return { success: true }
    }),

  adminUpdatePlan: adminProcedure
    .input(
      z.object({
        propertyId: z.string(),
        plan: z.enum(["member", "host", "partner", "founder"]),
        subscriptionStatus: z.enum(["none", "trial", "active", "grace", "expired"]),
      }),
    )
    .mutation(async ({ input }) => {
      // Look up the property to get its organisationId
      const property = await db.query.properties.findFirst({
        where: eq(properties.id, input.propertyId),
      })

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })
      }

      const [org] = await db
        .update(organisations)
        .set({ plan: input.plan, subscriptionStatus: input.subscriptionStatus, updatedAt: new Date() })
        .where(eq(organisations.id, property.organisationId))
        .returning()

      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organisation not found" })
      }

      return org
    }),

  getMyProperties: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.isAdmin) {
      return db.select().from(properties)
    }

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

  /**
   * Protected — owner submits a new property from the portal.
   * Creates the property as 'pending' and fires an admin notification email.
   * Guards against inactive subscriptions.
   */
  submitProperty: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        type: z.string().min(1),
        addressLine1: z.string().optional(),
        city: z.string().min(1),
        postcode: z.string().optional(),
        country: z.string().min(1),
        businessEmail: z.string().email().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const org = await db.query.organisations.findFirst({
        where: eq(organisations.ownerId, ctx.session.user.id),
      })

      if (!org) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No organisation found" })
      }

      // Block submission if subscription is not active
      const activeStatuses = ["active", "trial"] as const
      if (!activeStatuses.includes(org.subscriptionStatus as (typeof activeStatuses)[number])) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Your subscription is not currently active. Please renew before adding a property.",
        })
      }

      const propertyId = crypto.randomUUID()
      const verificationToken = input.businessEmail ? crypto.randomUUID() : null
      const tokenExpires = input.businessEmail
        ? new Date(Date.now() + 48 * 60 * 60 * 1000)
        : null

      const [property] = await db
        .insert(properties)
        .values({
          id: propertyId,
          organisationId: org.id,
          name: input.name,
          type: input.type,
          address: input.addressLine1 ?? null,
          city: input.city,
          postcode: input.postcode ?? null,
          country: input.country,
          ownerEmail: ctx.session.user.email,
          ownerName: ctx.session.user.name,
          status: "pending",
          businessEmail: input.businessEmail ?? null,
          businessEmailVerified: false,
          businessEmailToken: verificationToken,
          businessEmailTokenExpires: tokenExpires,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()

      if (!property) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" })

      if (input.businessEmail && verificationToken) {
        // Send verification email — admin is NOT notified until verified
        const verificationUrl = `${env.PUBLIC_PORTAL_URL}/verify-property/${verificationToken}`
        sendBusinessEmailVerification(input.businessEmail, input.name, verificationUrl).catch(
          (err) => console.error("[submitProperty] Verification email failed:", err),
        )
      } else {
        // No business email provided — notify admin immediately
        sendNewPropertyNotificationEmail(
          ctx.session.user.name,
          ctx.session.user.email,
          input.name,
          input.city,
          input.country,
          env.PUBLIC_PORTAL_URL,
        ).catch((err) => console.error("[submitProperty] Admin notification failed:", err))
      }

      return property
    }),

  verifyBusinessEmail: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      const property = await db.query.properties.findFirst({
        where: eq(properties.businessEmailToken, input.token),
      })

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid or already used verification link." })
      }

      if (property.businessEmailTokenExpires && property.businessEmailTokenExpires < new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This verification link has expired. Please request a new one from your dashboard." })
      }

      await db
        .update(properties)
        .set({
          businessEmailVerified: true,
          businessEmailToken: null,
          businessEmailTokenExpires: null,
          updatedAt: new Date(),
        })
        .where(eq(properties.id, property.id))

      // Now notify admin
      sendNewPropertyNotificationEmail(
        property.ownerName,
        property.ownerEmail,
        property.name,
        property.city,
        property.country,
        env.PUBLIC_PORTAL_URL,
      ).catch((err) => console.error("[verifyBusinessEmail] Admin notification failed:", err))

      return { success: true, propertyName: property.name }
    }),

  resendBusinessVerification: protectedProcedure
    .input(z.object({ propertyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      let orgId: string | undefined
      if (ctx.isAdmin) {
        const prop = await db.query.properties.findFirst({
          where: eq(properties.id, input.propertyId),
          columns: { organisationId: true },
        })
        orgId = prop?.organisationId
      } else {
        const org = await db.query.organisations.findFirst({
          where: eq(organisations.ownerId, ctx.session.user.id),
          columns: { id: true },
        })
        if (!org) throw new TRPCError({ code: "FORBIDDEN" })
        orgId = org.id
      }
      if (!orgId) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })

      const property = await db.query.properties.findFirst({
        where: and(eq(properties.id, input.propertyId), eq(properties.organisationId, orgId)),
      })

      if (!property) throw new TRPCError({ code: "NOT_FOUND" })
      if (!property.businessEmail) throw new TRPCError({ code: "BAD_REQUEST", message: "No business email on file." })
      if (property.businessEmailVerified) throw new TRPCError({ code: "BAD_REQUEST", message: "Email already verified." })

      const newToken = crypto.randomUUID()
      const newExpires = new Date(Date.now() + 48 * 60 * 60 * 1000)

      await db
        .update(properties)
        .set({ businessEmailToken: newToken, businessEmailTokenExpires: newExpires, updatedAt: new Date() })
        .where(eq(properties.id, property.id))

      const verificationUrl = `${env.PUBLIC_PORTAL_URL}/verify-property/${newToken}`
      await sendBusinessEmailVerification(property.businessEmail, property.name, verificationUrl)

      return { success: true }
    }),

  /**
   * Protected — generates a fresh Stripe checkout URL for a property awaiting payment.
   * Called when the owner clicks "Complete payment" on the property card in the portal.
   */
  getAdditionalPropertyCheckoutUrl: protectedProcedure
    .input(z.object({ propertyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const property = await db.query.properties.findFirst({
        where: eq(properties.id, input.propertyId),
      })
      if (!property) throw new TRPCError({ code: "NOT_FOUND" })

      let org
      if (ctx.isAdmin) {
        org = await db.query.organisations.findFirst({
          where: eq(organisations.id, property.organisationId),
        })
      } else {
        org = await db.query.organisations.findFirst({
          where: eq(organisations.ownerId, ctx.session.user.id),
        })
        if (!org) throw new TRPCError({ code: "FORBIDDEN" })
        if (property.organisationId !== org.id) throw new TRPCError({ code: "FORBIDDEN" })
      }

      if (!org) throw new TRPCError({ code: "FORBIDDEN" })

      if (property.paymentStatus !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Property does not require payment" })
      }

      const url = await createAdditionalPropertyCheckoutSession(
        property.id,
        property.name,
        org.stripeCustomerId ?? null,
      )

      return { url }
    }),

  /**
   * Protected — returns all additional (paid/cancelling) properties for this org.
   * Used in the billing section to list add-ons with a Remove button.
   */
  getMyAdditionalProperties: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.isAdmin) {
      return db
        .select({
          id: properties.id,
          name: properties.name,
          city: properties.city,
          country: properties.country,
          paymentStatus: properties.paymentStatus,
          stripeSubscriptionId: properties.stripeSubscriptionId,
        })
        .from(properties)
        .where(
          or(
            eq(properties.paymentStatus, "paid"),
            eq(properties.paymentStatus, "cancelling"),
          ),
        )
    }

    const org = await db.query.organisations.findFirst({
      where: eq(organisations.ownerId, ctx.session.user.id),
    })
    if (!org) return []

    return db
      .select({
        id: properties.id,
        name: properties.name,
        city: properties.city,
        country: properties.country,
        paymentStatus: properties.paymentStatus,
        stripeSubscriptionId: properties.stripeSubscriptionId,
      })
      .from(properties)
      .where(
        and(
          eq(properties.organisationId, org.id),
          or(
            eq(properties.paymentStatus, "paid"),
            eq(properties.paymentStatus, "cancelling"),
          ),
        ),
      )
  }),

  /**
   * Protected — schedules cancellation of an additional property's Stripe subscription
   * at the end of the current billing period. Sets paymentStatus to 'cancelling'.
   */
  cancelAdditionalProperty: protectedProcedure
    .input(z.object({ propertyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const property = await db.query.properties.findFirst({
        where: eq(properties.id, input.propertyId),
      })
      if (!property) throw new TRPCError({ code: "NOT_FOUND" })

      if (!ctx.isAdmin) {
        const org = await db.query.organisations.findFirst({
          where: eq(organisations.ownerId, ctx.session.user.id),
          columns: { id: true },
        })
        if (!org) throw new TRPCError({ code: "FORBIDDEN" })
        if (property.organisationId !== org.id) throw new TRPCError({ code: "FORBIDDEN" })
      }
      if (property.paymentStatus !== "paid") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only active additional properties can be cancelled",
        })
      }
      if (!property.stripeSubscriptionId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No Stripe subscription found for this property",
        })
      }

      // Schedule cancellation at period end (owner retains access until then)
      try {
        await stripe.subscriptions.update(property.stripeSubscriptionId, {
          cancel_at_period_end: true,
        })
      } catch (err) {
        console.error("[cancelAdditionalProperty] Stripe cancellation failed:", err)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not schedule cancellation with Stripe. Please try again or contact support.",
        })
      }

      const [updated] = await db
        .update(properties)
        .set({ paymentStatus: "cancelling", updatedAt: new Date() })
        .where(eq(properties.id, input.propertyId))
        .returning()

      return updated
    }),

  getPortfolioDashboard: protectedProcedure.query(async ({ ctx }) => {
    const org = ctx.isAdmin
      ? null
      : await db.query.organisations.findFirst({
          where: eq(organisations.ownerId, ctx.session.user.id),
        })

    if (!ctx.isAdmin && !org) {
      return {
        portfolioGcs: null,
        activeCount: 0,
        alertCount: 0,
        monthlyTrend: [],
        propertyCards: [],
        thisWeekCount: 0,
        thisWeekDelta: null,
        ventCount: 0,
        ventCountDelta: null,
        enrichedPropertyRows: [],
        staffLeaderboard: [],
        mostImproved: null,
      }
    }

    const orgProperties = await db
      .select({ id: properties.id, status: properties.status })
      .from(properties)
      .where(org ? eq(properties.organisationId, org.id) : undefined)

    const activeCount = orgProperties.filter((p) => p.status === "approved").length
    const propertyIds = orgProperties.map((p) => p.id)

    if (propertyIds.length === 0) {
      return {
        portfolioGcs: null,
        activeCount,
        alertCount: 0,
        monthlyTrend: [],
        propertyCards: [],
        thisWeekCount: 0,
        thisWeekDelta: null,
        ventCount: 0,
        ventCountDelta: null,
        enrichedPropertyRows: [],
        staffLeaderboard: [],
        mostImproved: null,
      }
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

    // ── Portfolio-level weekly & vent stats ──────────────────────────────────
    const now = new Date()
    const oneWeekAgo  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000)
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    const [thisWeekAgg, lastWeekAgg] = await Promise.all([
      db
        .select({
          total: count(),
          vents: sql<number>`COUNT(*) FILTER (WHERE ${feedback.ventText} IS NOT NULL)::int`,
        })
        .from(feedback)
        .where(and(inArray(feedback.propertyId, propertyIds), gte(feedback.submittedAt, oneWeekAgo))),
      db
        .select({
          total: count(),
          vents: sql<number>`COUNT(*) FILTER (WHERE ${feedback.ventText} IS NOT NULL)::int`,
        })
        .from(feedback)
        .where(
          and(
            inArray(feedback.propertyId, propertyIds),
            gte(feedback.submittedAt, twoWeeksAgo),
            lt(feedback.submittedAt, oneWeekAgo),
          ),
        ),
    ])

    const thisWeekCount  = thisWeekAgg[0]?.total ?? 0
    const thisWeekVents  = thisWeekAgg[0]?.vents ?? 0
    const lastWeekCount  = lastWeekAgg[0]?.total ?? 0
    const lastWeekVents  = lastWeekAgg[0]?.vents ?? 0

    const thisWeekDelta = lastWeekCount > 0
      ? Math.round(((thisWeekCount - lastWeekCount) / lastWeekCount) * 100)
      : null
    const ventCount = thisWeekVents
    const ventCountDelta = lastWeekVents > 0
      ? Math.round(((thisWeekVents - lastWeekVents) / lastWeekVents) * 100)
      : null

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

    const monthlyTrend = trendRows
      .map((r) => ({
        month: r.month,
        score: Number(r.avgGcs),
      }))
      .filter((r) => !isNaN(r.score))

    // Per-property cards
    const propertyRows = await db
      .select({
        id: properties.id,
        name: properties.name,
        type: properties.type,
        city: properties.city,
        country: properties.country,
        status: properties.status,
        avgGcs: propertyScores.avgGcs,
        totalFeedback: propertyScores.totalFeedback,
      })
      .from(properties)
      .leftJoin(propertyScores, eq(propertyScores.propertyId, properties.id))
      .where(org ? eq(properties.organisationId, org.id) : undefined)
      .orderBy(properties.name)

    // Alert flag per property: any feedback with GCS <= 5
    const alertRows = await db
      .select({ propertyId: feedback.propertyId, total: count() })
      .from(feedback)
      .where(and(inArray(feedback.propertyId, propertyIds), sql`${feedback.gcs}::numeric <= 5`))
      .groupBy(feedback.propertyId)

    const alertsByProperty = new Map(alertRows.map((r) => [r.propertyId, r.total]))

    const propertyCards = propertyRows.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      city: p.city,
      country: p.country,
      status: p.status,
      avgGcs: p.avgGcs != null ? Number(p.avgGcs) : null,
      totalFeedback: p.totalFeedback ?? 0,
      alertCount: alertsByProperty.get(p.id) ?? 0,
    }))

    // ── Per-property enrichment ──────────────────────────────────────────────
    // 1. Weekly feedback data (sparklines + per-property velocity)
    const sevenWeeksAgo = new Date(now.getTime() - 49 * 24 * 60 * 60 * 1000)
    const weeklyRows = await db
      .select({
        propertyId: feedback.propertyId,
        week: sql<string>`DATE_TRUNC('week', ${feedback.submittedAt})::text`,
        avgGcs: sql<string>`ROUND(AVG(${feedback.gcs}::numeric), 2)`,
        feedbackCount: count(),
      })
      .from(feedback)
      .where(and(inArray(feedback.propertyId, propertyIds), gte(feedback.submittedAt, sevenWeeksAgo)))
      .groupBy(feedback.propertyId, sql`DATE_TRUNC('week', ${feedback.submittedAt})`)
      .orderBy(sql`DATE_TRUNC('week', ${feedback.submittedAt})`)

    // Build 7 Monday-keyed week buckets (oldest → newest)
    const dayOfWeek = now.getDay() // 0=Sun, 1=Mon ... 6=Sat
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const currentMonday = new Date(now)
    currentMonday.setDate(now.getDate() + daysToMonday)
    currentMonday.setHours(0, 0, 0, 0)

    const weekKeys: string[] = []
    for (let i = 6; i >= 0; i--) {
      const monday = new Date(currentMonday.getTime() - i * 7 * 24 * 60 * 60 * 1000)
      weekKeys.push(monday.toISOString().substring(0, 10)) // "YYYY-MM-DD"
    }
    // weekKeys[0] = 6 weeks ago Monday, weekKeys[6] = this week's Monday

    type WeekData = { avgGcs: number | null; count: number }
    const weeklyMap = new Map<string, Map<string, WeekData>>()
    for (const row of weeklyRows) {
      if (!weeklyMap.has(row.propertyId)) weeklyMap.set(row.propertyId, new Map())
      const key = row.week.substring(0, 10) // "YYYY-MM-DD"
      weeklyMap.get(row.propertyId)!.set(key, {
        avgGcs: row.avgGcs != null ? Number(row.avgGcs) : null,
        count: row.feedbackCount,
      })
    }

    // 2. Monthly GCS delta (this month vs last month)
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    // 2–5. Run monthly delta, top staff, vents, and last feedback in parallel
    const [monthlyRows, topStaffRows, ventRowsPerProp, lastFeedbackRows] = await Promise.all([
      // 2. Monthly GCS delta
      db
        .select({
          propertyId: feedback.propertyId,
          month: sql<string>`DATE_TRUNC('month', ${feedback.submittedAt})::text`,
          avgGcs: sql<string>`ROUND(AVG(${feedback.gcs}::numeric), 2)`,
        })
        .from(feedback)
        .where(and(inArray(feedback.propertyId, propertyIds), gte(feedback.submittedAt, lastMonthStart)))
        .groupBy(feedback.propertyId, sql`DATE_TRUNC('month', ${feedback.submittedAt})`),
      // 3. Top staff per property (this calendar month)
      db
        .select({
          propertyId: feedback.propertyId,
          name: feedback.namedStaffMember,
          mentions: count(),
        })
        .from(feedback)
        .where(
          and(
            inArray(feedback.propertyId, propertyIds),
            isNotNull(feedback.namedStaffMember),
            gte(feedback.submittedAt, thisMonthStart),
          ),
        )
        .groupBy(feedback.propertyId, feedback.namedStaffMember)
        .orderBy(desc(count())),
      // 4. Vent count per property (this calendar month)
      db
        .select({ propertyId: feedback.propertyId, vents: count() })
        .from(feedback)
        .where(
          and(
            inArray(feedback.propertyId, propertyIds),
            isNotNull(feedback.ventText),
            gte(feedback.submittedAt, thisMonthStart),
          ),
        )
        .groupBy(feedback.propertyId),
      // 5. Last feedback timestamp per property
      db
        .select({ propertyId: feedback.propertyId, lastAt: max(feedback.submittedAt) })
        .from(feedback)
        .where(inArray(feedback.propertyId, propertyIds))
        .groupBy(feedback.propertyId),
    ])

    const thisMonthKey = thisMonthStart.toISOString().substring(0, 10) // "YYYY-MM-01"
    const lastMonthKey = lastMonthStart.toISOString().substring(0, 10)

    type MonthData = { thisMonth: number | null; lastMonth: number | null }
    const monthlyMap = new Map<string, MonthData>()
    for (const row of monthlyRows) {
      if (!monthlyMap.has(row.propertyId)) monthlyMap.set(row.propertyId, { thisMonth: null, lastMonth: null })
      const entry = monthlyMap.get(row.propertyId)!
      const mk = row.month.substring(0, 10)
      if (mk === thisMonthKey) entry.thisMonth = Number(row.avgGcs)
      else if (mk === lastMonthKey) entry.lastMonth = Number(row.avgGcs)
    }

    const topStaffByProperty = new Map<string, { name: string; mentions: number }>()
    for (const row of topStaffRows) {
      if (row.name == null) continue
      // First row per property = highest mentions (ordered desc)
      if (!topStaffByProperty.has(row.propertyId)) {
        topStaffByProperty.set(row.propertyId, { name: row.name, mentions: row.mentions })
      }
    }

    const ventsByProperty = new Map(ventRowsPerProp.map((r) => [r.propertyId, r.vents]))

    const lastFeedbackByProperty = new Map(
      lastFeedbackRows.map((r) => [r.propertyId, r.lastAt ? r.lastAt.toISOString() : null]),
    )

    // 6. City ranks — read from leaderboardCache (24 h TTL, same as getCityLeaderboard)
    const distinctCities = [...new Set(propertyRows.map((p) => p.city))]
    type CityRankData = { rank: number; total: number }
    const cityRankByProperty = new Map<string, CityRankData>()

    const LEADERBOARD_CACHE_TTL_MS = 24 * 60 * 60 * 1000
    const propertyIdSet = new Set(propertyIds)
    const cachedCityRows = await db.query.leaderboardCache.findMany({
      where: inArray(leaderboardCache.city, distinctCities),
    })
    for (const cached of cachedCityRows) {
      if (Date.now() - new Date(cached.cachedAt).getTime() >= LEADERBOARD_CACHE_TTL_MS) continue
      const payload = cached.data as {
        rows: Array<{ propertyId: string; rank: number }>
        totalCount: number
      }
      for (const row of payload.rows) {
        if (propertyIdSet.has(row.propertyId)) {
          cityRankByProperty.set(row.propertyId, { rank: row.rank, total: payload.totalCount })
        }
      }
    }

    // 7. Assemble enrichedPropertyRows
    const enrichedPropertyRows = propertyRows.map((p) => {
      const weekly = weeklyMap.get(p.id) ?? new Map<string, WeekData>()
      const sparkline = weekKeys.map((k) => weekly.get(k)?.avgGcs ?? null)
      const propThisWeekCount = weekly.get(weekKeys[6]!)?.count ?? 0
      const propLastWeekCount = weekly.get(weekKeys[5]!)?.count ?? 0
      const propThisWeekDelta =
        propLastWeekCount > 0
          ? Math.round(((propThisWeekCount - propLastWeekCount) / propLastWeekCount) * 100)
          : null

      const monthly = monthlyMap.get(p.id)
      const gcsDelta =
        monthly?.thisMonth != null && monthly?.lastMonth != null
          ? Math.round((monthly.thisMonth - monthly.lastMonth) * 10) / 10
          : null

      const topStaff = topStaffByProperty.get(p.id) ?? null
      const rankData = cityRankByProperty.get(p.id) ?? null

      return {
        id: p.id,
        name: p.name,
        type: p.type,
        city: p.city,
        country: p.country,
        status: p.status,
        avgGcs: p.avgGcs != null ? Number(p.avgGcs) : null,
        gcsDelta,
        sparkline,
        thisWeekCount: propThisWeekCount,
        thisWeekDelta: propThisWeekDelta,
        topStaffName: topStaff?.name ?? null,
        topStaffMentions: topStaff?.mentions ?? 0,
        ventCount: ventsByProperty.get(p.id) ?? 0,
        alertCount: alertsByProperty.get(p.id) ?? 0,
        lastFeedbackAt: lastFeedbackByProperty.get(p.id) ?? null,
        cityRank: rankData?.rank ?? null,
        cityTotal: rankData?.total ?? null,
      }
    })

    // ── Staff leaderboard (last 30 days, cross-property) ─────────────────────
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const staffLeaderboardRows = await db
      .select({
        name: feedback.namedStaffMember,
        propertyId: feedback.propertyId,
        mentions: count(),
        avgGcs: sql<string>`ROUND(AVG(${feedback.gcs}::numeric), 2)`,
      })
      .from(feedback)
      .where(
        and(
          inArray(feedback.propertyId, propertyIds),
          isNotNull(feedback.namedStaffMember),
          gte(feedback.submittedAt, thirtyDaysAgo),
        ),
      )
      .groupBy(feedback.namedStaffMember, feedback.propertyId)
      .orderBy(desc(count()))
      .limit(10)

    const propNameMap = new Map(propertyRows.map((p) => [p.id, { name: p.name, city: p.city }]))

    const staffLeaderboard = staffLeaderboardRows
      .filter((r) => r.name != null)
      .slice(0, 5)
      .map((r) => {
        const prop = propNameMap.get(r.propertyId) ?? { name: "Unknown", city: "" }
        return {
          name: r.name!,
          propertyName: prop.name,
          city: prop.city,
          mentionCount: r.mentions,
          avgGcs: r.avgGcs != null ? Number(r.avgGcs) : null,
        }
      })

    // ── Most improved (biggest positive GCS delta this month vs last) ─────────
    let mostImproved: {
      propertyId: string
      name: string
      city: string
      type: string | null
      previousGcs: number
      currentGcs: number
      delta: number
      cityRank: number | null
      cityTotal: number | null
    } | null = null

    for (const p of enrichedPropertyRows) {
      if (p.gcsDelta == null || p.gcsDelta <= 0) continue
      const monthly = monthlyMap.get(p.id)
      if (!monthly?.thisMonth || !monthly?.lastMonth) continue
      if (mostImproved == null || p.gcsDelta > mostImproved.delta) {
        mostImproved = {
          propertyId: p.id,
          name: p.name,
          city: p.city,
          type: p.type,
          previousGcs: monthly.lastMonth,
          currentGcs: monthly.thisMonth,
          delta: p.gcsDelta,
          cityRank: p.cityRank,
          cityTotal: p.cityTotal,
        }
      }
    }

    return {
      portfolioGcs,
      activeCount,
      alertCount,
      monthlyTrend,
      propertyCards,
      thisWeekCount,
      thisWeekDelta,
      ventCount,
      ventCountDelta,
      enrichedPropertyRows,
      staffLeaderboard,
      mostImproved,
    }
  }),

  getPropertyDashboard: protectedProcedure
    .input(z.object({ propertyId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.isAdmin) {
        await assertPropertyAccess(ctx.session.user.id, input.propertyId)
      }

      const property = await db.query.properties.findFirst({
        where: eq(properties.id, input.propertyId),
      })
      if (!property) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })

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
      const property = await db.query.properties.findFirst({
        where: eq(properties.id, input.propertyId),
      })
      if (!property) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })

      if (!ctx.isAdmin) {
        const org = await db.query.organisations.findFirst({
          where: eq(organisations.ownerId, ctx.session.user.id),
          columns: { id: true },
        })
        if (!org) throw new TRPCError({ code: "FORBIDDEN" })
        if (property.organisationId !== org.id) throw new TRPCError({ code: "FORBIDDEN" })
      }

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
      // 1. Verify property belongs to the user's org (or user is admin)
      let org: { id: string; plan: string | null; subscriptionStatus: string | null } | undefined | null

      if (ctx.isAdmin) {
        const prop = await db.query.properties.findFirst({
          where: eq(properties.id, input.propertyId),
          columns: { organisationId: true },
        })
        if (!prop) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })
        org = await db.query.organisations.findFirst({
          where: eq(organisations.id, prop.organisationId),
          columns: { id: true, plan: true, subscriptionStatus: true },
        })
      } else {
        org = await db.query.organisations.findFirst({
          where: eq(organisations.ownerId, ctx.session.user.id),
        })
        if (!org) throw new TRPCError({ code: "FORBIDDEN" })

        const property = await db.query.properties.findFirst({
          where: eq(properties.id, input.propertyId),
        })
        if (!property) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })
        if (property.organisationId !== org.id) throw new TRPCError({ code: "FORBIDDEN" })
      }

      if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organisation not found" })

      // 2. Clamp time range to plan — restrict grace/expired orgs to host-level
      // Admin always gets founder-level (full) access
      const effectivePlan: Plan = ctx.isAdmin
        ? "founder"
        : org.subscriptionStatus === "grace" || org.subscriptionStatus === "expired"
          ? "host"
          : isPlan(org.plan ?? "")
            ? (org.plan as Plan)
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
      // Verify ownership (or admin bypass)
      const property = await db.query.properties.findFirst({
        where: eq(properties.id, input.propertyId),
      })
      if (!property) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })

      let org: { id: string; plan: string | null } | undefined | null
      if (ctx.isAdmin) {
        org = await db.query.organisations.findFirst({
          where: eq(organisations.id, property.organisationId),
          columns: { id: true, plan: true },
        })
      } else {
        org = await db.query.organisations.findFirst({
          where: eq(organisations.ownerId, ctx.session.user.id),
          columns: { id: true, plan: true },
        })
        if (!org) throw new TRPCError({ code: "FORBIDDEN" })
        if (property.organisationId !== org.id) throw new TRPCError({ code: "FORBIDDEN" })
      }

      if (!org) throw new TRPCError({ code: "FORBIDDEN" })

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
        userPlan: isPlan(org.plan ?? "") ? (org.plan as Plan) : ("member" as Plan),
      }
    }),

  getFounderOverview: protectedProcedure.query(async ({ ctx }) => {
    let orgId: string | undefined

    if (ctx.isAdmin) {
      // Admin can view the founder overview without plan restriction
      // (returns all properties across all orgs)
    } else {
      const org = await db.query.organisations.findFirst({
        where: eq(organisations.ownerId, ctx.session.user.id),
        columns: { id: true, plan: true },
      })
      if (!org) throw new TRPCError({ code: "FORBIDDEN" })
      if (org.plan !== "founder") throw new TRPCError({ code: "FORBIDDEN", message: "Founder plan required" })
      orgId = org.id
    }

    // All properties in org (or all properties for admin)
    const orgProperties = await db
      .select({
        id: properties.id,
        name: properties.name,
        city: properties.city,
        status: properties.status,
      })
      .from(properties)
      .where(orgId ? eq(properties.organisationId, orgId) : undefined)

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

  getDashboardStats: protectedProcedure
    .input(z.object({ propertyId: z.string(), days: z.number().int().positive() }))
    .query(async ({ input }) => {
      const { stats } = await getCachedOrCompute(input.propertyId, input.days)
      return stats
    }),

  getGcsHistory: protectedProcedure
    .input(z.object({ propertyId: z.string(), days: z.number().int().positive() }))
    .query(async ({ input }) => {
      const { gcsHistory } = await getCachedOrCompute(input.propertyId, input.days)
      return gcsHistory
    }),

  getRecentFeedback: protectedProcedure
    .input(z.object({ propertyId: z.string(), days: z.number().int().positive() }))
    .query(async ({ input }) => {
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000)
      const rows = await db
        .select({
          id: feedback.id,
          resilience: feedback.resilience,
          empathy: feedback.empathy,
          anticipation: feedback.anticipation,
          recognition: feedback.recognition,
          gcs: feedback.gcs,
          mealTime: feedback.mealTime,
          namedStaffMember: feedback.namedStaffMember,
          ventText: feedback.ventText,
          submittedAt: feedback.submittedAt,
        })
        .from(feedback)
        .where(and(eq(feedback.propertyId, input.propertyId), gte(feedback.submittedAt, since)))
        .orderBy(desc(feedback.submittedAt))
        .limit(10)
      return rows.map((r) => ({ ...r, gcs: Number(r.gcs) }))
    }),

  getWordCloud: protectedProcedure
    .input(z.object({ propertyId: z.string(), days: z.number().int().positive() }))
    .query(async ({ input }) => {
      const { wordCloud } = await getCachedOrCompute(input.propertyId, input.days)
      return wordCloud
    }),

  getStaffBubbles: protectedProcedure
    .input(z.object({ propertyId: z.string(), days: z.number().int().positive() }))
    .query(async ({ input }) => {
      const { staffBubbles } = await getCachedOrCompute(input.propertyId, input.days)
      return staffBubbles
    }),

  getCityLeaderboardLive: protectedProcedure
    .input(z.object({ propertyId: z.string(), days: z.number().int().positive() }))
    .query(async ({ input }) => {
      type CacheRow = {
        propertyId: string
        avgGcs: number | null
        avgResilience: number | null
        avgEmpathy: number | null
        avgAnticipation: number | null
        avgRecognition: number | null
        submissions: number
        rank: number
      }
      type CachePayload = { rows: CacheRow[]; cityAvg: number | null; totalCount: number }

      const CONTEXT_WINDOW = 3  // show 3 above + own + 3 below

      const prop = await db.query.properties.findFirst({
        where: eq(properties.id, input.propertyId),
        columns: { city: true, name: true },
      })
      if (!prop) return { city: "", rows: [], cityAvg: null, ownRank: null, totalCount: 0 }

      // ── Check nightly cache (24 h TTL) ─────────────────────────────────────
      const ONE_DAY_MS = 24 * 60 * 60 * 1000
      const cached = await db.query.leaderboardCache.findFirst({
        where: eq(leaderboardCache.city, prop.city),
      })

      let payload: CachePayload | null = null

      if (cached && Date.now() - new Date(cached.cachedAt).getTime() < ONE_DAY_MS) {
        payload = cached.data as CachePayload
      }

      if (!payload) {
        // ── Recompute — 30-day window, all properties in city ────────────────
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        const cityProperties = await db
          .select({ id: properties.id })
          .from(properties)
          .where(and(eq(properties.city, prop.city), eq(properties.status, "approved")))
        const cityPropertyIds = cityProperties.map((p) => p.id)
        if (!cityPropertyIds.length) return { city: prop.city, rows: [], cityAvg: null, ownRank: null, totalCount: 0 }

        const agg = await db
          .select({
            propertyId: feedback.propertyId,
            avgGcs: avg(feedback.gcs),
            avgResilience: avg(sql<number>`${feedback.resilience}::numeric`),
            avgEmpathy: avg(sql<number>`${feedback.empathy}::numeric`),
            avgAnticipation: avg(sql<number>`${feedback.anticipation}::numeric`),
            avgRecognition: avg(sql<number>`${feedback.recognition}::numeric`),
            submissions: count(),
          })
          .from(feedback)
          .where(and(inArray(feedback.propertyId, cityPropertyIds), gte(feedback.submittedAt, since)))
          .groupBy(feedback.propertyId)

        const aggMap = Object.fromEntries(agg.map((r) => [r.propertyId, r]))
        const allRows: CacheRow[] = cityProperties
          .map((p) => {
            const r = aggMap[p.id]
            return {
              propertyId: p.id,
              avgGcs:          r?.avgGcs != null          ? Number(r.avgGcs)          : null,
              avgResilience:   r?.avgResilience != null   ? Number(r.avgResilience)   : null,
              avgEmpathy:      r?.avgEmpathy != null      ? Number(r.avgEmpathy)      : null,
              avgAnticipation: r?.avgAnticipation != null ? Number(r.avgAnticipation) : null,
              avgRecognition:  r?.avgRecognition != null  ? Number(r.avgRecognition)  : null,
              submissions: r?.submissions ?? 0,
            }
          })
          .sort((a, b) => {
            if (a.avgGcs == null && b.avgGcs == null) return 0
            if (a.avgGcs == null) return 1
            if (b.avgGcs == null) return -1
            return b.avgGcs - a.avgGcs
          })
          .map((row, idx) => ({ ...row, rank: idx + 1 }))

        const withData = allRows.filter((r) => r.avgGcs != null)
        const cityAvg = withData.length
          ? withData.reduce((sum, r) => sum + (r.avgGcs ?? 0), 0) / withData.length
          : null

        payload = { rows: allRows, cityAvg, totalCount: allRows.length }

        // Persist full ranked list to cache (names stripped for privacy)
        await db
          .insert(leaderboardCache)
          .values({ city: prop.city, data: payload, cachedAt: new Date() })
          .onConflictDoUpdate({
            target: leaderboardCache.city,
            set: { data: payload, cachedAt: new Date() },
          })
      }

      // ── Slice context window around own property ───────────────────────────
      const ownIdx = payload.rows.findIndex((r) => r.propertyId === input.propertyId)
      const ownRank = ownIdx >= 0 ? (payload.rows[ownIdx]?.rank ?? null) : null

      const start = Math.max(0, (ownIdx >= 0 ? ownIdx : 0) - CONTEXT_WINDOW)
      const end   = Math.min(payload.rows.length, (ownIdx >= 0 ? ownIdx : 0) + CONTEXT_WINDOW + 1)
      const contextRows = payload.rows.slice(start, end).map((r) => ({
        ...r,
        isOwn: r.propertyId === input.propertyId,
        name:  r.propertyId === input.propertyId ? prop.name : null,
      }))

      return {
        city:       prop.city,
        rows:       contextRows,
        cityAvg:    payload.cityAvg,
        ownRank,
        totalCount: payload.totalCount,
      }
    }),

  getTierStatus: protectedProcedure
    .input(z.object({ propertyId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.isAdmin) await assertPropertyAccess(ctx.session.user.id, input.propertyId)
      const tier = await db.query.propertyTiers.findFirst({
        where: eq(propertyTiers.propertyId, input.propertyId),
      })
      if (!tier) {
        return { currentTier: "member" as const, pendingTier: null, pendingDirection: null, pendingFrom: null }
      }
      return {
        currentTier: tier.currentTier,
        pendingTier: tier.pendingTier,
        pendingDirection: tier.pendingDirection,
        pendingFrom: tier.pendingFrom,
        lastEvaluatedAt: tier.lastEvaluatedAt ? tier.lastEvaluatedAt.toISOString() : null,
      }
    }),

  getAiSummary: protectedProcedure
    .input(z.object({ propertyId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.isAdmin) await assertPropertyAccess(ctx.session.user.id, input.propertyId)
      const summary = await db.query.aiDailySummaries.findFirst({
        where: eq(aiDailySummaries.propertyId, input.propertyId),
        orderBy: [desc(aiDailySummaries.date)],
      })
      if (!summary) return null
      return {
        date: summary.date,
        narrative: summary.narrative,
        focusPoints: summary.focusPoints as Array<{ pillar: string; action: string }>,
        generatedAt: summary.generatedAt,
      }
    }),

  getStripePortalUrl: protectedProcedure.query(async ({ ctx }): Promise<{ url: string | null }> => {
    const org = await db.query.organisations.findFirst({
      where: eq(organisations.ownerId, ctx.session.user.id),
    })

    if (!org?.stripeCustomerId) {
      return { url: null }
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: env.PUBLIC_PORTAL_URL + "/organisation/billing",
    })

    return { url: session.url }
  }),

  getGcsTrend: protectedProcedure
    .input(z.object({ propertyId: z.string(), days: z.number().int().positive() }))
    .query(async ({ input }) => {
      const { propertyId, days } = input
      const now = Date.now()
      const since = new Date(now - days * 24 * 60 * 60 * 1000)
      const prevSince = new Date(now - 2 * days * 24 * 60 * 60 * 1000)

      const [current] = await db
        .select({ avg: avg(feedback.gcs) })
        .from(feedback)
        .where(and(eq(feedback.propertyId, propertyId), gte(feedback.submittedAt, since)))

      const [previous] = await db
        .select({ avg: avg(feedback.gcs) })
        .from(feedback)
        .where(and(
          eq(feedback.propertyId, propertyId),
          gte(feedback.submittedAt, prevSince),
          lt(feedback.submittedAt, since),
        ))

      const currentAvg = current?.avg != null ? Number(current.avg) : null
      const previousAvg = previous?.avg != null ? Number(previous.avg) : null
      const delta = currentAvg != null && previousAvg != null
        ? Math.round((currentAvg - previousAvg) * 10) / 10
        : null

      return { delta, previousAvg }
    }),

  getMealTimeBreakdown: protectedProcedure
    .input(z.object({ propertyId: z.string(), days: z.number().int().positive() }))
    .query(async ({ input }) => {
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000)
      // Only show actual meal periods — exclude "none" (entire stay visits)
      const ORDER = ["morning", "lunch", "dinner"]

      const rows = await db
        .select({
          mealTime: feedback.mealTime,
          avgGcs: avg(feedback.gcs),
          total: count(),
        })
        .from(feedback)
        .where(and(
          eq(feedback.propertyId, input.propertyId),
          gte(feedback.submittedAt, since),
          isNotNull(feedback.mealTime),
          ne(feedback.mealTime, "none"),
        ))
        .groupBy(feedback.mealTime)

      return rows
        .map((r) => ({
          mealTime: r.mealTime ?? "unknown",
          avgGcs: r.avgGcs != null ? Number(r.avgGcs) : null,
          count: r.total,
        }))
        .sort((a, b) => ORDER.indexOf(a.mealTime) - ORDER.indexOf(b.mealTime))
    }),

  getStripeUpdatePaymentUrl: protectedProcedure.query(async ({ ctx }): Promise<{ url: string | null }> => {
    const org = await db.query.organisations.findFirst({
      where: eq(organisations.ownerId, ctx.session.user.id),
    })

    if (!org?.stripeCustomerId) {
      return { url: null }
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: env.PUBLIC_PORTAL_URL + "/organisation/billing",
      flow_data: { type: "payment_method_update" },
    })

    return { url: session.url }
  }),

  getStripeManageSubscriptionUrl: protectedProcedure.query(async ({ ctx }): Promise<{ url: string | null }> => {
    const org = await db.query.organisations.findFirst({
      where: eq(organisations.ownerId, ctx.session.user.id),
    })

    if (!org?.stripeCustomerId) {
      return { url: null }
    }

    // subscription_cancel flow requires the subscription ID
    // Check both active and trialing (trial subscriptions have status "trialing")
    const [activeSubs, trialingSubs] = await Promise.all([
      stripe.subscriptions.list({ customer: org.stripeCustomerId, status: "active", limit: 1 }),
      stripe.subscriptions.list({ customer: org.stripeCustomerId, status: "trialing", limit: 1 }),
    ])
    const subscriptionId = activeSubs.data[0]?.id ?? trialingSubs.data[0]?.id

    const sessionParams: Parameters<typeof stripe.billingPortal.sessions.create>[0] = {
      customer: org.stripeCustomerId,
      return_url: env.PUBLIC_PORTAL_URL + "/organisation/billing",
    }

    if (subscriptionId) {
      sessionParams.flow_data = {
        type: "subscription_cancel",
        subscription_cancel: { subscription: subscriptionId },
      }
    }

    const session = await stripe.billingPortal.sessions.create(sessionParams)

    return { url: session.url }
  }),

  /**
   * Protected — marks the owner's organisation onboarding as complete.
   * Called when the owner dismisses or finishes the onboarding walkthrough.
   */
  markOnboardingComplete: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.isAdmin) return { ok: true }

    const org = await db.query.organisations.findFirst({
      where: eq(organisations.ownerId, ctx.session.user.id),
      columns: { id: true },
    })
    if (!org) throw new TRPCError({ code: "FORBIDDEN" })

    await db
      .update(organisations)
      .set({ onboardingCompletedAt: new Date() })
      .where(eq(organisations.id, org.id))

    return { ok: true }
  }),
})
