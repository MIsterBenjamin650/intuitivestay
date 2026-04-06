# Subscription System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate dashboard access behind a Stripe/Wix subscription — organisations start with `subscriptionStatus: "none"`, owners are redirected to a plan selection page after approval, and Stripe webhooks keep the portal in sync.

**Architecture:** Four new columns on the `organisations` table track subscription state. A Stripe webhook handler in the portal server updates these on every subscription lifecycle event. The portal web app reads subscription status in `getUser` and redirects to `/choose-plan` when status is `"none"`. Grace and expired states allow restricted (host-level) access with a banner.

**Tech Stack:** Drizzle ORM (schema + migration), Stripe Node SDK, Hono (webhook route), TanStack Start server functions, TanStack Router `beforeLoad`, React components.

---

## File Map

| File | Change |
|---|---|
| `packages/db/src/schema/organisations.ts` | Add 4 columns |
| `packages/env/src/server.ts` | Add 5 Stripe env vars |
| `packages/env/src/web.ts` | Add 4 VITE_ Wix URL env vars |
| `apps/portal-server/src/index.ts` | Register Stripe webhook route |
| `apps/portal-server/src/webhooks/stripe.ts` | Create — webhook handler |
| `packages/api/src/routers/properties.ts` | Update `getPropertyInsights` — effective plan + subscriptionStatus in return |
| `apps/portal-web/package.json` | Add `@intuitive-stay/db: workspace:*` dependency |
| `apps/portal-web/src/functions/get-user.ts` | Query org subscriptionStatus and include in return |
| `apps/portal-web/src/routes/_portal.tsx` | Redirect to `/choose-plan` when subscriptionStatus is `"none"` |
| `apps/portal-web/src/components/choose-plan.tsx` | Create — plan selection UI |
| `apps/portal-web/src/routes/_portal.choose-plan.tsx` | Create — route wrapper |
| `apps/portal-web/src/components/property-insights.tsx` | Unlock Staff Tag Cloud for Host; add grace/expired banners |

---

### Task 1: DB Schema — Add Subscription Columns

**Files:**
- Modify: `packages/db/src/schema/organisations.ts`

- [ ] **Step 1: Replace the organisations schema with the new version**

```typescript
// packages/db/src/schema/organisations.ts
import { relations } from "drizzle-orm"
import { pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { user } from "./auth"

export const organisations = pgTable("organisations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan").notNull().default("host"), // 'host' | 'partner' | 'founder'
  subscriptionStatus: text("subscription_status").notNull().default("none"), // 'none' | 'trial' | 'active' | 'grace' | 'expired'
  trialEndsAt: timestamp("trial_ends_at"),
  subscriptionEndsAt: timestamp("subscription_ends_at"),
  stripeCustomerId: text("stripe_customer_id"),
  ownerId: text("owner_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

export const organisationsRelations = relations(organisations, ({ one }) => ({
  owner: one(user, {
    fields: [organisations.ownerId],
    references: [user.id],
  }),
}))
```

- [ ] **Step 2: Generate the migration**

```bash
pnpm --filter @intuitive-stay/db db:generate
```

Expected: A new SQL file appears in `packages/db/src/migrations/` with `ALTER TABLE organisations ADD COLUMN ...` statements for all four new columns.

- [ ] **Step 3: Run the migration**

```bash
pnpm --filter @intuitive-stay/db db:migrate
```

Expected: Output shows migration applied successfully. No errors.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema/organisations.ts packages/db/src/migrations/
git commit -m "feat: add subscription columns to organisations"
```

---

### Task 2: Env Vars

**Files:**
- Modify: `packages/env/src/server.ts`
- Modify: `packages/env/src/web.ts`

- [ ] **Step 1: Add Stripe vars to server env**

In `packages/env/src/server.ts`, add these five entries to the `server` object:

```typescript
STRIPE_SECRET_KEY: z.string().min(1),
STRIPE_PRICE_HOST: z.string().min(1),
STRIPE_PRICE_PARTNER: z.string().min(1),
STRIPE_PRICE_FOUNDER: z.string().min(1),
STRIPE_WEBHOOK_SECRET: z.string().min(1),
```

The full `server` object should look like:

```typescript
server: {
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  CORS_ORIGIN: z.url(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  WIXBRIDGE_SECRET: z.string().min(16),
  RESEND_API_KEY: z.string().min(1),
  ADMIN_EMAIL: z.string().email(),
  PUBLIC_PORTAL_URL: z.url(),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_PRICE_HOST: z.string().min(1),
  STRIPE_PRICE_PARTNER: z.string().min(1),
  STRIPE_PRICE_FOUNDER: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
},
```

- [ ] **Step 2: Add Wix URL vars to web env**

In `packages/env/src/web.ts`, add four entries to the `client` object:

```typescript
client: {
  VITE_SERVER_URL: z.url(),
  VITE_AUTH_URL: z.url(),
  VITE_WIX_PLAN_URL_HOST: z.url(),
  VITE_WIX_PLAN_URL_PARTNER: z.url(),
  VITE_WIX_PLAN_URL_FOUNDER: z.url(),
  VITE_WIX_BILLING_URL: z.url(),
},
```

- [ ] **Step 3: Add placeholder values to local env files so the dev server starts**

In `apps/portal-server/.env` (create if it doesn't exist), add:

```
STRIPE_SECRET_KEY=sk_test_placeholder
STRIPE_PRICE_HOST=price_host_placeholder
STRIPE_PRICE_PARTNER=price_partner_placeholder
STRIPE_PRICE_FOUNDER=price_founder_placeholder
STRIPE_WEBHOOK_SECRET=whsec_placeholder
```

In `apps/portal-web/.env`, add:

```
VITE_WIX_PLAN_URL_HOST=https://placeholder.example.com/host
VITE_WIX_PLAN_URL_PARTNER=https://placeholder.example.com/partner
VITE_WIX_PLAN_URL_FOUNDER=https://placeholder.example.com/founder
VITE_WIX_BILLING_URL=https://placeholder.example.com/billing
```

- [ ] **Step 4: Commit**

```bash
git add packages/env/src/server.ts packages/env/src/web.ts
git commit -m "feat: add Stripe and Wix plan env vars"
```

---

### Task 3: Stripe Webhook Handler

**Files:**
- Create: `apps/portal-server/src/webhooks/stripe.ts`
- Modify: `apps/portal-server/src/index.ts`

- [ ] **Step 1: Install the Stripe SDK**

```bash
pnpm --filter @intuitive-stay/portal-server add stripe
```

Expected: `stripe` appears in `apps/portal-server/package.json` dependencies.

- [ ] **Step 2: Create the webhook handler**

Create `apps/portal-server/src/webhooks/stripe.ts`:

```typescript
import { db } from "@intuitive-stay/db"
import { organisations, user } from "@intuitive-stay/db/schema"
import { env } from "@intuitive-stay/env/server"
import { eq } from "drizzle-orm"
import type { Context } from "hono"
import Stripe from "stripe"

const stripe = new Stripe(env.STRIPE_SECRET_KEY)

const PRICE_TO_PLAN: Record<string, string> = {
  [env.STRIPE_PRICE_HOST]: "host",
  [env.STRIPE_PRICE_PARTNER]: "partner",
  [env.STRIPE_PRICE_FOUNDER]: "founder",
}

async function findOrgByEmail(email: string): Promise<string | null> {
  const result = await db
    .select({ orgId: organisations.id })
    .from(organisations)
    .innerJoin(user, eq(organisations.ownerId, user.id))
    .where(eq(user.email, email))
    .limit(1)
  return result[0]?.orgId ?? null
}

async function getCustomerEmail(customerId: string): Promise<string | null> {
  const customer = await stripe.customers.retrieve(customerId)
  if (customer.deleted) return null
  return (customer as Stripe.Customer).email ?? null
}

export async function stripeWebhookHandler(c: Context) {
  const body = await c.req.text()
  const sig = c.req.header("stripe-signature") ?? ""

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET)
  } catch {
    return c.json({ error: "Invalid signature" }, 400)
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated"
  ) {
    const sub = event.data.object as Stripe.Subscription
    const email = await getCustomerEmail(sub.customer as string)
    if (!email) return c.json({ ok: true })

    const orgId = await findOrgByEmail(email)
    if (!orgId) return c.json({ ok: true })

    const priceId = sub.items.data[0]?.price.id ?? ""
    const plan = PRICE_TO_PLAN[priceId] ?? "host"
    const isTrialing = sub.status === "trialing"
    const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000) : null
    const periodEnd = sub.current_period_end
      ? new Date(sub.current_period_end * 1000)
      : null

    await db
      .update(organisations)
      .set({
        plan,
        subscriptionStatus: isTrialing ? "trial" : "active",
        trialEndsAt: isTrialing ? trialEnd : null,
        subscriptionEndsAt: isTrialing ? null : periodEnd,
        stripeCustomerId: sub.customer as string,
      })
      .where(eq(organisations.id, orgId))
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription
    const email = await getCustomerEmail(sub.customer as string)
    if (!email) return c.json({ ok: true })

    const orgId = await findOrgByEmail(email)
    if (!orgId) return c.json({ ok: true })

    await db
      .update(organisations)
      .set({ subscriptionStatus: "expired" })
      .where(eq(organisations.id, orgId))
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice
    if (!invoice.customer) return c.json({ ok: true })

    const email = await getCustomerEmail(invoice.customer as string)
    if (!email) return c.json({ ok: true })

    const orgId = await findOrgByEmail(email)
    if (!orgId) return c.json({ ok: true })

    const graceEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    await db
      .update(organisations)
      .set({ subscriptionStatus: "grace", subscriptionEndsAt: graceEnd })
      .where(eq(organisations.id, orgId))
  }

  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice
    if (!invoice.subscription || !invoice.customer) return c.json({ ok: true })

    const email = await getCustomerEmail(invoice.customer as string)
    if (!email) return c.json({ ok: true })

    const orgId = await findOrgByEmail(email)
    if (!orgId) return c.json({ ok: true })

    const sub = await stripe.subscriptions.retrieve(invoice.subscription as string)
    const periodEnd = new Date(sub.current_period_end * 1000)

    await db
      .update(organisations)
      .set({ subscriptionStatus: "active", subscriptionEndsAt: periodEnd })
      .where(eq(organisations.id, orgId))
  }

  return c.json({ ok: true })
}
```

- [ ] **Step 3: Register the route in the Hono server**

In `apps/portal-server/src/index.ts`, add this import at the top (with the other imports):

```typescript
import { stripeWebhookHandler } from "./webhooks/stripe"
```

Then add this route **before** the `app.get("/", ...)` route. It must be before the general tRPC middleware so Stripe's raw body is not consumed:

```typescript
app.post("/webhooks/stripe", stripeWebhookHandler)
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
pnpm --filter @intuitive-stay/portal-server check-types
```

Expected: No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add apps/portal-server/src/webhooks/stripe.ts apps/portal-server/src/index.ts apps/portal-server/package.json pnpm-lock.yaml
git commit -m "feat: add Stripe webhook handler for subscription lifecycle"
```

---

### Task 4: Enforce Subscription in getPropertyInsights

**Files:**
- Modify: `packages/api/src/routers/properties.ts`

This task updates `getPropertyInsights` to:
1. Treat `grace` and `expired` orgs as `"host"` plan (restricted access)
2. Return `subscriptionStatus` so the frontend can show banners

- [ ] **Step 1: Find the getPropertyInsights procedure**

Open `packages/api/src/routers/properties.ts` and find the `getPropertyInsights` query. It's approximately at line 498. Look for this block:

```typescript
// 2. Clamp time range to plan
const effectiveRange = clampTimeRange(input.timeRange, org.plan)
```

- [ ] **Step 2: Replace the effective plan derivation**

Replace this line:

```typescript
const effectiveRange = clampTimeRange(input.timeRange, org.plan)
```

With:

```typescript
// Restrict grace/expired orgs to host-level access
const effectivePlan: Plan =
  org.subscriptionStatus === "grace" || org.subscriptionStatus === "expired"
    ? "host"
    : isPlan(org.plan)
      ? org.plan
      : "host"
const effectiveRange = clampTimeRange(input.timeRange, effectivePlan)
```

- [ ] **Step 3: Replace org.plan references with effectivePlan**

Find this line near the bottom of `getPropertyInsights` (the vent keywords check):

```typescript
const ventKeywords =
  org.plan === "founder" ? extractKeywords(rows.map((r) => r.ventText)) : []
```

Replace with:

```typescript
const ventKeywords =
  effectivePlan === "founder" ? extractKeywords(rows.map((r) => r.ventText)) : []
```

- [ ] **Step 4: Add subscriptionStatus to the return value**

Find the `return {` at the end of `getPropertyInsights`. Add `subscriptionStatus` to the returned object:

```typescript
return {
  gcsOverTime,
  pillarAverages,
  pillarSpotlight: totalSubmissions > 0
    ? {
        strongest: strongest[0],
        strongestScore: strongest[1],
        weakest: weakest[0],
        weakestScore: weakest[1],
      }
    : null,
  gcsByMealTime,
  submissionsPerWeek,
  scoreDistribution,
  engagementStats: { totalSubmissions, nameDropRate, ventRate },
  staffTagCloud,
  ventKeywords,
  allowedTimeRange: effectiveRange,
  userPlan: effectivePlan,
  subscriptionStatus: org.subscriptionStatus as "none" | "trial" | "active" | "grace" | "expired",
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
pnpm --filter @intuitive-stay/api check-types
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routers/properties.ts
git commit -m "feat: enforce subscription status in getPropertyInsights"
```

---

### Task 5: Portal Layout Gate

**Files:**
- Modify: `apps/portal-web/package.json`
- Modify: `apps/portal-web/src/functions/get-user.ts`
- Modify: `apps/portal-web/src/routes/_portal.tsx`

- [ ] **Step 1: Add @intuitive-stay/db to portal-web dependencies**

Open `apps/portal-web/package.json`. In the `dependencies` object, add:

```json
"@intuitive-stay/db": "workspace:*"
```

Then install:

```bash
pnpm install
```

- [ ] **Step 2: Replace get-user.ts**

Replace the entire contents of `apps/portal-web/src/functions/get-user.ts` with:

```typescript
import { db } from "@intuitive-stay/db"
import { organisations } from "@intuitive-stay/db/schema"
import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"

import { authMiddleware } from "@/middleware/auth"

export const getUser = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!context.session) return null

    const org = await db.query.organisations.findFirst({
      where: eq(organisations.ownerId, context.session.user.id),
      columns: { subscriptionStatus: true },
    })

    return {
      ...context.session,
      isAdmin: context.session.user.email === process.env.ADMIN_EMAIL,
      subscriptionStatus: org?.subscriptionStatus ?? "none",
    }
  })
```

- [ ] **Step 3: Update _portal.tsx beforeLoad to redirect on "none" status**

Open `apps/portal-web/src/routes/_portal.tsx`. Find the `beforeLoad` function:

```typescript
beforeLoad: async () => {
  const session = await getUser();

  if (!session) {
    throw redirect({
      to: "/login",
    });
  }

  return { session };
},
```

Replace it with:

```typescript
beforeLoad: async ({ location }) => {
  const session = await getUser()

  if (!session) {
    throw redirect({ to: "/login" })
  }

  const isChoosingPlan = location.pathname === "/choose-plan"
  if (!isChoosingPlan && session.subscriptionStatus === "none") {
    throw redirect({ to: "/choose-plan" })
  }

  return { session }
},
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
pnpm --filter @intuitive-stay/portal-web check-types
```

Expected: No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add apps/portal-web/package.json apps/portal-web/src/functions/get-user.ts apps/portal-web/src/routes/_portal.tsx pnpm-lock.yaml
git commit -m "feat: redirect to choose-plan when subscription status is none"
```

---

### Task 6: Choose Plan Component and Route

**Files:**
- Create: `apps/portal-web/src/components/choose-plan.tsx`
- Create: `apps/portal-web/src/routes/_portal.choose-plan.tsx`

- [ ] **Step 1: Create the route file**

Create `apps/portal-web/src/routes/_portal.choose-plan.tsx`:

```typescript
import { createFileRoute } from "@tanstack/react-router"

import { ChoosePlan } from "@/components/choose-plan"

export const Route = createFileRoute("/_portal/choose-plan")({
  component: ChoosePlan,
})
```

- [ ] **Step 2: Create the component**

Create `apps/portal-web/src/components/choose-plan.tsx`:

```typescript
import { env } from "@intuitive-stay/env/web"

const PLANS = [
  {
    key: "host" as const,
    name: "Host",
    price: "Contact us",
    trial: "30-day free trial",
    trialBadgeStyle: "bg-green-50 text-green-700 border border-green-200",
    popular: false,
    features: [
      "GCS Over Time chart",
      "Pillar Averages radar",
      "Pillar Spotlight",
      "Total Submissions stat",
      "Staff Tag Cloud",
      "Last 7 days of data",
    ],
    locked: [
      "Score Distribution",
      "GCS by Meal Time",
      "City Leaderboard",
    ],
    buttonText: "Start free trial",
    buttonStyle: "border border-indigo-500 text-indigo-600 hover:bg-indigo-50",
    urlKey: "host" as const,
  },
  {
    key: "partner" as const,
    name: "Partner",
    price: "Contact us",
    trial: "14-day free trial",
    trialBadgeStyle: "bg-green-50 text-green-700 border border-green-200",
    popular: true,
    features: [
      "Everything in Host",
      "Last 30 days of data",
      "Score Distribution",
      "GCS by Meal Time",
      "Submissions per Week",
      "Engagement Stats",
      "City Leaderboard",
    ],
    locked: [
      "Vent Keyword Cloud",
      "Multi-property overview",
    ],
    buttonText: "Start free trial",
    buttonStyle: "bg-indigo-500 text-white hover:bg-indigo-600",
    urlKey: "partner" as const,
  },
  {
    key: "founder" as const,
    name: "Founder",
    price: "Contact us",
    trial: "No free trial",
    trialBadgeStyle: "bg-slate-50 text-slate-400 border border-slate-200",
    popular: false,
    features: [
      "Everything in Partner",
      "Up to 365 days of data",
      "Vent Keyword Cloud",
      "Within-city ranking",
      "Multi-property overview",
    ],
    locked: [],
    buttonText: "Subscribe now",
    buttonStyle: "bg-slate-900 text-white hover:bg-slate-800",
    urlKey: "founder" as const,
  },
]

const PLAN_URLS: Record<"host" | "partner" | "founder", string> = {
  host: env.VITE_WIX_PLAN_URL_HOST,
  partner: env.VITE_WIX_PLAN_URL_PARTNER,
  founder: env.VITE_WIX_PLAN_URL_FOUNDER,
}

export function ChoosePlan() {
  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center px-6 py-12">
      <div className="mb-10 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Choose your plan</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your property has been approved. Select a plan to access your dashboard.
        </p>
      </div>

      <div className="grid w-full max-w-4xl grid-cols-1 gap-5 md:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.key}
            className={`relative flex flex-col rounded-xl border bg-card p-6 shadow-sm ${
              plan.popular ? "border-indigo-500 ring-1 ring-indigo-500" : "border-border"
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-500 px-3 py-0.5 text-[11px] font-semibold text-white">
                Most popular
              </div>
            )}

            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {plan.name}
            </p>
            <p className="mt-1 text-2xl font-bold">{plan.price}</p>

            <span
              className={`mt-2 inline-block w-fit rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${plan.trialBadgeStyle}`}
            >
              {plan.trial}
            </span>

            <hr className="my-4 border-border" />

            <ul className="mb-6 flex-1 space-y-2">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                  <span className="font-bold text-indigo-500">✓</span>
                  {f}
                </li>
              ))}
              {plan.locked.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground/50">
                  <span className="text-[11px]">🔒</span>
                  {f}
                </li>
              ))}
            </ul>

            <a
              href={PLAN_URLS[plan.urlKey]}
              target="_blank"
              rel="noopener noreferrer"
              className={`block w-full rounded-lg py-2.5 text-center text-sm font-semibold transition-colors ${plan.buttonStyle}`}
            >
              {plan.buttonText}
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add the route to routeTree.gen.ts**

Open `apps/portal-web/src/routeTree.gen.ts`. Find where `_portal` child routes are registered and add `/_portal/choose-plan`. Follow the exact same pattern as the other `_portal` child routes already in the file. Look for the `_portalRoute` children array and add:

```typescript
_portalChoosePlanRoute,
```

Also add the import at the top following the pattern of other route imports:

```typescript
import { Route as _portalChoosePlanRoute } from "./routes/_portal.choose-plan"
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
pnpm --filter @intuitive-stay/portal-web check-types
```

Expected: No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add apps/portal-web/src/components/choose-plan.tsx apps/portal-web/src/routes/_portal.choose-plan.tsx apps/portal-web/src/routeTree.gen.ts
git commit -m "feat: add choose-plan page for new subscribers"
```

---

### Task 7: Grace/Expired Banners + Staff Tag Cloud Unlock

**Files:**
- Modify: `apps/portal-web/src/components/property-insights.tsx`

- [ ] **Step 1: Find the subscriptionStatus in the data**

Open `apps/portal-web/src/components/property-insights.tsx`. Find where `data` is destructured from the `getPropertyInsights` query. It will look like:

```typescript
const { data, isLoading, isError } = useQuery(...)
```

And then data will be used. Find the destructuring of data fields (look for `userPlan`, `allowedTimeRange`, etc.) and add `subscriptionStatus`:

```typescript
const {
  gcsOverTime,
  pillarAverages,
  pillarSpotlight,
  gcsByMealTime,
  submissionsPerWeek,
  scoreDistribution,
  engagementStats,
  staffTagCloud,
  ventKeywords,
  allowedTimeRange,
  userPlan,
  subscriptionStatus,   // add this line
} = data
```

- [ ] **Step 2: Add the subscription banners**

First, ensure `env` is imported at the top of `property-insights.tsx`. Look for existing imports — if `@intuitive-stay/env/web` is not already imported, add:

```typescript
import { env } from "@intuitive-stay/env/web"
```

Find where the main page content starts (after the loading/error/no-data guards, before the first chart section). Add the banners right after the time filter bar and before the first chart:

```typescript
{/* Subscription status banners */}
{subscriptionStatus === "grace" && (
  <div className="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
    <div>
      <p className="text-sm font-semibold text-orange-700">⚠️ Payment failed</p>
      <p className="text-xs text-orange-600 mt-0.5">
        You have 3 days to update your payment details before access is restricted.
      </p>
    </div>
    <a
      href={env.VITE_WIX_BILLING_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="ml-4 shrink-0 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600"
    >
      Update payment →
    </a>
  </div>
)}

{subscriptionStatus === "expired" && (
  <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3">
    <div>
      <p className="text-sm font-semibold text-red-700">Your subscription has ended</p>
      <p className="text-xs text-red-600 mt-0.5">
        You&apos;re on restricted access. Reactivate to restore your full dashboard.
      </p>
    </div>
    <a
      href={env.VITE_WIX_BILLING_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="ml-4 shrink-0 rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600"
    >
      Reactivate →
    </a>
  </div>
)}
```

- [ ] **Step 3: Unlock Staff Tag Cloud for Host**

Search in `property-insights.tsx` for the Staff Tag Cloud section. It will have a `LockedCard` wrapper that checks the plan. Find this pattern (exact variable names may differ slightly):

```typescript
{userPlan === "host" ? (
  <LockedCard title="Staff Tag Cloud" requiredPlan="Partner" />
) : (
  // actual staff tag cloud JSX
)}
```

Remove the lock entirely. Replace the entire conditional with just the staff tag cloud content (the non-locked branch), so it renders for all plans including host.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
pnpm --filter @intuitive-stay/portal-web check-types
```

Expected: No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add apps/portal-web/src/components/property-insights.tsx
git commit -m "feat: add subscription banners; unlock Staff Tag Cloud for Host"
```

---

### Final Step: Push to Railway

- [ ] **Push all commits**

```bash
git push origin main
```

Expected: Railway picks up all commits and deploys. Check the Railway dashboard to confirm deployment is successful.

**After deployment, configure Railway env vars:**
Go to Railway → portal-server service → Variables and add:
- `STRIPE_SECRET_KEY` — from your Stripe dashboard
- `STRIPE_PRICE_HOST` — the price ID for the Host plan in Stripe
- `STRIPE_PRICE_PARTNER` — the price ID for the Partner plan in Stripe
- `STRIPE_PRICE_FOUNDER` — the price ID for the Founder plan in Stripe
- `STRIPE_WEBHOOK_SECRET` — from Stripe webhook dashboard after adding the endpoint

Go to Railway → portal-web service → Variables and add:
- `VITE_WIX_PLAN_URL_HOST` — the Wix Pricing Plans checkout URL for Host
- `VITE_WIX_PLAN_URL_PARTNER` — the Wix Pricing Plans checkout URL for Partner
- `VITE_WIX_PLAN_URL_FOUNDER` — the Wix Pricing Plans checkout URL for Founder
- `VITE_WIX_BILLING_URL` — the Wix billing management URL

**Then in the Stripe dashboard:**
Add a webhook endpoint pointing to `https://vibrant-wonder-production.up.railway.app/webhooks/stripe` and subscribe to these events:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`
- `invoice.payment_succeeded`
