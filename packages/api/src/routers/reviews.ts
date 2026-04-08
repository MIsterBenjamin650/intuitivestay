import { ApifyClient } from "apify-client"
import { db } from "@intuitive-stay/db"
import { onlineReviewsCache, organisations, properties } from "@intuitive-stay/db/schema"
import { env } from "@intuitive-stay/env/server"
import { TRPCError } from "@trpc/server"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

import { protectedProcedure, router } from "../index"
import { analyseReviewsForPillars } from "../lib/ai"

async function assertPropertyOwner(userId: string, propertyId: string) {
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

export const reviewsRouter = router({
  setReviewSources: protectedProcedure
    .input(
      z.object({
        propertyId: z.string(),
        tripAdvisorUrl: z.string().url().nullable(),
        googlePlaceId: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertPropertyOwner(ctx.session.user.id, input.propertyId)

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
      await assertPropertyOwner(ctx.session.user.id, input.propertyId)

      const prop = await db
        .select({
          tripAdvisorUrl: properties.tripAdvisorUrl,
          googlePlaceId: properties.googlePlaceId,
        })
        .from(properties)
        .where(eq(properties.id, input.propertyId))
        .limit(1)

      const sources = prop[0] ?? { tripAdvisorUrl: null, googlePlaceId: null }

      const cached = await db
        .select()
        .from(onlineReviewsCache)
        .where(eq(onlineReviewsCache.propertyId, input.propertyId))

      return {
        tripAdvisorUrl: sources.tripAdvisorUrl,
        googlePlaceId: sources.googlePlaceId,
        tripadvisor: cached.find((c) => c.source === "tripadvisor") ?? null,
        google: cached.find((c) => c.source === "google") ?? null,
      }
    }),

  triggerScrape: protectedProcedure
    .input(z.object({ propertyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertPropertyOwner(ctx.session.user.id, input.propertyId)

      if (!env.APIFY_API_TOKEN) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Apify not configured" })
      }

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

      const apify = new ApifyClient({ token: env.APIFY_API_TOKEN })
      const results: {
        source: "tripadvisor" | "google"
        avgRating: number
        reviewCount: number
        texts: string[]
      }[] = []
      const scrapeErrors: string[] = []

      if (canScrapeTa && tripAdvisorUrl) {
        try {
          const run = await apify.actor("maxcopell/tripadvisor-scraper").call(
            {
              startUrls: [{ url: tripAdvisorUrl }],
              maxReviews: 50,
              reviewsLanguages: ["en"],
            },
            { waitSecs: 300 },
          )
          const { items } = await apify.dataset(run.defaultDatasetId).listItems({ limit: 50 })
          const reviews = items as Array<{ rating?: number; text?: string }>
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
          const run = await apify.actor("compass/google-maps-reviews-scraper").call(
            {
              placeIds: [googlePlaceId],
              maxReviews: 50,
              language: "en",
            },
            { waitSecs: 300 },
          )
          const { items } = await apify.dataset(run.defaultDatasetId).listItems({ limit: 50 })
          const reviews = items as Array<{ stars?: number; text?: string }>
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
})
