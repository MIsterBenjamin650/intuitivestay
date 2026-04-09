# Service Signature — Staff Removal (Soft Delete) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow property owners to remove staff members, severing their feedback picker visibility and deactivating their profile and passport link.

**Architecture:** Soft delete via a `removedAt` timestamp on `staff_profiles`. Removing sets this field; `getStaffProfile` throws NOT_FOUND when it is set; `getVerifiedStaffAtProperty` and `listPropertyStaff` filter removed staff out. The service-signature owner page gains a Remove button with inline confirmation per row.

**Tech Stack:** tRPC protected procedures, Drizzle ORM, TanStack Query, React, Tailwind CSS.

---

## File Map

| Action | Path |
|--------|------|
| **Modify** | `packages/db/src/schema/staff-profiles.ts` — add `removedAt` column |
| **Create** | `packages/db/src/migrations/0016_staff_removal.sql` — ALTER TABLE migration |
| **Modify** | `packages/api/src/routers/staff.ts` — add `removeStaff`, update `getStaffProfile`, `getVerifiedStaffAtProperty`, `listPropertyStaff` |
| **Modify** | `apps/portal-web/src/routes/_portal.properties.$propertyId.service-signature.tsx` — Remove button + inline confirm |
| **Modify** | `apps/portal-web/src/routes/staff-profile.$staffProfileId.tsx` — distinguish removed vs missing error state |
| **Modify** | `apps/portal-web/src/routes/passport.$staffProfileId.tsx` — distinguish removed vs missing error state |

---

### Task 1: DB schema — add removedAt to staff_profiles

**Files:**
- Modify: `packages/db/src/schema/staff-profiles.ts`
- Create: `packages/db/src/migrations/0016_staff_removal.sql`

- [ ] **Step 1: Add `removedAt` column to schema**

Open `packages/db/src/schema/staff-profiles.ts`. The current columns end with:

```typescript
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
```

Add `removedAt` after `stripePaymentIntentId`:

```typescript
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    /** Set when a property owner removes the staff member. Soft delete — preserves feedback attribution history. */
    removedAt: timestamp("removed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
```

- [ ] **Step 2: Create the migration file**

Create `packages/db/src/migrations/0016_staff_removal.sql` with this exact content:

```sql
ALTER TABLE "staff_profiles" ADD COLUMN IF NOT EXISTS "removed_at" timestamp;
```

- [ ] **Step 3: Commit**

```bash
cd /c/Users/miste/intuitivestay/intuitivestay
git add packages/db/src/schema/staff-profiles.ts packages/db/src/migrations/0016_staff_removal.sql
git commit -m "feat: add removedAt soft-delete column to staff_profiles"
```

---

### Task 2: API — removeStaff procedure + update existing queries

**Files:**
- Modify: `packages/api/src/routers/staff.ts`

**Context:**

The current drizzle-orm import in `staff.ts` is:
```typescript
import { and, asc, count, eq, isNotNull, sql } from "drizzle-orm"
```
`isNull` is not yet imported — it must be added.

The `getStaffProfile` procedure currently checks:
```typescript
if (!staff) {
  throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found." })
}
```

The `getVerifiedStaffAtProperty` procedure currently filters on:
```typescript
.where(
  and(
    eq(staffProfiles.propertyId, input.propertyId),
    isNotNull(staffProfiles.emailVerifiedAt),
  ),
)
```

The `listPropertyStaff` procedure currently filters on:
```typescript
.where(eq(staffProfiles.propertyId, input.propertyId))
```

- [ ] **Step 1: Add `isNull` to the drizzle-orm import**

Change:
```typescript
import { and, asc, count, eq, isNotNull, sql } from "drizzle-orm"
```
To:
```typescript
import { and, asc, count, eq, isNotNull, isNull, sql } from "drizzle-orm"
```

- [ ] **Step 2: Update `getStaffProfile` to throw NOT_FOUND when removedAt is set**

Find the `getStaffProfile` procedure. After the `if (!staff)` guard, add a removed check:

```typescript
      if (!staff) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found." })
      }
      if (staff.removedAt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "This profile is no longer active." })
      }
```

- [ ] **Step 3: Update `getVerifiedStaffAtProperty` to exclude removed staff**

Find the `.where(...)` clause in `getVerifiedStaffAtProperty`. Change:

```typescript
        .where(
          and(
            eq(staffProfiles.propertyId, input.propertyId),
            isNotNull(staffProfiles.emailVerifiedAt),
          ),
        )
```

To:

```typescript
        .where(
          and(
            eq(staffProfiles.propertyId, input.propertyId),
            isNotNull(staffProfiles.emailVerifiedAt),
            isNull(staffProfiles.removedAt),
          ),
        )
```

- [ ] **Step 4: Update `listPropertyStaff` to exclude removed staff**

Find the `.where(eq(staffProfiles.propertyId, input.propertyId))` in `listPropertyStaff`. Change:

```typescript
      const staff = await db
        .select()
        .from(staffProfiles)
        .where(eq(staffProfiles.propertyId, input.propertyId))
        .orderBy(asc(staffProfiles.name))
```

To:

```typescript
      const staff = await db
        .select()
        .from(staffProfiles)
        .where(
          and(
            eq(staffProfiles.propertyId, input.propertyId),
            isNull(staffProfiles.removedAt),
          ),
        )
        .orderBy(asc(staffProfiles.name))
```

- [ ] **Step 5: Add `removeStaff` protected procedure**

Add this procedure to the router object, after `listPropertyStaff`:

```typescript
  /**
   * Protected — owner soft-deletes a staff member by setting removedAt.
   * Validates that the staff member belongs to a property owned by the calling user's org.
   */
  removeStaff: protectedProcedure
    .input(z.object({ staffProfileId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const org = await db.query.organisations.findFirst({
        where: eq(organisations.ownerId, ctx.session.user.id),
      })
      if (!org) throw new TRPCError({ code: "FORBIDDEN" })

      const staff = await db.query.staffProfiles.findFirst({
        where: eq(staffProfiles.id, input.staffProfileId),
      })
      if (!staff) throw new TRPCError({ code: "NOT_FOUND", message: "Staff member not found." })

      // Verify the staff member belongs to a property owned by this org
      const property = await db.query.properties.findFirst({
        where: and(
          eq(properties.id, staff.propertyId),
          eq(properties.organisationId, org.id),
        ),
      })
      if (!property) throw new TRPCError({ code: "FORBIDDEN" })

      await db
        .update(staffProfiles)
        .set({ removedAt: new Date() })
        .where(eq(staffProfiles.id, input.staffProfileId))

      return { ok: true }
    }),
```

- [ ] **Step 6: Commit**

```bash
cd /c/Users/miste/intuitivestay/intuitivestay
git add packages/api/src/routers/staff.ts
git commit -m "feat: add removeStaff procedure, filter removed staff from picker and list, sever profile on removal"
```

---

### Task 3: Service-signature page — Remove button with inline confirmation

**Files:**
- Modify: `apps/portal-web/src/routes/_portal.properties.$propertyId.service-signature.tsx`

**Context:** The page uses `useTRPC()` (hook-based) with `useMutation` from `@tanstack/react-query`. The existing mutation pattern is:

```typescript
const generateMutation = useMutation(
  trpc.staff.generateInviteToken.mutationOptions({
    onSuccess: () => {
      void queryClient.invalidateQueries(
        trpc.staff.getInviteUrl.queryOptions({ propertyId }),
      )
    },
  }),
)
```

The staff table currently has four columns: Name, Email, Joined, Status. We add a fifth Actions column. Clicking "Remove" shows inline "Remove [Name]?" confirmation with "Yes, remove" and "Cancel" — no modal needed. `confirmRemoveId` tracks which row is in confirmation state.

- [ ] **Step 1: Add `confirmRemoveId` state and `removeMutation`**

After the existing `const [copied, setCopied] = React.useState(false)` line, add:

```typescript
  const [confirmRemoveId, setConfirmRemoveId] = React.useState<string | null>(null)

  const removeMutation = useMutation(
    trpc.staff.removeStaff.mutationOptions({
      onSuccess: () => {
        setConfirmRemoveId(null)
        void queryClient.invalidateQueries(
          trpc.staff.listPropertyStaff.queryOptions({ propertyId }),
        )
      },
    }),
  )
```

- [ ] **Step 2: Add the Actions column header**

Find the `<thead>` block and add the Actions `<th>`:

```tsx
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Joined</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
```

- [ ] **Step 3: Replace the `<tbody>` rows with the Remove cell added**

Find and replace the entire `{staffList.map((s) => (...))}` block:

```tsx
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
                      {confirmRemoveId === s.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Remove {s.name}?</span>
                          <button
                            type="button"
                            onClick={() => removeMutation.mutate({ staffProfileId: s.id })}
                            disabled={removeMutation.isPending}
                            className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                          >
                            {removeMutation.isPending ? "Removing…" : "Yes, remove"}
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
                  </tr>
                ))}
```

- [ ] **Step 4: Commit**

```bash
cd /c/Users/miste/intuitivestay/intuitivestay
git add "apps/portal-web/src/routes/_portal.properties.\$propertyId.service-signature.tsx"
git commit -m "feat: add Remove button with inline confirmation to staff list"
```

---

### Task 4: Staff-profile and passport pages — handle removed state

**Files:**
- Modify: `apps/portal-web/src/routes/staff-profile.$staffProfileId.tsx`
- Modify: `apps/portal-web/src/routes/passport.$staffProfileId.tsx`

**Context:** Both pages already have an `isError` branch. When `getStaffProfile` throws NOT_FOUND because `removedAt` is set, `isError` will be `true` and `error.message` will be `"This profile is no longer active."`. We use this exact string to differentiate "removed" from "genuinely not found", so the user sees a clear message.

With TanStack Query + tRPC, the `error` object from `useQuery` has a `.message` property that matches the string thrown by the server.

**Current `useQuery` call in `staff-profile.$staffProfileId.tsx`:**
```typescript
const { data, isLoading, isError, refetch } = useQuery(
  trpc.staff.getStaffProfile.queryOptions({ staffProfileId }),
)
```

**Current error block in `staff-profile.$staffProfileId.tsx`:**
```tsx
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
```

**Current `useQuery` call in `passport.$staffProfileId.tsx`:**
```typescript
const { data, isLoading, isError } = useQuery(
  trpc.staff.getStaffProfile.queryOptions({ staffProfileId }),
)
```

**Current error block in `passport.$staffProfileId.tsx`:**
```tsx
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
```

- [ ] **Step 1: Update `staff-profile.$staffProfileId.tsx` — expose `error`, update error block**

Change the `useQuery` destructure:
```typescript
  const { data, isLoading, isError, error, refetch } = useQuery(
    trpc.staff.getStaffProfile.queryOptions({ staffProfileId }),
  )
```

Replace the error block:
```tsx
  if (isError || !data) {
    const isRemoved = error?.message === "This profile is no longer active."
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="font-semibold">
            {isRemoved ? "Profile deactivated" : "Profile not found"}
          </p>
          <p className="text-sm text-muted-foreground">
            {isRemoved
              ? "This Service Signature profile is no longer active."
              : "This profile does not exist or the link is incorrect."}
          </p>
        </div>
      </div>
    )
  }
```

- [ ] **Step 2: Update `passport.$staffProfileId.tsx` — expose `error`, update error block**

Change the `useQuery` destructure:
```typescript
  const { data, isLoading, isError, error } = useQuery(
    trpc.staff.getStaffProfile.queryOptions({ staffProfileId }),
  )
```

Replace the error block:
```tsx
  if (isError || !data) {
    const isRemoved = error?.message === "This profile is no longer active."
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center space-y-2">
          <ShieldCheckIcon className="mx-auto size-8 text-muted-foreground/40" />
          <p className="font-semibold">
            {isRemoved ? "Passport deactivated" : "Passport not found"}
          </p>
          <p className="text-sm text-muted-foreground">
            {isRemoved
              ? "This Service Signature passport is no longer active."
              : "This passport does not exist or the link is incorrect."}
          </p>
        </div>
      </div>
    )
  }
```

- [ ] **Step 3: Commit and push**

```bash
cd /c/Users/miste/intuitivestay/intuitivestay
git add "apps/portal-web/src/routes/staff-profile.\$staffProfileId.tsx" "apps/portal-web/src/routes/passport.\$staffProfileId.tsx"
git commit -m "feat: show deactivated message on removed staff profile and passport pages"
git push origin main
```

---

## Self-Review

**Spec coverage:**
- ✅ Owner can remove staff — Task 3 (Remove button + confirm), Task 2 Step 5 (`removeStaff` procedure)
- ✅ Removed staff hidden from owner's list — Task 2 Step 4 (`listPropertyStaff` filters `isNull(removedAt)`)
- ✅ Removed staff don't appear in feedback picker — Task 2 Step 3 (`getVerifiedStaffAtProperty` filters `isNull(removedAt)`)
- ✅ Profile/passport link severed — Task 2 Step 2 (`getStaffProfile` throws NOT_FOUND), Task 4 (pages show deactivated message)
- ✅ Soft delete — `removedAt` flag only; no hard delete; feedback rows keep `staffProfileId` FK intact
- ✅ Cross-org protection — Task 2 Step 5 verifies `property.organisationId === org.id`
- ✅ DB schema + migration — Task 1 Steps 1 & 2
- ✅ Confirmation step before removal — Task 3 Step 3 (inline confirm UI)

**Placeholder scan:** None found.

**Type consistency:**
- `removedAt: timestamp("removed_at")` in schema → `staff.removedAt` in router → `isNull(staffProfiles.removedAt)` in queries — consistent throughout
- `removeStaff` takes `{ staffProfileId: string }` — matches `removeMutation.mutate({ staffProfileId: s.id })`
- `trpc.staff.removeStaff.mutationOptions(...)` — matches the router key `removeStaff`
- `error?.message === "This profile is no longer active."` — matches the exact string thrown in `getStaffProfile` when `staff.removedAt` is set

**Post-deploy step (user must do manually):** Run this in Supabase SQL Editor after pushing:
```sql
ALTER TABLE "staff_profiles" ADD COLUMN IF NOT EXISTS "removed_at" timestamp;
```
