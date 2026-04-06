# Navigation Redesign Design

## Goal

Simplify the portal sidebar and top-bar so property owners only see what is relevant to them, remove admin-only items from non-admin views, and move low-frequency actions (billing, account) into the profile dropdown.

## Context

The current sidebar shows items that are either irrelevant to property owners (Admin section exposed by a routing bug), duplicate (Dashboard appears twice), or better surfaced elsewhere (Plans & Billing, Alerts). The sidebar should be focused, calm, and fast to navigate.

---

## Sidebar Structure (Owner View)

### Current sidebar (owner role)

- Dashboard ← kept
- Workspace → **remove** (no clear purpose, not used)
- My Properties → **Founder-only** (Host/Partner plans are single-property; list has no value)
- Properties › [Property Name] › Dashboard ← duplicate of top-level Dashboard → **remove**
- Properties › [Property Name] › Feedback ← keep, rename label to "Feedback"
- Properties › [Property Name] › QR Codes ← keep
- Insights → **remove** (this IS the dashboard; redundant)
- Advanced Insights → **remove** (becomes a blurred/locked chart on the dashboard)
- Local Market → **remove** (becomes a blurred/locked chart on the dashboard)
- Alerts → **remove from sidebar** (move to topbar bell icon)
- Plans & Billing → **remove from sidebar** (move to profile dropdown)
- Admin section → **already hidden from owners** (bug was fixed in portal-redesign work)

### Target sidebar (owner role)

```
MY PROPERTY
  Dashboard
  Feedback
  QR Codes

ORGANISATION
  Team
```

"Team" only appears when the staff invitation system is live. Until then, Organisation group is hidden.

### Target sidebar (Founder role)

```
MY PROPERTIES
  [list of properties]

ORGANISATION
  Team
```

Founder sees the property list instead of a single-property section, since they manage multiple properties.

### Target sidebar (Admin role, unchanged)

Admin sidebar is separate and stays as-is.

---

## Top Bar Changes

### Alerts bell

- Bell icon in the top-right of the header (already present in design mockup)
- Badge shows unread alert count
- Clicking opens a slide-over panel listing recent alerts
- No dedicated Alerts sidebar item

### Profile dropdown

Current profile dropdown (if any) gains two new items:

```
Account Details
Plans & Billing          (shows current plan badge, links to Wix checkout or upgrade modal)
─────────────────
Sign Out
```

Plans & Billing shows the owner's current plan (e.g. "Host" badge). Clicking opens the plan selection / Wix checkout URL.

---

## Properties List (Founder Only)

- `My Properties` group visible only when `session.user.role === "founder"` (or equivalent admin flag)
- Host and Partner owners see no properties list — they land on their single property dashboard directly
- Property list links: each property links to `/_portal/properties/$propertyId/dashboard`

---

## Advanced Insights & Local Market

- Not sidebar items
- They become locked chart sections on the property dashboard
- Appearance: chart rendered but blurred (`blur-sm`, `pointer-events-none` overlay)
- Lock icon + "Upgrade to unlock" CTA overlaid on each locked chart
- Visible to all owners regardless of plan; upgrade CTA links to Plans & Billing

---

## Routing Changes

| Route | Action |
|---|---|
| `/_portal/index` | Keep — org dashboard (Founder) or single property dashboard redirect |
| `/_portal/properties` | Keep — Founder-only list view |
| `/_portal/properties/$propertyId/dashboard` | Keep |
| `/_portal/properties/$propertyId/feedback` | Keep |
| `/_portal/properties/$propertyId/qr-codes` | Keep |
| `/_portal/alerts` | Keep route but remove from sidebar; accessible via bell panel only |
| `/_portal/insights` | Remove route (redirect to dashboard) |
| `/_portal/advanced-insights` | Remove route (redirect to dashboard) |
| `/_portal/local-market` | Remove route (redirect to dashboard) |
| `/_portal/billing` | Keep route but remove from sidebar; accessible via profile dropdown only |

---

## Files to Change

| File | Change |
|---|---|
| `apps/portal-web/src/components/app-sidebar.tsx` | Remove Workspace, Insights, Advanced Insights, Local Market, Alerts, Plans & Billing from owner nav. Make My Properties Founder-only. |
| `apps/portal-web/src/routes/_portal.tsx` | Add bell icon + alert badge to header. Add Plans & Billing + Account Details to profile dropdown. |
| `apps/portal-web/src/routes/_portal.index.tsx` | For Host/Partner: auto-redirect to their single property dashboard instead of org dashboard. |
| Routes to remove or redirect | `/_portal/insights`, `/_portal/advanced-insights`, `/_portal/local-market` |

---

## Error Handling

- If a Host/Partner owner navigates directly to `/properties`, redirect to their property dashboard (guard in route loader)
- If no property found for owner, show empty state with onboarding CTA

---

## Success Criteria

- Owner sidebar shows exactly 4 items: Dashboard, Feedback, QR Codes, Team
- No Admin items visible to non-admin owners
- Plans & Billing accessible only via profile dropdown
- Alerts accessible only via topbar bell
- Founder sees property list; Host/Partner do not
- Removed routes redirect to dashboard (no 404s)
