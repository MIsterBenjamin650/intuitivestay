# Online Reviews Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Online Reputation" section to each property dashboard that scrapes TripAdvisor and Google reviews via Apify, analyses them with Claude against the 4 GCS pillars, and displays a radar chart comparing GCS scores vs online review scores.

**Architecture:** On-demand scraping triggered by a "Refresh Reviews" button with a 7-day cooldown per source. Results are stored in a new `online_reviews_cache` DB table. Claude analyses the scraped review text and scores it against the 4 pillars (Resilience, Empathy, Anticipation, Recognition) to make the comparison meaningful. The frontend shows a Recharts RadarChart overlay of GCS vs online scores, plus star ratings from each platform.

**Tech Stack:** Apify Client (`apify-client`), Anthropic Claude (existing), Drizzle ORM, tRPC, Recharts (existing in dashboard), React

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/env/src/server.ts` | Modify | Add APIFY_API_TOKEN env var |
| `packages/api/package.json` | Modify | Add apify-client dependency |
| `packages/db/src/schema/properties.ts` | Modify | Add tripAdvisorUrl, googlePlaceId columns |
| `packages/db/src/schema/online-reviews-cache.ts` | Create | New table for cached review results |
| `packages/db/src/schema/index.ts` | Modify | Export new table |
| `packages/db/src/migrations/0006_online_reviews.sql` | Create | SQL migration for new columns and table |
| `packages/api/src/lib/ai.ts` | Modify | Add analyseReviewsForPillars() function |
| `packages/api/src/routers/reviews.ts` | Create | tRPC router: setReviewSources, triggerScrape, getComparison |
| `packages/api/src/root.ts` | Modify | Register reviewsRouter (read file first to confirm path) |
| `apps/portal-web/src/components/online-reputation-section.tsx` | Create | Self-contained UI component for the reputation section |
| `apps/portal-web/src/routes/_portal.properties.$propertyId.dashboard.tsx` | Modify | Import and render OnlineReputationSection |

---

## Task 1: Install apify-client and add env var

**Files:**
- Modify: `packages/api/package.json`
- Modify: `packages/env/src/server.ts`

- [ ] **Step 1: Install apify-client in the api package**

Run from the repo root:
```bash
cd C:/Users/miste/intuitivestay/intuitivestay
pnpm --filter @intuitive-stay/api add apify-client
```

- [ ] **Step 2: Add APIFY_API_TOKEN to the server env schema**

Read `packages/env/src/server.ts` first. Then add `APIFY_API_TOKEN: z.string().min(1).optional()` to the server object, after the existing ANTHROPIC_API_KEY line:

```typescript
    ANTHROPIC_API_KEY: z.string().min(1),
    APIFY_API_TOKEN: z.string().min(1).optional(),
```

- [ ] **Step 3: Add the Railway env var**

In Railway → intuitivestay service → Variables, add:
- Key: `APIFY_API_TOKEN`
- Value: your Apify API token (found at apify.com → Settings → Integrations → API tokens)

- [ ] **Step 4: Commit**

```bash
cd C:/Users/miste/intuitivestay/intuitivestay
git add packages/api/package.json pnpm-lock.yaml packages/env/src/server.ts
git commit -m "feat: add apify-client dependency and APIFY_API_TOKEN env var"
```

---

## Task 2: Database schema

**Files:**
- Modify: `packages/db/src/schema/properties.ts`
- Create: `packages/db/src/schema/online-reviews-cache.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Add TripAdvisor and Google fields to properties schema**

Read `packages/db/src/schema/properties.ts`. Add two new columns after the `isVip` line:

```typescript
  isVip: boolean("is_vip").default(false).notNull(),
  tripAdvisorUrl: text("tripadvisor_url"),
  googlePlaceId: text("google_place_id"),
  ownerEmail: text("owner_email").notNull(),
```

- [ ] **Step 2: Create the online reviews cache table**

Create `packages/db/src/schema/online-reviews-cache.ts`:

```typescript
import { numeric, pgTable, text, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"

import { properties } from "./properties"

export const onlineReviewsCache = pgTable(
  "online_reviews_cache",
  {
    id: text("id").primaryKey(),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    source: text("source").notNull(), // 'tripadvisor' | 'google'
    avgRating: numeric("avg_rating", { precision: 3, scale: 1 }),
    reviewCount: integer("review_count").notNull().default(0),
    pillarResilience: numeric("pillar_resilience", { precision: 4, scale: 2 }),
    pillarEmpathy: numeric("pillar_empathy", { precision: 4, scale: 2 }),
    pillarAnticipation: numeric("pillar_anticipation", { precision: 4, scale: 2 }),
    pillarRecognition: numeric("pillar_recognition", { precision: 4, scale: 2 }),
    lastScrapedAt: timestamp("last_scraped_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("online_reviews_cache_property_source_idx").on(
      table.propertyId,
      table.source,
    ),
  ],
)

export const onlineReviewsCacheRelations = relations(onlineReviewsCache, ({ one }) => ({
  property: one(properties, {
    fields: [onlineReviewsCache.propertyId],
    references: [properties.id],
  }),
}))
```

- [ ] **Step 3: Export from schema index**

Read `packages/db/src/schema/index.ts`. Add the export:

```typescript
export * from "./online-reviews-cache"
```

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema/properties.ts packages/db/src/schema/online-reviews-cache.ts packages/db/src/schema/index.ts
git commit -m "feat: add online reviews cache schema and property review source columns"
```

---

## Task 3: Database migration

**Files:**
- Create: `packages/db/src/migrations/0006_online_reviews.sql`

- [ ] **Step 1: Create the migration file**

Create `packages/db/src/migrations/0006_online_reviews.sql`:

```sql
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "tripadvisor_url" text;
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "google_place_id" text;

CREATE TABLE IF NOT EXISTS "online_reviews_cache" (
  "id" text PRIMARY KEY NOT NULL,
  "property_id" text NOT NULL REFERENCES "properties"("id") ON DELETE CASCADE,
  "source" text NOT NULL,
  "avg_rating" numeric(3,1),
  "review_count" integer NOT NULL DEFAULT 0,
  "pillar_resilience" numeric(4,2),
  "pillar_empathy" numeric(4,2),
  "pillar_anticipation" numeric(4,2),
  "pillar_recognition" numeric(4,2),
  "last_scraped_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "online_reviews_cache_property_source_idx"
  ON "online_reviews_cache" ("property_id", "source");
```

- [ ] **Step 2: Run the migration in Supabase**

Go to Supabase → SQL Editor, paste and run the contents of the migration file.

Expected: No errors, "Success. No rows returned."

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/migrations/0006_online_reviews.sql
git commit -m "feat: add migration for online reviews cache table"
```

---

## Task 4: Claude pillar analysis function

**Files:**
- Modify: `packages/api/src/lib/ai.ts`

- [ ] **Step 1: Add the analyseReviewsForPillars function**

Read `packages/api/src/lib/ai.ts`. Append this function at the end of the file:

```typescript
export type PillarAnalysisResult = {
  resilience: number
  empathy: number
  anticipation: number
  recognition: number
}

export async function analyseReviewsForPillars(
  reviews: string[],
): Promise<PillarAnalysisResult> {
  if (reviews.length === 0) {
    return { resilience: 5, empathy: 5, anticipation: 5, recognition: 5 }
  }

  const sample = reviews.slice(0, 50)
  const prompt = `You are a hospitality performance analyst. Analyse these ${sample.length} guest reviews and score the property on 4 service pillars from 1-10 based purely on what the reviews say.

Pillar definitions:
- Resilience: How well do staff handle problems, complaints, or unexpected situations?
- Empathy: How warm, caring and attentive are staff to individual guest needs?
- Anticipation: Do staff anticipate guest needs before being asked?
- Recognition: Do guests feel personally recognised, remembered, or special?

If a pillar is not mentioned in the reviews, score it 5 (neutral).

Reviews:
${sample.map((r, i) => `${i + 1}. "${r.replace(/"/g, "'").slice(0, 300)}"`).join("\n")}

Respond with valid JSON only, no markdown:
{
  "resilience": 7.5,
  "empathy": 8.2,
  "anticipation": 6.9,
  "recognition": 7.8
}`

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
  })

  const raw = message.content[0]?.type === "text" ? message.content[0].text : ""
  const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim()
  const parsed = JSON.parse(text) as PillarAnalysisResult
  return {
    resilience: Math.min(10, Math.max(1, Number(parsed.resilience))),
    empathy: Math.min(10, Math.max(1, Number(parsed.empathy))),
    anticipation: Math.min(10, Math.max(1, Number(parsed.anticipation))),
    recognition: Math.min(10, Math.max(1, Number(parsed.recognition))),
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/lib/ai.ts
git commit -m "feat: add analyseReviewsForPillars AI function"
```

---

## Task 5: Reviews tRPC router

**Files:**
- Create: `packages/api/src/routers/reviews.ts`

- [ ] **Step 1: Create the reviews router**

Create `packages/api/src/routers/reviews.ts`:

```typescript
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

      // Check cooldowns
      const existing = await db
        .select({ source: onlineReviewsCache.source, lastScrapedAt: onlineReviewsCache.lastScrapedAt })
        .from(onlineReviewsCache)
        .where(eq(onlineReviewsCache.propertyId, input.propertyId))

      const now = Date.now()
      const taCache = existing.find((c) => c.source === "tripadvisor")
      const gCache = existing.find((c) => c.source === "google")

      const canScrapeTa = tripAdvisorUrl && (!taCache || now - taCache.lastScrapedAt.getTime() > COOLDOWN_MS)
      const canScrapeGoogle = googlePlaceId && (!gCache || now - gCache.lastScrapedAt.getTime() > COOLDOWN_MS)

      if (!canScrapeTa && !canScrapeGoogle) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Reviews were refreshed recently. Please wait 7 days before refreshing again.",
        })
      }

      const apify = new ApifyClient({ token: env.APIFY_API_TOKEN })
      const results: { source: "tripadvisor" | "google"; avgRating: number; reviewCount: number; texts: string[] }[] = []

      // Scrape TripAdvisor
      if (canScrapeTa && tripAdvisorUrl) {
        try {
          const run = await apify.actor("maxcopell/tripadvisor-scraper").call(
            {
              startUrls: [{ url: tripAdvisorUrl }],
              maxReviews: 50,
              reviewsLanguages: ["en"],
            },
            { waitSecs: 120 },
          )
          const { items } = await apify.dataset(run.defaultDatasetId).listItems({ limit: 50 })
          const reviews = items as Array<{ rating?: number; text?: string }>
          const texts = reviews.map((r) => r.text ?? "").filter(Boolean)
          const ratings = reviews.map((r) => r.rating ?? 0).filter(Boolean)
          const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0
          results.push({ source: "tripadvisor", avgRating, reviewCount: reviews.length, texts })
        } catch (err) {
          console.error("TripAdvisor scrape failed:", err)
        }
      }

      // Scrape Google Reviews
      if (canScrapeGoogle && googlePlaceId) {
        try {
          const run = await apify.actor("compass/google-maps-reviews-scraper").call(
            {
              placeIds: [googlePlaceId],
              maxReviews: 50,
              language: "en",
            },
            { waitSecs: 120 },
          )
          const { items } = await apify.dataset(run.defaultDatasetId).listItems({ limit: 50 })
          const reviews = items as Array<{ stars?: number; text?: string }>
          const texts = reviews.map((r) => r.text ?? "").filter(Boolean)
          const ratings = reviews.map((r) => r.stars ?? 0).filter(Boolean)
          const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0
          results.push({ source: "google", avgRating, reviewCount: reviews.length, texts })
        } catch (err) {
          console.error("Google scrape failed:", err)
        }
      }

      // Analyse each source with Claude and upsert cache
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

      return { scraped: results.map((r) => r.source) }
    }),
})
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/routers/reviews.ts
git commit -m "feat: add reviews tRPC router with Apify scraping and Claude pillar analysis"
```

---

## Task 6: Register the reviews router

**Files:**
- Modify: the root tRPC router file (read to find exact path)

- [ ] **Step 1: Find the root router**

Run:
```bash
grep -r "teamRouter\|appRouter\|createRouter" C:/Users/miste/intuitivestay/intuitivestay/packages/api/src/ --include="*.ts" -l
```

Read the file that registers all routers (likely `packages/api/src/root.ts` or `packages/api/src/router.ts`).

- [ ] **Step 2: Add reviewsRouter import and registration**

In the root router file, add:
```typescript
import { reviewsRouter } from "./routers/reviews"
```

And in the router definition, add:
```typescript
reviews: reviewsRouter,
```

alongside the other routers (team, properties, etc.).

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/root.ts  # or whichever file was modified
git commit -m "feat: register reviewsRouter in app router"
```

---

## Task 7: Frontend — OnlineReputationSection component

**Files:**
- Create: `apps/portal-web/src/components/online-reputation-section.tsx`

- [ ] **Step 1: Create the component**

Create `apps/portal-web/src/components/online-reputation-section.tsx`:

```tsx
import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { RefreshCw, Settings, Star } from "lucide-react"
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts"

import { useTRPC } from "@/utils/trpc"

interface Props {
  propertyId: string
  gcs: {
    resilience: number | null
    empathy: number | null
    anticipation: number | null
    recognition: number | null
  }
}

function StarRating({ value, max = 5 }: { value: number; max?: number }) {
  const pct = Math.round((value / max) * 10) / 10
  return (
    <div className="flex items-center gap-1.5">
      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
      <span className="text-lg font-bold">{value.toFixed(1)}</span>
      <span className="text-xs text-gray-400">/ {max}</span>
    </div>
  )
}

function daysSince(date: string | Date): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
}

export function OnlineReputationSection({ propertyId, gcs }: Props) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [showSetup, setShowSetup] = React.useState(false)
  const [taUrl, setTaUrl] = React.useState("")
  const [googleId, setGoogleId] = React.useState("")

  const { data, isLoading } = useQuery(
    trpc.reviews.getComparison.queryOptions({ propertyId }),
  )

  const saveMutation = useMutation(trpc.reviews.setReviewSources.mutationOptions())
  const scrapeMutation = useMutation(trpc.reviews.triggerScrape.mutationOptions())

  React.useEffect(() => {
    if (data) {
      setTaUrl(data.tripAdvisorUrl ?? "")
      setGoogleId(data.googlePlaceId ?? "")
    }
  }, [data])

  function refetch() {
    void queryClient.invalidateQueries(trpc.reviews.getComparison.queryOptions({ propertyId }))
  }

  async function handleSaveSources() {
    await saveMutation.mutateAsync({
      propertyId,
      tripAdvisorUrl: taUrl || null,
      googlePlaceId: googleId || null,
    })
    setShowSetup(false)
    refetch()
  }

  async function handleRefresh() {
    try {
      await scrapeMutation.mutateAsync({ propertyId })
      refetch()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Refresh failed"
      alert(msg)
    }
  }

  const hasSetup = !!(data?.tripAdvisorUrl || data?.googlePlaceId)
  const hasCache = !!(data?.tripadvisor || data?.google)

  // Build radar data — convert GCS 1-10 scale, online reviews also 1-10 from Claude analysis
  const radarData = [
    {
      subject: "Resilience",
      GCS: gcs.resilience ?? 0,
      "Online Reviews": data?.tripadvisor?.pillarResilience
        ? Number(data.tripadvisor.pillarResilience)
        : data?.google?.pillarResilience
        ? Number(data.google.pillarResilience)
        : null,
    },
    {
      subject: "Empathy",
      GCS: gcs.empathy ?? 0,
      "Online Reviews": data?.tripadvisor?.pillarEmpathy
        ? Number(data.tripadvisor.pillarEmpathy)
        : data?.google?.pillarEmpathy
        ? Number(data.google.pillarEmpathy)
        : null,
    },
    {
      subject: "Anticipation",
      GCS: gcs.anticipation ?? 0,
      "Online Reviews": data?.tripadvisor?.pillarAnticipation
        ? Number(data.tripadvisor.pillarAnticipation)
        : data?.google?.pillarAnticipation
        ? Number(data.google.pillarAnticipation)
        : null,
    },
    {
      subject: "Recognition",
      GCS: gcs.recognition ?? 0,
      "Online Reviews": data?.tripadvisor?.pillarRecognition
        ? Number(data.tripadvisor.pillarRecognition)
        : data?.google?.pillarRecognition
        ? Number(data.google.pillarRecognition)
        : null,
    },
  ]

  const showChart = hasCache && radarData.some((d) => d["Online Reviews"] !== null)

  // Cooldown check — disabled if both sources were scraped within 7 days
  const taAge = data?.tripadvisor ? daysSince(data.tripadvisor.lastScrapedAt) : 999
  const gAge = data?.google ? daysSince(data.google.lastScrapedAt) : 999
  const onCooldown = hasSetup && taAge < 7 && gAge < 7
  const lastUpdated = Math.min(taAge, gAge)

  if (isLoading) return null

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-gray-400">
            Online Reputation
          </p>
          {hasCache && (
            <p className="text-xs text-gray-400 mt-0.5">
              Last updated {lastUpdated === 0 ? "today" : `${lastUpdated} day${lastUpdated !== 1 ? "s" : ""} ago`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSetup((v) => !v)}
            className="flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
          >
            <Settings className="h-3 w-3" />
            Setup
          </button>
          {hasSetup && (
            <button
              onClick={handleRefresh}
              disabled={scrapeMutation.isPending || onCooldown}
              className="flex items-center gap-1.5 rounded-md border border-orange-300 bg-white px-2.5 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${scrapeMutation.isPending ? "animate-spin" : ""}`} />
              {scrapeMutation.isPending
                ? "Scraping…"
                : onCooldown
                ? `Refresh available in ${7 - lastUpdated}d`
                : "Refresh Reviews"}
            </button>
          )}
        </div>
      </div>

      {/* Setup form */}
      {showSetup && (
        <div className="mb-4 rounded-lg border border-dashed border-orange-200 bg-orange-50/50 p-4 space-y-3">
          <p className="text-xs font-medium text-gray-700">
            Enter your property's review page URLs so we can pull in your online reputation.
          </p>
          <div>
            <label className="text-xs font-medium text-gray-600">TripAdvisor URL</label>
            <input
              type="url"
              value={taUrl}
              onChange={(e) => setTaUrl(e.target.value)}
              placeholder="https://www.tripadvisor.co.uk/Restaurant_Review-..."
              className="mt-1 w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-300"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Google Place ID</label>
            <input
              type="text"
              value={googleId}
              onChange={(e) => setGoogleId(e.target.value)}
              placeholder="ChIJN1t_tDeuEmsRUsoyG83frY4"
              className="mt-1 w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-300"
            />
            <p className="mt-1 text-[10px] text-gray-400">
              Find your Place ID at: developers.google.com/maps/documentation/javascript/examples/places-placeid-finder
            </p>
          </div>
          <button
            onClick={handleSaveSources}
            disabled={saveMutation.isPending}
            className="rounded-md bg-orange-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {saveMutation.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      )}

      {/* No setup yet */}
      {!hasSetup && !showSetup && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-gray-400">
            Connect your TripAdvisor and Google listings to see how your online reputation compares to your GCS scores.
          </p>
          <button
            onClick={() => setShowSetup(true)}
            className="mt-3 rounded-md border border-orange-300 px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-50"
          >
            Get started
          </button>
        </div>
      )}

      {/* Has setup but no cache yet */}
      {hasSetup && !hasCache && !showSetup && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-gray-400">
            Click "Refresh Reviews" to pull in your latest online reviews and generate a comparison.
          </p>
        </div>
      )}

      {/* Comparison chart + ratings */}
      {showChart && (
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "#6b7280" }} />
              <Radar
                name="GCS Score"
                dataKey="GCS"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.25}
              />
              <Radar
                name="Online Reviews"
                dataKey="Online Reviews"
                stroke="#f97316"
                fill="#f97316"
                fillOpacity={0.15}
              />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 11 }}
                formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(1) : String(v))}
              />
            </RadarChart>
          </ResponsiveContainer>

          <div className="flex flex-col gap-3 justify-center min-w-[140px]">
            {data?.tripadvisor && (
              <div className="rounded-lg border p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                  TripAdvisor
                </p>
                <StarRating value={Number(data.tripadvisor.avgRating)} />
                <p className="text-xs text-gray-400 mt-0.5">
                  {data.tripadvisor.reviewCount} reviews
                </p>
              </div>
            )}
            {data?.google && (
              <div className="rounded-lg border p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                  Google
                </p>
                <StarRating value={Number(data.google.avgRating)} />
                <p className="text-xs text-gray-400 mt-0.5">
                  {data.google.reviewCount} reviews
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/portal-web/src/components/online-reputation-section.tsx
git commit -m "feat: add OnlineReputationSection dashboard component"
```

---

## Task 8: Wire into dashboard

**Files:**
- Modify: `apps/portal-web/src/routes/_portal.properties.$propertyId.dashboard.tsx`

- [ ] **Step 1: Add import**

Read the dashboard file. Add this import after the existing component imports:

```tsx
import { OnlineReputationSection } from "@/components/online-reputation-section"
```

- [ ] **Step 2: Compute average pillar values from history**

The `history` variable (from `getGcsHistory`) already contains pillar data. Find where `radarData` is computed (around line 176). Right after it, add:

```tsx
const avgPillars = history?.length
  ? {
      resilience: history.reduce((s, r) => s + (r.resilience ?? 0), 0) / history.length,
      empathy: history.reduce((s, r) => s + (r.empathy ?? 0), 0) / history.length,
      anticipation: history.reduce((s, r) => s + (r.anticipation ?? 0), 0) / history.length,
      recognition: history.reduce((s, r) => s + (r.recognition ?? 0), 0) / history.length,
    }
  : { resilience: null, empathy: null, anticipation: null, recognition: null }
```

- [ ] **Step 3: Add the section to the JSX**

Find the locked sections at the bottom of the dashboard JSX (the LockedSection components for Advanced Insights and Local Market). Add the OnlineReputationSection just before them:

```tsx
      {/* Online Reputation */}
      <OnlineReputationSection
        propertyId={propertyId}
        gcs={avgPillars}
      />
```

- [ ] **Step 4: TypeScript check**

```bash
cd C:/Users/miste/intuitivestay/intuitivestay
pnpm --filter @intuitive-stay/portal-web exec tsc --noEmit 2>&1 | grep -v "admin-dashboard\|sign-in-form\|sign-up-form\|topbar-user-menu\|_portal.index\|_portal.organisation.account\|_portal.properties.index"
```

Expected: No errors from the new files.

- [ ] **Step 5: Commit and push**

```bash
git add "apps/portal-web/src/routes/_portal.properties.\$propertyId.dashboard.tsx"
git commit -m "feat: add Online Reputation section to property dashboard"
git push origin main
```

---

## Self-Review

**Spec coverage:**
- ✅ On-demand scraping with button — Task 7 (Refresh Reviews button)
- ✅ 7-day cooldown per source — Task 5 (COOLDOWN_MS check) + Task 7 (onCooldown UI)
- ✅ TripAdvisor scraping — Task 5 (maxcopell/tripadvisor-scraper)
- ✅ Google reviews scraping — Task 5 (compass/google-maps-reviews-scraper)
- ✅ Claude pillar analysis — Task 4 + Task 5 (analyseReviewsForPillars)
- ✅ Radar chart comparison GCS vs online — Task 7 (RadarChart with two series)
- ✅ Star ratings per platform — Task 7 (StarRating component)
- ✅ Property URL/Place ID setup — Task 7 (setup form) + Task 5 (setReviewSources)
- ✅ Cache in database — Task 2 + Task 3 (online_reviews_cache table)
- ✅ Last updated display — Task 7 (daysSince helper)
- ✅ "Last updated X days ago" — Task 7

**Placeholder scan:** No TBDs, TODOs, or vague steps. All code is complete.

**Type consistency:** `onlineReviewsCache` used consistently across Tasks 2, 5. `analyseReviewsForPillars` defined in Task 4, imported in Task 5. `OnlineReputationSection` defined in Task 7, imported in Task 8. `avgPillars` defined and passed with matching `gcs` prop interface.
