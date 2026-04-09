# Service Signature Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow property owners to generate a staff invite link, and allow staff to self-register, creating a `staff_profiles` record that will power the Service Signature passport in later phases.

**Architecture:** Three new DB artefacts (staff_profiles table, staffInviteToken on properties, staffProfileId on feedback) are wired to a new `staffRouter` tRPC namespace. The owner-facing UI lives in a new portal page; the staff-facing registration lives at the public route `/staff-join/$inviteToken`.

**Tech Stack:** Drizzle ORM + PostgreSQL (Supabase), tRPC, TanStack Start SSR, React.

---

## File Map

| Action | Path |
|--------|------|
| **Create** | `packages/db/src/schema/staff-profiles.ts` |
| **Modify** | `packages/db/src/schema/properties.ts` — add `staffInviteToken` column |
| **Modify** | `packages/db/src/schema/feedback.ts` — add `staffProfileId` column |
| **Modify** | `packages/db/src/schema/index.ts` — export staff-profiles |
| **Create** | `packages/db/src/migrations/0013_service_signature_foundation.sql` |
| **Create** | `packages/api/src/routers/staff.ts` |
| **Modify** | `packages/api/src/routers/index.ts` — register staffRouter |
| **Create** | `apps/portal-web/src/routes/_portal.properties.$propertyId.service-signature.tsx` |
| **Modify** | `apps/portal-web/src/components/app-sidebar.tsx` — add nav item |
| **Create** | `apps/portal-web/src/routes/staff-join.$inviteToken.tsx` |

---

### Task 1: staff_profiles DB schema

**Files:**
- Create: `packages/db/src/schema/staff-profiles.ts`

- [ ] **Step 1: Create the schema file**

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
    /** The property this staff member is registered at. */
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("staff_profiles_property_id_idx").on(table.propertyId),
    /** Prevent the same email registering twice at the same property. */
    unique("staff_profiles_property_email_unique").on(table.propertyId, table.email),
  ],
)
```

- [ ] **Step 2: Export from schema index**

Open `packages/db/src/schema/index.ts` and add at the bottom:

```typescript
export * from "./staff-profiles"
```

- [ ] **Step 3: Add `staffInviteToken` to the properties schema**

Open `packages/db/src/schema/properties.ts`. Find the columns object inside `pgTable(...)` and add this line before `createdAt`:

```typescript
  /**
   * When set, staff can self-register at /staff-join/{staffInviteToken}.
   * Regenerating this value invalidates all previous invite links.
   */
  staffInviteToken: text("staff_invite_token").unique(),
```

- [ ] **Step 4: Add `staffProfileId` to the feedback schema**

Open `packages/db/src/schema/feedback.ts`. Add this import at the top (after the existing imports):

```typescript
import { staffProfiles } from "./staff-profiles"
```

Then add this column to the feedback table, before `submittedAt`:

```typescript
  /**
   * Set in Phase 2 when a guest picks a registered staff member from the
   * feedback form picker. Null for all legacy and unattributed submissions.
   */
  staffProfileId: text("staff_profile_id").references(() => staffProfiles.id, { onDelete: "set null" }),
```

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/staff-profiles.ts \
        packages/db/src/schema/index.ts \
        packages/db/src/schema/properties.ts \
        packages/db/src/schema/feedback.ts
git commit -m "feat: add staff_profiles schema and invite token columns"
```

---

### Task 2: Migration SQL

**Files:**
- Create: `packages/db/src/migrations/0013_service_signature_foundation.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- 0013_service_signature_foundation.sql
--
-- Service Signature Phase 1.
-- Adds staff self-registration infrastructure.
-- Phase 2 will link feedback rows to staff profiles.
-- Phase 3 adds the shareable passport and Stripe payment.

-- staff_profiles: one row per staff member per property.
CREATE TABLE IF NOT EXISTS "staff_profiles" (
  "id"          text PRIMARY KEY NOT NULL,
  "name"        text NOT NULL,
  "email"       text NOT NULL,
  "property_id" text NOT NULL
    REFERENCES "properties"("id") ON DELETE CASCADE,
  "created_at"  timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "staff_profiles_property_email_unique"
    UNIQUE ("property_id", "email")
);

CREATE INDEX IF NOT EXISTS "staff_profiles_property_id_idx"
  ON "staff_profiles" ("property_id");

-- Each property gets one active staff invite token.
-- Owners generate it; staff visit /staff-join/{token} to self-register.
ALTER TABLE "properties"
  ADD COLUMN IF NOT EXISTS "staff_invite_token" text UNIQUE;

-- Nullable FK from feedback to the staff member a guest nominated.
-- Always NULL until Phase 2 is deployed.
ALTER TABLE "feedback"
  ADD COLUMN IF NOT EXISTS "staff_profile_id" text
    REFERENCES "staff_profiles"("id") ON DELETE SET NULL;

ALTER TABLE "staff_profiles" ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Run the migration in production**

In the Supabase dashboard → SQL Editor, paste and run the migration file contents. Confirm there are no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/migrations/0013_service_signature_foundation.sql
git commit -m "feat: migration 0013 — service signature foundation"
```

---

### Task 3: Staff tRPC router

**Files:**
- Create: `packages/api/src/routers/staff.ts`

- [ ] **Step 1: Create the router file**

```typescript
// packages/api/src/routers/staff.ts
import { db } from "@intuitive-stay/db"
import {
  feedback,
  organisations,
  properties,
  staffProfiles,
} from "@intuitive-stay/db/schema"
import { env } from "@intuitive-stay/env/server"
import { TRPCError } from "@trpc/server"
import { and, asc, eq } from "drizzle-orm"
import { z } from "zod"

import { protectedProcedure, publicProcedure, router } from "../index"

export const staffRouter = router({
  /**
   * Protected — owner generates (or regenerates) a staff invite link.
   * Regenerating creates a new token; all old links stop working.
   */
  generateInviteToken: protectedProcedure
    .input(z.object({ propertyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const org = await db.query.organisations.findFirst({
        where: eq(organisations.ownerId, ctx.session.user.id),
      })
      if (!org) throw new TRPCError({ code: "FORBIDDEN" })

      const property = await db.query.properties.findFirst({
        where: eq(properties.id, input.propertyId),
      })
      if (!property) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })
      if (property.organisationId !== org.id) throw new TRPCError({ code: "FORBIDDEN" })

      const token = crypto.randomUUID()
      await db
        .update(properties)
        .set({ staffInviteToken: token })
        .where(eq(properties.id, input.propertyId))

      return {
        token,
        inviteUrl: `${env.PUBLIC_PORTAL_URL}/staff-join/${token}`,
      }
    }),

  /**
   * Protected — returns the current invite URL for a property.
   * Returns null if no token has been generated yet.
   */
  getInviteUrl: protectedProcedure
    .input(z.object({ propertyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const org = await db.query.organisations.findFirst({
        where: eq(organisations.ownerId, ctx.session.user.id),
      })
      if (!org) throw new TRPCError({ code: "FORBIDDEN" })

      const property = await db.query.properties.findFirst({
        where: eq(properties.id, input.propertyId),
      })
      if (!property) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })
      if (property.organisationId !== org.id) throw new TRPCError({ code: "FORBIDDEN" })

      return {
        token: property.staffInviteToken ?? null,
        inviteUrl: property.staffInviteToken
          ? `${env.PUBLIC_PORTAL_URL}/staff-join/${property.staffInviteToken}`
          : null,
      }
    }),

  /**
   * Public — validates an invite token and returns the property name.
   * Used by the /staff-join page to show the guest which property they're joining.
   */
  getInviteInfo: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const property = await db.query.properties.findFirst({
        where: eq(properties.staffInviteToken, input.token),
      })
      if (!property) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "This invite link is no longer valid.",
        })
      }
      return { propertyName: property.name }
    }),

  /**
   * Public — staff self-register using an invite token.
   * Creates a staff_profiles row for this property.
   */
  registerStaff: publicProcedure
    .input(
      z.object({
        token: z.string(),
        name: z.string().min(1).max(100),
        email: z.string().email(),
      }),
    )
    .mutation(async ({ input }) => {
      const property = await db.query.properties.findFirst({
        where: eq(properties.staffInviteToken, input.token),
      })
      if (!property) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "This invite link is no longer valid.",
        })
      }

      const existing = await db.query.staffProfiles.findFirst({
        where: and(
          eq(staffProfiles.propertyId, property.id),
          eq(staffProfiles.email, input.email.toLowerCase()),
        ),
      })
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You are already registered at this property.",
        })
      }

      const id = crypto.randomUUID()
      await db.insert(staffProfiles).values({
        id,
        name: input.name.trim(),
        email: input.email.toLowerCase(),
        propertyId: property.id,
        createdAt: new Date(),
      })

      return { ok: true, staffProfileId: id }
    }),

  /**
   * Protected — owner lists all registered staff profiles for their property.
   */
  listPropertyStaff: protectedProcedure
    .input(z.object({ propertyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const org = await db.query.organisations.findFirst({
        where: eq(organisations.ownerId, ctx.session.user.id),
      })
      if (!org) throw new TRPCError({ code: "FORBIDDEN" })

      const property = await db.query.properties.findFirst({
        where: eq(properties.id, input.propertyId),
      })
      if (!property) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })
      if (property.organisationId !== org.id) throw new TRPCError({ code: "FORBIDDEN" })

      const staff = await db
        .select()
        .from(staffProfiles)
        .where(eq(staffProfiles.propertyId, input.propertyId))
        .orderBy(asc(staffProfiles.name))

      return staff.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        createdAt: s.createdAt,
        // nominations wired in Phase 2 when staffProfileId is set on feedback rows
        nominations: 0,
      }))
    }),
})
```

- [ ] **Step 2: Register the router**

Open `packages/api/src/routers/index.ts`. Add the import:

```typescript
import { staffRouter } from "./staff"
```

Add to `appRouter`:

```typescript
  staff: staffRouter,
```

Full file after edit:

```typescript
import { protectedProcedure, publicProcedure, router } from "../index"
import { aiRouter } from "./ai"
import { contactRouter } from "./contact"
import { feedbackRouter } from "./feedback"
import { inviteRouter } from "./invite"
import { propertiesRouter } from "./properties"
import { staffRouter } from "./staff"
import { teamRouter } from "./team"
import { reviewsRouter } from "./reviews"

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK"
  }),
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "This is private",
      user: ctx.session.user,
    }
  }),
  properties: propertiesRouter,
  feedback: feedbackRouter,
  ai: aiRouter,
  team: teamRouter,
  staff: staffRouter,
  reviews: reviewsRouter,
  invite: inviteRouter,
  contact: contactRouter,
})

export type AppRouter = typeof appRouter
```

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/routers/staff.ts \
        packages/api/src/routers/index.ts
git commit -m "feat: add staff tRPC router (generateInviteToken, registerStaff, listPropertyStaff)"
```

---

### Task 4: Service Signature portal page

**Files:**
- Create: `apps/portal-web/src/routes/_portal.properties.$propertyId.service-signature.tsx`

- [ ] **Step 1: Create the portal page**

```typescript
// apps/portal-web/src/routes/_portal.properties.$propertyId.service-signature.tsx
import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { CheckIcon, CopyIcon, RefreshCwIcon, ShieldCheckIcon } from "lucide-react"

import { useTRPC } from "@/utils/trpc"

export const Route = createFileRoute(
  "/_portal/properties/$propertyId/service-signature",
)({
  component: RouteComponent,
})

function RouteComponent() {
  const { propertyId } = Route.useParams()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [copied, setCopied] = React.useState(false)

  const { data: inviteData, isLoading: inviteLoading } = useQuery(
    trpc.staff.getInviteUrl.queryOptions({ propertyId }),
  )

  const { data: staffList, isLoading: staffLoading } = useQuery(
    trpc.staff.listPropertyStaff.queryOptions({ propertyId }),
  )

  const generateMutation = useMutation(
    trpc.staff.generateInviteToken.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(
          trpc.staff.getInviteUrl.queryOptions({ propertyId }),
        )
      },
    }),
  )

  function handleCopy() {
    if (!inviteData?.inviteUrl) return
    void navigator.clipboard.writeText(inviteData.inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-6 space-y-8 max-w-2xl">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <ShieldCheckIcon className="size-5 text-orange-500" />
          <h1 className="text-2xl font-bold">Service Signature</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Give your team a staff invite link. When they register, guest feedback
          nominations are attributed to their profile — building their Service
          Signature passport over time.
        </p>
      </div>

      {/* Invite link card */}
      <div className="rounded-xl border bg-white p-5 space-y-4 shadow-sm">
        <div>
          <p className="font-semibold text-sm">Staff Registration Link</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Share this link with your team. Anyone with the link can register.
            Regenerating it invalidates the old link immediately.
          </p>
        </div>

        {inviteLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : inviteData?.inviteUrl ? (
          <div className="flex gap-2">
            <input
              readOnly
              value={inviteData.inviteUrl}
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
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No link generated yet. Click below to create one.
          </p>
        )}

        <button
          type="button"
          onClick={() => generateMutation.mutate({ propertyId })}
          disabled={generateMutation.isPending}
          className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60 transition-colors"
        >
          <RefreshCwIcon className="size-3.5" />
          {inviteData?.inviteUrl ? "Regenerate Link" : "Generate Link"}
        </button>
      </div>

      {/* Registered staff */}
      <div className="space-y-3">
        <p className="font-semibold text-sm">Registered Staff</p>
        {staffLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !staffList || staffList.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <ShieldCheckIcon className="mx-auto size-7 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              No staff registered yet. Share the link above to get started.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Joined</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(s.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "apps/portal-web/src/routes/_portal.properties.\$propertyId.service-signature.tsx"
git commit -m "feat: add Service Signature portal page (invite link + staff list)"
```

---

### Task 5: Add nav item to sidebar

**Files:**
- Modify: `apps/portal-web/src/components/app-sidebar.tsx`

- [ ] **Step 1: Add the import**

Open `apps/portal-web/src/components/app-sidebar.tsx`. Find the lucide-react icon imports at the top. Add `ShieldCheckIcon` to the import list. Example — locate the line like:

```typescript
import {
  LayoutDashboardIcon,
  // ... other icons
} from "lucide-react"
```

Add `ShieldCheckIcon` to that import.

- [ ] **Step 2: Add the nav item**

In the same file, find the "Team" nav item block (around the section that has `label="Team"`):

```tsx
                    label="Team"
                    icon={<UsersIcon />}  // (or whichever icon Team uses)
                    link={
                      <AppSidebarLink
                        to="/properties/$propertyId/team"
                        params={{ propertyId: activePropertyId! }}
                      />
                    }
                    isActive={isRouteActive(location.pathname, buildPropertyPath(activePropertyId, "team"))}
```

Immediately **after** the closing of that nav item block, add:

```tsx
                  <AppSidebarItem
                    label="Service Signature"
                    icon={<ShieldCheckIcon />}
                    link={
                      <AppSidebarLink
                        to="/properties/$propertyId/service-signature"
                        params={{ propertyId: activePropertyId! }}
                      />
                    }
                    isActive={isRouteActive(
                      location.pathname,
                      buildPropertyPath(activePropertyId, "service-signature"),
                    )}
                  />
```

- [ ] **Step 3: Commit**

```bash
git add apps/portal-web/src/components/app-sidebar.tsx
git commit -m "feat: add Service Signature nav item to sidebar"
```

---

### Task 6: Public staff registration page

**Files:**
- Create: `apps/portal-web/src/routes/staff-join.$inviteToken.tsx`

- [ ] **Step 1: Create the public registration page**

```typescript
// apps/portal-web/src/routes/staff-join.$inviteToken.tsx
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"

import { useTRPC, useTRPCClient } from "@/utils/trpc"

export const Route = createFileRoute("/staff-join/$inviteToken")({
  component: StaffJoinPage,
})

function StaffJoinPage() {
  const { inviteToken } = Route.useParams()
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()

  const { data, isLoading, isError } = useQuery(
    trpc.staff.getInviteInfo.queryOptions({ token: inviteToken }),
  )

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || isSubmitting) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      await trpcClient.staff.registerStaff.mutate({
        token: inviteToken,
        name: name.trim(),
        email: email.trim(),
      })
      setDone(true)
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      setSubmitError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="font-semibold">Invalid or expired link</p>
          <p className="text-sm text-muted-foreground">
            This invite link is no longer valid. Ask your manager for a new one.
          </p>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4 px-6 max-w-sm">
          <div className="text-5xl">🎉</div>
          <h2 className="text-xl font-bold">You're registered!</h2>
          <p className="text-sm text-muted-foreground">
            Your Service Signature profile at <strong>{data?.propertyName}</strong> has
            been created. Guest feedback will now be attributed to your profile.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            IntuitiveStay · Service Signature
          </p>
          <h1 className="text-2xl font-bold">Join {data?.propertyName}</h1>
          <p className="text-sm text-muted-foreground">
            Register your profile so guest feedback can be attributed to you.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="name" className="text-sm font-medium">
              Your name
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              maxLength={100}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium">
              Your email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}

          <button
            type="submit"
            disabled={!name.trim() || !email.trim() || isSubmitting}
            className="w-full rounded-lg bg-orange-500 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60 transition-colors"
          >
            {isSubmitting ? "Registering…" : "Create My Profile"}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit and push**

```bash
git add "apps/portal-web/src/routes/staff-join.\$inviteToken.tsx"
git commit -m "feat: add public staff-join registration page"
git push origin main
```

---

## Self-Review

**Spec coverage:**
- ✅ `staff_profiles` table — Task 1
- ✅ `staff_profile_id` on feedback — Task 1
- ✅ Team invite link (owner generates) — Tasks 3 + 4
- ✅ Staff self-registration (public page) — Task 6
- ✅ Staff list visible to owner — Task 4
- ✅ Nav item in portal sidebar — Task 5
- ✅ Migration — Task 2

**Placeholder scan:** None — all steps contain complete code.

**Type consistency:**
- `staffProfiles` exported from `packages/db/src/schema/staff-profiles.ts` and re-exported via `index.ts` — used correctly in `staff.ts` router and `feedback.ts` schema.
- `staffRouter` exported from `routers/staff.ts` and imported/registered in `routers/index.ts` as `staff:`.
- tRPC calls in portal page use `trpc.staff.getInviteUrl`, `trpc.staff.generateInviteToken`, `trpc.staff.listPropertyStaff` — all defined in router.
- tRPC calls in join page use `trpc.staff.getInviteInfo` and `trpcClient.staff.registerStaff` — both defined in router.
- Route path `"/staff-join/$inviteToken"` matches `Route.useParams()` destructuring `{ inviteToken }`.

**Phase boundary:** Phase 1 ends here. `staffProfileId` on feedback is always `null` until Phase 2 replaces the free-text name entry with a staff picker. `nominations` is hardcoded to 0 in `listPropertyStaff` until Phase 2 begins attributing feedback rows.
