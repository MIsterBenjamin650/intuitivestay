# Service Signature Phase 4 — Manager Commendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow property owners to write short endorsements for verified staff members that appear on the staff member's public passport.

**Architecture:** New `staff_commendations` table stores endorsements written by owners. Two new tRPC procedures: `addCommendation` (protected, owner-only) and `getCommendations` (public, for the passport). The service-signature page gains an inline commendation form per staff row; the passport page shows commendations below the stats card.

**Tech Stack:** tRPC, Drizzle ORM, TanStack Query, React, Tailwind CSS, PostgreSQL (Supabase).

---

## File Map

| Action | Path |
|--------|------|
| **Create** | `packages/db/src/schema/staff-commendations.ts` — new table schema |
| **Modify** | `packages/db/src/schema/index.ts` — export new schema |
| **Create** | `packages/db/src/migrations/0017_staff_commendations.sql` — migration |
| **Modify** | `packages/api/src/routers/staff.ts` — add `addCommendation` + `getCommendations` procedures |
| **Modify** | `apps/portal-web/src/routes/_portal.properties.$propertyId.service-signature.tsx` — inline commendation form |
| **Modify** | `apps/portal-web/src/routes/passport.$staffProfileId.tsx` — commendations section |

---

### Task 1: DB — staff_commendations table + migration + schema export

**Files:**
- Create: `packages/db/src/schema/staff-commendations.ts`
- Modify: `packages/db/src/schema/index.ts`
- Create: `packages/db/src/migrations/0017_staff_commendations.sql`

- [ ] **Step 1: Create the schema file**

Create `packages/db/src/schema/staff-commendations.ts`:

```typescript
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { properties } from "./properties"
import { staffProfiles } from "./staff-profiles"

export const staffCommendations = pgTable(
  "staff_commendations",
  {
    id: text("id").primaryKey(),
    staffProfileId: text("staff_profile_id")
      .notNull()
      .references(() => staffProfiles.id, { onDelete: "cascade" }),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    /** Owner's display name stored at write time — persists even if user renames. */
    authorName: text("author_name").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("staff_commendations_staff_profile_id_idx").on(table.staffProfileId),
  ],
)
```

- [ ] **Step 2: Export from schema index**

Open `packages/db/src/schema/index.ts`. The current last line is:
```typescript
export * from "./staff-profiles"
```

Add below it:
```typescript
export * from "./staff-commendations"
```

- [ ] **Step 3: Create the migration file**

Create `packages/db/src/migrations/0017_staff_commendations.sql`:

```sql
CREATE TABLE IF NOT EXISTS "staff_commendations" (
  "id" text PRIMARY KEY,
  "staff_profile_id" text NOT NULL REFERENCES "staff_profiles"("id") ON DELETE CASCADE,
  "property_id" text NOT NULL REFERENCES "properties"("id") ON DELETE CASCADE,
  "author_name" text NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "staff_commendations_staff_profile_id_idx" ON "staff_commendations" ("staff_profile_id");
```

- [ ] **Step 4: Commit**

```bash
cd /c/Users/miste/intuitivestay/intuitivestay
git add packages/db/src/schema/staff-commendations.ts packages/db/src/schema/index.ts packages/db/src/migrations/0017_staff_commendations.sql
git commit -m "feat: add staff_commendations table schema and migration"
```

---

### Task 2: API — addCommendation + getCommendations procedures

**Files:**
- Modify: `packages/api/src/routers/staff.ts`

**Context:** The current imports in `staff.ts` are:

```typescript
import { db } from "@intuitive-stay/db"
import { feedback, organisations, properties, staffProfiles } from "@intuitive-stay/db/schema"
import { env } from "@intuitive-stay/env/server"
import { TRPCError } from "@trpc/server"
import { and, asc, count, eq, isNotNull, isNull, sql } from "drizzle-orm"
import Stripe from "stripe"
import { z } from "zod"
```

Two changes are needed to imports:
1. Add `staffCommendations` to the `@intuitive-stay/db/schema` import
2. Add `desc` to the `drizzle-orm` import

The new procedures go at the end of the router object, before the closing `})`.

- [ ] **Step 1: Update the schema import**

Change:
```typescript
import { feedback, organisations, properties, staffProfiles } from "@intuitive-stay/db/schema"
```
To:
```typescript
import { feedback, organisations, properties, staffCommendations, staffProfiles } from "@intuitive-stay/db/schema"
```

- [ ] **Step 2: Update the drizzle-orm import**

Change:
```typescript
import { and, asc, count, eq, isNotNull, isNull, sql } from "drizzle-orm"
```
To:
```typescript
import { and, asc, count, desc, eq, isNotNull, isNull, sql } from "drizzle-orm"
```

- [ ] **Step 3: Add `addCommendation` procedure**

Add this procedure before the closing `})` of the router:

```typescript
  /**
   * Protected — owner writes a commendation for a verified, non-removed staff member
   * at their own property. authorName is stored at write time from the session.
   */
  addCommendation: protectedProcedure
    .input(
      z.object({
        staffProfileId: z.string(),
        body: z.string().min(10).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const org = await db.query.organisations.findFirst({
        where: eq(organisations.ownerId, ctx.session.user.id),
      })
      if (!org) throw new TRPCError({ code: "FORBIDDEN" })

      const staff = await db.query.staffProfiles.findFirst({
        where: eq(staffProfiles.id, input.staffProfileId),
      })
      if (!staff) throw new TRPCError({ code: "NOT_FOUND", message: "Staff member not found." })
      if (staff.removedAt) throw new TRPCError({ code: "FORBIDDEN", message: "This staff member has been removed." })
      if (!staff.emailVerifiedAt) throw new TRPCError({ code: "FORBIDDEN", message: "Staff member has not verified their email." })

      // Verify staff belongs to a property owned by this org
      const property = await db.query.properties.findFirst({
        where: and(
          eq(properties.id, staff.propertyId),
          eq(properties.organisationId, org.id),
        ),
      })
      if (!property) throw new TRPCError({ code: "FORBIDDEN" })

      await db.insert(staffCommendations).values({
        id: crypto.randomUUID(),
        staffProfileId: input.staffProfileId,
        propertyId: staff.propertyId,
        authorName: ctx.session.user.name ?? "Property Manager",
        body: input.body.trim(),
        createdAt: new Date(),
      })

      return { ok: true }
    }),

  /**
   * Public — returns all commendations for a staff member, newest first.
   * Joins properties to include propertyName alongside each entry.
   */
  getCommendations: publicProcedure
    .input(z.object({ staffProfileId: z.string() }))
    .query(async ({ input }) => {
      const rows = await db
        .select({
          id: staffCommendations.id,
          authorName: staffCommendations.authorName,
          body: staffCommendations.body,
          createdAt: staffCommendations.createdAt,
          propertyName: properties.name,
        })
        .from(staffCommendations)
        .innerJoin(properties, eq(staffCommendations.propertyId, properties.id))
        .where(eq(staffCommendations.staffProfileId, input.staffProfileId))
        .orderBy(desc(staffCommendations.createdAt))

      return rows
    }),
```

- [ ] **Step 4: Commit**

```bash
cd /c/Users/miste/intuitivestay/intuitivestay
git add packages/api/src/routers/staff.ts
git commit -m "feat: add addCommendation and getCommendations tRPC procedures"
```

---

### Task 3: Service-signature page — inline commendation form

**Files:**
- Modify: `apps/portal-web/src/routes/_portal.properties.$propertyId.service-signature.tsx`

**Context:** The current file uses `useTRPC()` hook pattern with `useMutation` from `@tanstack/react-query`. The staff table body currently maps `staffList` to a `<tr>` per staff member. We need to:

1. Add `commendingStaffId` and `commendBody` state
2. Add `commendMutation`
3. Wrap each staff row in `React.Fragment` so we can add an expansion row below it when the form is open
4. Add "Commend" button to the Actions cell (only for verified staff)
5. Render the expansion row when `commendingStaffId === s.id`

The current Actions cell (inside the `staffList.map`) is:

```tsx
                    <td className="px-4 py-3">
                      {confirmRemoveId === s.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Confirm?</span>
                          <button
                            type="button"
                            onClick={() => removeMutation.mutate({ staffProfileId: s.id })}
                            disabled={removeMutation.isPending}
                            className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                          >
                            {removeMutation.isPending ? "Removing…" : "Yes"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmRemoveId(null)}
                            disabled={removeMutation.isPending}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveId(s.id)}
                          className="text-xs font-medium text-red-500 hover:text-red-600 transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </td>
```

- [ ] **Step 1: Add `commendingStaffId` and `commendBody` state**

After the existing `const [confirmRemoveId, setConfirmRemoveId] = React.useState<string | null>(null)` line, add:

```typescript
  const [commendingStaffId, setCommendingStaffId] = React.useState<string | null>(null)
  const [commendBody, setCommendBody] = React.useState("")
```

- [ ] **Step 2: Add `commendMutation`**

After the existing `removeMutation`, add:

```typescript
  const commendMutation = useMutation(
    trpc.staff.addCommendation.mutationOptions({
      onSuccess: () => {
        setTimeout(() => {
          setCommendingStaffId(null)
          setCommendBody("")
        }, 1500)
      },
    }),
  )
```

- [ ] **Step 3: Replace the `staffList.map` block with one that uses React.Fragment and adds the commendation form row**

Find the entire `{staffList.map((s) => (` block and replace it with:

```tsx
                {staffList.map((s) => (
                  <React.Fragment key={s.id}>
                    <tr className="border-b">
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.email}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(s.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        {s.emailVerifiedAt ? (
                          <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {s.emailVerifiedAt && confirmRemoveId !== s.id && (
                            <button
                              type="button"
                              onClick={() => {
                                setCommendingStaffId(commendingStaffId === s.id ? null : s.id)
                                setCommendBody("")
                              }}
                              className="text-xs font-medium text-orange-500 hover:text-orange-600 transition-colors"
                            >
                              {commendingStaffId === s.id ? "Cancel" : "Commend"}
                            </button>
                          )}
                          {confirmRemoveId === s.id ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Confirm?</span>
                              <button
                                type="button"
                                onClick={() => removeMutation.mutate({ staffProfileId: s.id })}
                                disabled={removeMutation.isPending}
                                className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                              >
                                {removeMutation.isPending ? "Removing…" : "Yes"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmRemoveId(null)}
                                disabled={removeMutation.isPending}
                                className="text-xs text-muted-foreground hover:text-foreground"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmRemoveId(s.id)}
                              className="text-xs font-medium text-red-500 hover:text-red-600 transition-colors"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {commendingStaffId === s.id && (
                      <tr className="bg-orange-50/40 border-b">
                        <td colSpan={5} className="px-4 py-4">
                          <div className="space-y-3 max-w-lg">
                            <p className="text-xs font-semibold">
                              Write a commendation for {s.name}
                            </p>
                            <textarea
                              value={commendBody}
                              onChange={(e) => setCommendBody(e.target.value)}
                              maxLength={500}
                              rows={3}
                              placeholder="Describe how this staff member went above and beyond…"
                              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
                            />
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                {commendBody.length}/500
                              </span>
                              <div className="flex items-center gap-2">
                                {commendMutation.isSuccess ? (
                                  <span className="text-xs font-medium text-green-600">
                                    Commendation added ✓
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      commendMutation.mutate({
                                        staffProfileId: s.id,
                                        body: commendBody,
                                      })
                                    }
                                    disabled={
                                      commendBody.trim().length < 10 ||
                                      commendMutation.isPending
                                    }
                                    className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-60 transition-colors"
                                  >
                                    {commendMutation.isPending ? "Submitting…" : "Submit"}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
```

- [ ] **Step 4: Commit**

```bash
cd /c/Users/miste/intuitivestay/intuitivestay
git add "apps/portal-web/src/routes/_portal.properties.\$propertyId.service-signature.tsx"
git commit -m "feat: add inline commendation form to staff list"
```

---

### Task 4: Passport page — commendations section

**Files:**
- Modify: `apps/portal-web/src/routes/passport.$staffProfileId.tsx`

**Context:** The passport page already uses `useTRPC()` and `useQuery`. The page renders a stats card and footer. We need to:
1. Add a `getCommendations` query
2. Render a commendations section after the stats card, inside the `if (data.activatedAt)` branch (after the stats card, before the footer)

The commendations section only shows when there is at least one commendation. Each card shows `authorName`, `propertyName`, `body`, and `createdAt` formatted as "Apr 2026".

The current structure of the activated passport render is (simplified):
```tsx
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-sm space-y-6">
        {/* Header */}
        ...
        {/* Stats card */}
        <div className="rounded-xl border bg-white shadow-sm p-5 space-y-5">
          ...
        </div>
        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          Active since ...
        </p>
      </div>
    </div>
  )
```

- [ ] **Step 1: Add the `getCommendations` query**

Inside `PassportPage`, after the existing `useQuery` call:

```typescript
  const { data: commendations } = useQuery(
    trpc.staff.getCommendations.queryOptions({ staffProfileId }),
  )
```

- [ ] **Step 2: Add the commendations section to the JSX**

In the activated render (`return (...)`), add the commendations section between the stats card and the footer `<p>`:

```tsx
        {/* Commendations — only shown when there are entries */}
        {commendations && commendations.length > 0 && (
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
```

- [ ] **Step 3: Commit and push**

```bash
cd /c/Users/miste/intuitivestay/intuitivestay
git add "apps/portal-web/src/routes/passport.\$staffProfileId.tsx"
git commit -m "feat: show manager commendations on staff passport"
git push origin main
```

---

## Self-Review

**Spec coverage:**
- ✅ `staff_commendations` table with all required columns — Task 1 Step 1
- ✅ Index on `staffProfileId` — Task 1 Step 1
- ✅ Migration `0017_staff_commendations.sql` — Task 1 Step 3
- ✅ Schema exported from index — Task 1 Step 2
- ✅ `addCommendation` — owner only, validates org ownership, checks staff is verified + not removed, stores `authorName` from session — Task 2 Step 3
- ✅ `getCommendations` — public, joins properties for propertyName, ordered newest first — Task 2 Step 3
- ✅ 500-char max enforced at zod layer (`z.string().min(10).max(500)`) — Task 2 Step 3
- ✅ "Write Commendation" button only for verified staff — Task 3 Step 3 (`s.emailVerifiedAt && ...`)
- ✅ Only one form open at a time — Task 3 (single `commendingStaffId` state)
- ✅ 500-char counter in UI — Task 3 Step 3 (`{commendBody.length}/500`)
- ✅ Submit disabled when body < 10 chars — Task 3 Step 3
- ✅ "Commendation added ✓" success state, then collapses after 1.5s — Task 3 Steps 2 & 3
- ✅ Commendations shown on passport when activated + entries exist — Task 4 Step 2
- ✅ Each commendation shows authorName, propertyName, body, createdAt ("Apr 2026") — Task 4 Step 2
- ✅ Commendations not gated on staff activation to receive (only display requires it) — `addCommendation` has no `activatedAt` check

**Post-deploy step (user must do manually):** Run in Supabase SQL Editor:
```sql
CREATE TABLE IF NOT EXISTS "staff_commendations" (
  "id" text PRIMARY KEY,
  "staff_profile_id" text NOT NULL REFERENCES "staff_profiles"("id") ON DELETE CASCADE,
  "property_id" text NOT NULL REFERENCES "properties"("id") ON DELETE CASCADE,
  "author_name" text NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "staff_commendations_staff_profile_id_idx" ON "staff_commendations" ("staff_profile_id");
```

**Placeholder scan:** None found.

**Type consistency:**
- `staffCommendations` imported from `@intuitive-stay/db/schema` in `staff.ts` — matches export from `staff-commendations.ts`
- `getCommendations` returns `{ id, authorName, body, createdAt, propertyName }` — matches passport usage (`c.id`, `c.authorName`, `c.body`, `c.createdAt`, `c.propertyName`)
- `addCommendation` input `{ staffProfileId, body }` — matches `commendMutation.mutate({ staffProfileId: s.id, body: commendBody })`
- `trpc.staff.getCommendations.queryOptions({ staffProfileId })` — matches procedure name and input
