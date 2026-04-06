# Property Dashboard Redesign Design

## Goal

Replace the current minimal property dashboard with a comprehensive single-page performance overview for property owners, matching the v5 mockup: seal badge, ring gauge, AI summary, pillar trend chart, radar chart, donut gauges, adjective cloud, staff bubble cloud, recent feedback panel, and locked upgrade charts.

---

## Layout Overview

The dashboard is a scrollable single-column (with some two-column rows) layout. No tabs — all data visible on one page. A date range selector in the topbar controls all charts simultaneously.

```
Row 1  — Mini stat pills (4)
Row 2  — GCS ring + Seal badge  |  AI Daily Summary card
Row 3  — Pillar Scores Over Time chart  |  Radar/spider chart
Row 4  — 4 pillar donut gauges
Row 5  — Adjective Word Cloud  |  Staff Bubble Cloud
Row 6  — Recent Feedback panel
Row 7  — City Leaderboard (Host & Partner plans) / [Locked] for Founder plan
Row 8  — [Locked] Advanced Insights chart  |  [Locked] Local Market chart
```

---

## Date Range Selector

- In topbar (replaces current empty header space)
- Options: Last 7 days, Last 30 days, Last 90 days, Custom range
- Default: Last 30 days
- All dashboard queries use the selected date range as their time window

---

## Row 1: Mini Stat Pills

Four compact pill cards in a row:

| Pill | Value | Colour |
|---|---|---|
| Total Feedback | count of submissions in range | Indigo |
| Avg Response Rate | % of QR code scans that completed feedback | Teal |
| Open Alerts | count of unresolved alerts | Orange |
| Current Seal | Member / Bronze / Silver / Gold / Platinum badge | Tier colour |

Seal thresholds (see Tier System section for full rules):

---

## Row 2: GCS Ring Gauge + AI Daily Summary

### GCS Ring Gauge (left)

- Circular SVG ring gauge (donut style), 160px diameter
- Fills clockwise from 0 to GCS score (0–10 scale)
- Score printed in centre, large (32px extrabold)
- Label "Guest Care Score" below score
- Seal badge rendered below the ring: coloured pill (Member/Bronze/Silver/Gold/Platinum) with appropriate background
- If a tier change is pending (grace/confirmation window active), show a secondary indicator: e.g. "⚠ At risk: Bronze" or "⏳ Confirming: Gold"
- GCS displayed on the ring is on a 0–10 scale; the tier score used for seal calculation is `avg(pillars) × 10` = 0–100

Ring colour bands match current official tier colour (see Tier System section).

### AI Daily Summary card (right)

- Triggered each morning by a scheduled job (see AI Summary section below)
- Card shows the summary for the most recent completed day
- Content: ~3–4 sentence narrative, then 3 "Today's Focus" bullet points, each linked to a pillar name
- Pillar names highlighted in their respective colour (Indigo/Teal/Purple/Orange)
- Stale indicator if no summary generated yet today ("Summary not yet available for today")
- Falls back to yesterday's summary if today's hasn't run yet

---

---

## Tier System

### Score Calculation

The **tier score** is derived from the property's 30-day rolling average GCS, converted to a 0–100 scale:

```
tierScore = (average of all pillar scores over last 30 days) × 10
```

Each pillar score is 0–10, so the tier score is 0–100.

### Tiers

| Tier | Score Range | Colour |
|---|---|---|
| Member | 0–49 | Grey `#9ca3af` |
| Bronze | 50–69 | Amber `#b45309` |
| Silver | 70–79 | Slate `#64748b` |
| Gold | 80–94 | Yellow `#ca8a04` |
| Platinum | 95–100 | Indigo/purple `#6366f1` |

### Tier Change Rules

Tier changes are **never immediate**. A 30-day grace/confirmation window applies in both directions:

**Downgrade (grace period):**
1. On the 1st of each month, the system evaluates the property's tier score for the past 30 days
2. If the score has dropped below the current tier's lower threshold → create a `pendingTierChange` record with direction `"downgrade"`, new tier, and `pendingFrom = today`
3. Owner receives an alert/email: "Your score has dropped to [score]. You have 30 days to recover above [threshold] or your seal will change from [CurrentTier] to [NewTier]."
4. On the next monthly evaluation (30 days later):
   - If score is still below threshold → apply the downgrade, delete pending record, create alert "Your seal has changed to [NewTier]"
   - If score has recovered → delete pending record, create alert "Your seal is safe — well done"

**Upgrade (confirmation window):**
1. On the 1st of each month, if the score qualifies for a higher tier → create a `pendingTierChange` record with direction `"upgrade"`, new tier, and `pendingFrom = today`
2. Owner receives an alert/email: "Your score is qualifying for [NewTier]. Maintain your score above [threshold] for 30 more days to achieve it."
3. On the next monthly evaluation:
   - If score is still above threshold → apply the upgrade, delete pending record, create alert "Congratulations! Your seal has been upgraded to [NewTier]"
   - If score has dropped → delete pending record, no tier change, create alert "Your [NewTier] upgrade didn't complete — keep working to maintain your score"

**Concurrent changes:** Only one pending change per property at a time. If a pending upgrade is in progress and the score drops below the current tier, cancel the upgrade and start a downgrade grace instead.

### Database: `propertyTiers` table

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| propertyId | uuid FK → properties, unique | one row per property |
| currentTier | text | `"member"`, `"bronze"`, `"silver"`, `"gold"`, `"platinum"` |
| pendingTier | text nullable | tier being gained/lost |
| pendingDirection | text nullable | `"upgrade"` or `"downgrade"` |
| pendingFrom | date nullable | date the grace/confirmation window started |
| lastEvaluatedAt | timestamp | when the monthly job last ran for this property |
| updatedAt | timestamp | |

New properties start at `member` tier with no pending change.

### Monthly Evaluation Job

- Cron: runs on the 1st of each month at 00:01 UTC
- For each property:
  1. Calculate 30-day rolling tier score
  2. Determine qualifying tier from score
  3. Check `pendingTierChange`:
     - If pending change exists and 30 days have passed → resolve it (apply or cancel)
     - If no pending change and qualifying tier ≠ current tier → create pending change
  4. Send appropriate alert/email to owner

---

## Row 3: Pillar Scores Over Time + Radar Chart

### Pillar Scores Over Time (left, ~60% width)

- Recharts `LineChart` with 4 lines, one per pillar
- X-axis: dates (weekly buckets for 30-day range, daily for 7-day)
- Y-axis: 0–10 with gridlines
- Lines: Resilience (indigo `#6366f1`), Empathy (teal `#14b8a6`), Anticipation (purple `#a855f7`), Recognition (orange `#f97316`)
- Legend below chart with colour dots
- Tooltip on hover showing all 4 scores for that date

### Radar / Spider Chart (right, ~40% width)

- Recharts `RadarChart` with 4 axes: Resilience, Empathy, Anticipation, Recognition
- Diamond/square shape (4 axes evenly spaced)
- Single filled area showing current period averages
- Comparison fill (lighter, dashed border) for previous period if enough data
- Scale 0–10

---

## Row 4: Pillar Donut Gauges

Four equal-width cards in a row, one per pillar:

| Pillar | Colour |
|---|---|
| Resilience | Indigo `#6366f1` |
| Empathy | Teal `#14b8a6` |
| Anticipation | Purple `#a855f7` |
| Recognition | Orange `#f97316` |

Each card:
- SVG circular ring gauge (120px), fills to pillar average (0–10)
- Score in centre (24px extrabold)
- Pillar name below
- Delta vs previous period (e.g. "+0.3 vs last period") in small text, green or red

---

## Row 5: Adjective Word Cloud + Staff Bubble Cloud

### Adjective Word Cloud (left)

- Guest-chosen descriptive words from feedback form (optional field on submission form)
- Each unique word rendered as a coloured pill tag
- Tag size proportional to frequency (larger = more mentions)
- Gradient colours: varied per word using a set of brand-adjacent colours
- Empty state: "No descriptive words collected yet"
- Data source: `guestFeedback.adjectives` field (comma-separated string or JSON array, to be decided at DB schema stage)

### Staff Bubble Cloud (right)

- Staff members mentioned in guest feedback
- Each mentioned staff as a circular "bubble" (avatar initial or photo if available)
- Bubble size proportional to mention frequency
- Bubble colour by sentiment: green = positive mention, red = negative mention, grey = neutral/unspecified
- Sentiment derived from: if the feedback submission's overall GCS is above 7 and staff was tagged → positive; below 6 and staff tagged → negative; 6–7 → neutral
- Staff name shown on hover tooltip
- Empty state: "No staff mentions yet"

---

## Row 6: Recent Feedback Panel

Table or card list of the last 10 submissions in the selected date range. Each row:

| Column | Content |
|---|---|
| Time of day | Emoji indicator: Morning ☀️ (6am–12pm), Afternoon 🌤 (12pm–6pm), Evening 🌙 (6pm–12am), Night ⭐ (12am–6am) |
| Pillar scores | R · E · A · Rec, each /10, displayed as compact coloured chips |
| Staff mention | If present: staff name(s) as pill tags |
| Vent box | If present: amber-backgrounded text block (no guest name, anonymous) |

No guest names are ever displayed. All feedback is anonymous.

---

## Row 7: City Leaderboard

**Available to:** Host and Partner plans. Founder plan sees a locked/blurred version with upgrade CTA.

A ranked table of all IntuItiveStay properties in the same city, ordered by GCS (highest to lowest). The current property is highlighted.

### Data

- Source: aggregate GCS averages across all properties where `city` matches the current property's city
- Time window: matches the selected date range
- Minimum data threshold: properties with fewer than 3 submissions in the period are excluded from the ranking (shown as "Insufficient data")
- Anonymisation: other properties shown as "Property #N" (ranked position number) — only the current property shows its own name
- The current property's row is always shown even if it has insufficient data (so the owner can see their position)

### Table columns

| Column | Content |
|---|---|
| Rank | #1, #2, #3 … |
| Property | "Property #N" (anonymous) or own property name |
| GCS | Average overall score for the period |
| Resilience | Average pillar score |
| Empathy | Average pillar score |
| Anticipation | Average pillar score |
| Recognition | Average pillar score |
| Submissions | Count of feedback submissions in period |

### Visual treatment

- Current property row: indigo left border, light indigo background, bold text
- Top 3 rows: gold/silver/bronze rank badge
- GCS column: coloured chip (bronze/silver/gold threshold colouring)
- "City: [City Name]" label above the table

### Locked state (Founder plan)

- Table rendered but blurred (`backdrop-blur-sm`)
- Overlay: "See how you rank in [City Name]" + "Upgrade to Host or Partner to unlock"
- "View Plans" CTA button

---

## Row 8: Locked Charts

Two chart placeholders rendered with blur overlay:

1. **Advanced Insights** — "Sentiment trend analysis & competitor benchmarking"
2. **Local Market** — "Local hospitality market GCS comparison"

Each locked section:
- Chart rendered (fake static SVG or placeholder) with `backdrop-blur-sm` overlay
- Lock icon + bold "Unlock with [Plan Name]" label
- "View Plans" button linking to Plans & Billing in profile dropdown (or modal)
- Visible to all owners regardless of plan (design decision: tease the value)

For future plans: when owner plan unlocks these, blur/overlay is hidden and real data renders.

---

## AI Daily Summary Feature

### Trigger

- Scheduled cron job: runs at 08:00 local time (UTC initially; timezone-aware later)
- Covers the previous calendar day's feedback data

### What it generates

Using the Claude API (claude-haiku-4-5 for cost), prompt includes:
- Property name
- Number of submissions from yesterday
- Average pillar scores (Resilience, Empathy, Anticipation, Recognition) for yesterday
- Full vent box texts (if any) concatenated
- Staff mention summary

Output: JSON object:
```json
{
  "narrative": "String, 3-4 sentences summarising performance",
  "focus": [
    { "pillar": "Empathy", "action": "Brief actionable tip" },
    { "pillar": "Recognition", "action": "Brief actionable tip" },
    { "pillar": "Resilience", "action": "Brief actionable tip" }
  ]
}
```

### Storage

New DB table `aiDailySummaries`:
| Column | Type |
|---|---|
| id | uuid PK |
| propertyId | uuid FK → properties |
| date | date (the day being summarised) |
| narrative | text |
| focusPoints | jsonb |
| generatedAt | timestamp |

One row per property per day. Unique constraint on `(propertyId, date)`.

### Email delivery

- After generation, send summary email to property owner via Resend
- Subject: "Your Daily Guest Care Summary — [date]"
- Email body: narrative + 3 focus bullets + link back to portal

### Dashboard display

- Dashboard queries latest `aiDailySummaries` row for the property
- If today's summary exists → show it
- If not yet generated → show yesterday's with "Summary updates each morning" note
- If no summaries at all → show "Your first summary will appear tomorrow morning"

---

## Data Sources

All data comes from the existing `guestFeedback` table:

| Field | Usage |
|---|---|
| `overallScore` | GCS ring gauge, stat pill |
| `resilienceScore` | Pillar gauges, trend chart, radar |
| `empathyScore` | Pillar gauges, trend chart, radar |
| `anticipationScore` | Pillar gauges, trend chart, radar |
| `recognitionScore` | Pillar gauges, trend chart, radar |
| `staffMentions` | Staff bubble cloud, recent feedback |
| `ventBox` | Recent feedback vent text |
| `visitTimeOfDay` | Time of day emoji in recent feedback |
| `adjectives` | Word cloud (new field — add to schema) |
| `submittedAt` | Date filtering, trend chart x-axis |

`adjectives` field: `text` column containing comma-separated guest-chosen words. Added to `guestFeedback` schema as part of this spec.

---

## New tRPC Queries Required

| Query | Description |
|---|---|
| `property.getDashboardStats` | Stat pill values for date range |
| `property.getGcsHistory` | GCS + pillar scores over time for trend + radar |
| `property.getWordCloud` | Adjective frequency map |
| `property.getStaffBubbles` | Staff mention counts + sentiment |
| `property.getRecentFeedback` | Last 10 submissions with all fields |
| `property.getAiSummary` | Latest AI daily summary for property |
| `ai.generateDailySummary` | Admin-triggered or cron-triggered generation |
| `property.getCityLeaderboard` | GCS ranking of all properties in same city for date range |
| `property.getTierStatus` | Current tier, pending change, and score for the property |
| `tier.runMonthlyEvaluation` | Admin/cron-triggered monthly tier evaluation job |

---

## Error Handling

- All chart sections: if query returns no data, show empty state message (not a loading spinner)
- AI summary generation failure: log error, mark summary as failed in DB, skip email; retry next morning
- Adjective cloud with no data: show placeholder text, no empty chart area

---

## Success Criteria

- Dashboard loads all sections within 2 seconds on initial render (parallel queries)
- All chart sections show real data from `guestFeedback` table
- AI summary card shows correct narrative for the most recent available day
- Locked charts show blur overlay with upgrade CTA for all plan tiers
- Recent feedback shows correctly anonymised data (no guest names)
- Date range selector updates all charts simultaneously
- Word cloud renders only when `adjectives` data exists
- Staff bubble sentiment logic correctly maps score ranges to colours
- City leaderboard visible and populated for Host/Partner plans; blurred with upgrade CTA for Founder plan
- Own property row always highlighted in leaderboard regardless of rank
- Other properties anonymised as "Property #N" in leaderboard
- Tier system uses 5 levels: Member (0–49), Bronze (50–69), Silver (70–79), Gold (80–94), Platinum (95–100)
- Tier upgrades only apply after 30-day confirmation window; tier downgrades have 30-day grace period
- Pending tier changes shown on dashboard seal badge with warning/confirmation indicator
- Monthly evaluation cron job creates pending changes and resolves expired ones
