import { db } from "@intuitive-stay/db"
import { feedback, onlineReviewsCache, organisations, properties } from "@intuitive-stay/db/schema"
import { env } from "@intuitive-stay/env/server"
import { TRPCError } from "@trpc/server"
import { and, count, eq, gte, sql } from "drizzle-orm"
import { z } from "zod"

import { protectedProcedure, router } from "../index"
import { assertPropertyAccess } from "../lib/access"
import { analyseReviewsForPillars } from "../lib/ai"

const ALLOWED_REVIEW_HOSTNAMES = [
  "tripadvisor.com",
  "www.tripadvisor.com",
  "tripadvisor.co.uk",
  "www.tripadvisor.co.uk",
  "google.com",
  "www.google.com",
  "maps.google.com",
  "google.co.uk",
  "www.google.co.uk",
]

function assertReviewUrl(url: string | null | undefined, fieldName: string): void {
  if (!url) return
  try {
    const { hostname } = new URL(url)
    if (!ALLOWED_REVIEW_HOSTNAMES.includes(hostname)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `${fieldName} must be a TripAdvisor or Google Maps URL`,
      })
    }
  } catch (e) {
    if (e instanceof TRPCError) throw e
    throw new TRPCError({ code: "BAD_REQUEST", message: `Invalid ${fieldName} URL` })
  }
}

async function assertPropertyOwner(userId: string, propertyId: string, isAdmin = false) {
  if (isAdmin) return

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

const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const APIFY_BASE = "https://api.apify.com/v2"

async function apifyRun(
  token: string,
  actorId: string,
  input: Record<string, unknown>,
): Promise<string> {
  const res = await fetch(`${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/runs?token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Apify start failed (${res.status}): ${text}`)
  }
  const json = (await res.json()) as { data: { id: string } }
  return json.data.id
}

async function apifyWait(token: string, runId: string, timeoutMs = 300_000): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000))
    const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`)
    if (!res.ok) throw new Error(`Apify poll failed (${res.status})`)
    const json = (await res.json()) as { data: { status: string; defaultDatasetId: string } }
    const { status, defaultDatasetId } = json.data
    if (status === "SUCCEEDED") return defaultDatasetId
    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      throw new Error(`Apify run ${status}`)
    }
  }
  throw new Error("Apify run timed out after 5 minutes")
}

async function apifyDataset<T>(token: string, datasetId: string, limit = 50): Promise<T[]> {
  const res = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?token=${token}&limit=${limit}`,
  )
  if (!res.ok) throw new Error(`Apify dataset fetch failed (${res.status})`)
  return res.json() as Promise<T[]>
}

export const reviewsRouter = router({
  setReviewSources: protectedProcedure
    .input(
      z.object({
        propertyId: z.string(),
        tripAdvisorUrl: z.string().url().nullable(),
        googlePlaceId: z.string().url().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertPropertyOwner(ctx.session.user.id, input.propertyId, ctx.isAdmin)

      assertReviewUrl(input.tripAdvisorUrl, "TripAdvisor URL")
      assertReviewUrl(input.googlePlaceId, "Google Maps URL")

      await db
        .update(properties)
        .set({
          tripAdvisorUrl: input.tripAdvisorUrl,
          googlePlaceId: input.googlePlaceId,
        })
        .where(eq(properties.id, input.propertyId))

      return { success: true }
    }),

  getComparison: protectedProcedure
    .input(z.object({ propertyId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.isAdmin) await assertPropertyAccess(ctx.session.user.id, input.propertyId)

      const prop = await db
        .select({
          tripAdvisorUrl: properties.tripAdvisorUrl,
          googlePlaceId: properties.googlePlaceId,
          reviewPromptThreshold: properties.reviewPromptThreshold,
          reviewPromptPlatforms: properties.reviewPromptPlatforms,
        })
        .from(properties)
        .where(eq(properties.id, input.propertyId))
        .limit(1)

      const sources = prop[0] ?? { tripAdvisorUrl: null, googlePlaceId: null, reviewPromptThreshold: 8, reviewPromptPlatforms: "google,tripadvisor" }

      const cached = await db
        .select()
        .from(onlineReviewsCache)
        .where(eq(onlineReviewsCache.propertyId, input.propertyId))

      return {
        tripAdvisorUrl: sources.tripAdvisorUrl,
        googlePlaceId: sources.googlePlaceId,
        reviewPromptThreshold: sources.reviewPromptThreshold,
        reviewPromptPlatforms: sources.reviewPromptPlatforms,
        tripadvisor: cached.find((c) => c.source === "tripadvisor") ?? null,
        google: cached.find((c) => c.source === "google") ?? null,
      }
    }),

  triggerScrape: protectedProcedure
    .input(z.object({ propertyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertPropertyOwner(ctx.session.user.id, input.propertyId, ctx.isAdmin)

      if (!env.APIFY_API_TOKEN) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Apify not configured" })
      }
      const token = env.APIFY_API_TOKEN

      const prop = await db
        .select({
          tripAdvisorUrl: properties.tripAdvisorUrl,
          googlePlaceId: properties.googlePlaceId,
        })
        .from(properties)
        .where(eq(properties.id, input.propertyId))
        .limit(1)

      if (!prop[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })
      }

      const { tripAdvisorUrl, googlePlaceId } = prop[0]

      if (!tripAdvisorUrl && !googlePlaceId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No review sources configured for this property",
        })
      }

      const existing = await db
        .select({
          source: onlineReviewsCache.source,
          lastScrapedAt: onlineReviewsCache.lastScrapedAt,
        })
        .from(onlineReviewsCache)
        .where(eq(onlineReviewsCache.propertyId, input.propertyId))

      const now = Date.now()
      const taCache = existing.find((c) => c.source === "tripadvisor")
      const gCache = existing.find((c) => c.source === "google")

      const canScrapeTa =
        tripAdvisorUrl && (!taCache || now - taCache.lastScrapedAt.getTime() > COOLDOWN_MS)
      const canScrapeGoogle =
        googlePlaceId && (!gCache || now - gCache.lastScrapedAt.getTime() > COOLDOWN_MS)

      if (!canScrapeTa && !canScrapeGoogle) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Reviews were refreshed recently. Please wait 7 days before refreshing again.",
        })
      }

      const results: {
        source: "tripadvisor" | "google"
        avgRating: number
        reviewCount: number
        texts: string[]
      }[] = []
      const scrapeErrors: string[] = []

      if (canScrapeTa && tripAdvisorUrl) {
        try {
          const runId = await apifyRun(token, "maxcopell/tripadvisor-reviews", {
            startUrls: [{ url: tripAdvisorUrl }],
            maxReviews: 50,
          })
          const datasetId = await apifyWait(token, runId)
          const reviews = await apifyDataset<{ rating?: number; text?: string }>(token, datasetId)
          const texts = reviews.map((r) => r.text ?? "").filter(Boolean)
          const ratings = reviews.map((r) => r.rating ?? 0).filter(Boolean)
          const avgRating =
            ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0
          results.push({ source: "tripadvisor", avgRating, reviewCount: reviews.length, texts })
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error("TripAdvisor scrape failed:", msg)
          scrapeErrors.push(`TripAdvisor: ${msg}`)
        }
      }

      if (canScrapeGoogle && googlePlaceId) {
        try {
          const runId = await apifyRun(token, "compass/google-maps-reviews-scraper", {
            startUrls: [{ url: googlePlaceId }],
            maxReviews: 50,
            language: "en",
          })
          const datasetId = await apifyWait(token, runId)
          const reviews = await apifyDataset<{ stars?: number; text?: string }>(token, datasetId)
          const texts = reviews.map((r) => r.text ?? "").filter(Boolean)
          const ratings = reviews.map((r) => r.stars ?? 0).filter(Boolean)
          const avgRating =
            ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0
          results.push({ source: "google", avgRating, reviewCount: reviews.length, texts })
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error("Google scrape failed:", msg)
          scrapeErrors.push(`Google: ${msg}`)
        }
      }

      for (const result of results) {
        const pillars = await analyseReviewsForPillars(result.texts)

        await db
          .insert(onlineReviewsCache)
          .values({
            id: crypto.randomUUID(),
            propertyId: input.propertyId,
            source: result.source,
            avgRating: String(result.avgRating.toFixed(1)),
            reviewCount: result.reviewCount,
            pillarResilience: String(pillars.resilience.toFixed(2)),
            pillarEmpathy: String(pillars.empathy.toFixed(2)),
            pillarAnticipation: String(pillars.anticipation.toFixed(2)),
            pillarRecognition: String(pillars.recognition.toFixed(2)),
            lastScrapedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [onlineReviewsCache.propertyId, onlineReviewsCache.source],
            set: {
              avgRating: String(result.avgRating.toFixed(1)),
              reviewCount: result.reviewCount,
              pillarResilience: String(pillars.resilience.toFixed(2)),
              pillarEmpathy: String(pillars.empathy.toFixed(2)),
              pillarAnticipation: String(pillars.anticipation.toFixed(2)),
              pillarRecognition: String(pillars.recognition.toFixed(2)),
              lastScrapedAt: new Date(),
            },
          })
      }

      if (results.length === 0 && scrapeErrors.length > 0) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: scrapeErrors.join(" | "),
        })
      }

      return { scraped: results.map((r) => r.source), errors: scrapeErrors }
    }),

  updateReviewPromptSettings: protectedProcedure
    .input(
      z.object({
        propertyId: z.string(),
        threshold: z.number().int().min(1).max(10),
        platforms: z.array(z.enum(["google", "tripadvisor"])).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertPropertyOwner(ctx.session.user.id, input.propertyId, ctx.isAdmin)

      await db
        .update(properties)
        .set({
          reviewPromptThreshold: input.threshold,
          reviewPromptPlatforms: input.platforms.join(","),
        })
        .where(eq(properties.id, input.propertyId))

      return { ok: true }
    }),

  getAdvancedInsights: protectedProcedure
    .input(z.object({ propertyId: z.string(), days: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.isAdmin) await assertPropertyAccess(ctx.session.user.id, input.propertyId)

      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000)

      // ── Day-of-week breakdown ────────────────────────────────────────────────
      // DOW: 0 = Sunday, 1 = Monday, … 6 = Saturday
      const dowRows = await db
        .select({
          dow: sql<string>`EXTRACT(DOW FROM ${feedback.submittedAt})::int`,
          avgGcs: sql<string>`COALESCE(AVG(${feedback.gcs}::numeric), 0)`,
          count: count(),
        })
        .from(feedback)
        .where(and(eq(feedback.propertyId, input.propertyId), gte(feedback.submittedAt, since)))
        .groupBy(sql`EXTRACT(DOW FROM ${feedback.submittedAt})`)
        .orderBy(sql`EXTRACT(DOW FROM ${feedback.submittedAt})`)

      const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

      // Build a full 7-day array so days with no data show as null
      const dowMap = new Map(dowRows.map((r) => [Number(r.dow), { avgGcs: Number(r.avgGcs), count: r.count }]))
      const dayOfWeek = DOW_LABELS.map((label, idx) => ({
        day: label,
        avgGcs: dowMap.get(idx)?.avgGcs ?? null,
        count: dowMap.get(idx)?.count ?? 0,
      }))

      // ── Weekly sentiment trend ───────────────────────────────────────────────
      const trendRows = await db
        .select({
          week: sql<string>`TO_CHAR(DATE_TRUNC('week', ${feedback.submittedAt}), 'DD Mon')`,
          avgGcs: sql<string>`COALESCE(AVG(${feedback.gcs}::numeric), 0)`,
          count: count(),
        })
        .from(feedback)
        .where(and(eq(feedback.propertyId, input.propertyId), gte(feedback.submittedAt, since)))
        .groupBy(sql`DATE_TRUNC('week', ${feedback.submittedAt})`)
        .orderBy(sql`DATE_TRUNC('week', ${feedback.submittedAt})`)

      const sentimentTrend = trendRows.map((r) => ({
        week: r.week,
        avgGcs: Number(r.avgGcs),
        count: r.count,
      }))

      return { dayOfWeek, sentimentTrend }
    }),
})
