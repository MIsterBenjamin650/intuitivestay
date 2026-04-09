# Service Signature Phase 5 — Staff Profile Merge + Magic Link Login + Email Notifications

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the staff profile and passport views, add a magic-link "recover my profile" page, and send staff notification emails when their record is updated.

**Architecture:** Three new email functions go in `email.ts`. Two router changes (staff + feedback) trigger those emails fire-and-forget. The staff profile page is redesigned to mirror the passport layout while keeping its blur/payment wall and shareable link. A new `/staff-login` page lets staff recover their profile URL by email.

**Tech Stack:** TanStack Start (SSR, React), tRPC, Drizzle ORM + PostgreSQL (Supabase), Resend, monorepo (`apps/portal-web`, `packages/api`, `packages/db`)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `packages/api/src/lib/email.ts` | Add 3 new email functions |
| Modify | `packages/api/src/routers/staff.ts` | Add `requestProfileLink` procedure; update `addCommendation` to send notification email |
| Modify | `packages/api/src/routers/feedback.ts` | Update `submitFeedback` to send nomination email after insert |
| Modify | `apps/portal-web/src/routes/staff-profile.$staffProfileId.tsx` | Redesign stats view to match passport; add commendations query; add login link |
| Create | `apps/portal-web/src/routes/staff-login.tsx` | New magic-link recovery page |

---

## Task 1: Add three email functions to `email.ts`

**Files:**
- Modify: `packages/api/src/lib/email.ts`

### Context

`email.ts` already exports `sendStaffVerificationEmail`. New functions follow the same Resend pattern. FROM is already defined as `"IntuitiveStay <noreply@intuitivestay.com>"`. `env.PUBLIC_PORTAL_URL` is available via the existing import.

- [ ] **Step 1: Append three functions to `packages/api/src/lib/email.ts`**

Add after the last export in the file:

```typescript
export async function sendStaffNominationEmail(
  staffEmail: string,
  staffName: string,
  propertyName: string,
  staffProfileId: string,
) {
  const profileUrl = `${env.PUBLIC_PORTAL_URL}/staff-profile/${staffProfileId}`

  await resend.emails.send({
    from: FROM,
    to: staffEmail,
    subject: `You've received a guest nomination — ${propertyName}`,
    html: `<h1>Hi ${staffName},</h1>
<p>A guest just nominated you on IntuitiveStay at <strong>${propertyName}</strong>.</p>
<p>View your updated Service Signature to see how your score is growing:</p>
<p><a href="${profileUrl}" style="display:inline-block;background:#f97316;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">View My Profile →</a></p>
<p style="font-size:12px;color:#64748b">Keep delivering exceptional service — every nomination counts.</p>`,
  })
}

export async function sendStaffCommendationEmail(
  staffEmail: string,
  staffName: string,
  authorName: string,
  propertyName: string,
  staffProfileId: string,
) {
  const profileUrl = `${env.PUBLIC_PORTAL_URL}/staff-profile/${staffProfileId}`

  await resend.emails.send({
    from: FROM,
    to: staffEmail,
    subject: `New commendation from ${authorName} — ${propertyName}`,
    html: `<h1>Hi ${staffName},</h1>
<p>Your manager <strong>${authorName}</strong> at <strong>${propertyName}</strong> has written a commendation on your Service Signature.</p>
<p>Log in to your profile to read it:</p>
<p><a href="${profileUrl}" style="display:inline-block;background:#f97316;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">View My Profile →</a></p>`,
  })
}

export async function sendProfileLinkEmail(
  staffEmail: string,
  profiles: Array<{ name: string; propertyName: string; staffProfileId: string }>,
) {
  const profileLinks = profiles
    .map(
      (p) =>
        `<div style="margin:12px 0;padding:12px;border:1px solid #e2e8f0;border-radius:8px">
  <p style="margin:0 0 8px;font-weight:bold">${p.name} · ${p.propertyName}</p>
  <a href="${env.PUBLIC_PORTAL_URL}/staff-profile/${p.staffProfileId}" style="display:inline-block;background:#f97316;color:white;padding:8px 20px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px">View Profile →</a>
</div>`,
    )
    .join("")

  await resend.emails.send({
    from: FROM,
    to: staffEmail,
    subject: "Your Service Signature profile link",
    html: `<h1>Your Service Signature profile</h1>
<p>Here ${profiles.length === 1 ? "is" : "are"} your Service Signature profile ${profiles.length === 1 ? "link" : "links"}:</p>
${profileLinks}
<p style="font-size:12px;color:#64748b;margin-top:24px">Bookmark this link so you can access your profile at any time.</p>`,
  })
}
```

- [ ] **Step 2: Commit**

```bash
cd C:\Users\miste\intuitivestay\intuitivestay
git add packages/api/src/lib/email.ts
git commit -m "feat: add staff nomination, commendation, and profile link email functions"
```

---

## Task 2: Add `requestProfileLink` procedure and commendation email to `staff.ts`

**Files:**
- Modify: `packages/api/src/routers/staff.ts`

### Context

`staff.ts` currently imports `sendStaffVerificationEmail` from `../lib/email`. We need to also import the two new notification functions. `requestProfileLink` is a `publicProcedure` that takes `{ email: string }` and always returns `{ ok: true }` — never leaks whether a profile exists. It queries `staffProfiles` for all rows matching the email where `emailVerifiedAt IS NOT NULL` AND `removedAt IS NULL`, then calls `sendProfileLinkEmail` fire-and-forget. The `addCommendation` mutation already exists — we only need to add a fire-and-forget email call after the insert.

- [ ] **Step 1: Update the import line for email functions in `packages/api/src/routers/staff.ts`**

Find (line 9):
```typescript
import { sendStaffVerificationEmail } from "../lib/email"
```

Replace with:
```typescript
import { sendProfileLinkEmail, sendStaffCommendationEmail, sendStaffVerificationEmail } from "../lib/email"
```

- [ ] **Step 2: Add `requestProfileLink` procedure to the router**

Add it inside `staffRouter`, after the `getCommendations` procedure (after the closing `}),` of `getCommendations`):

```typescript
  /**
   * Public — staff enter their email to receive profile link(s).
   * Always returns { ok: true } — never reveals if an email has a profile.
   */
  requestProfileLink: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const profiles = await db
        .select({
          id: staffProfiles.id,
          name: staffProfiles.name,
          propertyId: staffProfiles.propertyId,
        })
        .from(staffProfiles)
        .where(
          and(
            eq(staffProfiles.email, input.email.toLowerCase()),
            isNotNull(staffProfiles.emailVerifiedAt),
            isNull(staffProfiles.removedAt),
          ),
        )

      if (profiles.length > 0) {
        const profilesWithProperty = await Promise.all(
          profiles.map(async (p) => {
            const property = await db.query.properties.findFirst({
              where: eq(properties.id, p.propertyId),
            })
            return {
              name: p.name,
              propertyName: property?.name ?? "Unknown Property",
              staffProfileId: p.id,
            }
          }),
        )

        sendProfileLinkEmail(input.email.toLowerCase(), profilesWithProperty).catch(console.error)
      }

      return { ok: true }
    }),
```

- [ ] **Step 3: Add fire-and-forget commendation email to `addCommendation`**

In the `addCommendation` procedure, find the return statement at the bottom of the mutation:
```typescript
      return { ok: true }
```

Add the email send just before it:
```typescript
      // Fire-and-forget — don't block response if email fails
      sendStaffCommendationEmail(
        staff.email,
        staff.name,
        ctx.session.user.name ?? "Property Manager",
        property.name,
        input.staffProfileId,
      ).catch(console.error)

      return { ok: true }
```

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/routers/staff.ts
git commit -m "feat: add requestProfileLink procedure and commendation notification email"
```

---

## Task 3: Add nomination email to `submitFeedback` in `feedback.ts`

**Files:**
- Modify: `packages/api/src/routers/feedback.ts`

### Context

`feedback.ts` currently imports `sendAlertEmail, sendVelocityAlertEmail` from `../lib/email`. After the feedback row is inserted, if `resolvedStaffProfileId` is not null, we look up the staff member and send a nomination email fire-and-forget. The staff profile was already validated above the insert (verified, not removed, belongs to property) — we just need the email and name for the notification.

- [ ] **Step 1: Add `sendStaffNominationEmail` to the import in `packages/api/src/routers/feedback.ts`**

Find (line 8):
```typescript
import { sendAlertEmail, sendVelocityAlertEmail } from "../lib/email"
```

Replace with:
```typescript
import { sendAlertEmail, sendStaffNominationEmail, sendVelocityAlertEmail } from "../lib/email"
```

- [ ] **Step 2: Add nomination email after the feedback insert block**

In `submitFeedback`, find the block that starts `// Save fingerprint to prevent duplicate submissions` (it comes after the `db.insert(feedback).values(...)` call). Add this just before that fingerprint block:

```typescript
      // Notify nominated staff member — fire-and-forget
      if (resolvedStaffProfileId) {
        const nominatedStaff = await db.query.staffProfiles.findFirst({
          where: eq(staffProfiles.id, resolvedStaffProfileId),
        })
        if (nominatedStaff) {
          const nominatedProperty = await db.query.properties.findFirst({
            where: eq(properties.id, qrCode.propertyId),
          })
          sendStaffNominationEmail(
            nominatedStaff.email,
            nominatedStaff.name,
            nominatedProperty?.name ?? "your property",
            resolvedStaffProfileId,
          ).catch(console.error)
        }
      }
```

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/routers/feedback.ts
git commit -m "feat: send nomination email to staff when guest feedback is attributed to them"
```

---

## Task 4: Redesign staff profile page to match passport

**Files:**
- Modify: `apps/portal-web/src/routes/staff-profile.$staffProfileId.tsx`

### Context

The current page already has `PillarBar`, the blur overlay + payment wall, the shareable link card, and the Stripe checkout redirect logic. The redesign:
- Adds the same header layout as passport (label, shield icon, name, property, "Verified" badge when `emailVerifiedAt`)
- Adds a `getCommendations` query (same as passport)
- Renders commendations section below the stats card (only when there are commendations)
- Adds a small "Lost your profile link?" text link pointing to `/staff-login`
- Keeps payment success banner, blur overlay, payment wall, shareable link card

The passport is at `apps/portal-web/src/routes/passport.$staffProfileId.tsx` for reference — the header and commendations section are copied from there.

`getStaffProfile` already returns `activatedAt`, `emailVerifiedAt` is NOT in the return — but we need to show "Verified" badge. Check: the passport shows this badge always (because passport only renders for verified staff — `emailVerifiedAt` is required for passport to exist). The staff profile page doesn't need a Verified badge since it's the private view. Keep it consistent with passport by adding the badge always if data is returned (all registered staff with emailVerifiedAt can view their profile — unverified staff who landed on the wrong URL would see a different error).

Actually looking at the spec: "Same header: ... 'Verified' badge (when emailVerifiedAt)". But `getStaffProfile` doesn't return `emailVerifiedAt`. We need to add it to the router response. Check `getStaffProfile` in `staff.ts` — it currently returns:
```typescript
return {
  id: staff.id,
  name: staff.name,
  propertyName: property?.name ?? "Unknown Property",
  createdAt: staff.createdAt,
  activatedAt: staff.activatedAt ?? null,
  nominations: stats?.nominations ?? 0,
  avgGcs: Number(stats?.avgGcs ?? 0),
  pillarAverages: { ... },
}
```

We need to add `emailVerifiedAt: staff.emailVerifiedAt ?? null` to this return. Do that in this task.

- [ ] **Step 1: Add `emailVerifiedAt` to `getStaffProfile` return in `packages/api/src/routers/staff.ts`**

Find in `getStaffProfile`:
```typescript
      return {
        id: staff.id,
        name: staff.name,
        propertyName: property?.name ?? "Unknown Property",
        createdAt: staff.createdAt,
        activatedAt: staff.activatedAt ?? null,
        nominations: stats?.nominations ?? 0,
```

Replace with:
```typescript
      return {
        id: staff.id,
        name: staff.name,
        propertyName: property?.name ?? "Unknown Property",
        createdAt: staff.createdAt,
        activatedAt: staff.activatedAt ?? null,
        emailVerifiedAt: staff.emailVerifiedAt ?? null,
        nominations: stats?.nominations ?? 0,
```

- [ ] **Step 2: Rewrite `apps/portal-web/src/routes/staff-profile.$staffProfileId.tsx`**

Replace the entire file:

```typescript
// apps/portal-web/src/routes/staff-profile.$staffProfileId.tsx
import { cn } from "@intuitive-stay/ui/lib/utils"
import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
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

  const { data, isLoading, isError, error, refetch } = useQuery(
    trpc.staff.getStaffProfile.queryOptions({ staffProfileId }),
  )

  const { data: commendations } = useQuery(
    trpc.staff.getCommendations.queryOptions({ staffProfileId }),
  )

  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [copied, setCopied] = useState(false)

  const isActivated = !!data?.activatedAt
  const tierScore = data ? Math.round(data.avgGcs * 10) : 0
  const passportUrl = `${window.location.origin}/passport/${staffProfileId}`

  // If user just returned from Stripe but webhook hasn't fired yet,
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
          <ShieldCheckIcon className="mx-auto size-8 text-muted-foreground/40" />
          <p className="font-semibold">Profile not found</p>
          <p className="text-sm text-muted-foreground">
            {error?.message ?? "This profile does not exist or the link is incorrect."}
          </p>
          <Link
            to="/staff-login"
            className="text-xs text-orange-500 hover:text-orange-600 underline underline-offset-2"
          >
            Recover your profile link →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-sm space-y-6">

        {/* Payment success banner */}
        {justPaid && (
          <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 text-center">
            🎉 Payment successful! Your Service Signature is now unlocked.
          </div>
        )}

        {/* Header — matches passport */}
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
          {data.emailVerifiedAt && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
              <span className="size-1.5 rounded-full bg-green-500" />
              Verified
            </div>
          )}
        </div>

        {/* Stats card — blurred when not activated */}
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

        {/* Commendations — only shown when activated and there are entries */}
        {isActivated && commendations && commendations.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground text-center">
              Manager Commendations
            </p>
            {commendations.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border bg-white shadow-sm p-4 space-y-2"
              >
                <p className="text-sm text-foreground leading-relaxed">"{c.body}"</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium">{c.authorName} · {c.propertyName}</span>
                  <span>
                    {new Date(c.createdAt).toLocaleDateString("en-GB", {
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

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

        {/* Footer — login recovery link */}
        <p className="text-center text-xs text-muted-foreground">
          Lost your profile link?{" "}
          <Link
            to="/staff-login"
            className="text-orange-500 hover:text-orange-600 underline underline-offset-2"
          >
            Send it to your email
          </Link>
        </p>

      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/routers/staff.ts apps/portal-web/src/routes/staff-profile.$staffProfileId.tsx
git commit -m "feat: redesign staff profile page to match passport view and add commendations"
```

---

## Task 5: Create `/staff-login` magic link page

**Files:**
- Create: `apps/portal-web/src/routes/staff-login.tsx`

### Context

New public page. No authentication. Staff enter their email, click submit, tRPC calls `staff.requestProfileLink`. The page always shows the same success message regardless of outcome — never confirms whether the email matched a profile. The form should not be re-submittable after success (show the success state instead).

- [ ] **Step 1: Create `apps/portal-web/src/routes/staff-login.tsx`**

```typescript
// apps/portal-web/src/routes/staff-login.tsx
import { useMutation } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { ShieldCheckIcon } from "lucide-react"
import { useState } from "react"

import { useTRPC } from "@/utils/trpc"

export const Route = createFileRoute("/staff-login")({
  component: StaffLoginPage,
})

function StaffLoginPage() {
  const trpc = useTRPC()
  const [email, setEmail] = useState("")

  const mutation = useMutation(trpc.staff.requestProfileLink.mutationOptions())

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    mutation.mutate({ email: email.trim() })
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="mx-auto max-w-sm w-full space-y-6">

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="rounded-full bg-orange-100 p-3">
              <ShieldCheckIcon className="size-8 text-orange-500" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Find your profile</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Enter the email address you used to register. We'll send you a link to your Service Signature profile.
            </p>
          </div>
        </div>

        {/* Form / Success state */}
        {mutation.isSuccess ? (
          <div className="rounded-xl border bg-white shadow-sm p-6 text-center space-y-2">
            <p className="font-semibold text-sm">Check your inbox</p>
            <p className="text-sm text-muted-foreground">
              If we found a profile linked to this email, we've sent you a link.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-xl border bg-white shadow-sm p-6 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-border bg-gray-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              type="submit"
              disabled={mutation.isPending || !email.trim()}
              className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60 transition-colors"
            >
              {mutation.isPending ? "Sending…" : "Send my profile link"}
            </button>
            {mutation.isError && (
              <p className="text-xs text-red-600 text-center">
                Something went wrong. Please try again.
              </p>
            )}
          </form>
        )}

      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/portal-web/src/routes/staff-login.tsx
git commit -m "feat: add staff-login magic link page for profile recovery"
```

---

## Self-Review

### Spec coverage

| Requirement | Task |
|-------------|------|
| Staff profile page matches passport header | Task 4 |
| Staff profile page matches passport stats card | Task 4 |
| Staff profile page adds commendations | Task 4 |
| Blur/payment wall kept | Task 4 |
| Shareable link kept | Task 4 |
| Payment success banner kept | Task 4 |
| "Lost your link?" login link on profile page | Task 4 |
| `/staff-login` page | Task 5 |
| `requestProfileLink` public procedure | Task 2 |
| Always returns `{ ok: true }` — no info leakage | Task 2 |
| Sends profile link email fire-and-forget | Task 2 |
| `sendProfileLinkEmail` email function | Task 1 |
| Nomination email on feedback attribution | Task 3 |
| `sendStaffNominationEmail` email function | Task 1 |
| Commendation email on `addCommendation` | Task 2 |
| `sendStaffCommendationEmail` email function | Task 1 |
| All emails fire-and-forget | Tasks 2, 3 |
| No DB changes | ✅ no migrations |
| Profile URL: `/staff-profile/$staffProfileId` | Tasks 1, 2, 3 |
| `emailVerifiedAt` added to `getStaffProfile` return | Task 4 Step 1 |

### No placeholder check

All code blocks are complete. No TBDs, no "implement later", no "similar to Task N".

### Type consistency

- `sendStaffNominationEmail(email, name, propertyName, staffProfileId)` — used the same signature in Task 1 (definition) and Task 3 (call site)
- `sendStaffCommendationEmail(email, name, authorName, propertyName, staffProfileId)` — used the same signature in Task 1 (definition) and Task 2 (call site)
- `sendProfileLinkEmail(email, profiles[])` — `profiles` array shape `{ name, propertyName, staffProfileId }` consistent between Task 1 and Task 2
- `getStaffProfile` now returns `emailVerifiedAt` — consumed in Task 4 as `data.emailVerifiedAt`
