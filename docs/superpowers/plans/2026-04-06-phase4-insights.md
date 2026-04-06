# Phase 4 — Property Insights Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Insights page at `/properties/:id/insights` with tier-gated analytics charts, plus a Founder-only multi-property overview at `/insights`.

**Architecture:** Two tRPC endpoints supply data — `getPropertyInsights` (time-range aware, all per-property charts) and `getCityLeaderboard` (static, city rankings). A third endpoint `getFounderOverview` serves the multi-property overview. All tier enforcement is server-side; the frontend renders locked-chart placeholders based on `userPlan` returned by the server.

**Tech Stack:** Hono + tRPC (portal-server), TanStack Start + React 19 (portal-web), Drizzle ORM + PostgreSQL, recharts (already installed — the spec mentions Chart.js but recharts is the installed library and produces equivalent output).

> **Note:** This project has no automated test suite. All verification steps are manual — start the dev server with `pnpm dev` run from `C:\Users\miste\intuitivestay\intuitivestay` and check the UI in the browser.

---

## File Map

| File | Action |
|---|---|
| `packages/api/src/routers/properties.ts` | Modify — add 3 new procedures |
| `apps/portal-web/src/components/property-insights.tsx` | Create |
| `apps/portal-web/src/components/founder-insights-overview.tsx` | Create |
| `apps/portal-web/src/routes/_portal.properties.$propertyId.insights.tsx` | Modify — wire up component |
| `apps/portal-web/src/routes/_portal.insights.tsx` | Create |

---

### Task 1: `getPropertyInsights` tRPC procedure

**Files:**
- Modify: `packages/api/src/routers/properties.ts`

- [ ] **Step 1: Add helper functions above the router definition**

Add these helpers at the top of `packages/api/src/routers/properties.ts`, after the imports:

```ts
// ─── Insights helpers ─────────────────────────────────────────────────────────

const TIER_ORDER = ["7d", "30d", "180d", "365d"] as const
type TimeRange = (typeof TIER_ORDER)[number]

const PLAN_MAX_RANGE: Record<string, TimeRange> = {
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
  const max = PLAN_MAX_RANGE[plan] ?? "7d"
  const reqIdx = TIER_ORDER.indexOf(requested as TimeRange)
  const maxIdx = TIER_ORDER.indexOf(max)
  return reqIdx !== -1 && reqIdx <= maxIdx ? (requested as TimeRange) : max
}

function weekStart(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
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
```

- [ ] **Step 2: Add `getPropertyInsights` to the router**

Inside the `propertiesRouter` object (after `getPropertyQrData`), add:

```ts
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

      // 2. Clamp time range to plan
      const effectiveRange = clampTimeRange(input.timeRange, org.plan)
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
        org.plan === "founder" ? extractKeywords(rows.map((r) => r.ventText)) : []

      return {
        gcsOverTime,
        pillarAverages,
        pillarSpotlight: {
          strongest: strongest[0],
          strongestScore: strongest[1],
          weakest: weakest[0],
          weakestScore: weakest[1],
        },
        gcsByMealTime,
        submissionsPerWeek,
        scoreDistribution,
        engagementStats: { totalSubmissions, nameDropRate, ventRate },
        staffTagCloud,
        ventKeywords,
        allowedTimeRange: effectiveRange,
        userPlan: org.plan as "host" | "partner" | "founder",
      }
    }),
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /c/Users/miste/intuitivestay/intuitivestay && pnpm --filter @intuitive-stay/api tsc --noEmit
```

Expected: no errors. If you see "Property 'getPropertyInsights' does not exist" — make sure you added the procedure inside the `propertiesRouter` object.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/miste/intuitivestay/intuitivestay
git add packages/api/src/routers/properties.ts
git commit -m "feat: add getPropertyInsights tRPC procedure with tier-gated analytics"
```

---

### Task 2: `getCityLeaderboard` tRPC procedure

**Files:**
- Modify: `packages/api/src/routers/properties.ts`

- [ ] **Step 1: Add the procedure to the router**

Inside the `propertiesRouter` object, after `getPropertyInsights`:

```ts
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

      // Within-city: all approved properties in same city with scores
      const cityRows = await db
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
        .orderBy(desc(propertyScores.avgGcs))

      const withinCityRankings = cityRows.map((row, idx) => ({
        rank: idx + 1,
        name: row.id === input.propertyId ? row.name : null,
        isYou: row.id === input.propertyId,
        gcs: Math.round(Number(row.gcs) * 10) / 10,
      }))

      const yourEntry = withinCityRankings.find((r) => r.isYou)
      const yourRank = yourEntry?.rank ?? 0
      const yourGcs = yourEntry?.gcs ?? 0
      const cityAvgGcs =
        withinCityRankings.length > 0
          ? Math.round(
              (withinCityRankings.reduce((s, r) => s + r.gcs, 0) / withinCityRankings.length) * 10,
            ) / 10
          : 0

      // National: all cities averaged
      const nationalRows = await db
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
        .orderBy(desc(sql`avg(${propertyScores.avgGcs}::numeric)`))

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
        gapToCityAvg: Math.round((yourGcs - cityAvgGcs) * 10) / 10,
        withinCityRankings,
        nationalCityRankings,
        userPlan: org.plan as "host" | "partner" | "founder",
      }
    }),
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /c/Users/miste/intuitivestay/intuitivestay && pnpm --filter @intuitive-stay/api tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/routers/properties.ts
git commit -m "feat: add getCityLeaderboard tRPC procedure"
```

---

### Task 3: `getFounderOverview` tRPC procedure

**Files:**
- Modify: `packages/api/src/routers/properties.ts`

- [ ] **Step 1: Add the procedure to the router**

Inside the `propertiesRouter` object, after `getCityLeaderboard`:

```ts
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

    // Scores for all properties
    const scoreRows = await db
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
      .where(inArray(propertyScores.propertyId, propertyIds))

    const scoreMap = new Map(scoreRows.map((s) => [s.propertyId, s]))

    // Last 8 weeks of feedback for sparklines + trend delta
    const eightWeeksAgo = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000)
    const recentFeedback = await db
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
      .orderBy(feedback.submittedAt)

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
      const trendDelta = allWeeks.length >= 2 ? Math.round((recentAvg - prevAvg) * 10) / 10 : null

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
      const strongestPillar =
        pillarEntries.length > 0 ? pillarEntries.reduce((a, b) => (b[1] > a[1] ? b : a))[0] : null
      const weakestPillar =
        pillarEntries.length > 0 ? pillarEntries.reduce((a, b) => (b[1] < a[1] ? b : a))[0] : null

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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /c/Users/miste/intuitivestay/intuitivestay && pnpm --filter @intuitive-stay/api tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/routers/properties.ts
git commit -m "feat: add getFounderOverview tRPC procedure"
```

---

### Task 4: `PropertyInsights` component — shell, tier filter, GCS trend

**Files:**
- Create: `apps/portal-web/src/components/property-insights.tsx`

- [ ] **Step 1: Create the component file**

Create `apps/portal-web/src/components/property-insights.tsx` with this full content:

```tsx
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { useTRPC } from "@/utils/trpc"

// ─── Types ────────────────────────────────────────────────────────────────────

type TimeRange = "7d" | "30d" | "180d" | "365d"
type Plan = "host" | "partner" | "founder"

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "180d": "Last 6 months",
  "365d": "Last 12 months",
}

const PLAN_MAX: Record<Plan, TimeRange> = {
  host: "7d",
  partner: "30d",
  founder: "365d",
}

const TIER_ORDER: TimeRange[] = ["7d", "30d", "180d", "365d"]

function isRangeAllowed(range: TimeRange, plan: Plan): boolean {
  return TIER_ORDER.indexOf(range) <= TIER_ORDER.indexOf(PLAN_MAX[plan])
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">
      {children}
    </p>
  )
}

function ChartCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50 p-4 ${className}`}>
      {children}
    </div>
  )
}

function LockedCard({ requiredPlan }: { requiredPlan: string }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 h-32">
      <p className="text-sm text-muted-foreground">
        🔒 Upgrade to {requiredPlan} plan to unlock
      </p>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="text-3xl font-extrabold text-indigo-600 mt-1">{value}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
    </div>
  )
}

// ─── Score distribution colours ───────────────────────────────────────────────

function distColor(score: number): string {
  if (score <= 3) return "#fca5a5"
  if (score <= 5) return "#fcd34d"
  if (score <= 7) return "rgba(99,102,241,0.6)"
  if (score <= 9) return "#6366f1"
  return "#22c55e"
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  propertyId: string
}

export function PropertyInsights({ propertyId }: Props) {
  const trpc = useTRPC()
  const [timeRange, setTimeRange] = useState<TimeRange>("30d")

  const { data, isLoading, isError } = useQuery(
    trpc.properties.getPropertyInsights.queryOptions({ propertyId, timeRange }),
  )

  const { data: cityData } = useQuery(
    trpc.properties.getCityLeaderboard.queryOptions({ propertyId }),
  )

  const plan: Plan = (data?.userPlan as Plan) ?? "host"

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading insights…</div>
  }

  if (isError || !data) {
    return <div className="p-6 text-sm text-destructive">Failed to load insights.</div>
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Property Insights</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Guest satisfaction analytics for this property
        </p>
      </div>

      {/* ── Tier filter bar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
          Time Range
        </span>
        {TIER_ORDER.map((range) => {
          const allowed = isRangeAllowed(range, plan)
          const active = timeRange === range
          return (
            <button
              key={range}
              onClick={() => allowed && setTimeRange(range)}
              disabled={!allowed}
              className={[
                "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                active
                  ? "bg-indigo-600 text-white border border-indigo-600"
                  : allowed
                    ? "bg-indigo-50 text-indigo-600 border border-indigo-300 hover:bg-indigo-100"
                    : "bg-slate-50 text-slate-400 border border-slate-200 cursor-default",
              ].join(" ")}
            >
              {!allowed ? "🔒 " : ""}
              {TIME_RANGE_LABELS[range]}
            </button>
          )
        })}
        <span className="text-[9px] text-slate-400 ml-1">🔒 = higher plan required</span>
      </div>

      {/* ── GCS Over Time ── */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <SectionLabel>GCS Over Time</SectionLabel>
          {data.gcsOverTime.length >= 2 && (() => {
            const first = data.gcsOverTime[0]!.avg
            const last = data.gcsOverTime[data.gcsOverTime.length - 1]!.avg
            const delta = Math.round((last - first) * 10) / 10
            return (
              <span className={`text-xs font-semibold ${delta >= 0 ? "text-indigo-500" : "text-red-500"}`}>
                {delta >= 0 ? "↑" : "↓"} {delta >= 0 ? "+" : ""}{delta} vs start of period
              </span>
            )
          })()}
        </div>
        <ChartCard>
          {data.gcsOverTime.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No data for this period yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={data.gcsOverTime}>
                <defs>
                  <linearGradient id="gcsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => v.toFixed(1)} />
                <Area
                  type="monotone"
                  dataKey="avg"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#gcsGrad)"
                  dot={{ fill: "white", stroke: "#6366f1", strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 5 }}
                  name="GCS"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── Score Distribution + Pillar Radar ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <SectionLabel>Score Distribution</SectionLabel>
          {plan === "host" ? (
            <LockedCard requiredPlan="Partner" />
          ) : (
            <ChartCard>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.scoreDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="score" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip formatter={(v: number) => [`${v} submissions`, "Count"]} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Submissions">
                    {data.scoreDistribution.map((entry) => (
                      <Cell key={entry.score} fill={distColor(entry.score)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </div>

        <div>
          <SectionLabel>Pillar Averages</SectionLabel>
          <ChartCard>
            <ResponsiveContainer width="100%" height={180}>
              <RadarChart
                data={[
                  { pillar: "Resilience", score: data.pillarAverages.resilience },
                  { pillar: "Empathy", score: data.pillarAverages.empathy },
                  { pillar: "Anticipation", score: data.pillarAverages.anticipation },
                  { pillar: "Recognition", score: data.pillarAverages.recognition },
                ]}
              >
                <PolarGrid />
                <PolarAngleAxis dataKey="pillar" tick={{ fontSize: 10 }} />
                <Radar
                  name="Score"
                  dataKey="score"
                  stroke="#6366f1"
                  fill="#6366f1"
                  fillOpacity={0.25}
                />
                <Tooltip formatter={(v: number) => v.toFixed(1)} />
              </RadarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      {/* ── Meal Time + Submissions + Pillar Spotlight ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <SectionLabel>GCS by Meal Time</SectionLabel>
          {plan === "host" ? (
            <LockedCard requiredPlan="Partner" />
          ) : (
            <ChartCard>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={data.gcsByMealTime} layout="vertical">
                  <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="mealTime" width={70} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => v.toFixed(1)} />
                  <Bar dataKey="avg" fill="#6366f1" radius={[0, 4, 4, 0]} name="Avg GCS" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </div>

        <div>
          <SectionLabel>Submissions per Week</SectionLabel>
          {plan === "host" ? (
            <LockedCard requiredPlan="Partner" />
          ) : (
            <ChartCard>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={data.submissionsPerWeek}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="week" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip formatter={(v: number) => [`${v} submissions`, "Count"]} />
                  <Bar dataKey="count" fill="#818cf8" radius={[4, 4, 0, 0]} name="Submissions" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </div>

        <div>
          <SectionLabel>Pillar Spotlight</SectionLabel>
          <ChartCard className="flex flex-col gap-3 justify-center h-[160px]">
            <div className="rounded-lg bg-green-50 px-3 py-2 flex justify-between items-center">
              <div>
                <p className="text-[8px] font-semibold text-green-700 uppercase">★ Strongest</p>
                <p className="text-sm font-bold capitalize">{data.pillarSpotlight.strongest}</p>
              </div>
              <p className="text-xl font-extrabold text-green-600">
                {data.pillarSpotlight.strongestScore.toFixed(1)}
              </p>
            </div>
            <div className="rounded-lg bg-red-50 px-3 py-2 flex justify-between items-center">
              <div>
                <p className="text-[8px] font-semibold text-red-700 uppercase">↓ Needs focus</p>
                <p className="text-sm font-bold capitalize">{data.pillarSpotlight.weakest}</p>
              </div>
              <p className="text-xl font-extrabold text-red-600">
                {data.pillarSpotlight.weakestScore.toFixed(1)}
              </p>
            </div>
          </ChartCard>
        </div>
      </div>

      {/* ── Engagement Stats ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Total Submissions"
          value={String(data.engagementStats.totalSubmissions)}
          sub="this period"
        />
        {plan === "host" ? (
          <>
            <LockedCard requiredPlan="Partner" />
            <LockedCard requiredPlan="Partner" />
          </>
        ) : (
          <>
            <StatCard
              label="Name Drop Rate"
              value={`${data.engagementStats.nameDropRate}%`}
              sub="of happy guests named staff"
            />
            <StatCard
              label="Vent Box Rate"
              value={`${data.engagementStats.ventRate}%`}
              sub="of low-score guests left feedback"
            />
          </>
        )}
      </div>

      {/* ── Staff Tag Cloud ── */}
      <div>
        <SectionLabel>Staff Recognition — Name Drop™</SectionLabel>
        {plan === "host" ? (
          <LockedCard requiredPlan="Partner" />
        ) : data.staffTagCloud.length === 0 ? (
          <ChartCard>
            <p className="text-sm text-muted-foreground text-center py-4">
              No staff mentions yet in this period.
            </p>
          </ChartCard>
        ) : (
          <ChartCard>
            {(() => {
              const maxMentions = Math.max(...data.staffTagCloud.map((s) => s.mentions), 1)
              return (
                <div className="flex flex-wrap gap-3 items-center justify-center min-h-[80px]">
                  {data.staffTagCloud.map((staff) => {
                    const fontSize = Math.round(12 + (staff.mentions / maxMentions) * 20)
                    const color =
                      staff.avgGcs >= 9
                        ? "#4f46e5"
                        : staff.avgGcs >= 8
                          ? "#6366f1"
                          : staff.avgGcs >= 7
                            ? "#818cf8"
                            : "#a5b4fc"
                    return (
                      <span
                        key={staff.name}
                        title={`${staff.mentions} mention${staff.mentions !== 1 ? "s" : ""} · avg GCS ${staff.avgGcs.toFixed(1)}`}
                        style={{ fontSize, color, fontWeight: 700, cursor: "default" }}
                      >
                        {staff.name}
                      </span>
                    )
                  })}
                </div>
              )
            })()}
            <p className="text-[9px] text-slate-400 mt-3 text-center">
              Size = mentions · Darker = higher avg GCS · Hover for details
            </p>
          </ChartCard>
        )}
      </div>

      {/* ── Vent Keyword Cloud ── */}
      <div>
        <SectionLabel>Complaint Themes — Vent Keywords</SectionLabel>
        {plan !== "founder" ? (
          <LockedCard requiredPlan="Founder" />
        ) : data.ventKeywords.length === 0 ? (
          <ChartCard>
            <p className="text-sm text-muted-foreground text-center py-4">
              No vent text in this period.
            </p>
          </ChartCard>
        ) : (
          <ChartCard className="bg-red-50 border-red-200">
            {(() => {
              const maxCount = Math.max(...data.ventKeywords.map((k) => k.count), 1)
              return (
                <div className="flex flex-wrap gap-3 items-center justify-center min-h-[70px]">
                  {data.ventKeywords.map((kw) => {
                    const fontSize = Math.round(11 + (kw.count / maxCount) * 20)
                    const color =
                      kw.count / maxCount > 0.6
                        ? "#dc2626"
                        : kw.count / maxCount > 0.3
                          ? "#ef4444"
                          : "#f87171"
                    return (
                      <span
                        key={kw.word}
                        title={`${kw.count} occurrence${kw.count !== 1 ? "s" : ""}`}
                        style={{ fontSize, color, fontWeight: 600, cursor: "default" }}
                      >
                        {kw.word}
                      </span>
                    )
                  })}
                </div>
              )
            })()}
            <p className="text-[9px] text-slate-400 mt-3 text-center">
              Extracted from vent text · Size = frequency · Hover for count
            </p>
          </ChartCard>
        )}
      </div>

      {/* ── City Leaderboard ── */}
      {cityData && plan !== "host" && (
        <>
          {/* City ranking banner */}
          <div className="rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-400 p-5 text-white flex justify-between items-center">
            <div>
              <p className="text-xs opacity-80 uppercase tracking-wide font-semibold">
                Your ranking in {cityData.cityName}
              </p>
              <p className="text-3xl font-extrabold mt-1">
                #{cityData.yourRank}{" "}
                <span className="text-base font-medium opacity-75">
                  of {cityData.totalInCity} properties
                </span>
              </p>
              <p className="text-xs opacity-70 mt-1">
                Your avg GCS: {cityData.yourGcs.toFixed(1)} · City avg:{" "}
                {cityData.cityAvgGcs.toFixed(1)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs opacity-75">vs city average</p>
              <p className="text-3xl font-extrabold">
                {cityData.gapToCityAvg >= 0 ? "+" : ""}
                {cityData.gapToCityAvg.toFixed(1)}
              </p>
            </div>
          </div>

          {/* Within-city bar chart */}
          {plan === "founder" && cityData.withinCityRankings.length > 0 && (
            <div>
              <SectionLabel>{cityData.cityName} — Property Rankings</SectionLabel>
              <ChartCard>
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(160, cityData.withinCityRankings.length * 44)}
                >
                  <BarChart
                    data={cityData.withinCityRankings.map((r) => ({
                      ...r,
                      label: r.isYou ? r.name! : `#${r.rank} Anonymous`,
                    }))}
                    layout="vertical"
                  >
                    <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 10 }} />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={140}
                      tick={({ x, y, payload }) => (
                        <text
                          x={x}
                          y={y}
                          dy={4}
                          textAnchor="end"
                          fill={payload.value.includes("Anonymous") ? "#94a3b8" : "#6366f1"}
                          fontWeight={payload.value.includes("Anonymous") ? 400 : 700}
                          fontSize={10}
                        >
                          {payload.value}
                        </text>
                      )}
                    />
                    <Tooltip formatter={(v: number) => v.toFixed(1)} />
                    <ReferenceLine
                      x={cityData.cityAvgGcs}
                      stroke="#94a3b8"
                      strokeDasharray="4 4"
                      label={{
                        value: `Avg ${cityData.cityAvgGcs.toFixed(1)}`,
                        position: "top",
                        fill: "#94a3b8",
                        fontSize: 10,
                      }}
                    />
                    <Bar dataKey="gcs" radius={[0, 4, 4, 0]} name="Avg GCS">
                      {cityData.withinCityRankings.map((entry, idx) => (
                        <Cell key={idx} fill={entry.isYou ? "#6366f1" : "#c7d2fe"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-[9px] text-slate-400 mt-2">
                  Only your property is named · All others remain anonymous
                </p>
              </ChartCard>
            </div>
          )}

          {/* National city leaderboard */}
          {cityData.nationalCityRankings.length > 0 && (
            <div>
              <SectionLabel>National City Rankings</SectionLabel>
              <ChartCard>
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(160, cityData.nationalCityRankings.length * 40)}
                >
                  <BarChart
                    data={cityData.nationalCityRankings}
                    layout="vertical"
                  >
                    <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 10 }} />
                    <YAxis
                      type="category"
                      dataKey="city"
                      width={100}
                      tick={({ x, y, payload }) => (
                        <text
                          x={x}
                          y={y}
                          dy={4}
                          textAnchor="end"
                          fill={payload.value === cityData.cityName ? "#6366f1" : "#64748b"}
                          fontWeight={payload.value === cityData.cityName ? 700 : 400}
                          fontSize={10}
                        >
                          {payload.value}
                        </text>
                      )}
                    />
                    <Tooltip
                      formatter={(v: number, _name, props) => [
                        `${v.toFixed(1)} avg GCS (${props.payload.propertyCount} properties)`,
                        "City",
                      ]}
                    />
                    <Bar dataKey="avgGcs" radius={[0, 4, 4, 0]} name="Avg GCS">
                      {cityData.nationalCityRankings.map((entry, idx) => (
                        <Cell
                          key={idx}
                          fill={entry.isYou ? "#6366f1" : "#c7d2fe"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-[9px] text-slate-400 mt-2">
                  City averages across all active properties · Individual properties never shown
                </p>
              </ChartCard>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /c/Users/miste/intuitivestay/intuitivestay && pnpm --filter portal-web tsc --noEmit
```

Expected: no errors. Common issue: `ReferenceLine` or `Cell` not in recharts import — add them. Also check that `useTRPC` path `@/utils/trpc` is correct by looking at another component like `admin-property-detail.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/portal-web/src/components/property-insights.tsx
git commit -m "feat: add PropertyInsights component with tier-gated charts"
```

---

### Task 5: Wire up the property insights route

**Files:**
- Modify: `apps/portal-web/src/routes/_portal.properties.$propertyId.insights.tsx`

- [ ] **Step 1: Replace the placeholder with the real component**

Replace the entire file content with:

```tsx
import { createFileRoute } from "@tanstack/react-router"

import { PropertyInsights } from "@/components/property-insights"

export const Route = createFileRoute("/_portal/properties/$propertyId/insights")({
  component: RouteComponent,
})

function RouteComponent() {
  const { propertyId } = Route.useParams()
  return <PropertyInsights propertyId={propertyId} />
}
```

- [ ] **Step 2: Start dev server and verify the insights page loads**

```bash
cd /c/Users/miste/intuitivestay/intuitivestay && pnpm dev
```

Visit `http://localhost:3000` (or whatever port TanStack Start uses), log in as a property owner, navigate to a property → Insights tab. You should see:
- Tier filter buttons (locked ones show 🔒 if on Host plan)
- GCS Over Time area chart
- Score Distribution + Pillar radar side by side
- Meal Time, Submissions, Spotlight in three columns
- Engagement stat cards
- Staff tag cloud
- Vent keyword cloud (if Founder)
- City leaderboard (if Partner+)

If the page shows "No data for this period yet" — that's correct if the property has no feedback in the time range. Switch to a wider range.

- [ ] **Step 3: Commit**

```bash
git add apps/portal-web/src/routes/_portal.properties.\$propertyId.insights.tsx
git commit -m "feat: wire up PropertyInsights component to insights route"
```

---

### Task 6: `FounderInsightsOverview` component

**Files:**
- Create: `apps/portal-web/src/components/founder-insights-overview.tsx`

- [ ] **Step 1: Create the component file**

Create `apps/portal-web/src/components/founder-insights-overview.tsx`:

```tsx
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Area, AreaChart, ResponsiveContainer } from "recharts"

import { useTRPC } from "@/utils/trpc"

function gcsColor(gcs: number | null): string {
  if (gcs == null) return "text-slate-400"
  if (gcs >= 8) return "text-green-600"
  if (gcs >= 6) return "text-amber-500"
  return "text-red-600"
}

function AggregateStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="text-2xl font-extrabold text-indigo-600 mt-1">{value}</p>
    </div>
  )
}

export function FounderInsightsOverview() {
  const trpc = useTRPC()
  const { data, isLoading, isError } = useQuery(
    trpc.properties.getFounderOverview.queryOptions(),
  )

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading overview…</div>
  }

  if (isError || !data) {
    return <div className="p-6 text-sm text-destructive">Failed to load overview.</div>
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Portfolio Insights</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview across all your properties
        </p>
      </div>

      {/* Aggregate stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <AggregateStat
          label="Portfolio GCS"
          value={data.aggregateGcs != null ? data.aggregateGcs.toFixed(1) : "—"}
        />
        <AggregateStat
          label="Total Submissions"
          value={String(data.totalSubmissions)}
        />
        <AggregateStat
          label="Best Property"
          value={
            data.bestProperty
              ? `${data.bestProperty.name} · ${data.bestProperty.avgGcs.toFixed(1)}`
              : "—"
          }
        />
        <AggregateStat
          label="Needs Attention"
          value={
            data.worstProperty
              ? `${data.worstProperty.name} · ${data.worstProperty.avgGcs.toFixed(1)}`
              : "—"
          }
        />
      </div>

      {/* Property cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {data.properties.map((prop) => (
          <div
            key={prop.id}
            className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col gap-3"
          >
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold text-sm">{prop.name}</p>
                <p className="text-[10px] text-slate-400">{prop.city}</p>
              </div>
              <div className="text-right">
                <p className={`text-2xl font-extrabold ${gcsColor(prop.avgGcs)}`}>
                  {prop.avgGcs != null ? prop.avgGcs.toFixed(1) : "—"}
                </p>
                {prop.trendDelta != null && (
                  <p
                    className={`text-[10px] font-semibold ${prop.trendDelta >= 0 ? "text-green-600" : "text-red-500"}`}
                  >
                    {prop.trendDelta >= 0 ? "↑ +" : "↓ "}
                    {prop.trendDelta.toFixed(1)}
                  </p>
                )}
              </div>
            </div>

            {/* Sparkline */}
            {prop.sparkline.length > 1 && (
              <ResponsiveContainer width="100%" height={48}>
                <AreaChart data={prop.sparkline}>
                  <defs>
                    <linearGradient id={`sg-${prop.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="avg"
                    stroke="#6366f1"
                    strokeWidth={1.5}
                    fill={`url(#sg-${prop.id})`}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}

            {/* Stats row */}
            <div className="flex gap-4 text-[10px] text-slate-500">
              <span>{prop.totalFeedback} submissions</span>
              {prop.strongestPillar && (
                <span className="text-green-600">★ {prop.strongestPillar}</span>
              )}
              {prop.weakestPillar && prop.weakestPillar !== prop.strongestPillar && (
                <span className="text-red-500">↓ {prop.weakestPillar}</span>
              )}
            </div>

            {/* Link */}
            <Link
              to="/properties/$propertyId/insights"
              params={{ propertyId: prop.id }}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 mt-auto"
            >
              View Insights →
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /c/Users/miste/intuitivestay/intuitivestay && pnpm --filter portal-web tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/portal-web/src/components/founder-insights-overview.tsx
git commit -m "feat: add FounderInsightsOverview component"
```

---

### Task 7: Create the `/insights` route

**Files:**
- Create: `apps/portal-web/src/routes/_portal.insights.tsx`

- [ ] **Step 1: Create the route file**

Create `apps/portal-web/src/routes/_portal.insights.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router"

import { FounderInsightsOverview } from "@/components/founder-insights-overview"

export const Route = createFileRoute("/_portal/insights")({
  component: RouteComponent,
})

function RouteComponent() {
  return <FounderInsightsOverview />
}
```

The `getFounderOverview` server procedure already enforces Founder-only with a FORBIDDEN error. The `FounderInsightsOverview` component renders an error state if the call fails. Navigation to this route should only be surfaced in the sidebar for Founder users (handled separately in the sidebar component — see `app-sidebar.tsx` if you need to gate the nav link).

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /c/Users/miste/intuitivestay/intuitivestay && pnpm --filter portal-web tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual verification**

Start the dev server and log in as a Founder-plan user. Navigate to `/insights`. You should see the multi-property overview with property cards and sparklines. Non-Founder users who visit `/insights` directly should be redirected to their property insights page.

- [ ] **Step 5: Commit**

```bash
git add apps/portal-web/src/routes/_portal.insights.tsx
git commit -m "feat: add /insights route for Founder multi-property overview"
```

---

## Self-Review Checklist

Before calling this done, verify:

- [ ] `getPropertyInsights` returns correct `userPlan` for all three plan types
- [ ] Switching time range re-fetches data and charts update
- [ ] Host plan: Score Distribution, Meal Time, Submissions, Name Drop Rate, Vent Rate, Staff Tag Cloud, City Leaderboard all show 🔒 locked cards
- [ ] Partner plan: Vent Keyword Cloud and Within-city bar chart show 🔒; everything else visible
- [ ] Founder plan: all charts visible
- [ ] City leaderboard only shows when `cityData` is loaded and plan is Partner+
- [ ] Within-city bar chart only names your property — others show as "Anonymous"
- [ ] `/insights` route: Founder sees multi-property overview; non-Founder redirects to their property
