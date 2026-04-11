# Portfolio Dashboard Redesign — Design Spec

**Date:** 2026-04-11  
**Status:** Approved

---

## Overview

Rebuild the portfolio overview page (`/_portal/`) from its current minimal form (3 stat cards + property card grid + trend chart) into a full operations-manager dashboard. The target audience is a manager overseeing multiple hospitality sites who needs at-a-glance performance data, competitive context, and internal accountability tools.

The visual design is approved. See the reference mockup at:
`.superpowers/brainstorm/441-1775900434/content/portfolio-branded.html`

---

## What the Page Shows

### 1. Summary Stats Row (5 cards)

| Card | Value | Sub-line |
|---|---|---|
| Portfolio GCS | Weighted avg GCS across all org properties | ↑/↓ delta vs last month |
| Active Properties | Count of `status = 'approved'` properties | "approved & live" |
| This Week | Feedback count submitted in last 7 days | ↑/↓ % vs prior 7 days |
| Open Alerts | Feedback records where GCS ≤ 5.0 (all time) | "scores ≤ 5.0" |
| Vent Submissions | Feedback where `ventText IS NOT NULL`, last 7 days | ↑/↓ vs prior 7 days |

All five cards use the orange left-border design (`border-left: 4px solid #f97316`).

---

### 2. Spotlight Row

Two side-by-side highlight cards, computed automatically from property data:

- **Best Performer** (green gradient) — property with highest `avgGcs` this month, showing name, city, type, GCS, and month-over-month delta
- **Needs Attention** (amber gradient) — property with lowest `avgGcs` this month, showing name, city, type, GCS, delta, alert count, and vent count

Spotlights are derived from `propertyRows` on the frontend — no separate API field needed.

---

### 3. Property Table

Replaces the current card grid. A sortable table with a filter bar above it.

**Columns:**

| Column | Description |
|---|---|
| Property | Name, city · type · "Last: Xh ago" (time since last feedback) |
| GCS | `avgGcs` (all-time from `propertyScores`), coloured green/orange/red; ↑/↓ delta vs last month |
| Trend | Mini sparkline SVG — 6 weekly avg GCS points, last 6 weeks |
| This week | Feedback count this week; ↑/↓ % vs prior week |
| Top staff | Most-mentioned staff name this month + mention count (from `feedback.namedStaffMember`) |
| Vents | Count of `ventText IS NOT NULL` submissions this month |
| Alerts | Count of GCS ≤ 5.0 feedback (all time); shown as red badge if > 0, dash otherwise |

**Gone quiet flag:** If a property's `lastFeedbackAt` is > 7 days ago, the property name gets a "Gone quiet · Nd" amber pill and the row background turns `#fffbeb`. The sparkline renders dashed and grey rather than solid orange.

**Filter bar (visual state only — no routing changes):**  
Pills for: All GCS / ≥ 8.5 / 7–8.5 / < 7 | All trends / ↑ Improving / ↓ Declining | All activity / ⚠ Gone quiet / Active this week | Has alerts / Has vents

Filter state is local React state (`useState`). No URL params.

**Sort:** Clicking a column header toggles asc/desc sort on that column. Default sort: GCS descending. Active sort column header shown in orange.

---

### 4. Property Ranking Leaderboard

Internal ranking of org's own properties by GCS, with city context per property.

Each row shows:
- Medal emoji (🥇🥈🥉) for top 3, number for the rest
- Property name + "Gone quiet" badge if applicable
- City + city rank: "London · **#3 in city** out of 47 properties"
- GCS (large, colour-coded) + delta arrow
- Horizontal progress bar (width = GCS/10, colour matches GCS)

**Tabs:** GCS (default) | Most Improved | Volume — tabs are static for now (only GCS tab populates data; others are visual placeholders, not yet built).

**City rank source:** The `leaderboardCache` table already stores ranked city data per city (24h TTL, keyed by city name). For the portfolio view, we load the cache for each distinct city the org's properties are in, then look up each property's rank from that cache. If a property's city has no cache entry, `cityRank` and `cityTotal` are `null` and the city line reads just the city name without rank.

---

### 5. Staff Leaderboard

Cross-property ranking of staff by guest name-drop mentions (from `feedback.namedStaffMember`) in the last 30 days.

Each row shows:
- Medal / rank number
- Coloured avatar circle (initial letter, gradient colour)
- Staff name + property name and city
- Mention count + avg GCS of reviews that named them

**Source:** `feedback.namedStaffMember` (free-text field). Group by name, count rows, avg GCS where `namedStaffMember IS NOT NULL` and `submittedAt >= now() - 30 days` and `propertyId IN (org property IDs)`. Limit 5.

> Note: `namedStaffMember` is free-text so name variations (e.g. "Emma" vs "Emma T.") may produce separate rows. This is acceptable for now.

**Tabs:** Mentions (default) | GCS — GCS tab is a visual placeholder.

---

### 6. Most Improved Banner

A dark banner (`#1c1917` background, orange accent) showing the single property with the biggest positive GCS delta from last calendar month to this calendar month.

Shows: property name, city, GCS range ("8.3 → 9.1"), city rank ("Now #1 in city"), delta (+0.8 in large orange text).

Hidden entirely if no property has a positive month-over-month delta.

City rank in the banner comes from the same city-rank data used for the property leaderboard.

---

### 7. Portfolio Trend Chart

Kept from the current design. Change: stroke colour from `#6366f1` (indigo) → `#f97316` (orange), gradient fill to match.

---

## Component Structure

```
_portal.index.tsx            — route, keeps PortfolioDashboard + AdminDashboard split
components/
  portfolio-stat-cards.tsx   — 5-card summary row
  portfolio-spotlight.tsx    — best performer + needs attention
  portfolio-table.tsx        — sortable, filterable property table
  portfolio-leaderboard.tsx  — property ranking leaderboard
  portfolio-staff-board.tsx  — staff mention leaderboard
  portfolio-most-improved.tsx— dark "most improved" banner
  portfolio-trend-chart.tsx  — orange area chart (extracted from _portal.index.tsx)
```

Each component receives its data as props (no independent tRPC calls). All data fetched once in `_portal.index.tsx` via `getPortfolioDashboard`.

---

## API Changes — `getPortfolioDashboard`

Extended in-place. Adds new fields to the existing return shape; existing fields (`portfolioGcs`, `activeCount`, `alertCount`, `monthlyTrend`, `propertyCards`) are kept for backward compatibility but `propertyCards` is superseded by `propertyRows`.

### New return fields

```typescript
// Existing fields unchanged:
portfolioGcs: number | null
activeCount: number
alertCount: number
monthlyTrend: Array<{ month: string; score: number }>
propertyCards: Array<...>  // kept, not removed

// New:
thisWeekCount: number
thisWeekDelta: number | null   // % change vs prior 7 days; null if no prior data
ventCount: number              // vents this week
ventCountDelta: number | null  // % change vs prior 7 days

propertyRows: Array<{
  id: string
  name: string
  type: string | null
  city: string
  country: string
  status: string
  avgGcs: number | null          // all-time from propertyScores
  gcsDelta: number | null        // this calendar month avg minus last calendar month avg; null if either is missing
  sparkline: Array<number | null>  // 6 elements, weekly avg GCS newest-first reversed to oldest-first
  thisWeekCount: number
  thisWeekDelta: number | null   // % vs prior week; null if prior week had 0
  topStaffName: string | null
  topStaffMentions: number
  ventCount: number              // this calendar month
  alertCount: number             // all-time GCS ≤ 5
  lastFeedbackAt: string | null  // ISO timestamp of most recent feedback
  cityRank: number | null
  cityTotal: number | null
}>

staffLeaderboard: Array<{
  name: string
  propertyName: string
  city: string
  mentionCount: number
  avgGcs: number | null
}>

mostImproved: {
  propertyId: string
  name: string
  city: string
  type: string | null
  previousGcs: number
  currentGcs: number
  delta: number
  cityRank: number | null
  cityTotal: number | null
} | null
```

### New database queries (all within the existing procedure)

All queries are scoped to `propertyIds` (the org's property ID list, already computed).

1. **`thisWeekCount` / `ventCount` / `thisWeekDelta` / `ventCountDelta`**  
   Two `COUNT` queries over `feedback` — one for last 7 days, one for 8–14 days prior — filtered on `propertyIds`.  
   Vent = `ventText IS NOT NULL`.

2. **Per-property weekly feedback counts & sparkline**  
   Single query: `SELECT propertyId, DATE_TRUNC('week', submittedAt), AVG(gcs), COUNT(*) FROM feedback WHERE propertyId IN (...) AND submittedAt >= now() - 7 weeks GROUP BY propertyId, DATE_TRUNC('week', submittedAt)`  
   Post-process in TypeScript to build 6-element sparkline array and this-week / last-week counts per property.

3. **Per-property GCS delta (month-over-month)**  
   Single query: `SELECT propertyId, DATE_TRUNC('month', submittedAt) as month, AVG(gcs) FROM feedback WHERE propertyId IN (...) AND submittedAt >= DATE_TRUNC('month', now()) - interval '1 month' GROUP BY propertyId, month`  
   Post-process to compute delta = this month avg − last month avg per property.

4. **Per-property top staff**  
   Single query: `SELECT propertyId, namedStaffMember, COUNT(*) as mentions FROM feedback WHERE propertyId IN (...) AND namedStaffMember IS NOT NULL AND submittedAt >= DATE_TRUNC('month', now()) GROUP BY propertyId, namedStaffMember ORDER BY mentions DESC`  
   Post-process: keep only the highest-mention row per property.

5. **Per-property vent count (this month)**  
   Single query: `SELECT propertyId, COUNT(*) FROM feedback WHERE propertyId IN (...) AND ventText IS NOT NULL AND submittedAt >= DATE_TRUNC('month', now()) GROUP BY propertyId`

6. **Per-property lastFeedbackAt**  
   Single query: `SELECT propertyId, MAX(submittedAt) FROM feedback WHERE propertyId IN (...) GROUP BY propertyId`

7. **City ranks**  
   Get distinct cities from `propertyRows`. For each city, load `leaderboardCache` (same 24h TTL logic used by `getCityLeaderboard`). Look up each property's rank in its city's cache rows. If cache miss for a city, query inline (same logic as `getCityLeaderboard`).

8. **Staff leaderboard**  
   Single query: `SELECT namedStaffMember, propertyId, COUNT(*) as mentions, AVG(gcs) FROM feedback WHERE propertyId IN (...) AND namedStaffMember IS NOT NULL AND submittedAt >= now() - 30 days GROUP BY namedStaffMember, propertyId ORDER BY mentions DESC LIMIT 10`  
   Post-process: join `propertyId` → property name/city, deduplicate to top 5 by mention count.

9. **Most improved**  
   Derived from query 3 (GCS delta per property). Take the property with the highest positive `gcsDelta`. Null if no positive delta exists.

---

## Styling

- Font: Inter (already loaded via `globals.css` as `--font-sans`)
- Primary brand colour: `#f97316` (orange-500)
- GCS colour thresholds: ≥ 8.5 → `#16a34a` (green), ≥ 7 → `#f97316` (orange), < 7 → `#dc2626` (red), null → `#e5e7eb` (grey)
- "Gone quiet" threshold: `lastFeedbackAt` older than 7 days
- Trend chart: orange gradient (`#f97316`), replacing current indigo

---

## Out of Scope

- "Most Improved" and "Volume" leaderboard tabs are rendered but show no data (placeholder). Not wired up.
- "GCS" staff leaderboard tab is rendered but not wired up.
- Filter bar interactions are local state only — no URL persistence, no server-side filtering.
- City leaderboard data is read from cache only; no background refresh is added (existing 24h TTL applies).
- No new migrations required — all data derives from existing tables.
