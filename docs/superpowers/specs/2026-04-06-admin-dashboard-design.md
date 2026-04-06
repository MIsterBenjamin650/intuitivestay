# Admin Dashboard Design

**Date:** 2026-04-06
**Status:** Approved

## Overview

When the admin logs in to the portal, the main dashboard (`/`) shows a purpose-built admin view instead of the regular property-owner portfolio dashboard. The admin view gives a full picture of every property registered on the platform — who owns it, what plan they're on, how it's performing, and whether it's seeing real guest activity.

Regular property owners are unaffected — they continue to see the existing portfolio dashboard.

## Admin Detection

`apps/portal-web/src/functions/get-user.ts` is updated to append `isAdmin: true` to the returned session when `session.user.email` matches the `ADMIN_EMAIL` server env var. This flag is then available throughout the portal via `Route.useRouteContext()`.

## Backend

### New tRPC procedure: `properties.getAllProperties`

- Type: `adminProcedure` (throws `FORBIDDEN` for non-admins)
- Returns a single array of property rows, each containing:
  - `id`, `name`, `status`, `city`, `country`, `type`
  - `ownerName`, `ownerEmail`
  - `plan` — the organisation's plan tier (`host` | `partner` | `founder`)
  - `avgGcs` — from `property_scores.avg_gcs` (null if no feedback yet)
  - `totalFeedback` — from `property_scores.total_feedback` (0 if none)
  - `lastFeedbackAt` — `MAX(feedback.submitted_at)` for this property (null if none)
  - `createdAt` — when the property was registered
- Also returns summary stats object:
  - `totalCount` — all properties regardless of status
  - `approvedCount` — properties with status `approved`
  - `platformAvgGcs` — average of all `avgGcs` values across approved properties (null if none)

Query joins: `properties` → `organisations` (for plan) → `property_scores` (left join, for scores) → `feedback` (left join aggregated, for `lastFeedbackAt`).

## Frontend

### `_portal.index.tsx`

Reads `session.isAdmin` from route context. If `true`, renders `<AdminDashboard>`. Otherwise renders the existing portfolio dashboard component (no changes to portfolio dashboard).

### `AdminDashboard` component

Extracted to `src/components/admin-dashboard.tsx` (the filters + table logic is substantial enough to warrant its own file).

**Summary cards (3, top of page):**
| Card | Value |
|---|---|
| Total Properties | `totalCount` |
| Approved | `approvedCount` |
| Platform Avg GCS | `platformAvgGcs` formatted to 1 decimal, or "No data" |

**Filter bar (below cards):**
- Search input — filters rows where property name or owner name contains the typed text (case-insensitive)
- Status dropdown — All / Approved / Pending / Rejected
- City dropdown — All + unique city values from the data
- Country dropdown — All + unique country values from the data
- GCS range dropdown — Any score / Below 5 (critical) / 5–7 (average) / Above 7 (good). Rows with no GCS score are excluded when a range filter is active.

All filtering is client-side — no additional server queries.

**Table columns:**

| Column | Notes |
|---|---|
| Property | Name, bold |
| Owner | `ownerName` bold, `ownerEmail` as small muted text on the line below |
| Plan | Badge: Host / Partner / Founder |
| Status | Coloured badge: Approved (green) / Pending (yellow) / Rejected (red) |
| City | Plain text |
| GCS | Numeric to 1 decimal; "—" if null. Sortable. |
| Feedback | Count; "—" if 0 and pending/rejected. Approved properties with 0 show **"No activity"** badge instead. Sortable. |
| Last Feedback | Relative date (e.g. "3 days ago"); "—" if null. Sortable. |

Default sort: newest registered first (`createdAt` desc).

Clicking a sortable column header toggles asc/desc. Active sort column shows an arrow indicator.

## What Is Not In Scope

- Server-side filtering or pagination (client-side is sufficient at expected scale)
- Clicking a property row to drill into detail (future phase)
- CSV export (future phase)
- Any changes to the Approvals page
- Any changes to the property-owner dashboard
