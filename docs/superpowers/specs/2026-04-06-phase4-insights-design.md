# Phase 4 — Property Insights Page Design

## Goal

Build the Insights page for the IntuItiveStay portal, replacing the current placeholder at `/properties/:id/insights`. The page shows rich analytics derived from guest feedback, with chart availability and time ranges gated by subscription tier. Founder-plan users also get a multi-property overview page.

## Architecture

### Tier Access Model

Three tiers control what a user can see and how far back they can look:

| Feature | Host | Partner | Founder |
|---|---|---|---|
| Max time range | 7 days | 30 days | 365 days |
| GCS Over Time (line) | ✅ | ✅ | ✅ |
| Pillar Averages (radar) | ✅ | ✅ | ✅ |
| Pillar Spotlight (strongest/weakest) | ✅ | ✅ | ✅ |
| Total Submissions stat | ✅ | ✅ | ✅ |
| Score Distribution histogram | 🔒 | ✅ | ✅ |
| GCS by Meal Time | 🔒 | ✅ | ✅ |
| Submissions per Week bar | 🔒 | ✅ | ✅ |
| Engagement stats (Name Drop Rate, Vent Rate) | 🔒 | ✅ | ✅ |
| Staff Tag Cloud | 🔒 | ✅ | ✅ |
| City Leaderboard (national) | 🔒 | ✅ | ✅ |
| Vent Keyword Cloud | 🔒 | 🔒 | ✅ |
| Within-city property ranking | 🔒 | 🔒 | ✅ |
| Multi-property overview | 🔒 | 🔒 | ✅ |

Tier enforcement happens **server-side**. If a lower-tier user requests a longer time range, the server clamps it to their plan maximum. Locked charts are hidden on the frontend with an upgrade prompt.

### User Flow

**Host / Partner:**
`/properties/:id/insights` → single property insights dashboard

**Founder:**
`/insights` → multi-property overview → click property → `/properties/:id/insights` → full insights dashboard

---

## Multi-Property Overview (Founder only)

Route: `/insights` (new)
Component: `founder-insights-overview.tsx` (new)

### Layout

**Top: Aggregate summary row (4 stat cards)**
- Combined avg GCS across all properties
- Total submissions this period
- Best performing property (name + GCS)
- Worst performing property (name + GCS)

**Below: Property cards grid**
One card per property, each showing:
- Property name + city
- Current GCS (large, colour-coded: green ≥ 8, amber 6–7.9, red < 6)
- Trend arrow + delta vs previous period
- Submissions this period
- Strongest pillar / weakest pillar
- Mini sparkline (tiny 4-point line chart)
- "View Insights →" link to `/properties/:id/insights`

**tRPC procedure:** `properties.getFounderOverview()` — Founder-only, returns aggregate stats + per-property summaries with sparkline data points.

---

## Single Property Insights Page

Route: `/properties/:id/insights` (existing placeholder, to be wired up)
Component: `property-insights.tsx` (new)

### tRPC Endpoints

**`properties.getPropertyInsights({ propertyId, timeRange })`**

`timeRange` is one of: `"7d"` | `"30d"` | `"180d"` | `"365d"`

Server validates that the requested `timeRange` is within the user's plan limit. If not, it clamps to plan max.

Returns:
```ts
{
  gcsOverTime: { week: string; avg: number }[]           // grouped by week
  pillarAverages: { resilience: number; empathy: number; anticipation: number; recognition: number }
  pillarSpotlight: { strongest: string; strongestScore: number; weakest: string; weakestScore: number }
  gcsByMealTime: { mealTime: string; avg: number }[]
  submissionsPerWeek: { week: string; count: number }[]
  scoreDistribution: { score: number; count: number }[]  // scores 1–10
  engagementStats: { totalSubmissions: number; nameDropRate: number; ventRate: number }
  staffTagCloud: { name: string; mentions: number; avgGcs: number }[]
  ventKeywords: { word: string; count: number }[]        // top 20 for Founder; empty array [] for Host/Partner
  allowedTimeRange: "7d" | "30d" | "180d" | "365d"      // actual range used (after clamping)
  userPlan: "host" | "partner" | "founder"
}
```

**`properties.getCityLeaderboard({ propertyId })`**

Not time-range dependent. Fetched once, cached separately.

Returns:
```ts
{
  cityName: string
  yourRank: number
  totalInCity: number
  yourGcs: number
  cityAvgGcs: number
  gapToCityAvg: number
  withinCityRankings: { rank: number; name: string | null; gcs: number }[]  // name only set for requesting property
  nationalCityRankings: { rank: number; city: string; avgGcs: number; propertyCount: number }[]
}
```

### Server-side Data Processing

**Staff Tag Cloud:** Group feedback rows by `namedStaffMember` (non-null), count occurrences, calculate avg GCS per name. Return sorted by mention count descending.

**Vent Keywords:** Collect all non-null `ventText` strings within the time range. Tokenise (split on whitespace and punctuation), lowercase, remove stop words (`the, a, an, is, was, it, to, of, and, in, that, this, for, on, with, at, by, from, i, my, we, me, very, so, but, not, be, are, have, had, were, he, she, they, you, your, our, their, its`). Count frequencies, return top 20 sorted by count descending.

**City Leaderboard:** Query `properties` joined to `property_scores` where `status = 'approved'`. Group by `city` for national rankings. Filter to same city as requesting property for within-city rankings. Only set `name` field for the row matching the requesting `propertyId` — all others return `null`.

**Tier enforcement:** Read `organisation.plan` from session context. Map plan to max days (`host → 7`, `partner → 30`, `founder → 365`). If requested range exceeds limit, silently clamp.

### UI — Page Layout (scrollable, top to bottom)

1. **Time filter bar** — buttons: "Last 7 days", "Last 30 days", "Last 6 months", "Last 12 months". Buttons beyond plan limit shown with 🔒 and disabled. Active selection highlighted in indigo.

2. **GCS Over Time** — full-width Chart.js line chart, fill gradient, data point labels, trend delta badge (e.g. "↑ +0.6 vs last period").

3. **Score Distribution + Pillar Averages** — two-column grid. Score distribution is a Chart.js bar chart (scores 1–10, colour-coded red/amber/indigo/green). Pillar averages is a Chart.js radar chart. *(Partner+ only)*

4. **GCS by Meal Time + Submissions per Week + Pillar Spotlight** — three-column grid. Meal time: horizontal bar chart. Submissions: bar chart with count labels. Pillar spotlight: two coloured cards (green strongest, red weakest). *(Partner+ for meal time and submissions)*

5. **Engagement stats row** — three stat cards: Name Drop Rate (%), Vent Box Rate (%), Total Submissions. *(Partner+ for rates)*

6. **Staff Tag Cloud** — full-width. Font size proportional to mention count. Colour intensity proportional to avg GCS from those guests. Hover tooltip shows "X mentions · avg GCS Y". *(Partner+)*

7. **Vent Keyword Cloud** — full-width, red-toned. Font size = frequency, colour intensity = relative frequency. *(Founder only)*

8. **City ranking banner** — gradient indigo card showing "#N of X properties in [City]" + gap to city average. *(Partner+)*

9. **Within-city property bar chart** — horizontal Chart.js bar, your property named in bold indigo, all others shown as "Anonymous". Dashed line marking city average. *(Founder only)*

10. **National city leaderboard** — horizontal Chart.js bar, your city highlighted. *(Partner+)*

### Visual Style

- Chart.js for all charts
- Indigo colour palette matching existing portal (`#6366f1` primary, `#818cf8` secondary, `#c7d2fe` light)
- White cards with `#e2e8f0` borders and `#f8fafc` card backgrounds
- Section labels: 9px uppercase, `#64748b`, letter-spacing
- Locked sections show a `🔒 Upgrade to [Plan] to unlock` banner instead of the chart

---

## New Files

| File | Action | Purpose |
|---|---|---|
| `packages/api/src/routers/properties.ts` | Modify | Add `getPropertyInsights`, `getCityLeaderboard`, `getFounderOverview` procedures |
| `apps/portal-web/src/components/property-insights.tsx` | Create | Single property insights page component |
| `apps/portal-web/src/components/founder-insights-overview.tsx` | Create | Multi-property overview for Founder plan |
| `apps/portal-web/src/routes/_portal.properties.$propertyId.insights.tsx` | Modify | Wire up `PropertyInsights` component (currently a placeholder) |
| `apps/portal-web/src/routes/_portal.insights.tsx` | Create | Founder overview route; `beforeLoad` redirects non-Founders to `/properties/:id/insights` using their single property ID (fetched via `properties.getMyProperties`) |

---

## Out of Scope

- Email digests or scheduled reports
- Exporting charts as images or PDFs
- Comparing two date ranges side by side
- AI-generated summaries of feedback
