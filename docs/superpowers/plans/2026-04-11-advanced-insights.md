# Advanced Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Coming Soon" Advanced Insights placeholder on the dashboard with two real charts — a weekly sentiment trend line and a day-of-week GCS bar chart.

**Architecture:** A single new tRPC query (`reviews.getAdvancedInsights`) fetches both datasets in one round-trip. A new self-contained React component (`AdvancedInsightsSection`) renders both charts using Recharts (already installed). The dashboard replaces its placeholder card with this component, passing the existing `propertyId` and `days` props — no layout changes needed.

**Tech Stack:** TypeScript, Drizzle ORM + PostgreSQL, tRPC, Recharts, Tailwind CSS, TanStack Query

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `packages/api/src/routers/reviews.ts` | Add `getAdvancedInsights` query |
| Create | `apps/portal-web/src/components/advanced-insights-section.tsx` | Sentiment trend + day-of-week charts |
| Modify | `apps/portal-web/src/routes/_portal.properties.$propertyId.dashboard.tsx` | Wire in the new component |

---

## Task 1: Backend — `getAdvancedInsights` query

**Files:**
- Modify: `packages/api/src/routers/reviews.ts`

**Context:**
- Auth pattern: `if (!ctx.isAdmin) await assertPropertyAccess(ctx.session.user.id, input.propertyId)`
- `assertPropertyAccess` is already imported at the top of this file
- `feedback` table has: `propertyId`, `gcs` (numeric), `submittedAt` (timestamp)
- Drizzle imports already present: `db`, `feedback` — but `feedback` may not be imported yet; check the imports at the top of the file and add if missing
- PostgreSQL DOW: `EXTRACT(DOW FROM submitted_at)` returns 0=Sunday through 6=Saturday
- Use `sql` tagged template from `drizzle-orm` for raw SQL expressions (already imported in other routers)

- [ ] **Step 1: Check and update imports in reviews.ts**

Open `packages/api/src/routers/reviews.ts`. Ensure these are present at the top:

```typescript
import { feedback, onlineReviewsCache, organisations, properties } from "@intuitive-stay/db/schema"
import { and, avg, count, eq, gte, sql } from "drizzle-orm"
```

If `feedback` is missing from the schema import, add it. If `avg`, `count`, `gte`, `sql` are missing from drizzle-orm, add them.

- [ ] **Step 2: Add the `getAdvancedInsights` procedure to the router**

Find the closing `})` of the `reviewsRouter` export in `packages/api/src/routers/reviews.ts` and add the new procedure before it:

```typescript
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

      // Build a full 7-day array so days with no data show as 0
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
```

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/routers/reviews.ts
git commit -m "feat: add getAdvancedInsights tRPC query (day-of-week + sentiment trend)"
```

---

## Task 2: Frontend — `AdvancedInsightsSection` component

**Files:**
- Create: `apps/portal-web/src/components/advanced-insights-section.tsx`

**Context:**
- Recharts is already installed. Dashboard uses: `AreaChart`, `Area`, `BarChart`, `Bar`, `CartesianGrid`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`, `Cell`
- Orange brand colour: `#f97316` (Tailwind `orange-500`)
- Dashboard card style: `rounded-2xl bg-white shadow-sm p-5`
- "No data" empty state pattern: a centred paragraph with `text-sm text-muted-foreground`
- `useTRPC` comes from `@/utils/trpc`
- `useQuery` comes from `@tanstack/react-query`
- The `days` prop is type `1 | 7 | 30 | 365` in the dashboard — accept it as `number` here to keep the component generic

- [ ] **Step 1: Create the component file**

Create `apps/portal-web/src/components/advanced-insights-section.tsx`:

```typescript
import { useQuery } from "@tanstack/react-query"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { useTRPC } from "@/utils/trpc"

interface Props {
  propertyId: string
  days: number
}

function gcsColor(gcs: number | null): string {
  if (gcs === null) return "#e5e7eb" // gray — no data
  if (gcs >= 8.5) return "#22c55e"   // green
  if (gcs >= 7)   return "#f97316"   // orange
  return "#ef4444"                   // red
}

export function AdvancedInsightsSection({ propertyId, days }: Props) {
  const trpc = useTRPC()

  const { data, isLoading } = useQuery(
    trpc.reviews.getAdvancedInsights.queryOptions({ propertyId, days }),
  )

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-white shadow-sm p-5 flex items-center justify-center min-h-[220px]">
        <p className="text-sm text-muted-foreground">Loading advanced insights…</p>
      </div>
    )
  }

  const hasTrendData = (data?.sentimentTrend?.length ?? 0) > 0
  const hasDowData = (data?.dayOfWeek?.filter((d) => d.count > 0).length ?? 0) > 0

  return (
    <div className="rounded-2xl bg-white shadow-sm p-5 flex flex-col gap-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#a8a29e]">
          Advanced Insights
        </p>
      </div>

      {/* ── Sentiment Trend ── */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-[#44403c]">Weekly Sentiment Trend</p>
        {!hasTrendData ? (
          <div className="flex items-center justify-center h-[140px] rounded-xl bg-gray-50 border border-dashed border-gray-200">
            <p className="text-sm text-muted-foreground">Not enough data yet for this period.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={data!.sentimentTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f97316" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
              <XAxis dataKey="week" tick={{ fontSize: 9 }} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 9 }} />
              <Tooltip
                formatter={(v: unknown) => [typeof v === "number" ? v.toFixed(1) : v, "Avg GCS"]}
                labelFormatter={(label) => `w/c ${label}`}
              />
              <Area
                type="monotone"
                dataKey="avgGcs"
                stroke="#f97316"
                strokeWidth={2}
                fill="url(#sentGrad)"
                dot={{ fill: "white", stroke: "#f97316", strokeWidth: 2, r: 3 }}
                activeDot={{ r: 4 }}
                name="Avg GCS"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Day-of-Week ── */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-[#44403c]">GCS by Day of Week</p>
        {!hasDowData ? (
          <div className="flex items-center justify-center h-[140px] rounded-xl bg-gray-50 border border-dashed border-gray-200">
            <p className="text-sm text-muted-foreground">Not enough data yet for this period.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={data!.dayOfWeek} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
              <XAxis dataKey="day" tick={{ fontSize: 9 }} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 9 }} />
              <Tooltip
                formatter={(v: unknown, _name: unknown, props: { payload?: { count: number } }) => [
                  typeof v === "number" ? v.toFixed(1) : "No data",
                  `Avg GCS (${props.payload?.count ?? 0} submissions)`,
                ]}
              />
              <Bar dataKey="avgGcs" radius={[4, 4, 0, 0]} name="Avg GCS">
                {(data!.dayOfWeek).map((entry, idx) => (
                  <Cell key={idx} fill={gcsColor(entry.avgGcs)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        <p className="text-[9px] text-muted-foreground">
          Green ≥ 8.5 · Orange ≥ 7 · Red &lt; 7 · Grey = no submissions
        </p>
      </div>

    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/portal-web/src/components/advanced-insights-section.tsx
git commit -m "feat: AdvancedInsightsSection component with sentiment trend + day-of-week charts"
```

---

## Task 3: Wire into the dashboard

**Files:**
- Modify: `apps/portal-web/src/routes/_portal.properties.$propertyId.dashboard.tsx`

**Context:**
- The relevant section is "Row 9: Advanced Insights + Local Market"
- Currently the `canSeeAdvancedInsights ? <placeholder card> : <LockedSection>` block renders a "Coming Soon" card when the user has access
- Replace only the placeholder card (the `true` branch of `canSeeAdvancedInsights`) — leave the `LockedSection` fallback and the Local Market card untouched
- `days` is already available as a state variable in scope
- `propertyId` is already available from `Route.useParams()`

- [ ] **Step 1: Add the import**

Find the existing imports at the top of `_portal.properties.$propertyId.dashboard.tsx`. Add:

```typescript
import { AdvancedInsightsSection } from "@/components/advanced-insights-section"
```

- [ ] **Step 2: Replace the placeholder card**

Find this block in the "Row 9" section:

```typescript
        {canSeeAdvancedInsights ? (
          <div className="rounded-2xl bg-white shadow-sm p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#a8a29e]">Advanced Insights</p>
              <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-[10px] font-semibold text-orange-500">Coming Soon</span>
            </div>
            <p className="text-sm text-[#44403c] leading-relaxed">Sentiment trend analysis, day-of-week consistency patterns, and reputation gap analysis will appear here once your property has sufficient data history.</p>
          </div>
        ) : (
          <LockedSection title="Advanced Insights" description="Sentiment trend analysis, day-of-week consistency, reputation gap analysis. Available on Partner and Founder plans." />
        )}
```

Replace it with:

```typescript
        {canSeeAdvancedInsights ? (
          <AdvancedInsightsSection propertyId={propertyId} days={days} />
        ) : (
          <LockedSection title="Advanced Insights" description="Sentiment trend analysis, day-of-week consistency, reputation gap analysis. Available on Partner and Founder plans." />
        )}
```

- [ ] **Step 3: Commit and push**

```bash
git add apps/portal-web/src/routes/_portal.properties.$propertyId.dashboard.tsx
git commit -m "feat: replace Advanced Insights placeholder with live sentiment trend + day-of-week charts"
git push origin main
```

---

## Self-Review

**Spec coverage:**
- ✅ Sentiment trend — weekly AreaChart, uses `days` filter, empty state handled
- ✅ Day-of-week — BarChart Mon–Sun, colour-coded by score, missing days shown as grey, empty state handled
- ✅ Tier gating — unchanged, still behind `canSeeAdvancedInsights` (Partner+)
- ✅ No new DB schema changes needed

**Placeholder scan:** None found — all steps have concrete code.

**Type consistency:**
- `getAdvancedInsights` returns `{ dayOfWeek: { day: string, avgGcs: number | null, count: number }[], sentimentTrend: { week: string, avgGcs: number, count: number }[] }`
- `AdvancedInsightsSection` consumes exactly this shape via tRPC inference — no manual type definitions needed
- `gcsColor` accepts `number | null` matching the `avgGcs` type on `dayOfWeek` rows
