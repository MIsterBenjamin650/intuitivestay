# Admin Oversight Expansion Design

**Date:** 2026-04-06
**Status:** Approved

## Overview

Two additions to the admin portal:

1. **Expanded dashboard stats** — the existing main admin dashboard (`/`) gains two more rows of stat cards above the properties table: plan distribution (Host / Partner / Founder counts) and activity metrics (total feedback, pending approvals, inactive properties, registered users). Property name cells become clickable links.

2. **Property detail page** — a new admin-only route at `/admin/properties/:propertyId` showing the complete data picture for any single property: property info, owner, QR code, all six GCS sub-scores, and a full feedback history table with every individual submission.

Regular property owners are unaffected by both changes.

---

## Part 1: Expanded Dashboard Stats

### Backend — update `properties.getAllProperties`

Add the following fields to the existing `stats` object returned by this procedure:

| Field | Value |
|---|---|
| `hostCount` | Count of properties where `organisations.plan = 'host'` |
| `partnerCount` | Count of properties where `organisations.plan = 'partner'` |
| `founderCount` | Count of properties where `organisations.plan = 'founder'` |
| `platformTotalFeedback` | Sum of `property_scores.total_feedback` across all properties |
| `pendingCount` | Count of properties with `status = 'pending'` |
| `inactiveCount` | Count of approved properties with `total_feedback = 0` (or no `property_scores` row) |
| `totalUsers` | Total row count of the `user` table |

All fields are computed in JavaScript after the existing query. `totalUsers` requires one additional `db.select({ count: count() }).from(user)` query run in parallel with the existing query.

### Frontend — update `AdminDashboard` component

Replace the existing single row of 3 stat cards with three labelled rows:

**Row 1 — Overview (existing cards, unchanged):**
Total Properties | Approved | Platform Avg GCS

**Row 2 — Plan Distribution:**
Host | Partner | Founder
- Host card: slate background
- Partner card: blue background
- Founder card: purple background

**Row 3 — Activity (4 cards):**
- Total Feedback (green)
- Pending Approval (yellow) — the number is a link to `/admin/approvals`
- No Activity (orange) — approved properties with zero feedback
- Registered Users (neutral)

Each row has a small section label above it ("Overview", "Plan Distribution", "Activity").

**Clickable property names:** In the properties table, the Property column cell wraps the name in a TanStack Router `<Link>` to `/admin/properties/$propertyId`. The name is styled indigo + underline to signal it's clickable.

---

## Part 2: Property Detail Page

### New route

File: `apps/portal-web/src/routes/_portal.admin.properties.$propertyId.tsx`
URL: `/admin/properties/:propertyId`
Access: admin only (redirects non-admins to `/`)

### New tRPC procedure: `properties.getAdminPropertyDetail`

Type: `adminProcedure`
Input: `{ propertyId: string }`

Returns:
```ts
{
  property: {
    id, name, status, city, country, address, type, ownerName, ownerEmail,
    plan, createdAt
  },
  scores: {
    avgGcs, avgResilience, avgEmpathy, avgAnticipation, avgRecognition,
    totalFeedback
  } | null,
  qrCode: {
    uniqueCode, feedbackUrl, createdAt
  } | null,
  feedback: Array<{
    id, submittedAt, gcs, resilience, empathy, anticipation, recognition,
    namedStaffMember, ventText, source, mealTime
  }>
}
```

Joins: `properties` → `organisations` (for plan), LEFT JOIN `property_scores`, LEFT JOIN `qr_codes`, LEFT JOIN `feedback` (all rows, ordered by `submitted_at DESC`).

Throws `NOT_FOUND` if property doesn't exist. Throws `FORBIDDEN` if non-admin calls it (handled by `adminProcedure`).

### Page layout

**Header:**
- Breadcrumb: `← Back to Admin Dashboard` (link to `/`)
- Property name (large, bold) + Status badge + Plan badge on same line
- Subtitle: city · country · type · `Registered {date}`

**Info cards (2 columns):**
- Left: Owner — name (bold), email (muted)
- Right: QR Code — truncated feedback URL, date generated. Shows "No QR code yet" if property not yet approved.

**Performance section (6 stat cards in one row):**
Avg GCS | Total Feedback | Avg Resilience | Avg Empathy | Avg Anticipation | Avg Recognition
- All null values show "—"
- "No data yet" state when `scores` is null

**Feedback History table:**
- Section label: `Feedback History ({n} submissions)`
- Columns: Date | GCS | Resilience | Empathy | Anticipation | Recognition | Staff Named | Vent Text
- GCS ≤ 5 displayed in red
- Vent Text truncated to ~40 chars, full text visible on hover (HTML `title` attribute)
- Staff Named shows "—" if null
- Empty state: "No feedback received yet"
- All submissions shown (no pagination — admin needs complete data)
- Default order: newest first

### New component file

`apps/portal-web/src/components/admin-property-detail.tsx` — contains the full page component. The route file imports and renders it.

---

## What Is Not In Scope

- Editing property details from the admin page
- Deleting properties or users
- Exporting feedback to CSV (future)
- Pagination of feedback table (all rows shown)
- Changes to any non-admin pages
