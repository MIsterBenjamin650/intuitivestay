# Service Signature Phase 3 — Staff Dashboard + Payment + Shareable Link

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the staff-facing profile page showing attribution stats blurred behind a £9.99 one-time Stripe payment, and a public shareable passport link for employers once activated.

**Architecture:** Six tasks — DB columns, tRPC procedures (profile stats + Stripe checkout), Stripe webhook handler update, verify-page redirect, staff profile page (blur overlay + payment), and public passport page. Staff have no login; they access their profile via a bookmarked direct URL after email verification.

**Tech Stack:** Drizzle ORM + PostgreSQL, tRPC public procedures, Stripe Checkout (payment mode), TanStack Start/Router, React, Tailwind CSS.

---

## File Map

| Action | Path |
|--------|------|
| **Modify** | `packages/db/src/schema/staff-profiles.ts` — add `activatedAt`, `stripePaymentIntentId` |
| **Create** | `packages/db/src/migrations/0015_staff_activation.sql` |
| **Modify** | `packages/api/src/routers/staff.ts` — update `verifyStaffEmail`, add `getStaffProfile`, `createStaffActivationCheckout` |
| **Modify** | `apps/portal-server/src/webhooks/stripe.ts` — handle `staffProfileId` in `checkout.session.completed` |
| **Modify** | `apps/portal-web/src/routes/staff-verify.$token.tsx` — redirect to `/staff-profile/$staffProfileId` |
| **Create** | `apps/portal-web/src/routes/staff-profile.$staffProfileId.tsx` |
| **Create** | `apps/portal-web/src/routes/passport.$staffProfileId.tsx` |

---

### Task 1: DB schema + migration

**Files:**
- Modify: `packages/db/src/schema/staff-profiles.ts`
- Create: `packages/db/src/migrations/0015_staff_activation.sql`

- [ ] **Step 1: Add columns to the Drizzle schema**

Read `packages/db/src/schema/staff-profiles.ts`. Add two nullable columns before `createdAt`:

```typescript
// packages/db/src/schema/staff-profiles.ts
import { index, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core"

import { properties } from "./properties"

export const staffProfiles = pgTable(
  "staff_profiles",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    emailVerificationToken: text("email_verification_token"),
    emailVerifiedAt: timestamp("email_verified_at"),
    /** Set when staff completes the £9.99 one-time Stripe payment. */
    activatedAt: timestamp("activated_at"),
    /** Stripe PaymentIntent ID stored for audit purposes. */
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("staff_profiles_property_id_idx").on(table.propertyId),
    unique("staff_profiles_property_email_unique").on(table.propertyId, table.email),
    unique("staff_profiles_verification_token_unique").on(table.emailVerificationToken),
  ],
)
```

- [ ] **Step 2: Create the migration file**

Create `packages/db/src/migrations/0015_staff_activation.sql`:

```sql
ALTER TABLE "staff_profiles" ADD COLUMN IF NOT EXISTS "activated_at" timestamp;
ALTER TABLE "staff_profiles" ADD COLUMN IF NOT EXISTS "stripe_payment_intent_id" text;
```

- [ ] **Step 3: Commit**

```bash
cd /c/Users/miste/intuitivestay/intuitivestay
git add packages/db/src/schema/staff-profiles.ts \
        packages/db/src/migrations/0015_staff_activation.sql
git commit -m "feat: add activatedAt and stripePaymentIntentId to staff_profiles"
```

---

### Task 2: Update staff tRPC router

**Files:**
- Modify: `packages/api/src/routers/staff.ts`

**Context:** Read the full file before editing. Current imports are:
```typescript
import { db } from "@intuitive-stay/db"
import { organisations, properties, staffProfiles } from "@intuitive-stay/db/schema"
import { env } from "@intuitive-stay/env/server"
import { TRPCError } from "@trpc/server"
import { and, asc, eq, isNotNull } from "drizzle-orm"
import { z } from "zod"
import { sendStaffVerificationEmail } from "../lib/email"
import { protectedProcedure, publicProcedure, router } from "../index"
```

- [ ] **Step 1: Update imports**

Replace the imports block with:

```typescript
import { db } from "@intuitive-stay/db"
import { feedback, organisations, properties, staffProfiles } from "@intuitive-stay/db/schema"
import { env } from "@intuitive-stay/env/server"
import { TRPCError } from "@trpc/server"
import { and, asc, count, eq, isNotNull, sql } from "drizzle-orm"
import Stripe from "stripe"
import { z } from "zod"

import { sendStaffVerificationEmail } from "../lib/email"
import { protectedProcedure, publicProcedure, router } from "../index"

const stripe = new Stripe(env.STRIPE_SECRET_KEY)
```

- [ ] **Step 2: Update `verifyStaffEmail` to return `staffProfileId`**

Find `verifyStaffEmail`. Its current return is:

```typescript
return { ok: true, name: staff.name, propertyId: staff.propertyId }
```

Change it to:

```typescript
return { ok: true, name: staff.name, propertyId: staff.propertyId, staffProfileId: staff.id }
```

- [ ] **Step 3: Add `getStaffProfile` procedure**

Add after `getVerifiedStaffAtProperty`, before the closing `})` of the router:

```typescript
  /**
   * Public — returns a staff member's profile and attribution stats.
   * Email is never returned (public endpoint).
   * Stats only include feedback rows with staffProfileId set (Phase 2+).
   */
  getStaffProfile: publicProcedure
    .input(z.object({ staffProfileId: z.string() }))
    .query(async ({ input }) => {
      const staff = await db.query.staffProfiles.findFirst({
        where: eq(staffProfiles.id, input.staffProfileId),
      })
      if (!staff) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found." })
      }

      const property = await db.query.properties.findFirst({
        where: eq(properties.id, staff.propertyId),
      })

      const [stats] = await db
        .select({
          nominations: count(),
          avgGcs: sql<string>`COALESCE(avg(${feedback.gcs}::numeric), 0)`,
          avgResilience: sql<string>`COALESCE(avg(${feedback.resilience}::numeric), 0)`,
          avgEmpathy: sql<string>`COALESCE(avg(${feedback.empathy}::numeric), 0)`,
          avgAnticipation: sql<string>`COALESCE(avg(${feedback.anticipation}::numeric), 0)`,
          avgRecognition: sql<string>`COALESCE(avg(${feedback.recognition}::numeric), 0)`,
        })
        .from(feedback)
        .where(eq(feedback.staffProfileId, input.staffProfileId))

      return {
        id: staff.id,
        name: staff.name,
        propertyName: property?.name ?? "Unknown Property",
        createdAt: staff.createdAt,
        activatedAt: staff.activatedAt ?? null,
        nominations: stats?.nominations ?? 0,
        avgGcs: Number(stats?.avgGcs ?? 0),
        pillarAverages: {
          resilience: Number(stats?.avgResilience ?? 0),
          empathy: Number(stats?.avgEmpathy ?? 0),
          anticipation: Number(stats?.avgAnticipation ?? 0),
          recognition: Number(stats?.avgRecognition ?? 0),
        },
      }
    }),
```

- [ ] **Step 4: Add `createStaffActivationCheckout` procedure**

Add after `getStaffProfile`:

```typescript
  /**
   * Public — creates a £9.99 one-time Stripe checkout session for staff activation.
   * Staff have no login so this is a public endpoint; the staffProfileId is validated
   * to exist and not already be activated before creating a session.
   */
  createStaffActivationCheckout: publicProcedure
    .input(z.object({ staffProfileId: z.string() }))
    .mutation(async ({ input }) => {
      const staff = await db.query.staffProfiles.findFirst({
        where: eq(staffProfiles.id, input.staffProfileId),
      })
      if (!staff) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found." })
      }
      if (staff.activatedAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Profile is already activated." })
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "gbp",
              unit_amount: 999,
              product_data: {
                name: "Service Signature — Lifetime Access",
                description: "One-time fee. Unlock your digital staff passport and shareable link.",
              },
            },
            quantity: 1,
          },
        ],
        metadata: { staffProfileId: input.staffProfileId },
        success_url: `${env.PUBLIC_PORTAL_URL}/staff-profile/${input.staffProfileId}?activated=true`,
        cancel_url: `${env.PUBLIC_PORTAL_URL}/staff-profile/${input.staffProfileId}`,
      })

      if (!session.url) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe did not return a checkout URL." })
      }

      return { checkoutUrl: session.url }
    }),
```

- [ ] **Step 5: Commit**

```bash
cd /c/Users/miste/intuitivestay/intuitivestay
git add packages/api/src/routers/staff.ts
git commit -m "feat: add getStaffProfile and createStaffActivationCheckout tRPC procedures"
```

---

### Task 3: Stripe webhook — handle staff activation

**Files:**
- Modify: `apps/portal-server/src/webhooks/stripe.ts`

**Context:** Read the full file. The `checkout.session.completed` block currently starts with:

```typescript
if (event.type === "checkout.session.completed") {
  const session = event.data.object as Stripe.Checkout.Session
  const propertyId = session.metadata?.propertyId
  if (!propertyId) return c.json({ ok: true })
  // ... property billing logic
}
```

We need to add a staff activation branch BEFORE the `!propertyId` guard, because staff sessions have `staffProfileId` in metadata but NOT `propertyId`, so the current guard would silently discard them.

- [ ] **Step 1: Add `staffProfiles` to the DB schema import**

Current import:
```typescript
import { organisations, properties, user } from "@intuitive-stay/db/schema"
```

Change to:
```typescript
import { organisations, properties, staffProfiles, user } from "@intuitive-stay/db/schema"
```

- [ ] **Step 2: Add `eq` to drizzle-orm import if not present**

Current import:
```typescript
import { eq } from "drizzle-orm"
```

It's already there — no change needed.

- [ ] **Step 3: Restructure the `checkout.session.completed` block**

Find the entire `if (event.type === "checkout.session.completed") { ... }` block. Replace it with:

```typescript
if (event.type === "checkout.session.completed") {
  const session = event.data.object as Stripe.Checkout.Session

  // ── Staff activation payment ─────────────────────────────────────────────
  const staffProfileId = session.metadata?.staffProfileId
  if (staffProfileId) {
    if (session.payment_status !== "paid") return c.json({ ok: true })

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent as Stripe.PaymentIntent | null)?.id ?? null

    await db
      .update(staffProfiles)
      .set({
        activatedAt: new Date(),
        stripePaymentIntentId: paymentIntentId,
      })
      .where(eq(staffProfiles.id, staffProfileId))

    return c.json({ ok: true })
  }

  // ── Additional property payment ──────────────────────────────────────────
  const propertyId = session.metadata?.propertyId
  if (!propertyId) return c.json({ ok: true })

  // Only act on paid sessions (subscription mode sessions may have payment_status = 'no_payment_required' for trials)
  if (session.payment_status !== "paid") return c.json({ ok: true })

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription as Stripe.Subscription | null)?.id ?? null

  if (!subscriptionId) return c.json({ ok: true })

  const property = await db.query.properties.findFirst({
    where: eq(properties.id, propertyId),
  })

  // Guard: only activate if currently awaiting payment
  if (!property || property.paymentStatus !== "pending") return c.json({ ok: true })

  // Mark as paid and store the subscription ID for future cancellation
  await db
    .update(properties)
    .set({
      paymentStatus: "paid",
      stripeSubscriptionId: subscriptionId,
      updatedAt: new Date(),
    })
    .where(eq(properties.id, propertyId))

  // Generate QR code and send activation email (same as standard approval flow)
  await generateAndActivateProperty(property).catch((err) =>
    console.error("[webhook/checkout.session.completed] Activation failed:", err),
  )
}
```

- [ ] **Step 4: Commit**

```bash
cd /c/Users/miste/intuitivestay/intuitivestay
git add apps/portal-server/src/webhooks/stripe.ts
git commit -m "feat: handle staffProfileId in Stripe checkout.session.completed webhook"
```

---

### Task 4: Update staff-verify page to redirect

**Files:**
- Modify: `apps/portal-web/src/routes/staff-verify.$token.tsx`

**Context:** After a successful `verifyStaffEmail` mutation, the page currently shows a success message. We need it to redirect to `/staff-profile/$staffProfileId` instead. The `verifyStaffEmail` mutation now returns `staffProfileId` (added in Task 2).

- [ ] **Step 1: Rewrite the file**

```typescript
// apps/portal-web/src/routes/staff-verify.$token.tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"

import { useTRPCClient } from "@/utils/trpc"

export const Route = createFileRoute("/staff-verify/$token")({
  component: StaffVerifyPage,
})

function StaffVerifyPage() {
  const { token } = Route.useParams()
  const trpcClient = useTRPCClient()
  const navigate = useNavigate()

  const [status, setStatus] = useState<"loading" | "error">("loading")

  useEffect(() => {
    trpcClient.staff.verifyStaffEmail
      .mutate({ token })
      .then((result) => {
        void navigate({
          to: "/staff-profile/$staffProfileId",
          params: { staffProfileId: result.staffProfileId },
        })
      })
      .catch(() => {
        setStatus("error")
      })
  }, [token])

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="font-semibold text-destructive">Verification failed</p>
          <p className="text-sm text-muted-foreground">
            This link is invalid or has already been used. If you need help, contact your manager.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">Verifying your email…</p>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /c/Users/miste/intuitivestay/intuitivestay
git add "apps/portal-web/src/routes/staff-verify.\$token.tsx"
git commit -m "feat: redirect staff-verify page to staff-profile after successful verification"
```

---

### Task 5: Staff profile page

**Files:**
- Create: `apps/portal-web/src/routes/staff-profile.$staffProfileId.tsx`

- [ ] **Step 1: Create the file**

```typescript
// apps/portal-web/src/routes/staff-profile.$staffProfileId.tsx
import { cn } from "@intuitive-stay/ui/lib/utils"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { CheckIcon, CopyIcon, LockIcon, ShieldCheckIcon } from "lucide-react"
import { useEffect, useState } from "react"

import { useTRPC, useTRPCClient } from "@/utils/trpc"

export const Route = createFileRoute("/staff-profile/$staffProfileId")({
  validateSearch: (search: Record<string, unknown>) => ({
    activated: search.activated === "true" || search.activated === true,
  }),
  component: StaffProfilePage,
})

function PillarBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round((value / 10) * 100)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{value.toFixed(1)}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-orange-500 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function StaffProfilePage() {
  const { staffProfileId } = Route.useParams()
  const { activated: justPaid } = Route.useSearch()
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()

  const { data, isLoading, isError, refetch } = useQuery(
    trpc.staff.getStaffProfile.queryOptions({ staffProfileId }),
  )

  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [copied, setCopied] = useState(false)

  const isActivated = !!data?.activatedAt
  const tierScore = data ? Math.round(data.avgGcs * 10) : 0
  const passportUrl = `${window.location.origin}/passport/${staffProfileId}`

  // If user just returned from Stripe (justPaid=true) but webhook hasn't fired yet,
  // refetch once after 3 seconds to pick up the activation.
  useEffect(() => {
    if (justPaid && !isActivated) {
      const t = setTimeout(() => void refetch(), 3000)
      return () => clearTimeout(t)
    }
  }, [justPaid, isActivated, refetch])

  async function handleUnlock() {
    if (isCheckingOut) return
    setIsCheckingOut(true)
    try {
      const result = await trpcClient.staff.createStaffActivationCheckout.mutate({ staffProfileId })
      window.location.href = result.checkoutUrl
    } catch {
      setIsCheckingOut(false)
    }
  }

  function handleCopy() {
    void navigator.clipboard.writeText(passportUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading your profile…</p>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="font-semibold">Profile not found</p>
          <p className="text-sm text-muted-foreground">
            This profile does not exist or the link is incorrect.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-sm space-y-6">

        {/* Payment success banner */}
        {justPaid && (
          <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 text-center">
            🎉 Payment successful! Your Service Signature is now unlocked.
          </div>
        )}

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="rounded-full bg-orange-100 p-3">
              <ShieldCheckIcon className="size-7 text-orange-500" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">{data.name}</h1>
          <p className="text-sm text-muted-foreground">{data.propertyName}</p>
          <p className="text-xs text-muted-foreground">
            {isActivated
              ? `Active since ${new Date(data.activatedAt!).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
              : `Member since ${new Date(data.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`}
          </p>
        </div>

        {/* Stats — blurred when not activated */}
        <div className="relative rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className={cn("p-5 space-y-5", !isActivated && "blur-sm select-none pointer-events-none")}>

            {/* GCS score */}
            <div className="text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                Guest Connection Score
              </p>
              <p className="text-5xl font-black text-orange-500">
                {data.nominations > 0 ? tierScore : "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.nominations > 0 ? "/ 100" : "No nominations yet"}
              </p>
            </div>

            <div className="border-t border-border" />

            {/* Nominations */}
            <div className="text-center">
              <p className="text-3xl font-bold">{data.nominations}</p>
              <p className="text-xs text-muted-foreground">
                {data.nominations === 1 ? "Guest nomination" : "Guest nominations"}
              </p>
            </div>

            <div className="border-t border-border" />

            {/* Pillar breakdown */}
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground text-center">
                Pillar Breakdown
              </p>
              <PillarBar label="Resilience" value={data.pillarAverages.resilience} />
              <PillarBar label="Empathy" value={data.pillarAverages.empathy} />
              <PillarBar label="Anticipation" value={data.pillarAverages.anticipation} />
              <PillarBar label="Recognition" value={data.pillarAverages.recognition} />
            </div>
          </div>

          {/* Unlock overlay */}
          {!isActivated && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white/60 backdrop-blur-[1px]">
              <div className="text-center space-y-1 px-6">
                <LockIcon className="mx-auto size-6 text-muted-foreground mb-2" />
                <p className="font-bold text-base">Unlock Your Service Signature</p>
                <p className="text-xs text-muted-foreground">
                  One-time fee — lifetime access. Your stats and shareable passport link unlock instantly.
                </p>
              </div>
              <button
                type="button"
                onClick={handleUnlock}
                disabled={isCheckingOut}
                className="rounded-xl bg-orange-500 px-6 py-3 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60 transition-colors shadow-md"
              >
                {isCheckingOut ? "Redirecting to payment…" : "Unlock Now — £9.99"}
              </button>
            </div>
          )}
        </div>

        {/* Shareable link — only when activated */}
        {isActivated && (
          <div className="rounded-xl border bg-white shadow-sm p-5 space-y-3">
            <div>
              <p className="font-semibold text-sm">Your Shareable Passport Link</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Share this link with employers. It shows your verified guest feedback stats.
              </p>
            </div>
            <div className="flex gap-2">
              <input
                readOnly
                value={passportUrl}
                className="flex-1 rounded-lg border border-border bg-gray-50 px-3 py-2 text-xs font-mono text-gray-700 outline-none"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium hover:bg-gray-50 transition-colors"
              >
                {copied ? (
                  <CheckIcon className="size-3.5 text-green-600" />
                ) : (
                  <CopyIcon className="size-3.5" />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /c/Users/miste/intuitivestay/intuitivestay
git add "apps/portal-web/src/routes/staff-profile.\$staffProfileId.tsx"
git commit -m "feat: add staff profile page with blur payment wall and shareable link"
```

---

### Task 6: Public passport page + push

**Files:**
- Create: `apps/portal-web/src/routes/passport.$staffProfileId.tsx`

- [ ] **Step 1: Create the file**

```typescript
// apps/portal-web/src/routes/passport.$staffProfileId.tsx
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { ShieldCheckIcon } from "lucide-react"

import { useTRPC } from "@/utils/trpc"

export const Route = createFileRoute("/passport/$staffProfileId")({
  component: PassportPage,
})

function PillarBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round((value / 10) * 100)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{value.toFixed(1)}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-orange-500 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function PassportPage() {
  const { staffProfileId } = Route.useParams()
  const trpc = useTRPC()

  const { data, isLoading, isError } = useQuery(
    trpc.staff.getStaffProfile.queryOptions({ staffProfileId }),
  )

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="font-semibold">Passport not found</p>
          <p className="text-sm text-muted-foreground">
            This passport does not exist or the link is incorrect.
          </p>
        </div>
      </div>
    )
  }

  if (!data.activatedAt) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center space-y-3">
          <ShieldCheckIcon className="mx-auto size-8 text-muted-foreground/40" />
          <p className="font-semibold">Passport not yet activated</p>
          <p className="text-sm text-muted-foreground">
            This Service Signature passport has not been activated yet.
          </p>
        </div>
      </div>
    )
  }

  const tierScore = Math.round(data.avgGcs * 10)

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-sm space-y-6">

        {/* Header */}
        <div className="text-center space-y-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            IntuitiveStay · Service Signature
          </p>
          <div className="flex justify-center">
            <div className="rounded-full bg-orange-100 p-3">
              <ShieldCheckIcon className="size-8 text-orange-500" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold">{data.name}</h1>
            <p className="text-sm text-muted-foreground">{data.propertyName}</p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
            <span className="size-1.5 rounded-full bg-green-500" />
            Verified
          </div>
        </div>

        {/* Stats card */}
        <div className="rounded-xl border bg-white shadow-sm p-5 space-y-5">

          {/* GCS */}
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
              Guest Connection Score
            </p>
            <p className="text-5xl font-black text-orange-500">
              {data.nominations > 0 ? tierScore : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {data.nominations > 0 ? "/ 100" : "No data yet"}
            </p>
          </div>

          <div className="border-t border-border" />

          {/* Nominations */}
          <div className="text-center">
            <p className="text-3xl font-bold">{data.nominations}</p>
            <p className="text-xs text-muted-foreground">
              {data.nominations === 1 ? "Guest nomination" : "Guest nominations"}
            </p>
          </div>

          {data.nominations > 0 && (
            <>
              <div className="border-t border-border" />

              {/* Pillar breakdown */}
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground text-center">
                  Pillar Breakdown
                </p>
                <PillarBar label="Resilience" value={data.pillarAverages.resilience} />
                <PillarBar label="Empathy" value={data.pillarAverages.empathy} />
                <PillarBar label="Anticipation" value={data.pillarAverages.anticipation} />
                <PillarBar label="Recognition" value={data.pillarAverages.recognition} />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          Active since{" "}
          {new Date(data.activatedAt).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          {" · "}
          Powered by IntuitiveStay
        </p>

      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit and push**

```bash
cd /c/Users/miste/intuitivestay/intuitivestay
git add "apps/portal-web/src/routes/passport.\$staffProfileId.tsx"
git commit -m "feat: add public staff passport page for employer-facing view"
git push origin main
```

---

## Self-Review

**Spec coverage:**
- ✅ DB: `activatedAt` + `stripePaymentIntentId` on `staff_profiles` — Task 1
- ✅ Migration `0015_staff_activation.sql` — Task 1
- ✅ `verifyStaffEmail` returns `staffProfileId` — Task 2
- ✅ `staff-verify` redirects to `/staff-profile/$staffProfileId` — Task 4
- ✅ `getStaffProfile` public procedure — Task 2
- ✅ `createStaffActivationCheckout` — Task 2
- ✅ Stripe webhook handles `staffProfileId` in `checkout.session.completed` — Task 3
- ✅ Staff profile page with blur + payment wall — Task 5
- ✅ `?activated=true` banner — Task 5
- ✅ Shareable link visible only when activated — Task 5
- ✅ Refetch after 3s when `justPaid` but not yet activated — Task 5
- ✅ Public passport page — Task 6
- ✅ Passport shows "not yet activated" when `activatedAt` is null — Task 6
- ✅ Email not exposed in `getStaffProfile` response — Task 2 (name, propertyName, stats only)

**Placeholder scan:** None.

**Type consistency:**
- `getStaffProfile` returns `{ activatedAt: Date | null, ... }` — used as `data.activatedAt` with `!!` truthiness check throughout. Matches.
- `createStaffActivationCheckout` returns `{ checkoutUrl: string }` — used as `result.checkoutUrl`. Matches.
- `verifyStaffEmail` returns `{ ok, name, propertyId, staffProfileId }` — `staff-verify` uses `result.staffProfileId`. Matches.
- `PillarBar` accepts `{ label: string, value: number }` — called with `data.pillarAverages.resilience` etc. Matches.
- Route param is `$staffProfileId` — `Route.useParams()` destructures `staffProfileId`. Matches in both pages.

**Phase boundary:** Phase 3 ends here. Staff can register, verify, pay, and view/share their passport. Phase 4 adds manager commendations (written references from property owners that appear on the passport). Phase 2 data (feedback attributions) will start populating their stats from the moment staff are verified and selected in the feedback form.

**Run this SQL in Supabase after deploying:**
```sql
ALTER TABLE "staff_profiles" ADD COLUMN IF NOT EXISTS "activated_at" timestamp;
ALTER TABLE "staff_profiles" ADD COLUMN IF NOT EXISTS "stripe_payment_intent_id" text;
```
