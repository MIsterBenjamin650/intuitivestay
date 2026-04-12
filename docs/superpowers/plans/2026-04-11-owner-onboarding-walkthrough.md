# Owner Onboarding Walkthrough Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a dismissible multi-step walkthrough modal to property owners the first time they access the dashboard, guiding them through QR code placement, GCS feedback, Red Alerts, and daily AI summaries.

**Architecture:** A nullable `onboarding_completed_at` timestamp is added to the `organisations` table. `getUser` returns `needsOnboarding: true` when it is null. The `_portal.tsx` layout renders a fixed-overlay `OnboardingModal` when that flag is true for non-admin, non-staff owners. Completing or dismissing the modal fires a tRPC mutation that sets the timestamp, permanently hiding the modal.

**Tech Stack:** Drizzle ORM (schema + migration), tRPC `protectedProcedure` mutation, React + `@tanstack/react-query` `useMutation`, Tailwind CSS, Lucide React icons.

---

## File Structure

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `packages/db/src/schema/organisations.ts` | Add `onboardingCompletedAt` column |
| Generate | `packages/db/drizzle/0023_onboarding.sql` | Auto-generated migration — verify but don't edit |
| Modify | `packages/api/src/routers/properties.ts` | Add `markOnboardingComplete` mutation |
| Modify | `apps/portal-web/src/functions/get-user.ts` | Return `needsOnboarding` flag |
| Create | `apps/portal-web/src/components/onboarding-modal.tsx` | 6-step walkthrough overlay |
| Modify | `apps/portal-web/src/routes/_portal.tsx` | Mount `<OnboardingModal />` |

---

### Task 1: Add `onboardingCompletedAt` to organisations schema

**Files:**
- Modify: `packages/db/src/schema/organisations.ts`

- [ ] **Step 1: Open the file and add the new column**

The current file ends at `updatedAt`. Add one line — `onboardingCompletedAt` — between `createdAt` and `updatedAt`:

```typescript
import { relations } from "drizzle-orm"
import { pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { user } from "./auth"

export const organisations = pgTable("organisations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan").notNull().default("member"),
  subscriptionStatus: text("subscription_status").notNull().default("none"),
  trialEndsAt: timestamp("trial_ends_at"),
  subscriptionEndsAt: timestamp("subscription_ends_at"),
  stripeCustomerId: text("stripe_customer_id"),
  ownerId: text("owner_id").references(() => user.id, { onDelete: "set null" }),
  onboardingCompletedAt: timestamp("onboarding_completed_at"),
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
cd /path/to/repo
pnpm db:generate
```

Expected: Drizzle Kit creates a file like `packages/db/drizzle/0023_onboarding.sql` containing:

```sql
ALTER TABLE "organisations" ADD COLUMN "onboarding_completed_at" timestamp;
```

Open the generated file and confirm it contains exactly that line (and nothing destructive). If it contains extra statements, stop and investigate before continuing.

- [ ] **Step 3: Commit schema + migration**

```bash
git add packages/db/src/schema/organisations.ts
git add packages/db/drizzle/  # picks up the new migration file
git commit -m "feat: add onboarding_completed_at to organisations schema"
```

---

### Task 2: Add `markOnboardingComplete` tRPC mutation

**Files:**
- Modify: `packages/api/src/routers/properties.ts`

Context: `properties.ts` already imports `organisations` from the DB schema and uses `eq` from drizzle-orm. No new imports are needed. Add the mutation just before the closing `})` of the `router({...})` call — which is the last line of the router export.

- [ ] **Step 1: Find the end of the router definition**

Search for the last `}),` before `export const propertiesRouter = router({` closes. The mutation goes inside `router({...})`, after the last existing procedure.

- [ ] **Step 2: Add the mutation**

Insert this procedure as the last entry in the `router({...})` object (before the closing `})` of `router`):

```typescript
  /**
   * Protected — marks the owner's organisation onboarding as complete.
   * Called when the owner dismisses or finishes the onboarding walkthrough.
   */
  markOnboardingComplete: protectedProcedure.mutation(async ({ ctx }) => {
    const org = await db.query.organisations.findFirst({
      where: eq(organisations.ownerId, ctx.session.user.id),
      columns: { id: true },
    })
    if (!org) throw new TRPCError({ code: "FORBIDDEN" })

    await db
      .update(organisations)
      .set({ onboardingCompletedAt: new Date() })
      .where(eq(organisations.id, org.id))

    return { ok: true }
  }),
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm --filter @intuitive-stay/portal-server exec tsc --noEmit 2>&1 | grep "markOnboarding"
```

Expected: no output (no errors referencing markOnboarding).

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/routers/properties.ts
git commit -m "feat: add markOnboardingComplete tRPC mutation"
```

---

### Task 3: Return `needsOnboarding` from `getUser`

**Files:**
- Modify: `apps/portal-web/src/functions/get-user.ts`

- [ ] **Step 1: Update the org query to select `onboardingCompletedAt`**

Find this block (around line 25):

```typescript
    const org = await db.query.organisations.findFirst({
      where: eq(organisations.ownerId, userId),
      columns: { id: true, subscriptionStatus: true, plan: true },
    })
```

Replace with:

```typescript
    const org = await db.query.organisations.findFirst({
      where: eq(organisations.ownerId, userId),
      columns: { id: true, subscriptionStatus: true, plan: true, onboardingCompletedAt: true },
    })
```

- [ ] **Step 2: Add `needsOnboarding` to the owner return**

Find the `if (org) {` block's return statement. It currently ends with:

```typescript
        subscriptionStatus: org.subscriptionStatus ?? "none",
        plan: org.plan ?? null,
      }
```

Replace with:

```typescript
        subscriptionStatus: org.subscriptionStatus ?? "none",
        plan: org.plan ?? null,
        needsOnboarding: org.onboardingCompletedAt === null,
      }
```

- [ ] **Step 3: Verify the file looks correct**

The full `if (org)` block should now be:

```typescript
    if (org) {
      const orgProperties = await db
        .select({ id: properties.id, name: properties.name })
        .from(properties)
        .where(eq(properties.organisationId, org.id))

      return {
        ...context.session,
        user: {
          ...user,
          properties: orgProperties,
        },
        isAdmin: user.email.toLowerCase().trim() === env.ADMIN_EMAIL.toLowerCase().trim(),
        isStaff: false,
        staffPropertyId: null,
        staffPermissions: null,
        subscriptionStatus: org.subscriptionStatus ?? "none",
        plan: org.plan ?? null,
        needsOnboarding: org.onboardingCompletedAt === null,
      }
    }
```

Staff members and unregistered users do **not** get `needsOnboarding` — it only exists in the owner path. The modal component will only be rendered when `needsOnboarding === true`, so the undefined case on other return paths is safe.

- [ ] **Step 4: Commit**

```bash
git add apps/portal-web/src/functions/get-user.ts
git commit -m "feat: include needsOnboarding flag in getUser for org owners"
```

---

### Task 4: Create the OnboardingModal component

**Files:**
- Create: `apps/portal-web/src/components/onboarding-modal.tsx`

- [ ] **Step 1: Create the file with the full component**

```typescript
import { useMutation } from "@tanstack/react-query"
import {
  BarChart3,
  BellRing,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  PartyPopper,
  QrCode,
  Sparkles,
  X,
} from "lucide-react"
import { useState } from "react"

import { Button } from "@intuitive-stay/ui/components/button"

import { useTRPC } from "@/utils/trpc"

const STEPS = [
  {
    icon: PartyPopper,
    title: "Welcome to IntuitiveStay!",
    description:
      "Your property dashboard is live. Let us show you around in 60 seconds so you can start collecting real guest feedback from day one.",
  },
  {
    icon: QrCode,
    title: "Place your QR code",
    description:
      "Your branded QR code is ready to download from the QR Code tab in your property page. Print it and display it where guests can easily scan — at reception, on tables, or in rooms. Every scan brings you closer to understanding your guests.",
  },
  {
    icon: BarChart3,
    title: "Track your Guest Connection Score",
    description:
      "Every scan reveals how guests feel across four pillars: Resilience, Empathy, Anticipation and Recognition. Your GCS is the overall score out of 10 — aim for 8 or above consistently to know your service is landing.",
  },
  {
    icon: BellRing,
    title: "Act fast with Red Alerts",
    description:
      "When a guest scores 5 or below, a Red Alert appears in your dashboard and you receive an email notification instantly. Tap the alert to read their vent text and take action before they leave a public review.",
  },
  {
    icon: Sparkles,
    title: "Your daily AI summary",
    description:
      "Every morning you'll receive an AI-generated summary of the previous day's feedback with specific action points for each service pillar. Start each day knowing exactly where to focus your team.",
  },
  {
    icon: CheckCircle2,
    title: "You're ready to go!",
    description:
      "Head to your property dashboard to download your QR code and start collecting guest feedback. Your first score will appear within minutes of your first scan.",
  },
]

export function OnboardingModal() {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(true)
  const trpc = useTRPC()

  const { mutate: markComplete, isPending } = useMutation(
    trpc.properties.markOnboardingComplete.mutationOptions(),
  )

  function dismiss() {
    markComplete(undefined, {
      onSettled: () => setVisible(false),
    })
  }

  if (!visible) return null

  const current = STEPS[step]!
  const isFirst = step === 0
  const isLast = step === STEPS.length - 1
  const Icon = current.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={dismiss}
        aria-hidden="true"
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl">

        {/* Orange header band */}
        <div className="bg-orange-500 px-6 py-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <span className="text-white font-black text-[12px] tracking-tight">IS</span>
              </div>
              <span className="text-white font-bold text-base">IntuitiveStay</span>
            </div>
            <button
              onClick={dismiss}
              disabled={isPending}
              className="text-white/70 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Step dots */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step
                    ? "w-6 bg-white"
                    : i < step
                    ? "w-3 bg-white/60"
                    : "w-3 bg-white/30"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="bg-white px-8 py-8">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center">
              <Icon className="h-8 w-8 text-orange-500" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-gray-900 tracking-tight mb-2">
                {current.title}
              </h2>
              <p className="text-sm text-gray-500 leading-relaxed max-w-sm mx-auto">
                {current.description}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#fef9f5] border-t border-orange-100 px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => setStep((s) => s - 1)}
            disabled={isFirst}
            className="flex items-center gap-1 text-sm font-medium text-gray-400 hover:text-gray-600 disabled:opacity-0 disabled:pointer-events-none transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          <p className="text-xs text-gray-400">
            {step + 1} of {STEPS.length}
          </p>

          {isLast ? (
            <Button
              onClick={dismiss}
              disabled={isPending}
              className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-5"
              size="sm"
            >
              {isPending ? "Saving…" : "Get Started →"}
            </Button>
          ) : (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="flex items-center gap-1 text-sm font-semibold text-orange-600 hover:text-orange-700 transition-colors"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify Lucide icons exist**

Run a quick check — all these icons are standard Lucide React:

```bash
grep -r "from \"lucide-react\"" apps/portal-web/src/routes/_portal.index.tsx
```

The codebase already imports from `lucide-react`. All icons used (`PartyPopper`, `QrCode`, `BarChart3`, `BellRing`, `Sparkles`, `CheckCircle2`, `ChevronLeft`, `ChevronRight`, `X`) are included in Lucide React v0.400+.

- [ ] **Step 3: Commit**

```bash
git add apps/portal-web/src/components/onboarding-modal.tsx
git commit -m "feat: add OnboardingModal component with 6-step walkthrough"
```

---

### Task 5: Mount OnboardingModal in the portal layout

**Files:**
- Modify: `apps/portal-web/src/routes/_portal.tsx`

- [ ] **Step 1: Add the import at the top of the file**

After the existing imports, add:

```typescript
import { OnboardingModal } from "@/components/onboarding-modal"
```

- [ ] **Step 2: Read `needsOnboarding` from session in `RouteComponent`**

In `RouteComponent`, the session is already available via `Route.useRouteContext()`. Add the `needsOnboarding` read alongside the existing `isStaff` read:

```typescript
function RouteComponent() {
  const { session } = Route.useRouteContext();
  const sessionProperties = resolveSessionProperties(session);
  const isStaff = (session as { isStaff?: boolean } | null)?.isStaff === true
  const isAdmin = (session as { isAdmin?: boolean } | null)?.isAdmin === true
  const needsOnboarding =
    !isStaff &&
    !isAdmin &&
    (session as { needsOnboarding?: boolean } | null)?.needsOnboarding === true
  const staffPermissions = (session as {
    staffPermissions?: {
      viewFeedback: boolean
      viewAnalytics: boolean
      viewAiSummary: boolean
      viewWordCloud: boolean
      viewStaffCloud: boolean
      viewAlerts: boolean
    } | null
  } | null)?.staffPermissions ?? null
```

Note: `isAdmin` was already extracted from session in the JSX (`(session as {...})?.isAdmin`). Extract it as a variable here so we can reuse it without repeating the cast.

- [ ] **Step 3: Render `<OnboardingModal />` inside the root div**

The `RouteComponent` JSX starts with:

```tsx
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-white via-[#fdf8f3] to-[#fef0d9] dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950">
```

Add `{needsOnboarding && <OnboardingModal />}` as the **first child** of that div (before `<SidebarProvider>`):

```tsx
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-white via-[#fdf8f3] to-[#fef0d9] dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950">
      {needsOnboarding && <OnboardingModal />}
      <SidebarProvider>
```

- [ ] **Step 4: Update the `isAdmin` reference in `<AppSidebar>`**

The existing JSX passes `isAdmin` inline:

```tsx
            isAdmin={(session as { isAdmin?: boolean } | null)?.isAdmin === true}
```

Replace with the variable extracted in Step 2:

```tsx
            isAdmin={isAdmin}
```

- [ ] **Step 5: Verify the full updated `RouteComponent` looks correct**

```typescript
function RouteComponent() {
  const { session } = Route.useRouteContext();
  const sessionProperties = resolveSessionProperties(session);
  const isStaff = (session as { isStaff?: boolean } | null)?.isStaff === true
  const isAdmin = (session as { isAdmin?: boolean } | null)?.isAdmin === true
  const needsOnboarding =
    !isStaff &&
    !isAdmin &&
    (session as { needsOnboarding?: boolean } | null)?.needsOnboarding === true
  const staffPermissions = (session as {
    staffPermissions?: {
      viewFeedback: boolean
      viewAnalytics: boolean
      viewAiSummary: boolean
      viewWordCloud: boolean
      viewStaffCloud: boolean
      viewAlerts: boolean
    } | null
  } | null)?.staffPermissions ?? null

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-white via-[#fdf8f3] to-[#fef0d9] dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950">
      {needsOnboarding && <OnboardingModal />}
      <SidebarProvider>
        <ActivePropertyProvider initialProperties={sessionProperties}>
          <AppSidebar
            isAdmin={isAdmin}
            plan={(session as { plan?: string | null } | null)?.plan ?? null}
            subscriptionStatus={(session as { subscriptionStatus?: string } | null)?.subscriptionStatus ?? "none"}
            isStaff={isStaff}
            staffPermissions={staffPermissions}
            staffPropertyId={(session as { staffPropertyId?: string | null } | null)?.staffPropertyId ?? null}
          />
          <SidebarInset className="overflow-x-hidden bg-transparent min-h-screen">
            <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center bg-transparent">
              <div className="flex w-full items-center justify-between gap-3 px-3 md:px-4">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <SidebarTrigger className="-ml-1" />
                  <div className="relative w-full max-w-sm md:max-w-md">
                    <SearchIcon size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search"
                      className="h-9 pl-9"
                      aria-label="Search"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2">
                  <TopbarThemeSwitcher />
                  <TopbarNotifications />
                  <TopbarUserMenu />
                </div>
              </div>
            </header>
            <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden pt-3">
              <Outlet />
            </div>
          </SidebarInset>
        </ActivePropertyProvider>
      </SidebarProvider>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/portal-web/src/routes/_portal.tsx
git commit -m "feat: mount OnboardingModal in portal layout for first-time owners"
```

---

### Task 6: Apply migration to production and push

- [ ] **Step 1: Apply migration in Supabase**

Run this SQL in the Supabase SQL editor (Project → SQL Editor):

```sql
ALTER TABLE "organisations" ADD COLUMN IF NOT EXISTS "onboarding_completed_at" timestamp;
```

Expected: "Success. No rows returned."

- [ ] **Step 2: Push all commits**

```bash
git push
```

Railway will redeploy both portal-web and portal-server automatically.

- [ ] **Step 3: Verify in production**

Log in as a property owner who has never completed onboarding. The modal should appear on top of the dashboard immediately after login. Step through all 6 slides, click "Get Started" on the final step, and confirm:
- Modal closes
- Refreshing the page does NOT show the modal again (onboardingCompletedAt is now set)

---

## Self-Review

**Spec coverage:**
- ✅ First-login detection — via nullable `onboardingCompletedAt`
- ✅ Multi-step walkthrough — 6 steps covering QR, GCS, Alerts, AI summary
- ✅ Dismissible — X button and backdrop click both mark complete
- ✅ Permanent — stored in DB, survives page refresh, different browsers, Railway redeploys
- ✅ Owner-only — `needsOnboarding` only returned in the owner branch of `getUser`; `!isStaff && !isAdmin` guard in layout
- ✅ No PDF (user said "or walkthrough" — interactive is better; PDF can be added later)

**Placeholder scan:** None found. All code blocks are complete and runnable.

**Type consistency:**
- `onboardingCompletedAt` used in schema, query columns, and return value — consistent
- `needsOnboarding` passed through session → route context → component — consistent
- `markOnboardingComplete` matches between router definition and `trpc.properties.markOnboardingComplete` call in component — consistent
