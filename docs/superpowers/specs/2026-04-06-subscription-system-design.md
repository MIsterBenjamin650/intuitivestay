# Subscription System Design

## Goal

Gate dashboard access behind a subscription purchased via Wix Pricing Plans (Stripe). New organisations start with no subscription. After property approval, owners choose a plan and complete checkout. Stripe webhooks keep the portal in sync. Expired or unpaid accounts drop to a restricted view with an upgrade prompt.

## Architecture

### Subscription States

| Status | Access |
|---|---|
| `none` | Blocked — full-screen "Choose your plan" gate |
| `trial` | Full access for their plan tier |
| `active` | Full access for their plan tier |
| `grace` | Restricted view (Host-level only, 7-day range) + payment failed banner |
| `expired` | Restricted view (Host-level only, 7-day range) + reactivate banner |

### Trial Lengths

| Plan | Trial |
|---|---|
| Host | 30 days |
| Partner | 14 days |
| Founder | No trial — paid immediately |

### Grace Period

3 days when a payment fails. During grace, owner sees restricted view (Host-level features, 7-day range only) with a warning banner prompting them to update payment details.

---

## User Flow

1. Owner registers property via Wix form → portal creates org with `plan: "host"`, `subscriptionStatus: "none"`
2. Admin approves property → magic link approval email sent
3. Owner clicks magic link → portal shows **Choose Your Plan** page (dashboard blocked)
4. Owner selects a plan → redirected to Wix Pricing Plans checkout (Stripe processes payment)
5. Stripe fires webhook → portal updates plan, status, and dates
6. Owner's next visit goes straight to the dashboard

---

## Database Changes

Add four columns to the `organisations` table:

| Column | Type | Default | Notes |
|---|---|---|---|
| `subscriptionStatus` | text | `"none"` | `none \| trial \| active \| grace \| expired` |
| `trialEndsAt` | timestamp | null | Set when trial activates |
| `subscriptionEndsAt` | timestamp | null | Current period end from Stripe |
| `stripeCustomerId` | text | null | Links org to Stripe customer |

The existing `plan` column (`host \| partner \| founder`) is updated by the Stripe webhook when a subscription is created or changed.

---

## Stripe Webhook

**Endpoint:** `POST /webhooks/stripe` (public, verified by Stripe signature)

**Events handled:**

| Event | Action |
|---|---|
| `customer.subscription.created` | Set `plan` from price ID. If trial: set `subscriptionStatus: "trial"`, set `trialEndsAt`. If no trial: set `subscriptionStatus: "active"`, set `subscriptionEndsAt` |
| `customer.subscription.updated` | Update `plan`, `subscriptionStatus`, and dates if changed |
| `customer.subscription.deleted` | Set `subscriptionStatus: "expired"` |
| `invoice.payment_failed` | Set `subscriptionStatus: "grace"`, set `subscriptionEndsAt: now + 3 days` |
| `invoice.payment_succeeded` | Set `subscriptionStatus: "active"`, update `subscriptionEndsAt` |

**Linking Stripe to portal:** Match by email — the email on the Stripe customer record matches the org owner's email in the portal.

**Plan mapping via env vars:**

```
STRIPE_PRICE_HOST=price_xxx
STRIPE_PRICE_PARTNER=price_xxx
STRIPE_PRICE_FOUNDER=price_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

---

## Choose Your Plan UI

Route: `/_portal/choose-plan` (new)
Component: `choose-plan.tsx` (new)

Shown when `subscriptionStatus === "none"`. Full-screen layout with three plan cards:

| Plan | Trial badge | Button text |
|---|---|---|
| Host | "30-day free trial" | "Start free trial" |
| Partner | "14-day free trial" (highlighted as most popular) | "Start free trial" |
| Founder | "No free trial" | "Subscribe now" |

Each button links to the corresponding Wix Pricing Plans checkout URL (configured via env vars):
```
VITE_WIX_PLAN_URL_HOST=https://...
VITE_WIX_PLAN_URL_PARTNER=https://...
VITE_WIX_PLAN_URL_FOUNDER=https://...
```

The portal layout's `beforeLoad` checks `subscriptionStatus`. If `"none"`, redirect to `/choose-plan`.

---

## Dashboard Banners

For `grace` and `expired` states, a banner renders at the top of the dashboard (not a full gate):

- **Grace:** amber banner — "Payment failed · You have X days to update your details before access is restricted." + "Update payment →" link to Wix
- **Expired:** red banner — "Your subscription has ended · You're on restricted access." + "Reactivate →" link to Wix

Both link to env var `VITE_WIX_BILLING_URL`.

---

## Updated Tier Feature Access

| Feature | Host | Partner | Founder |
|---|---|---|---|
| Max time range | 7 days | 30 days | 365 days |
| GCS Over Time | ✅ | ✅ | ✅ |
| Pillar Averages | ✅ | ✅ | ✅ |
| Pillar Spotlight | ✅ | ✅ | ✅ |
| Total Submissions | ✅ | ✅ | ✅ |
| Staff Tag Cloud | ✅ | ✅ | ✅ |
| Score Distribution | 🔒 | ✅ | ✅ |
| GCS by Meal Time | 🔒 | ✅ | ✅ |
| Submissions per Week | 🔒 | ✅ | ✅ |
| Engagement Stats | 🔒 | ✅ | ✅ |
| City Leaderboard | 🔒 | ✅ | ✅ |
| Vent Keyword Cloud | 🔒 | 🔒 | ✅ |
| Within-city ranking | 🔒 | 🔒 | ✅ |
| Multi-property overview | 🔒 | 🔒 | ✅ |
| Red Alerts | ✅ | ✅ | ✅ |

Locked features render grayed out with "Upgrade to [Plan] to view" — never hidden.

---

## New Files

| File | Action | Purpose |
|---|---|---|
| `packages/db/src/schema/organisations.ts` | Modify | Add `subscriptionStatus`, `trialEndsAt`, `subscriptionEndsAt`, `stripeCustomerId` columns |
| `apps/portal-server/src/webhooks/stripe.ts` | Create | Stripe webhook handler |
| `apps/portal-web/src/routes/_portal.choose-plan.tsx` | Create | Choose plan route |
| `apps/portal-web/src/components/choose-plan.tsx` | Create | Plan selection full-screen UI |
| `apps/portal-web/src/routes/_portal.tsx` | Modify | Add `beforeLoad` redirect to `/choose-plan` when `subscriptionStatus === "none"` |
| `apps/portal-web/src/components/property-insights.tsx` | Modify | Unlock Staff Tag Cloud for Host plan; add grace/expired banners |

---

## Out of Scope

- PDF export of dashboard data (deferred to a future phase)
- Multiple alert recipients or custom alert thresholds per tier (future enhancement)
- Admin plan override UI (admin can update plan directly in database for now)
