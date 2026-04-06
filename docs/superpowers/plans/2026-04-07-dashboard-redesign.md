# Property Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current minimal property dashboard with a comprehensive single-page performance overview: GCS ring gauge with seal badge, AI daily summary card, pillar trend chart, radar chart, pillar donut gauges, adjective word cloud, staff bubble cloud, recent feedback panel, city leaderboard (Host/Partner), and locked upgrade chart sections.

**Architecture:** Three layers: (1) DB — add `adjectives` text column to `feedback`, create `aiDailySummaries` and `propertyTiers` tables; (2) Backend — new tRPC procedures on `propertiesRouter` plus a new `aiRouter` for daily summary generation; (3) Frontend — complete rewrite of `_portal.properties.$propertyId.dashboard.tsx` with all chart components inline (SVG ring gauge, Recharts LineChart/RadarChart, flex-wrap word cloud/bubble cloud, leaderboard table). A date-range selector in the page header controls all queries.

**Tech Stack:** React, TanStack Router, TanStack Query, tRPC, Recharts, Drizzle ORM, PostgreSQL, Tailwind CSS v4, shadcn/ui, TypeScript, Resend, `@anthropic-ai/sdk`

---

## File Map

| File | Action |
|---|---|
| `packages/db/src/schema/feedback.ts` | Add `adjectives` column |
| `packages/db/src/schema/ai-daily-summaries.ts` | Create new table |
| `packages/db/src/schema/property-tiers.ts` | Create new table |
| `packages/db/src/schema/index.ts` | Export new tables |
| `packages/env/src/server.ts` | Add `ANTHROPIC_API_KEY` env var |
| `packages/api/src/routers/properties.ts` | Add 7 new query procedures |
| `packages/api/src/lib/ai.ts` | Claude API helper |
| `packages/api/src/routers/ai.ts` | New `aiRouter` with `generateDailySummary` |
| `packages/api/src/routers/index.ts` | Register `aiRouter` |
| `apps/portal-web/src/routes/_portal.properties.$propertyId.dashboard.tsx` | Full rewrite |

---

### Task 1: DB Schema — new tables and adjectives field

**Context:** The `feedback` table lives at `packages/db/src/schema/feedback.ts`. The `adjectives` field stores comma-separated descriptive words guests choose (e.g. `"clean,friendly,quiet"`). The `aiDailySummaries` table stores one row per property per day. The `propertyTiers` table stores the current tier and any pending change. Migration runs with `drizzle-kit generate` then `drizzle-kit migrate` from `packages/db/`.

**Files:**
- Modify: `packages/db/src/schema/feedback.ts`
- Create: `packages/db/src/schema/ai-daily-summaries.ts`
- Create: `packages/db/src/schema/property-tiers.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Add `adjectives` to the feedback table**

In `packages/db/src/schema/feedback.ts`, add `adjectives` after `ventText`:

```ts
// existing line:
  ventText: text("vent_text"),
// add after it:
  adjectives: text("adjectives"), // comma-separated guest-chosen words e.g. "clean,friendly,quiet"
```

- [ ] **Step 2: Create `aiDailySummaries` table**

Create `packages/db/src/schema/ai-daily-summaries.ts`:

```ts
import { relations } from "drizzle-orm"
import { pgTable, text, timestamp, date, jsonb, unique } from "drizzle-orm/pg-core"

import { properties } from "./properties"

export const aiDailySummaries = pgTable(
  "ai_daily_summaries",
  {
    id: text("id").primaryKey(),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    date: date("date").notNull(), // the day being summarised, e.g. "2026-04-06"
    narrative: text("narrative").notNull(),
    focusPoints: jsonb("focus_points").notNull(), // Array<{ pillar: string; action: string }>
    generatedAt: timestamp("generated_at").defaultNow().notNull(),
  },
  (table) => [unique().on(table.propertyId, table.date)],
)

export const aiDailySummariesRelations = relations(aiDailySummaries, ({ one }) => ({
  property: one(properties, {
    fields: [aiDailySummaries.propertyId],
    references: [properties.id],
  }),
}))
```

- [ ] **Step 3: Create `propertyTiers` table**

Create `packages/db/src/schema/property-tiers.ts`:

```ts
import { relations } from "drizzle-orm"
import { pgTable, text, timestamp, date } from "drizzle-orm/pg-core"

import { properties } from "./properties"

export const propertyTiers = pgTable("property_tiers", {
  id: text("id").primaryKey(),
  propertyId: text("property_id")
    .notNull()
    .unique()
    .references(() => properties.id, { onDelete: "cascade" }),
  // "member" | "bronze" | "silver" | "gold" | "platinum"
  currentTier: text("current_tier").notNull().default("member"),
  // null when no change pending
  pendingTier: text("pending_tier"),
  // "upgrade" | "downgrade" | null
  pendingDirection: text("pending_direction"),
  pendingFrom: date("pending_from"),
  lastEvaluatedAt: timestamp("last_evaluated_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const propertyTiersRelations = relations(propertyTiers, ({ one }) => ({
  property: one(properties, {
    fields: [propertyTiers.propertyId],
    references: [properties.id],
  }),
}))
```

- [ ] **Step 4: Export new tables from schema index**

In `packages/db/src/schema/index.ts`, add:

```ts
export * from "./ai-daily-summaries";
export * from "./property-tiers";
```

- [ ] **Step 5: Generate and run the migration**

```bash
cd C:/Users/miste/intuitivestay/intuitivestay/packages/db && pnpm drizzle-kit generate 2>&1
```

Expected: generates a new SQL migration file in `src/migrations/`.

```bash
pnpm drizzle-kit migrate 2>&1
```

Expected: `All migrations applied successfully.`

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd C:/Users/miste/intuitivestay/intuitivestay && pnpm tsc --noEmit 2>&1 | head -40
```

Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/schema/ && git commit -m "feat: add adjectives column, ai_daily_summaries and property_tiers tables"
```

---

### Task 2: Add ANTHROPIC_API_KEY env var

**Context:** The env package validates all environment variables at startup. `packages/env/src/server.ts` uses `@t3-oss/env-core`. Add `ANTHROPIC_API_KEY` so the AI summary feature can use the Anthropic SDK.

**Files:**
- Modify: `packages/env/src/server.ts`

- [ ] **Step 1: Add ANTHROPIC_API_KEY to server env**

In `packages/env/src/server.ts`, add `ANTHROPIC_API_KEY` to the `server` object:

```ts
// Add after STRIPE_WEBHOOK_SECRET:
ANTHROPIC_API_KEY: z.string().min(1),
```

- [ ] **Step 2: Add the key to .env files**

In `apps/portal-server/.env`, add:
```
ANTHROPIC_API_KEY=sk-ant-...   # your real key
```

If a `.env.example` or `.env.local` exists in the repo root or `portal-server/`, add the key there too with a placeholder value.

- [ ] **Step 3: Install the Anthropic SDK in the api package**

```bash
cd C:/Users/miste/intuitivestay/intuitivestay/packages/api && pnpm add @anthropic-ai/sdk
```

Expected: package added to `packages/api/package.json`.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd C:/Users/miste/intuitivestay/intuitivestay && pnpm tsc --noEmit 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/env/src/server.ts packages/api/package.json pnpm-lock.yaml
git commit -m "feat: add ANTHROPIC_API_KEY env var and install @anthropic-ai/sdk"
```

---

### Task 3: tRPC — getDashboardStats, getGcsHistory, getRecentFeedback

**Context:** All new procedures go into `packages/api/src/routers/properties.ts` inside `propertiesRouter`. Each takes `{ propertyId: string, days: number }` as input and queries the `feedback` table filtered to that time window. Numeric DB columns (`gcs`, `resilience` etc.) return strings — wrap in `Number()` before arithmetic.

**Files:**
- Modify: `packages/api/src/routers/properties.ts`

- [ ] **Step 1: Add `gte` and `lt` to the drizzle imports**

At the top of `properties.ts`, the drizzle import already has `and, count, desc, eq, inArray, max, sql`. Add `gte, avg`:

```ts
import { and, avg, count, desc, eq, gte, inArray, max, sql } from "drizzle-orm"
```

Also ensure `feedback` is imported from `@intuitive-stay/db/schema` (it's already there).

- [ ] **Step 2: Add `getDashboardStats` procedure**

Inside `propertiesRouter`, add:

```ts
getDashboardStats: protectedProcedure
  .input(z.object({ propertyId: z.string(), days: z.number().int().positive() }))
  .query(async ({ input }) => {
    const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000)

    const [row] = await db
      .select({
        totalFeedback: count(),
        avgGcs: avg(feedback.gcs),
      })
      .from(feedback)
      .where(and(eq(feedback.propertyId, input.propertyId), gte(feedback.submittedAt, since)))

    return {
      totalFeedback: row?.totalFeedback ?? 0,
      avgGcs: row?.avgGcs != null ? Number(row.avgGcs) : null,
    }
  }),
```

- [ ] **Step 3: Add `getGcsHistory` procedure**

```ts
getGcsHistory: protectedProcedure
  .input(z.object({ propertyId: z.string(), days: z.number().int().positive() }))
  .query(async ({ input }) => {
    const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000)

    // Group by week (ISO week start) for >=14 days, else by day
    const bucketExpr = input.days >= 14
      ? sql<string>`to_char(date_trunc('week', ${feedback.submittedAt}), 'YYYY-MM-DD')`
      : sql<string>`to_char(${feedback.submittedAt}, 'YYYY-MM-DD')`

    const rows = await db
      .select({
        bucket: bucketExpr,
        gcs: avg(feedback.gcs),
        resilience: avg(feedback.resilience),
        empathy: avg(feedback.empathy),
        anticipation: avg(feedback.anticipation),
        recognition: avg(feedback.recognition),
      })
      .from(feedback)
      .where(and(eq(feedback.propertyId, input.propertyId), gte(feedback.submittedAt, since)))
      .groupBy(bucketExpr)
      .orderBy(bucketExpr)

    return rows.map((r) => ({
      bucket: r.bucket ?? "",
      gcs: r.gcs != null ? Number(r.gcs) : null,
      resilience: r.resilience != null ? Number(r.resilience) : null,
      empathy: r.empathy != null ? Number(r.empathy) : null,
      anticipation: r.anticipation != null ? Number(r.anticipation) : null,
      recognition: r.recognition != null ? Number(r.recognition) : null,
    }))
  }),
```

- [ ] **Step 4: Add `getRecentFeedback` procedure**

```ts
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

    return rows.map((r) => ({
      ...r,
      gcs: Number(r.gcs),
    }))
  }),
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd C:/Users/miste/intuitivestay/intuitivestay && pnpm tsc --noEmit 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routers/properties.ts
git commit -m "feat: add getDashboardStats, getGcsHistory, getRecentFeedback tRPC procedures"
```

---

### Task 4: tRPC — getWordCloud, getStaffBubbles, getCityLeaderboard, getTierStatus

**Context:** Continues in `packages/api/src/routers/properties.ts`. The `propertyTiers` and `aiDailySummaries` tables are now exported from `@intuitive-stay/db/schema`. Import them.

**Files:**
- Modify: `packages/api/src/routers/properties.ts`

- [ ] **Step 1: Add new table imports**

At the top of `properties.ts`, add to the schema import:

```ts
import { aiDailySummaries, feedback, organisations, properties, propertyScores, propertyTiers, qrCodes, user } from "@intuitive-stay/db/schema"
```

- [ ] **Step 2: Add `getWordCloud` procedure**

```ts
getWordCloud: protectedProcedure
  .input(z.object({ propertyId: z.string(), days: z.number().int().positive() }))
  .query(async ({ input }) => {
    const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000)

    const rows = await db
      .select({ adjectives: feedback.adjectives })
      .from(feedback)
      .where(
        and(
          eq(feedback.propertyId, input.propertyId),
          gte(feedback.submittedAt, since),
          isNotNull(feedback.adjectives),
        ),
      )

    const freq: Record<string, number> = {}
    for (const row of rows) {
      if (!row.adjectives) continue
      for (const word of row.adjectives.split(",").map((w) => w.trim().toLowerCase()).filter(Boolean)) {
        freq[word] = (freq[word] ?? 0) + 1
      }
    }

    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([word, count]) => ({ word, count }))
  }),
```

- [ ] **Step 3: Add `getStaffBubbles` procedure**

```ts
getStaffBubbles: protectedProcedure
  .input(z.object({ propertyId: z.string(), days: z.number().int().positive() }))
  .query(async ({ input }) => {
    const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000)

    const rows = await db
      .select({
        name: feedback.namedStaffMember,
        gcs: feedback.gcs,
      })
      .from(feedback)
      .where(
        and(
          eq(feedback.propertyId, input.propertyId),
          gte(feedback.submittedAt, since),
          isNotNull(feedback.namedStaffMember),
        ),
      )

    const map: Record<string, { count: number; totalGcs: number }> = {}
    for (const row of rows) {
      if (!row.name) continue
      const entry = map[row.name] ?? { count: 0, totalGcs: 0 }
      entry.count += 1
      entry.totalGcs += Number(row.gcs)
      map[row.name] = entry
    }

    return Object.entries(map).map(([name, { count, totalGcs }]) => {
      const avgGcs = totalGcs / count
      // sentiment: positive >=7, negative <6, neutral 6-6.99
      const sentiment: "positive" | "neutral" | "negative" =
        avgGcs >= 7 ? "positive" : avgGcs < 6 ? "negative" : "neutral"
      return { name, count, sentiment }
    })
  }),
```

- [ ] **Step 4: Add `getCityLeaderboard` procedure**

```ts
getCityLeaderboard: protectedProcedure
  .input(z.object({ propertyId: z.string(), days: z.number().int().positive() }))
  .query(async ({ input }) => {
    const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000)

    // Get the city for this property
    const prop = await db.query.properties.findFirst({
      where: eq(properties.id, input.propertyId),
      columns: { city: true, name: true },
    })

    if (!prop) return { city: "", rows: [] }

    // Get all approved properties in same city
    const cityProperties = await db
      .select({ id: properties.id, name: properties.name })
      .from(properties)
      .where(and(eq(properties.city, prop.city), eq(properties.status, "approved")))

    const cityPropertyIds = cityProperties.map((p) => p.id)

    if (!cityPropertyIds.length) return { city: prop.city, rows: [] }

    // Aggregate feedback per property in the time window
    const agg = await db
      .select({
        propertyId: feedback.propertyId,
        avgGcs: avg(feedback.gcs),
        avgResilience: avg(feedback.resilience),
        avgEmpathy: avg(feedback.empathy),
        avgAnticipation: avg(feedback.anticipation),
        avgRecognition: avg(feedback.recognition),
        submissions: count(),
      })
      .from(feedback)
      .where(
        and(
          inArray(feedback.propertyId, cityPropertyIds),
          gte(feedback.submittedAt, since),
        ),
      )
      .groupBy(feedback.propertyId)

    const aggMap = Object.fromEntries(agg.map((r) => [r.propertyId, r]))

    const rows = cityProperties
      .map((p) => {
        const r = aggMap[p.id]
        return {
          propertyId: p.id,
          isOwn: p.id === input.propertyId,
          name: p.id === input.propertyId ? p.name : null, // anonymise others
          avgGcs: r?.avgGcs != null ? Number(r.avgGcs) : null,
          avgResilience: r?.avgResilience != null ? Number(r.avgResilience) : null,
          avgEmpathy: r?.avgEmpathy != null ? Number(r.avgEmpathy) : null,
          avgAnticipation: r?.avgAnticipation != null ? Number(r.avgAnticipation) : null,
          avgRecognition: r?.avgRecognition != null ? Number(r.avgRecognition) : null,
          submissions: r?.submissions ?? 0,
        }
      })
      // Sort by GCS descending, nulls last
      .sort((a, b) => {
        if (a.avgGcs == null && b.avgGcs == null) return 0
        if (a.avgGcs == null) return 1
        if (b.avgGcs == null) return -1
        return b.avgGcs - a.avgGcs
      })
      .map((row, idx) => ({ ...row, rank: idx + 1 }))

    return { city: prop.city, rows }
  }),
```

- [ ] **Step 5: Add `getTierStatus` procedure**

```ts
getTierStatus: protectedProcedure
  .input(z.object({ propertyId: z.string() }))
  .query(async ({ input }) => {
    const tier = await db.query.propertyTiers.findFirst({
      where: eq(propertyTiers.propertyId, input.propertyId),
    })

    if (!tier) {
      // No tier record yet — treat as member
      return {
        currentTier: "member" as const,
        pendingTier: null,
        pendingDirection: null,
        pendingFrom: null,
      }
    }

    return {
      currentTier: tier.currentTier,
      pendingTier: tier.pendingTier,
      pendingDirection: tier.pendingDirection,
      pendingFrom: tier.pendingFrom,
    }
  }),
```

Also add `getAiSummary` procedure:

```ts
getAiSummary: protectedProcedure
  .input(z.object({ propertyId: z.string() }))
  .query(async ({ input }) => {
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
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd C:/Users/miste/intuitivestay/intuitivestay && pnpm tsc --noEmit 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/routers/properties.ts
git commit -m "feat: add getWordCloud, getStaffBubbles, getCityLeaderboard, getTierStatus, getAiSummary"
```

---

### Task 5: AI summary — Claude API helper + aiRouter

**Context:** The AI daily summary calls the Anthropic API with the previous day's stats, generates a JSON narrative + 3 focus points, writes to `aiDailySummaries`, and sends an email to the property owner. This is an admin-only procedure for now (to be triggered manually or by cron). The email helper pattern follows `packages/api/src/lib/email.ts`.

**Files:**
- Create: `packages/api/src/lib/ai.ts`
- Create: `packages/api/src/routers/ai.ts`
- Modify: `packages/api/src/routers/index.ts`
- Modify: `packages/api/src/lib/email.ts`

- [ ] **Step 1: Create the AI helper**

Create `packages/api/src/lib/ai.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk"
import { env } from "@intuitive-stay/env/server"

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

export type DailySummaryResult = {
  narrative: string
  focus: Array<{ pillar: string; action: string }>
}

export async function generatePropertySummary(input: {
  propertyName: string
  date: string
  submissionCount: number
  avgGcs: number | null
  avgResilience: number | null
  avgEmpathy: number | null
  avgAnticipation: number | null
  avgRecognition: number | null
  ventTexts: string[]
  staffMentions: string[]
}): Promise<DailySummaryResult> {
  const pillars = [
    { name: "Resilience", score: input.avgResilience },
    { name: "Empathy", score: input.avgEmpathy },
    { name: "Anticipation", score: input.avgAnticipation },
    { name: "Recognition", score: input.avgRecognition },
  ]

  const lowestPillar = pillars
    .filter((p) => p.score != null)
    .sort((a, b) => (a.score ?? 10) - (b.score ?? 10))[0]

  const prompt = `You are a hospitality performance advisor. Generate a brief daily summary for a property manager.

Property: ${input.propertyName}
Date: ${input.date}
Submissions yesterday: ${input.submissionCount}
Overall GCS: ${input.avgGcs?.toFixed(1) ?? "N/A"}/10
Pillar scores: Resilience ${input.avgResilience?.toFixed(1) ?? "N/A"}, Empathy ${input.avgEmpathy?.toFixed(1) ?? "N/A"}, Anticipation ${input.avgAnticipation?.toFixed(1) ?? "N/A"}, Recognition ${input.avgRecognition?.toFixed(1) ?? "N/A"}
${input.ventTexts.length > 0 ? `Guest comments: ${input.ventTexts.slice(0, 3).join(" | ")}` : "No guest comments yesterday."}
${input.staffMentions.length > 0 ? `Staff mentioned: ${[...new Set(input.staffMentions)].join(", ")}` : ""}

Respond with valid JSON only, no markdown:
{
  "narrative": "3-4 sentence summary of performance",
  "focus": [
    { "pillar": "PillarName", "action": "Short actionable tip for today" },
    { "pillar": "PillarName", "action": "Short actionable tip for today" },
    { "pillar": "PillarName", "action": "Short actionable tip for today" }
  ]
}`

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  })

  const text = message.content[0]?.type === "text" ? message.content[0].text : ""
  const parsed = JSON.parse(text) as DailySummaryResult
  return parsed
}
```

- [ ] **Step 2: Add `sendDailySummaryEmail` to email.ts**

In `packages/api/src/lib/email.ts`, add at the bottom:

```ts
export async function sendDailySummaryEmail(
  ownerEmail: string,
  propertyName: string,
  date: string,
  narrative: string,
  focus: Array<{ pillar: string; action: string }>,
  portalUrl: string,
) {
  const focusHtml = focus
    .map((f) => `<li><strong>${f.pillar}:</strong> ${f.action}</li>`)
    .join("")

  await resend.emails.send({
    from: FROM,
    to: ownerEmail,
    subject: `Your Daily Guest Care Summary — ${date}`,
    html: `<h2>Daily Guest Care Summary</h2>
<p><strong>${propertyName}</strong> · ${date}</p>
<p>${narrative}</p>
<h3>Today's Focus</h3>
<ul>${focusHtml}</ul>
<p><a href="${portalUrl}">View your full dashboard →</a></p>`,
  })
}
```

- [ ] **Step 3: Create the ai router**

Create `packages/api/src/routers/ai.ts`:

```ts
import { db } from "@intuitive-stay/db"
import { aiDailySummaries, feedback, organisations, properties } from "@intuitive-stay/db/schema"
import { env } from "@intuitive-stay/env/server"
import { and, desc, eq, gte, lt } from "drizzle-orm"
import { z } from "zod"

import { adminProcedure, router } from "../index"
import { sendDailySummaryEmail } from "../lib/email"
import { generatePropertySummary } from "../lib/ai"

export const aiRouter = router({
  generateDailySummary: adminProcedure
    .input(z.object({ propertyId: z.string(), date: z.string() })) // date = "YYYY-MM-DD"
    .mutation(async ({ input }) => {
      const targetDate = new Date(input.date)
      const dayStart = new Date(targetDate)
      dayStart.setUTCHours(0, 0, 0, 0)
      const dayEnd = new Date(targetDate)
      dayEnd.setUTCHours(23, 59, 59, 999)

      const prop = await db.query.properties.findFirst({
        where: eq(properties.id, input.propertyId),
        columns: { name: true, ownerEmail: true, organisationId: true },
      })

      if (!prop) throw new Error("Property not found")

      const rows = await db
        .select({
          gcs: feedback.gcs,
          resilience: feedback.resilience,
          empathy: feedback.empathy,
          anticipation: feedback.anticipation,
          recognition: feedback.recognition,
          ventText: feedback.ventText,
          namedStaffMember: feedback.namedStaffMember,
        })
        .from(feedback)
        .where(
          and(
            eq(feedback.propertyId, input.propertyId),
            gte(feedback.submittedAt, dayStart),
            lt(feedback.submittedAt, dayEnd),
          ),
        )

      if (!rows.length) {
        return { skipped: true, reason: "No submissions for this date" }
      }

      const avg = (vals: number[]) =>
        vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null

      const summaryInput = {
        propertyName: prop.name,
        date: input.date,
        submissionCount: rows.length,
        avgGcs: avg(rows.map((r) => Number(r.gcs))),
        avgResilience: avg(rows.map((r) => r.resilience)),
        avgEmpathy: avg(rows.map((r) => r.empathy)),
        avgAnticipation: avg(rows.map((r) => r.anticipation)),
        avgRecognition: avg(rows.map((r) => r.recognition)),
        ventTexts: rows.map((r) => r.ventText).filter((t): t is string => !!t),
        staffMentions: rows
          .map((r) => r.namedStaffMember)
          .filter((s): s is string => !!s),
      }

      const result = await generatePropertySummary(summaryInput)

      // Upsert into aiDailySummaries
      await db
        .insert(aiDailySummaries)
        .values({
          id: crypto.randomUUID(),
          propertyId: input.propertyId,
          date: input.date,
          narrative: result.narrative,
          focusPoints: result.focus,
          generatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [aiDailySummaries.propertyId, aiDailySummaries.date],
          set: {
            narrative: result.narrative,
            focusPoints: result.focus,
            generatedAt: new Date(),
          },
        })

      // Send summary email
      await sendDailySummaryEmail(
        prop.ownerEmail,
        prop.name,
        input.date,
        result.narrative,
        result.focus,
        env.PUBLIC_PORTAL_URL,
      )

      return { skipped: false, date: input.date, submissionCount: rows.length }
    }),
})
```

- [ ] **Step 4: Register the ai router**

In `packages/api/src/routers/index.ts`:

```ts
import { aiRouter } from "./ai"
import { feedbackRouter } from "./feedback"
import { propertiesRouter } from "./properties"

export const appRouter = router({
  healthCheck: publicProcedure.query(() => "OK"),
  privateData: protectedProcedure.query(({ ctx }) => ({
    message: "This is private",
    user: ctx.session.user,
  })),
  properties: propertiesRouter,
  feedback: feedbackRouter,
  ai: aiRouter,
})

export type AppRouter = typeof appRouter
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd C:/Users/miste/intuitivestay/intuitivestay && pnpm tsc --noEmit 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/lib/ai.ts packages/api/src/lib/email.ts packages/api/src/routers/ai.ts packages/api/src/routers/index.ts
git commit -m "feat: add AI daily summary generation with Claude API + Resend email delivery"
```

---

### Task 6: Dashboard UI — layout, date range, stat pills, GCS ring, seal badge

**Context:** The current `_portal.properties.$propertyId.dashboard.tsx` has StatCard + PillarCard. This task completely rewrites it with the new layout. The date range state (`days: 7 | 30 | 90`) drives all queries. The GCS ring gauge is a pure SVG component. The seal badge derives from the tier system.

**Files:**
- Modify: `apps/portal-web/src/routes/_portal.properties.$propertyId.dashboard.tsx`

- [ ] **Step 1: Write the new dashboard file**

Replace the entire file with:

```tsx
import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useRouteContext } from "@tanstack/react-router"
import { LockIcon } from "lucide-react"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { useTRPC } from "@/utils/trpc"

export const Route = createFileRoute("/_portal/properties/$propertyId/dashboard")({
  component: RouteComponent,
})

// ─── Constants ──────────────────────────────────────────────────────────────

type Days = 7 | 30 | 90

const PILLAR_COLORS = {
  resilience: "#6366f1",
  empathy: "#14b8a6",
  anticipation: "#a855f7",
  recognition: "#f97316",
} as const

const TIER_CONFIG = {
  member:   { label: "Member",   color: "#9ca3af", bg: "#f3f4f6" },
  bronze:   { label: "Bronze",   color: "#b45309", bg: "#fef3c7" },
  silver:   { label: "Silver",   color: "#64748b", bg: "#f1f5f9" },
  gold:     { label: "Gold",     color: "#ca8a04", bg: "#fefce8" },
  platinum: { label: "Platinum", color: "#6366f1", bg: "#eef2ff" },
} as const

type Tier = keyof typeof TIER_CONFIG

function getTierFromScore(score: number): Tier {
  if (score >= 95) return "platinum"
  if (score >= 80) return "gold"
  if (score >= 70) return "silver"
  if (score >= 50) return "bronze"
  return "member"
}

// ─── GCS Ring Gauge ─────────────────────────────────────────────────────────

function GcsRing({ gcs, tier }: { gcs: number | null; tier: Tier }) {
  const r = 56
  const cx = 70
  const cy = 70
  const C = 2 * Math.PI * r
  const pct = gcs != null ? Math.min(Math.max(gcs / 10, 0), 1) : 0
  const filled = C * pct
  const gap = C - filled
  const t = TIER_CONFIG[tier]

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width="140" height="140">
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        {/* Fill — rotated so it starts at top */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={t.color}
          strokeWidth="10"
          strokeDasharray={`${filled} ${gap}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        {/* Score text */}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="28" fontWeight="800" fill={t.color}>
          {gcs != null ? gcs.toFixed(1) : "—"}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fill="#9ca3af">
          out of 10
        </text>
      </svg>
      {/* Seal badge */}
      <span
        className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
        style={{ background: t.bg, color: t.color }}
      >
        {t.label}
      </span>
    </div>
  )
}

// ─── Locked section wrapper ─────────────────────────────────────────────────

function LockedSection({ title, description }: { title: string; description: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-white p-5 shadow-sm">
      {/* Placeholder bars */}
      <div className="mb-4 space-y-2 blur-sm select-none pointer-events-none">
        {[80, 60, 90, 45, 70].map((w, i) => (
          <div key={i} className="h-3 rounded-full bg-gray-200" style={{ width: `${w}%` }} />
        ))}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-white/80 backdrop-blur-sm">
        <LockIcon className="size-6 text-gray-400" />
        <p className="text-sm font-semibold text-gray-700">{title}</p>
        <p className="text-xs text-gray-500 text-center px-4">{description}</p>
        <a
          href="/organisation/billing"
          className="mt-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          View Plans
        </a>
      </div>
    </div>
  )
}

// ─── Date range tab bar ─────────────────────────────────────────────────────

function DateRangeTabs({ days, onChange }: { days: Days; onChange: (d: Days) => void }) {
  const options: { label: string; value: Days }[] = [
    { label: "7 days", value: 7 },
    { label: "30 days", value: 30 },
    { label: "90 days", value: 90 },
  ]
  return (
    <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            days === o.value
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ─── Route component ─────────────────────────────────────────────────────────

function RouteComponent() {
  const { propertyId } = Route.useParams()
  const { session } = useRouteContext({ from: "/_portal" })
  const plan = (session as { plan?: string | null } | null)?.plan ?? null
  const canSeeLeaderboard = plan === "host" || plan === "partner"

  const [days, setDays] = React.useState<Days>(30)
  const trpc = useTRPC()
  const opts = { propertyId, days }

  const { data: stats } = useQuery(trpc.properties.getDashboardStats.queryOptions(opts))
  const { data: history } = useQuery(trpc.properties.getGcsHistory.queryOptions(opts))
  const { data: recentFeedback } = useQuery(trpc.properties.getRecentFeedback.queryOptions(opts))
  const { data: wordCloud } = useQuery(trpc.properties.getWordCloud.queryOptions(opts))
  const { data: staffBubbles } = useQuery(trpc.properties.getStaffBubbles.queryOptions(opts))
  const { data: leaderboard } = useQuery(trpc.properties.getCityLeaderboard.queryOptions(opts))
  const { data: tierStatus } = useQuery(trpc.properties.getTierStatus.queryOptions({ propertyId }))
  const { data: aiSummary } = useQuery(trpc.properties.getAiSummary.queryOptions({ propertyId }))

  const tierScore = stats?.avgGcs != null ? stats.avgGcs * 10 : 0
  const officialTier = (tierStatus?.currentTier ?? "member") as Tier
  const displayTier: Tier = getTierFromScore(tierScore)

  // Radar data
  const radarData = history?.length
    ? [
        {
          subject: "Resilience",
          score: history.reduce((s, r) => s + (r.resilience ?? 0), 0) / history.length,
        },
        {
          subject: "Empathy",
          score: history.reduce((s, r) => s + (r.empathy ?? 0), 0) / history.length,
        },
        {
          subject: "Anticipation",
          score: history.reduce((s, r) => s + (r.anticipation ?? 0), 0) / history.length,
        },
        {
          subject: "Recognition",
          score: history.reduce((s, r) => s + (r.recognition ?? 0), 0) / history.length,
        },
      ]
    : []

  const TIME_EMOJIS: Record<string, string> = {
    morning: "☀️",
    afternoon: "🌤",
    evening: "🌙",
    night: "⭐",
  }

  const MAX_BUBBLE = 56
  const maxStaffCount = Math.max(...(staffBubbles?.map((s) => s.count) ?? [1]), 1)
  const SENTIMENT_COLORS = {
    positive: "#22c55e",
    neutral: "#94a3b8",
    negative: "#ef4444",
  }

  const maxWordCount = Math.max(...(wordCloud?.map((w) => w.count) ?? [1]), 1)

  return (
    <div className="flex flex-col gap-5 p-5">
      {/* Header with date range */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Dashboard</h1>
        <DateRangeTabs days={days} onChange={setDays} />
      </div>

      {/* Row 1: Stat pills */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Feedback", value: String(stats?.totalFeedback ?? "—"), color: "#6366f1" },
          { label: "Avg GCS", value: stats?.avgGcs != null ? stats.avgGcs.toFixed(1) : "—", color: "#14b8a6" },
          { label: "Tier Score", value: stats?.avgGcs != null ? (stats.avgGcs * 10).toFixed(0) : "—", color: "#a855f7" },
          { label: "Current Seal", value: TIER_CONFIG[displayTier].label, color: TIER_CONFIG[displayTier].color },
        ].map((pill) => (
          <div
            key={pill.label}
            className="rounded-xl bg-white px-4 py-3 shadow-sm"
            style={{ borderLeft: `4px solid ${pill.color}` }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-gray-400">{pill.label}</p>
            <p className="text-xl font-extrabold leading-tight mt-0.5" style={{ color: pill.color }}>{pill.value}</p>
          </div>
        ))}
      </div>

      {/* Row 2: GCS ring + AI summary */}
      <div className="grid gap-4 md:grid-cols-[auto_1fr]">
        <div className="flex items-center justify-center rounded-xl bg-white p-6 shadow-sm">
          <GcsRing gcs={stats?.avgGcs ?? null} tier={displayTier} />
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.07em] text-gray-400">AI Daily Summary</p>
          {aiSummary ? (
            <>
              <p className="text-xs text-gray-500 mb-3">
                {aiSummary.date} · Generated {new Date(aiSummary.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="text-sm text-gray-700 leading-relaxed mb-4">{aiSummary.narrative}</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-gray-400 mb-2">Today's Focus</p>
              <ul className="space-y-1.5">
                {aiSummary.focusPoints.map((f, i) => {
                  const pillarKey = f.pillar.toLowerCase() as keyof typeof PILLAR_COLORS
                  const color = PILLAR_COLORS[pillarKey] ?? "#6366f1"
                  return (
                    <li key={i} className="flex gap-2 text-xs text-gray-700">
                      <span className="font-semibold shrink-0" style={{ color }}>{f.pillar}:</span>
                      <span>{f.action}</span>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            <p className="text-sm text-gray-400">Your first summary will appear tomorrow morning.</p>
          )}
        </div>
      </div>

      {/* Row 3: Pillar trend + Radar */}
      <div className="grid gap-4 md:grid-cols-[3fr_2fr]">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.07em] text-gray-400">Pillar Scores Over Time</p>
          {history?.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 11 }} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="resilience" stroke={PILLAR_COLORS.resilience} strokeWidth={2} dot={false} name="Resilience" />
                <Line type="monotone" dataKey="empathy" stroke={PILLAR_COLORS.empathy} strokeWidth={2} dot={false} name="Empathy" />
                <Line type="monotone" dataKey="anticipation" stroke={PILLAR_COLORS.anticipation} strokeWidth={2} dot={false} name="Anticipation" />
                <Line type="monotone" dataKey="recognition" stroke={PILLAR_COLORS.recognition} strokeWidth={2} dot={false} name="Recognition" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400">No data yet for this period.</p>
          )}
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.07em] text-gray-400">Pillar Radar</p>
          {radarData.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "#6b7280" }} />
                <Radar name="Score" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 11 }}
                  formatter={(v: unknown) => typeof v === "number" ? v.toFixed(1) : v} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400">No data yet.</p>
          )}
        </div>
      </div>

      {/* Row 4: Pillar donut gauges */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(["resilience", "empathy", "anticipation", "recognition"] as const).map((pillar) => {
          const avgVal = history?.length
            ? history.reduce((s, r) => s + (r[pillar] ?? 0), 0) / history.length
            : null
          const r = 40
          const C = 2 * Math.PI * r
          const pct = avgVal != null ? Math.min(Math.max(avgVal / 10, 0), 1) : 0
          const color = PILLAR_COLORS[pillar]
          return (
            <div key={pillar} className="flex flex-col items-center rounded-xl bg-white p-4 shadow-sm">
              <svg width="100" height="100">
                <circle cx={50} cy={50} r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
                <circle
                  cx={50} cy={50} r={r} fill="none" stroke={color} strokeWidth="8"
                  strokeDasharray={`${C * pct} ${C * (1 - pct)}`}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                />
                <text x={50} y={54} textAnchor="middle" fontSize="20" fontWeight="800" fill={color}>
                  {avgVal != null ? avgVal.toFixed(1) : "—"}
                </text>
              </svg>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.07em] text-gray-400 capitalize">{pillar}</p>
            </div>
          )
        })}
      </div>

      {/* Row 5: Word cloud + Staff bubbles */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-gray-400">Guest Adjectives</p>
          {wordCloud?.length ? (
            <div className="flex flex-wrap gap-2">
              {wordCloud.map(({ word, count }) => {
                const scale = 0.75 + (count / maxWordCount) * 0.75
                return (
                  <span
                    key={word}
                    className="rounded-full px-3 py-1 font-semibold text-white"
                    style={{
                      fontSize: `${Math.round(scale * 12)}px`,
                      background: `hsl(${(word.charCodeAt(0) * 37) % 360}, 70%, 55%)`,
                    }}
                  >
                    {word}
                  </span>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No descriptive words collected yet.</p>
          )}
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-gray-400">Staff Mentions</p>
          {staffBubbles?.length ? (
            <div className="flex flex-wrap gap-3">
              {staffBubbles.map(({ name, count, sentiment }) => {
                const size = Math.round(28 + (count / maxStaffCount) * (MAX_BUBBLE - 28))
                return (
                  <div key={name} className="flex flex-col items-center gap-1">
                    <div
                      className="flex items-center justify-center rounded-full font-bold text-white"
                      style={{
                        width: size,
                        height: size,
                        background: SENTIMENT_COLORS[sentiment],
                        fontSize: Math.max(size * 0.3, 10),
                      }}
                      title={`${name} — ${count} mention${count !== 1 ? "s" : ""}`}
                    >
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-[9px] text-gray-500 font-medium">{name.split(" ")[0]}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No staff mentions yet.</p>
          )}
        </div>
      </div>

      {/* Row 6: Recent feedback */}
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-gray-400">Recent Feedback</p>
        {recentFeedback?.length ? (
          <div className="space-y-3">
            {recentFeedback.map((f) => (
              <div key={f.id} className="flex gap-4 rounded-lg border border-gray-100 p-3">
                <div className="text-2xl leading-none">{TIME_EMOJIS[f.mealTime ?? ""] ?? "🕐"}</div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { label: "R", value: f.resilience, color: PILLAR_COLORS.resilience },
                        { label: "E", value: f.empathy, color: PILLAR_COLORS.empathy },
                        { label: "A", value: f.anticipation, color: PILLAR_COLORS.anticipation },
                        { label: "Rec", value: f.recognition, color: PILLAR_COLORS.recognition },
                      ] as const
                    ).map(({ label, value, color }) => (
                      <span
                        key={label}
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                        style={{ background: color }}
                      >
                        {label} {value}/10
                      </span>
                    ))}
                  </div>
                  {f.namedStaffMember && (
                    <p className="text-[11px] text-gray-500">
                      Staff: <span className="font-semibold text-gray-700">{f.namedStaffMember}</span>
                    </p>
                  )}
                  {f.ventText && (
                    <p className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800 border border-amber-100">
                      {f.ventText}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No feedback yet for this period.</p>
        )}
      </div>

      {/* Row 7: City leaderboard */}
      {canSeeLeaderboard ? (
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-gray-400">
            City Leaderboard{leaderboard?.city ? ` — ${leaderboard.city}` : ""}
          </p>
          {leaderboard?.rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="py-2 pr-3 text-left font-semibold text-gray-500">#</th>
                    <th className="py-2 pr-3 text-left font-semibold text-gray-500">Property</th>
                    <th className="py-2 pr-3 text-right font-semibold text-gray-500">GCS</th>
                    <th className="py-2 pr-3 text-right font-semibold text-gray-500">R</th>
                    <th className="py-2 pr-3 text-right font-semibold text-gray-500">E</th>
                    <th className="py-2 pr-3 text-right font-semibold text-gray-500">A</th>
                    <th className="py-2 pr-3 text-right font-semibold text-gray-500">Rec</th>
                    <th className="py-2 text-right font-semibold text-gray-500">Submissions</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.rows.map((row) => (
                    <tr
                      key={row.propertyId}
                      className={row.isOwn ? "bg-indigo-50" : "border-b border-gray-50"}
                      style={row.isOwn ? { borderLeft: "3px solid #6366f1" } : undefined}
                    >
                      <td className="py-2 pr-3 font-bold text-gray-500">{row.rank}</td>
                      <td className="py-2 pr-3 font-semibold text-gray-800">
                        {row.isOwn ? row.name : `Property #${row.rank}`}
                      </td>
                      <td className="py-2 pr-3 text-right font-bold text-indigo-600">
                        {row.avgGcs != null ? row.avgGcs.toFixed(1) : "—"}
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-500">{row.avgResilience?.toFixed(1) ?? "—"}</td>
                      <td className="py-2 pr-3 text-right text-gray-500">{row.avgEmpathy?.toFixed(1) ?? "—"}</td>
                      <td className="py-2 pr-3 text-right text-gray-500">{row.avgAnticipation?.toFixed(1) ?? "—"}</td>
                      <td className="py-2 pr-3 text-right text-gray-500">{row.avgRecognition?.toFixed(1) ?? "—"}</td>
                      <td className="py-2 text-right text-gray-500">{row.submissions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No other properties found in your city yet.</p>
          )}
        </div>
      ) : (
        <LockedSection
          title="City Leaderboard"
          description="See how you rank against other properties in your city. Available on Host and Partner plans."
        />
      )}

      {/* Row 8: Locked sections */}
      <div className="grid gap-4 md:grid-cols-2">
        <LockedSection
          title="Advanced Insights"
          description="Sentiment trend analysis, day-of-week consistency, reputation gap analysis. Upgrade to unlock."
        />
        <LockedSection
          title="Local Market"
          description="Compare your GCS against local hospitality market benchmarks. Upgrade to unlock."
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:/Users/miste/intuitivestay/intuitivestay && pnpm tsc --noEmit 2>&1 | head -40
```

Expected: no errors. Common issues: missing Recharts types (run `pnpm add -D @types/recharts` if needed, though Recharts ships its own types).

- [ ] **Step 3: Build**

```bash
cd C:/Users/miste/intuitivestay/intuitivestay && pnpm build 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/portal-web/src/routes/_portal.properties.\$propertyId.dashboard.tsx
git commit -m "feat: complete property dashboard redesign with all chart sections"
```

---

### Task 7: Build and deploy

- [ ] **Step 1: Push to Railway**

```bash
git push origin main
```

Expected: Railway picks up the push and builds successfully. Check the Railway dashboard.

- [ ] **Step 2: Verify in production**

Log in as a Host or Partner owner and open the property dashboard. Confirm:
- Date range tabs (7 days / 30 days / 90 days) render in the header
- GCS ring gauge renders with correct colour for current tier
- Seal badge shows the correct tier label
- AI summary card shows "Your first summary will appear tomorrow morning" if no summaries exist yet
- Pillar trend line chart renders (or shows "No data yet" if no feedback)
- Radar chart renders
- 4 pillar donut gauges render
- Word cloud empty state shows if no adjectives
- Staff mentions empty state shows if no staff data
- Recent feedback shows last 10 submissions with pillar score chips
- City leaderboard visible for Host/Partner; locked section for Founder
- Two locked sections at the bottom (Advanced Insights, Local Market)
