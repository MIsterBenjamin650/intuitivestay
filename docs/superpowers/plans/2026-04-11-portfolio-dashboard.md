# Portfolio Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the multi-property portfolio overview into a full operations-manager dashboard with 5-card stats, spotlight row, sortable/filterable property table with sparklines, property + staff leaderboards with city ranks, a most-improved banner, and an orange trend chart.

**Architecture:** Extend the existing `getPortfolioDashboard` tRPC procedure in-place to return new fields (`enrichedPropertyRows`, `staffLeaderboard`, `mostImproved`, `thisWeekCount`, `ventCount`, and deltas). Refactor `_portal.index.tsx` to use seven new single-responsibility components, all receiving props from that single query — no extra network requests.

**Tech Stack:** tRPC + Drizzle ORM (PostgreSQL); React + TanStack Query + Tailwind CSS + inline SVG sparklines + Recharts (trend chart). No schema migrations — all data comes from existing tables.

---

## File Map

**Modify:**
- `packages/api/src/routers/properties.ts` — extend `getPortfolioDashboard` (~line 1107)
- `apps/portal-web/src/routes/_portal.index.tsx` — replace `PortfolioDashboard` component

**Create:**
- `apps/portal-web/src/components/portfolio-stat-cards.tsx`
- `apps/portal-web/src/components/portfolio-spotlight.tsx`
- `apps/portal-web/src/components/portfolio-table.tsx`
- `apps/portal-web/src/components/portfolio-leaderboard.tsx`
- `apps/portal-web/src/components/portfolio-staff-board.tsx`
- `apps/portal-web/src/components/portfolio-most-improved.tsx`
- `apps/portal-web/src/components/portfolio-trend-chart.tsx`

---

### Task 1: Extend API — portfolio-level stats + update early returns

The `getPortfolioDashboard` procedure needs `thisWeekCount`, `ventCount`, `thisWeekDelta`, and `ventCountDelta` at the portfolio level. The two early-return branches also need the new fields so the frontend never sees missing keys.

**Files:**
- Modify: `packages/api/src/routers/properties.ts`

- [ ] **Step 1: Update the first early return (no org, line 1115)**

Replace:
```typescript
      return { portfolioGcs: null, activeCount: 0, alertCount: 0, monthlyTrend: [] }
```
With:
```typescript
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
```

- [ ] **Step 2: Update the second early return (no properties, line 1127)**

Replace:
```typescript
      return { portfolioGcs: null, activeCount, alertCount: 0, monthlyTrend: [] }
```
With:
```typescript
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
```

- [ ] **Step 3: Add portfolio-level weekly + vent stats queries**

Insert the following block immediately after the `const alertCount = ...` line (after line 1149), before the monthly trend query:

```typescript
    // ── Portfolio-level weekly & vent stats ──────────────────────────────────
    const now = new Date()
    const oneWeekAgo  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000)
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    const [thisWeekAgg, lastWeekAgg] = await Promise.all([
      db
        .select({
          total: count(),
          vents: sql<number>`COUNT(*) FILTER (WHERE ${feedback.ventText} IS NOT NULL)`,
        })
        .from(feedback)
        .where(and(inArray(feedback.propertyId, propertyIds), gte(feedback.submittedAt, oneWeekAgo))),
      db
        .select({
          total: count(),
          vents: sql<number>`COUNT(*) FILTER (WHERE ${feedback.ventText} IS NOT NULL)`,
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
```

- [ ] **Step 4: Update the main return to include new portfolio-level fields**

Replace the final return statement (line 1210):
```typescript
    return { portfolioGcs, activeCount, alertCount, monthlyTrend, propertyCards }
```
With (the enriched fields will be added in Task 3 — for now use empty placeholders so TypeScript compiles):
```typescript
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
      enrichedPropertyRows: [] as typeof enrichedPropertyRows,
      staffLeaderboard: [] as typeof staffLeaderboard,
      mostImproved: null as typeof mostImproved,
    }
```

> Note: `enrichedPropertyRows`, `staffLeaderboard`, and `mostImproved` don't exist yet — they will be added in Tasks 2 and 3. For now, TypeScript will complain about those variable references. That's fine — the return statement will be fixed again at the end of Task 3 to use the real variables. If TypeScript errors block compilation, comment out those three lines temporarily and restore them in Task 3.

- [ ] **Step 5: Verify the portal compiles**

```bash
cd apps/portal-web && pnpm tsc --noEmit
```
Expected: no errors (or only the temporary `enrichedPropertyRows`/`staffLeaderboard`/`mostImproved` reference errors if you left them in).

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routers/properties.ts
git commit -m "feat(api): add thisWeekCount, ventCount, and deltas to getPortfolioDashboard"
```

---

### Task 2: Extend API — per-property enriched rows

Adds sparklines, GCS delta, per-property weekly velocity, top-staff name, vent count, last feedback timestamp, and city rank to each property row.

**Files:**
- Modify: `packages/api/src/routers/properties.ts`

- [ ] **Step 1: Add the weekly sparkline query**

Insert this block immediately after the `const propertyCards = ...` block (after line 1208), still inside the `getPortfolioDashboard` procedure:

```typescript
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
```

- [ ] **Step 2: Add the monthly GCS delta query**

Append immediately after the block from Step 1:

```typescript
    // 2. Monthly GCS delta (this month vs last month)
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    const monthlyRows = await db
      .select({
        propertyId: feedback.propertyId,
        month: sql<string>`DATE_TRUNC('month', ${feedback.submittedAt})::text`,
        avgGcs: sql<string>`ROUND(AVG(${feedback.gcs}::numeric), 2)`,
      })
      .from(feedback)
      .where(and(inArray(feedback.propertyId, propertyIds), gte(feedback.submittedAt, lastMonthStart)))
      .groupBy(feedback.propertyId, sql`DATE_TRUNC('month', ${feedback.submittedAt})`)

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
```

- [ ] **Step 3: Add top-staff, vent-count, and last-feedback queries**

Append immediately after the block from Step 2:

```typescript
    // 3. Top staff per property (highest mention count, this calendar month)
    const topStaffRows = await db
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
      .orderBy(desc(count()))

    const topStaffByProperty = new Map<string, { name: string; mentions: number }>()
    for (const row of topStaffRows) {
      if (row.name == null) continue
      // First row per property = highest mentions (ordered desc)
      if (!topStaffByProperty.has(row.propertyId)) {
        topStaffByProperty.set(row.propertyId, { name: row.name, mentions: row.mentions })
      }
    }

    // 4. Vent count per property (this calendar month)
    const ventRowsPerProp = await db
      .select({ propertyId: feedback.propertyId, vents: count() })
      .from(feedback)
      .where(
        and(
          inArray(feedback.propertyId, propertyIds),
          isNotNull(feedback.ventText),
          gte(feedback.submittedAt, thisMonthStart),
        ),
      )
      .groupBy(feedback.propertyId)

    const ventsByProperty = new Map(ventRowsPerProp.map((r) => [r.propertyId, r.vents]))

    // 5. Last feedback timestamp per property
    const lastFeedbackRows = await db
      .select({ propertyId: feedback.propertyId, lastAt: max(feedback.submittedAt) })
      .from(feedback)
      .where(inArray(feedback.propertyId, propertyIds))
      .groupBy(feedback.propertyId)

    const lastFeedbackByProperty = new Map(
      lastFeedbackRows.map((r) => [r.propertyId, r.lastAt ? r.lastAt.toISOString() : null]),
    )
```

- [ ] **Step 4: Add city-rank lookups from leaderboard cache**

Append immediately after the block from Step 3:

```typescript
    // 6. City ranks — read from leaderboardCache (24 h TTL, same as getCityLeaderboard)
    const distinctCities = [...new Set(propertyRows.map((p) => p.city))]
    type CityRankData = { rank: number; total: number }
    const cityRankByProperty = new Map<string, CityRankData>()

    const ONE_DAY_MS_LC = 24 * 60 * 60 * 1000
    for (const city of distinctCities) {
      const cached = await db.query.leaderboardCache.findFirst({
        where: eq(leaderboardCache.city, city),
      })
      if (!cached || Date.now() - new Date(cached.cachedAt).getTime() >= ONE_DAY_MS_LC) continue

      const payload = cached.data as {
        rows: Array<{ propertyId: string; rank: number }>
        totalCount: number
      }
      for (const row of payload.rows) {
        if (propertyIds.includes(row.propertyId)) {
          cityRankByProperty.set(row.propertyId, { rank: row.rank, total: payload.totalCount })
        }
      }
    }
```

- [ ] **Step 5: Build `enrichedPropertyRows`**

Append immediately after the block from Step 4:

```typescript
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
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd apps/portal-web && pnpm tsc --noEmit
```

Expected: no errors except references to `staffLeaderboard` and `mostImproved` in the return (added in Task 3).

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/routers/properties.ts
git commit -m "feat(api): add enrichedPropertyRows with sparklines, velocity, staff, city rank"
```

---

### Task 3: Extend API — staffLeaderboard, mostImproved, and final return

**Files:**
- Modify: `packages/api/src/routers/properties.ts`

- [ ] **Step 1: Add staff leaderboard query**

Append immediately after the `enrichedPropertyRows` block (end of Task 2):

```typescript
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
```

- [ ] **Step 2: Derive mostImproved**

Append immediately after the `staffLeaderboard` block:

```typescript
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
```

- [ ] **Step 3: Replace the final return statement**

Replace the temporary return statement from Task 1 Step 4 with the real one:

```typescript
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
```

- [ ] **Step 4: Verify TypeScript compiles cleanly**

```bash
cd apps/portal-web && pnpm tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 5: Smoke-test the endpoint**

Start the dev server and load the portal as a multi-property user. Open DevTools → Network, find the tRPC batch request, confirm the response JSON contains:
- `thisWeekCount` (number)
- `enrichedPropertyRows` (array with `sparkline`, `gcsDelta`, `cityRank`, etc.)
- `staffLeaderboard` (array)
- `mostImproved` (object or null)

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routers/properties.ts
git commit -m "feat(api): add staffLeaderboard and mostImproved to getPortfolioDashboard"
```

---

### Task 4: Create `portfolio-stat-cards.tsx`

Five summary cards across the top of the dashboard.

**Files:**
- Create: `apps/portal-web/src/components/portfolio-stat-cards.tsx`

- [ ] **Step 1: Create the file**

```tsx
// apps/portal-web/src/components/portfolio-stat-cards.tsx

interface Props {
  portfolioGcs: number | null
  activeCount: number
  thisWeekCount: number
  thisWeekDelta: number | null
  alertCount: number
  ventCount: number
  ventCountDelta: number | null
  isLoading: boolean
}

function DeltaLine({ delta, suffix = "vs last week" }: { delta: number | null; suffix?: string }) {
  if (delta === null) return <p className="mt-0.5 text-[9px] text-gray-400">no prior data</p>
  const isUp = delta >= 0
  return (
    <p className={`mt-0.5 text-[9px] font-semibold ${isUp ? "text-green-600" : "text-red-600"}`}>
      {isUp ? "↑" : "↓"} {Math.abs(delta)}% {suffix}
    </p>
  )
}

function StatCard({
  label,
  value,
  children,
}: {
  label: string
  value: string
  children?: React.ReactNode
}) {
  return (
    <div
      className="rounded-xl bg-white shadow-sm p-3"
      style={{ borderLeft: "4px solid #f97316" }}
    >
      <p className="text-[9px] font-bold uppercase tracking-[0.07em] text-[#a8a29e] mb-1">{label}</p>
      <p className="text-[26px] font-black leading-none text-[#f97316]">{value}</p>
      {children}
    </div>
  )
}

export function PortfolioStatCards({
  portfolioGcs,
  activeCount,
  thisWeekCount,
  thisWeekDelta,
  alertCount,
  ventCount,
  ventCountDelta,
  isLoading,
}: Props) {
  const dash = "—"

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <StatCard label="Portfolio GCS" value={isLoading ? dash : portfolioGcs != null ? portfolioGcs.toFixed(1) : dash}>
        <p className="mt-0.5 text-[9px] text-gray-400">avg across all properties</p>
      </StatCard>

      <StatCard label="Active Properties" value={isLoading ? dash : String(activeCount)}>
        <p className="mt-0.5 text-[9px] text-gray-400">approved &amp; live</p>
      </StatCard>

      <StatCard label="This Week" value={isLoading ? dash : String(thisWeekCount)}>
        <DeltaLine delta={isLoading ? null : thisWeekDelta} />
      </StatCard>

      <StatCard label="Open Alerts" value={isLoading ? dash : String(alertCount)}>
        <p className="mt-0.5 text-[9px] text-gray-400">scores ≤ 5.0</p>
      </StatCard>

      <StatCard label="Vent Submissions" value={isLoading ? dash : String(ventCount)}>
        <DeltaLine delta={isLoading ? null : ventCountDelta} />
      </StatCard>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/portal-web/src/components/portfolio-stat-cards.tsx
git commit -m "feat(ui): add PortfolioStatCards component"
```

---

### Task 5: Create `portfolio-spotlight.tsx`

Two highlight cards — best performer (green) and needs-attention (amber). Derived from `enrichedPropertyRows` on the frontend.

**Files:**
- Create: `apps/portal-web/src/components/portfolio-spotlight.tsx`

- [ ] **Step 1: Create the file**

```tsx
// apps/portal-web/src/components/portfolio-spotlight.tsx

type Row = {
  id: string
  name: string
  city: string
  type: string | null
  avgGcs: number | null
  gcsDelta: number | null
  alertCount: number
  ventCount: number
}

interface Props {
  rows: Row[]
}

function DeltaBadge({ delta, color }: { delta: number | null; color: string }) {
  if (delta == null) return null
  const sign = delta >= 0 ? "↑ +" : "↓ "
  return (
    <span
      className="text-[9px] font-bold rounded-full px-2 py-0.5"
      style={{ background: color === "green" ? "#dcfce7" : "#fee2e2", color: color === "green" ? "#16a34a" : "#dc2626" }}
    >
      {sign}{Math.abs(delta).toFixed(1)} this month
    </span>
  )
}

export function PortfolioSpotlight({ rows }: Props) {
  const withGcs = rows.filter((r) => r.avgGcs != null)
  if (withGcs.length === 0) return null

  const best = [...withGcs].sort((a, b) => (b.avgGcs ?? 0) - (a.avgGcs ?? 0))[0]!
  const worst = [...withGcs].sort((a, b) => (a.avgGcs ?? 0) - (b.avgGcs ?? 0))[0]!

  // Don't show spotlight if there's only one property
  if (best.id === worst.id) return null

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {/* Best performer */}
      <div
        className="rounded-xl p-4"
        style={{
          background: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
          border: "1px solid #bbf7d0",
        }}
      >
        <p className="text-[9px] font-bold uppercase tracking-[0.07em] text-green-600 mb-1.5">⭐ Best Performer</p>
        <p className="text-sm font-extrabold text-gray-900">{best.name}</p>
        <p className="text-[9px] text-gray-500 mb-2">
          {best.city} · {best.type ?? "Property"}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-[24px] font-black text-green-600 leading-none">
            {best.avgGcs?.toFixed(1)}
          </span>
          <DeltaBadge delta={best.gcsDelta} color="green" />
        </div>
      </div>

      {/* Needs attention */}
      <div
        className="rounded-xl p-4"
        style={{
          background: "linear-gradient(135deg,#fff7ed,#ffedd5)",
          border: "1px solid #fed7aa",
        }}
      >
        <p className="text-[9px] font-bold uppercase tracking-[0.07em] text-orange-600 mb-1.5">⚠️ Needs Attention</p>
        <p className="text-sm font-extrabold text-gray-900">{worst.name}</p>
        <p className="text-[9px] text-gray-500 mb-2">
          {worst.city} · {worst.type ?? "Property"}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-[24px] font-black text-orange-600 leading-none">
            {worst.avgGcs?.toFixed(1)}
          </span>
          <span
            className="text-[9px] font-bold rounded-full px-2 py-0.5"
            style={{ background: "#fee2e2", color: "#dc2626" }}
          >
            {worst.gcsDelta != null && worst.gcsDelta < 0 ? `↓ ${worst.gcsDelta.toFixed(1)} · ` : ""}
            {worst.alertCount > 0 ? `${worst.alertCount} alert${worst.alertCount !== 1 ? "s" : ""} · ` : ""}
            {worst.ventCount > 0 ? `${worst.ventCount} vent${worst.ventCount !== 1 ? "s" : ""}` : ""}
          </span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/portal-web/src/components/portfolio-spotlight.tsx
git commit -m "feat(ui): add PortfolioSpotlight component"
```

---

### Task 6: Create `portfolio-table.tsx`

Sortable, filterable property table with sparkline SVGs, gone-quiet detection, and all seven columns from the design.

**Files:**
- Create: `apps/portal-web/src/components/portfolio-table.tsx`

- [ ] **Step 1: Create the file**

```tsx
// apps/portal-web/src/components/portfolio-table.tsx

import { useMemo, useState } from "react"
import { Link } from "@tanstack/react-router"

type Row = {
  id: string
  name: string
  type: string | null
  city: string
  avgGcs: number | null
  gcsDelta: number | null
  sparkline: Array<number | null>
  thisWeekCount: number
  thisWeekDelta: number | null
  topStaffName: string | null
  topStaffMentions: number
  ventCount: number
  alertCount: number
  lastFeedbackAt: string | null
}

interface Props {
  rows: Row[]
}

// ── helpers ──────────────────────────────────────────────────────────────────

function gcsColor(gcs: number | null): string {
  if (gcs == null) return "#9ca3af"
  if (gcs >= 8.5) return "#16a34a"
  if (gcs >= 7) return "#f97316"
  return "#dc2626"
}

function sparklinePoints(values: Array<number | null>, width = 54, height = 24): string {
  const n = values.length
  if (n < 2) return ""
  const pts: string[] = []
  values.forEach((v, i) => {
    if (v == null) return
    const x = Math.round((i / (n - 1)) * width)
    const clamped = Math.max(5, Math.min(10, v))
    const y = Math.round((1 - (clamped - 5) / 5) * height)
    pts.push(`${x},${y}`)
  })
  return pts.join(" ")
}

function timeAgo(iso: string | null): string {
  if (!iso) return "no data"
  const ms = Date.now() - new Date(iso).getTime()
  const h = Math.floor(ms / (1000 * 60 * 60))
  if (h < 1) return "just now"
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function isGoneQuiet(iso: string | null): boolean {
  if (!iso) return false
  return Date.now() - new Date(iso).getTime() > 7 * 24 * 60 * 60 * 1000
}

// ── sub-components ───────────────────────────────────────────────────────────

type SortCol = "name" | "gcs" | "thisWeek" | "vents" | "alerts"
type SortDir = "asc" | "desc"

function ColHeader({
  label,
  col,
  active,
  sortCol,
  sortDir,
  align = "center",
  onSort,
}: {
  label: string
  col: SortCol
  active: boolean
  sortCol: SortCol
  sortDir: SortDir
  align?: "left" | "center" | "right"
  onSort: (col: SortCol) => void
}) {
  return (
    <button
      onClick={() => onSort(col)}
      className={`text-[8px] font-bold uppercase tracking-[0.05em] cursor-pointer select-none w-full ${
        align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center"
      } ${active ? "text-[#f97316]" : "text-gray-400"}`}
    >
      {label} {active ? (sortDir === "desc" ? "↓" : "↑") : ""}
    </button>
  )
}

function Pill({
  label,
  active,
  color,
  onClick,
}: {
  label: string
  active: boolean
  color?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="text-[8px] font-bold px-2 py-0.5 rounded-full border cursor-pointer"
      style={
        active
          ? { background: "#fff7ed", color: "#ea580c", borderColor: "#f97316" }
          : { background: "#fff", color: color ?? "#6b7280", borderColor: "#e5e7eb" }
      }
    >
      {label}
    </button>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export function PortfolioTable({ rows }: Props) {
  const [sortCol, setSortCol] = useState<SortCol>("gcs")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [gcsFilter, setGcsFilter] = useState<"all" | "high" | "mid" | "low">("all")
  const [trendFilter, setTrendFilter] = useState<"all" | "up" | "down">("all")
  const [activityFilter, setActivityFilter] = useState<"all" | "quiet" | "active">("all")
  const [alertFilter, setAlertFilter] = useState(false)
  const [ventFilter, setVentFilter] = useState(false)

  function handleSort(col: SortCol) {
    if (col === sortCol) setSortDir((d) => (d === "desc" ? "asc" : "desc"))
    else { setSortCol(col); setSortDir("desc") }
  }

  const filtered = useMemo(() => {
    let r = [...rows]
    if (gcsFilter === "high") r = r.filter((x) => x.avgGcs != null && x.avgGcs >= 8.5)
    else if (gcsFilter === "mid") r = r.filter((x) => x.avgGcs != null && x.avgGcs >= 7 && x.avgGcs < 8.5)
    else if (gcsFilter === "low") r = r.filter((x) => x.avgGcs != null && x.avgGcs < 7)
    if (trendFilter === "up") r = r.filter((x) => x.gcsDelta != null && x.gcsDelta > 0)
    else if (trendFilter === "down") r = r.filter((x) => x.gcsDelta != null && x.gcsDelta < 0)
    if (activityFilter === "quiet") r = r.filter((x) => isGoneQuiet(x.lastFeedbackAt))
    else if (activityFilter === "active") r = r.filter((x) => !isGoneQuiet(x.lastFeedbackAt))
    if (alertFilter) r = r.filter((x) => x.alertCount > 0)
    if (ventFilter) r = r.filter((x) => x.ventCount > 0)
    return r
  }, [rows, gcsFilter, trendFilter, activityFilter, alertFilter, ventFilter])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let diff = 0
      if (sortCol === "gcs") diff = (b.avgGcs ?? -1) - (a.avgGcs ?? -1)
      else if (sortCol === "name") diff = a.name.localeCompare(b.name)
      else if (sortCol === "thisWeek") diff = b.thisWeekCount - a.thisWeekCount
      else if (sortCol === "vents") diff = b.ventCount - a.ventCount
      else if (sortCol === "alerts") diff = b.alertCount - a.alertCount
      return sortDir === "asc" ? -diff : diff
    })
  }, [filtered, sortCol, sortDir])

  const COLS = "1.8fr 70px 62px 62px 90px 56px 52px"

  return (
    <div className="rounded-xl bg-white shadow-sm overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-1.5 flex-wrap px-4 py-2.5 bg-[#fafaf9] border-b border-gray-100">
        <span className="text-[8px] font-bold uppercase tracking-[0.05em] text-[#a8a29e]">Filter:</span>

        <Pill label="All GCS"  active={gcsFilter === "all"}  onClick={() => setGcsFilter("all")} />
        <Pill label="≥ 8.5"   active={gcsFilter === "high"} onClick={() => setGcsFilter("high")} color="#16a34a" />
        <Pill label="7–8.5"   active={gcsFilter === "mid"}  onClick={() => setGcsFilter("mid")}  color="#f97316" />
        <Pill label="< 7"     active={gcsFilter === "low"}  onClick={() => setGcsFilter("low")}  color="#dc2626" />

        <div className="w-px h-3.5 bg-gray-200" />

        <Pill label="↑ Improving" active={trendFilter === "up"}   onClick={() => setTrendFilter("up")}   color="#16a34a" />
        <Pill label="↓ Declining" active={trendFilter === "down"} onClick={() => setTrendFilter("down")} color="#dc2626" />
        <Pill label="All trends"  active={trendFilter === "all"}  onClick={() => setTrendFilter("all")} />

        <div className="w-px h-3.5 bg-gray-200" />

        <Pill label="⚠ Gone quiet"    active={activityFilter === "quiet"}  onClick={() => setActivityFilter(activityFilter === "quiet" ? "all" : "quiet")}  color="#b45309" />
        <Pill label="Active this week" active={activityFilter === "active"} onClick={() => setActivityFilter(activityFilter === "active" ? "all" : "active")} />

        <div className="w-px h-3.5 bg-gray-200" />

        <Pill label="Has alerts" active={alertFilter} onClick={() => setAlertFilter((v) => !v)} color="#dc2626" />
        <Pill label="Has vents"  active={ventFilter}  onClick={() => setVentFilter((v) => !v)} />
      </div>

      {/* Column headers */}
      <div
        className="grid px-4 py-2 bg-gray-50 border-b border-gray-200 gap-1"
        style={{ gridTemplateColumns: COLS }}
      >
        <ColHeader label="Property"  col="name"     active={sortCol === "name"}     sortCol={sortCol} sortDir={sortDir} align="left"  onSort={handleSort} />
        <ColHeader label="GCS"       col="gcs"      active={sortCol === "gcs"}      sortCol={sortCol} sortDir={sortDir}               onSort={handleSort} />
        <div className="text-[8px] font-bold uppercase tracking-[0.05em] text-gray-400 text-center">Trend</div>
        <ColHeader label="This week" col="thisWeek" active={sortCol === "thisWeek"} sortCol={sortCol} sortDir={sortDir}               onSort={handleSort} />
        <div className="text-[8px] font-bold uppercase tracking-[0.05em] text-gray-400 text-center">Top staff</div>
        <ColHeader label="Vents"     col="vents"    active={sortCol === "vents"}    sortCol={sortCol} sortDir={sortDir}               onSort={handleSort} />
        <ColHeader label="Alerts"    col="alerts"   active={sortCol === "alerts"}   sortCol={sortCol} sortDir={sortDir} align="right"  onSort={handleSort} />
      </div>

      {/* Rows */}
      {sorted.length === 0 ? (
        <p className="text-sm text-gray-400 px-4 py-6 text-center">No properties match the current filters.</p>
      ) : (
        sorted.map((row) => {
          const quiet = isGoneQuiet(row.lastFeedbackAt)
          const pts = sparklinePoints(row.sparkline)
          const hasData = pts.length > 0
          const gcsDeltaDir = row.gcsDelta != null ? (row.gcsDelta > 0 ? "up" : row.gcsDelta < 0 ? "down" : "flat") : null

          return (
            <Link
              key={row.id}
              to="/properties/$propertyId/dashboard"
              params={{ propertyId: row.id }}
              className="grid px-4 py-2.5 border-b border-gray-50 gap-1 items-center last:border-0 hover:bg-[#fafaf9] transition-colors"
              style={{
                gridTemplateColumns: COLS,
                background: quiet ? "#fffbeb" : undefined,
              }}
            >
              {/* Property name */}
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-gray-900">{row.name}</span>
                  {quiet && (
                    <span
                      className="text-[7px] font-bold px-1.5 py-0.5 rounded-full border"
                      style={{ background: "#fef3c7", color: "#b45309", borderColor: "#fde68a" }}
                    >
                      Gone quiet · {Math.floor((Date.now() - new Date(row.lastFeedbackAt!).getTime()) / (1000 * 60 * 60 * 24))}d
                    </span>
                  )}
                </div>
                <p className="text-[8px] text-gray-400">
                  {row.city} · {row.type ?? "Property"} · Last: {timeAgo(row.lastFeedbackAt)}
                </p>
              </div>

              {/* GCS */}
              <div className="text-center">
                <p className="text-[16px] font-black leading-none" style={{ color: gcsColor(row.avgGcs) }}>
                  {row.avgGcs?.toFixed(1) ?? "—"}
                </p>
                {gcsDeltaDir && row.gcsDelta != null && (
                  <p
                    className="text-[8px] font-bold"
                    style={{ color: gcsDeltaDir === "up" ? "#16a34a" : gcsDeltaDir === "down" ? "#dc2626" : "#9ca3af" }}
                  >
                    {gcsDeltaDir === "up" ? "↑" : "↓"} {gcsDeltaDir !== "flat" ? `${row.gcsDelta > 0 ? "+" : ""}${row.gcsDelta.toFixed(1)}` : "→"}
                  </p>
                )}
              </div>

              {/* Trend sparkline */}
              <div className="flex justify-center">
                {hasData ? (
                  <svg width="54" height="24" viewBox="0 0 54 24">
                    <polyline
                      points={pts}
                      fill="none"
                      stroke={quiet ? "#d1d5db" : "#f97316"}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={quiet ? "3 2" : undefined}
                    />
                  </svg>
                ) : (
                  <span className="text-[9px] text-gray-300">—</span>
                )}
              </div>

              {/* This week */}
              <div className="text-center">
                <p className="text-[12px] font-bold text-gray-900">{row.thisWeekCount}</p>
                {row.thisWeekDelta != null && (
                  <p
                    className="text-[8px] font-semibold"
                    style={{ color: row.thisWeekDelta >= 0 ? "#16a34a" : "#dc2626" }}
                  >
                    {row.thisWeekDelta >= 0 ? "↑" : "↓"} {Math.abs(row.thisWeekDelta)}%
                  </p>
                )}
              </div>

              {/* Top staff */}
              <div className="text-center">
                {row.topStaffName ? (
                  <>
                    <p className="text-[9px] font-bold text-[#f97316]">{row.topStaffName}</p>
                    <p className="text-[8px] text-gray-400">{row.topStaffMentions} mentions</p>
                  </>
                ) : (
                  <p className="text-[9px] text-gray-300">—</p>
                )}
              </div>

              {/* Vents */}
              <div className="text-center">
                <p
                  className="text-[11px] font-bold"
                  style={{ color: row.ventCount > 0 ? "#dc2626" : "#9ca3af" }}
                >
                  {row.ventCount}
                </p>
              </div>

              {/* Alerts */}
              <div className="text-right">
                {row.alertCount > 0 ? (
                  <span
                    className="text-[8.5px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: "#fef2f2", color: "#dc2626" }}
                  >
                    {row.alertCount}
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-300">—</span>
                )}
              </div>
            </Link>
          )
        })
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/portal-web/src/components/portfolio-table.tsx
git commit -m "feat(ui): add PortfolioTable with filters, sort, sparklines, gone-quiet"
```

---

### Task 7: Create `portfolio-leaderboard.tsx`

Internal property ranking with medals, city rank, GCS bar, and delta.

**Files:**
- Create: `apps/portal-web/src/components/portfolio-leaderboard.tsx`

- [ ] **Step 1: Create the file**

```tsx
// apps/portal-web/src/components/portfolio-leaderboard.tsx

type Row = {
  id: string
  name: string
  city: string
  avgGcs: number | null
  gcsDelta: number | null
  lastFeedbackAt: string | null
  cityRank: number | null
  cityTotal: number | null
}

interface Props {
  rows: Row[]
}

function gcsColor(gcs: number | null): string {
  if (gcs == null) return "#9ca3af"
  if (gcs >= 8.5) return "#16a34a"
  if (gcs >= 7) return "#f97316"
  return "#dc2626"
}

function isGoneQuiet(iso: string | null): boolean {
  if (!iso) return false
  return Date.now() - new Date(iso).getTime() > 7 * 24 * 60 * 60 * 1000
}

export function PortfolioLeaderboard({ rows }: Props) {
  const sorted = [...rows]
    .sort((a, b) => (b.avgGcs ?? -1) - (a.avgGcs ?? -1))

  const medals = ["🥇", "🥈", "🥉"]

  return (
    <div className="rounded-xl bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div>
          <p className="text-[12px] font-bold text-gray-900">🏆 Property Ranking</p>
          <p className="text-[9px] text-gray-400 mt-0.5">Internal rank + city position this month</p>
        </div>
        <div className="flex gap-1">
          <span
            className="text-[8px] font-bold px-2 py-0.5 rounded-full border"
            style={{ background: "#fff7ed", color: "#ea580c", borderColor: "#f97316" }}
          >
            GCS
          </span>
          <span className="text-[8px] font-bold px-2 py-0.5 rounded-full border border-gray-200 text-gray-400">
            Most improved
          </span>
          <span className="text-[8px] font-bold px-2 py-0.5 rounded-full border border-gray-200 text-gray-400">
            Volume
          </span>
        </div>
      </div>

      {/* Rows */}
      {sorted.map((row, idx) => {
        const quiet = isGoneQuiet(row.lastFeedbackAt)
        const color = gcsColor(row.avgGcs)
        const barWidth = row.avgGcs != null ? Math.round((row.avgGcs / 10) * 100) : 0
        const cityRankIsHigh = row.cityRank != null && row.cityRank <= 3

        return (
          <div
            key={row.id}
            className="flex items-center gap-2.5 px-4 py-2.5 border-b border-gray-50 last:border-0"
            style={{ background: quiet ? "#fffbeb" : undefined }}
          >
            {/* Medal / rank */}
            <div className="text-[18px] min-w-[22px] text-center">
              {idx < 3 ? medals[idx] : <span className="text-[13px] font-extrabold text-gray-300">{idx + 1}</span>}
            </div>

            {/* Name + city rank */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-[12px] font-bold text-gray-900 truncate">{row.name}</p>
                {quiet && (
                  <span
                    className="text-[7px] font-bold px-1.5 py-0.5 rounded-full border"
                    style={{ background: "#fef3c7", color: "#b45309", borderColor: "#fde68a" }}
                  >
                    Gone quiet
                  </span>
                )}
              </div>
              <p className="text-[8px] text-gray-400 mt-0.5">
                {row.city}
                {row.cityRank != null && row.cityTotal != null && (
                  <>
                    {" · "}
                    <span style={{ color: cityRankIsHigh ? "#f97316" : "#b45309", fontWeight: 700 }}>
                      #{row.cityRank} in city
                    </span>
                    {" "}out of {row.cityTotal} properties
                  </>
                )}
              </p>
            </div>

            {/* GCS + delta */}
            <div className="text-right mr-2">
              <p className="text-[17px] font-black leading-none" style={{ color }}>
                {row.avgGcs?.toFixed(1) ?? "—"}
              </p>
              {row.gcsDelta != null && (
                <p
                  className="text-[9px] font-semibold"
                  style={{ color: row.gcsDelta > 0 ? "#16a34a" : row.gcsDelta < 0 ? "#dc2626" : "#9ca3af" }}
                >
                  {row.gcsDelta > 0 ? "↑" : row.gcsDelta < 0 ? "↓" : "→"}{" "}
                  {row.gcsDelta !== 0 ? `${row.gcsDelta > 0 ? "+" : ""}${row.gcsDelta.toFixed(1)}` : "stable"}
                </p>
              )}
            </div>

            {/* Bar */}
            <div
              className="rounded-full overflow-hidden"
              style={{ width: 80, height: 5, background: "#f3f4f6", flexShrink: 0 }}
            >
              <div style={{ width: `${barWidth}%`, height: "100%", background: color, borderRadius: 3 }} />
            </div>
          </div>
        )
      })}

      {sorted.length === 0 && (
        <p className="text-sm text-gray-400 px-4 py-5 text-center">No properties yet.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/portal-web/src/components/portfolio-leaderboard.tsx
git commit -m "feat(ui): add PortfolioLeaderboard with city rank and GCS bars"
```

---

### Task 8: Create `portfolio-staff-board.tsx`

Staff mention leaderboard across all properties.

**Files:**
- Create: `apps/portal-web/src/components/portfolio-staff-board.tsx`

- [ ] **Step 1: Create the file**

```tsx
// apps/portal-web/src/components/portfolio-staff-board.tsx

type Entry = {
  name: string
  propertyName: string
  city: string
  mentionCount: number
  avgGcs: number | null
}

interface Props {
  entries: Entry[]
}

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#f97316,#fb923c)",
  "linear-gradient(135deg,#6366f1,#818cf8)",
  "linear-gradient(135deg,#14b8a6,#5eead4)",
  "linear-gradient(135deg,#f59e0b,#fbbf24)",
  "linear-gradient(135deg,#ec4899,#f472b6)",
]

const MEDALS = ["🥇", "🥈", "🥉"]

function gcsColor(gcs: number | null): string {
  if (gcs == null) return "#9ca3af"
  if (gcs >= 8.5) return "#16a34a"
  if (gcs >= 7) return "#f97316"
  return "#dc2626"
}

export function PortfolioStaffBoard({ entries }: Props) {
  return (
    <div className="rounded-xl bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div>
          <p className="text-[12px] font-bold text-gray-900">⭐ Top Staff Across All Sites</p>
          <p className="text-[9px] text-gray-400 mt-0.5">Guest nominations this month</p>
        </div>
        <div className="flex gap-1">
          <span
            className="text-[8px] font-bold px-2 py-0.5 rounded-full border"
            style={{ background: "#fff7ed", color: "#ea580c", borderColor: "#f97316" }}
          >
            Mentions
          </span>
          <span className="text-[8px] font-bold px-2 py-0.5 rounded-full border border-gray-200 text-gray-400">
            GCS
          </span>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-gray-400 px-4 py-5 text-center">
          No staff nominations yet. Name drops appear once guests start nominating team members.
        </p>
      ) : (
        entries.map((entry, idx) => (
          <div
            key={`${entry.name}-${entry.propertyName}`}
            className="flex items-center gap-2.5 px-4 py-2.5 border-b border-gray-50 last:border-0"
          >
            {/* Medal / rank */}
            <div className="text-[18px] min-w-[22px] text-center">
              {idx < 3 ? MEDALS[idx] : <span className="text-[13px] font-extrabold text-gray-300">{idx + 1}</span>}
            </div>

            {/* Avatar */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-extrabold text-white flex-shrink-0"
              style={{ background: AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length] }}
            >
              {entry.name.charAt(0).toUpperCase()}
            </div>

            {/* Name + property */}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold text-gray-900 truncate">{entry.name}</p>
              <p className="text-[9px] text-gray-400 truncate">
                {entry.propertyName} · {entry.city}
              </p>
            </div>

            {/* Mentions + avg GCS */}
            <div className="text-right">
              <p className="text-[12px] font-extrabold text-[#f97316]">
                {entry.mentionCount}{" "}
                <span className="text-[9px] font-normal text-gray-400">mentions</span>
              </p>
              {entry.avgGcs != null && (
                <p className="text-[9px] font-semibold" style={{ color: gcsColor(entry.avgGcs) }}>
                  GCS {entry.avgGcs.toFixed(1)}
                </p>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/portal-web/src/components/portfolio-staff-board.tsx
git commit -m "feat(ui): add PortfolioStaffBoard component"
```

---

### Task 9: Create `portfolio-most-improved.tsx` and `portfolio-trend-chart.tsx`

**Files:**
- Create: `apps/portal-web/src/components/portfolio-most-improved.tsx`
- Create: `apps/portal-web/src/components/portfolio-trend-chart.tsx`

- [ ] **Step 1: Create `portfolio-most-improved.tsx`**

```tsx
// apps/portal-web/src/components/portfolio-most-improved.tsx

type MostImproved = {
  name: string
  city: string
  type: string | null
  previousGcs: number
  currentGcs: number
  delta: number
  cityRank: number | null
  cityTotal: number | null
}

interface Props {
  mostImproved: MostImproved
}

export function PortfolioMostImproved({ mostImproved }: Props) {
  const { name, city, previousGcs, currentGcs, delta, cityRank, cityTotal } = mostImproved

  return (
    <div
      className="rounded-xl px-5 py-4 flex items-center justify-between"
      style={{ background: "linear-gradient(135deg,#1c1917,#292524)" }}
    >
      <div>
        <p
          className="text-[8px] font-bold uppercase tracking-[0.1em] mb-1.5"
          style={{ color: "#f97316" }}
        >
          🚀 Most Improved This Month
        </p>
        <p className="text-[16px] font-black text-white">{name}</p>
        <p className="text-[9px] mt-0.5" style={{ color: "#9ca3af" }}>
          {city} · GCS {previousGcs.toFixed(1)} → {currentGcs.toFixed(1)}
          {cityRank != null && cityTotal != null && ` · Now #${cityRank} in city`}
        </p>
      </div>
      <div className="text-right">
        <p className="text-[32px] font-black leading-none" style={{ color: "#f97316" }}>
          +{delta.toFixed(1)}
        </p>
        <p className="text-[9px] mt-0.5" style={{ color: "#9ca3af" }}>
          vs last month
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `portfolio-trend-chart.tsx`**

```tsx
// apps/portal-web/src/components/portfolio-trend-chart.tsx

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

interface Props {
  monthlyTrend: Array<{ month: string; score: number }>
}

export function PortfolioTrendChart({ monthlyTrend }: Props) {
  return (
    <div className="rounded-xl bg-white shadow-sm p-5">
      <p className="text-[14px] font-bold text-gray-900">Portfolio Satisfaction Trend</p>
      <p className="mt-0.5 mb-4 text-[11px] text-gray-400">Average GCS across all properties</p>

      {monthlyTrend.length === 0 ? (
        <p className="text-sm text-gray-400">No feedback yet. Scores will appear once guests start submitting.</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={monthlyTrend}>
            <defs>
              <linearGradient id="portfolioGcsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f97316" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
              formatter={(v) => (typeof v === "number" ? v.toFixed(2) : v)}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="#f97316"
              strokeWidth={2.5}
              fill="url(#portfolioGcsGrad)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/portal-web/src/components/portfolio-most-improved.tsx apps/portal-web/src/components/portfolio-trend-chart.tsx
git commit -m "feat(ui): add PortfolioMostImproved and PortfolioTrendChart components"
```

---

### Task 10: Rewire `_portal.index.tsx`

Replace the old `PortfolioDashboard` with the new component composition. The `beforeLoad` redirect logic is unchanged — only the component body changes.

**Files:**
- Modify: `apps/portal-web/src/routes/_portal.index.tsx`

- [ ] **Step 1: Replace the entire file content**

```tsx
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, redirect, useRouteContext } from "@tanstack/react-router"

import { AdminDashboard } from "@/components/admin-dashboard"
import { PortfolioLeaderboard } from "@/components/portfolio-leaderboard"
import { PortfolioMostImproved } from "@/components/portfolio-most-improved"
import { PortfolioSpotlight } from "@/components/portfolio-spotlight"
import { PortfolioStaffBoard } from "@/components/portfolio-staff-board"
import { PortfolioStatCards } from "@/components/portfolio-stat-cards"
import { PortfolioTable } from "@/components/portfolio-table"
import { PortfolioTrendChart } from "@/components/portfolio-trend-chart"
import { PushNotificationPrompt } from "@/components/push-notification-prompt"
import { useTRPC } from "@/utils/trpc"

export const Route = createFileRoute("/_portal/")({
  beforeLoad: ({ context }) => {
    const session = context.session as {
      isAdmin?: boolean
      isStaff?: boolean
      staffPropertyId?: string | null
      user?: { properties?: Array<{ id: string }> }
    } | null

    const isAdmin = session?.isAdmin === true
    const isStaff = session?.isStaff === true
    const staffPropertyId = session?.staffPropertyId ?? null
    const properties = session?.user?.properties ?? []

    if (isStaff && staffPropertyId) {
      throw redirect({
        to: "/properties/$propertyId/dashboard",
        params: { propertyId: staffPropertyId },
      })
    }

    if (!isAdmin && properties.length === 1) {
      const firstProperty = properties[0]
      if (firstProperty) {
        throw redirect({
          to: "/properties/$propertyId/dashboard",
          params: { propertyId: firstProperty.id },
        })
      }
    }
  },
  component: RouteComponent,
})

function PortfolioDashboard() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(
    trpc.properties.getPortfolioDashboard.queryOptions(),
  )

  const rows = data?.enrichedPropertyRows ?? []

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <PushNotificationPrompt />

      <div>
        <h1 className="text-xl font-black text-[#1c1917]">Portfolio Overview</h1>
        <p className="text-xs text-gray-400 mt-0.5">All your properties at a glance</p>
      </div>

      <PortfolioStatCards
        portfolioGcs={data?.portfolioGcs ?? null}
        activeCount={data?.activeCount ?? 0}
        thisWeekCount={data?.thisWeekCount ?? 0}
        thisWeekDelta={data?.thisWeekDelta ?? null}
        alertCount={data?.alertCount ?? 0}
        ventCount={data?.ventCount ?? 0}
        ventCountDelta={data?.ventCountDelta ?? null}
        isLoading={isLoading}
      />

      <PortfolioSpotlight rows={rows} />

      <PortfolioTable rows={rows} />

      <div className="grid gap-3 md:grid-cols-2">
        <PortfolioLeaderboard rows={rows} />
        <PortfolioStaffBoard entries={data?.staffLeaderboard ?? []} />
      </div>

      {data?.mostImproved && (
        <PortfolioMostImproved mostImproved={data.mostImproved} />
      )}

      <PortfolioTrendChart monthlyTrend={data?.monthlyTrend ?? []} />
    </div>
  )
}

function RouteComponent() {
  const { session } = useRouteContext({ from: "/_portal" })
  const isAdmin = (session as { isAdmin?: boolean } | null)?.isAdmin === true

  if (isAdmin) return <AdminDashboard />
  return <PortfolioDashboard />
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/portal-web && pnpm tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Load the portfolio page in the browser**

Start the dev server (both API and portal-web). Log in as a multi-property account. Navigate to the root `/` route. Verify:
- 5 stat cards appear with values (not all dashes)
- Spotlight row shows best/worst property
- Property table renders with sparklines and filter bar
- Leaderboard shows properties in GCS order with city rank text
- Staff board shows any name-drop mentions (or "no nominations yet" if none exist)
- Trend chart is orange (not indigo)
- If a property hasn't received feedback in 7+ days, it shows the "Gone quiet" amber badge

- [ ] **Step 4: Final commit**

```bash
git add apps/portal-web/src/routes/_portal.index.tsx
git commit -m "feat(ui): wire up new portfolio dashboard with all sections"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| 5 summary stat cards (GCS, properties, this week, alerts, vents) | Task 1 (API) + Task 4 (UI) |
| Best performer + needs attention spotlight | Task 5 |
| Property table with 7 columns | Task 6 |
| Filter bar (GCS, trend, activity, alerts, vents) | Task 6 |
| Gone quiet detection (>7 days) | Task 2 (API lastFeedbackAt) + Task 6 (UI) |
| Sparklines (7 weekly points) | Task 2 (API weeklyRows) + Task 6 (UI SVG) |
| Per-property velocity (this week vs last week %) | Task 2 (API) + Task 6 (UI) |
| Top staff per property | Task 2 (API topStaffByProperty) + Task 6 (UI) |
| Vent count per property | Task 2 (API) + Task 6 (UI) |
| Property leaderboard with city ranks | Task 2 (API cityRankByProperty) + Task 7 (UI) |
| Staff leaderboard cross-property | Task 3 (API) + Task 8 (UI) |
| Most improved banner | Task 3 (API) + Task 9 (UI) |
| Orange trend chart | Task 9 (UI) |
| thisWeekDelta + ventCountDelta at portfolio level | Task 1 (API) + Task 4 (UI) |

All requirements covered. No placeholders. Type names consistent across all tasks (`Row`, `Entry`, `MostImproved` are local to each file — no cross-file type mismatches possible since tRPC infers the types automatically).
