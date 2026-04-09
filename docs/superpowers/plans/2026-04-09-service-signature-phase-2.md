# Service Signature Phase 2 — Feedback Attribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a guest submits feedback with an average GCS ≥ 8, show a picker of verified staff at that property so the guest can attribute the score to a specific staff member — linking the feedback row to a `staff_profile_id`.

**Architecture:** Two changes — API layer adds `propertyId` to the feedback form query, adds `getVerifiedStaffAtProperty` to the staff router, and adds optional `staffProfileId` to `submitFeedback`; the feedback form conditionally queries verified staff and replaces the three free-text name inputs with a button picker when gcs ≥ 8.

**Tech Stack:** tRPC public procedures, Drizzle ORM, TanStack Query, React, Tailwind CSS.

---

## File Map

| Action | Path |
|--------|------|
| **Modify** | `packages/api/src/routers/feedback.ts` — `getFeedbackFormData` returns `propertyId`; `submitFeedback` accepts optional `staffProfileId` |
| **Modify** | `packages/api/src/routers/staff.ts` — add `getVerifiedStaffAtProperty` public procedure |
| **Modify** | `apps/portal-web/src/routes/f.$uniqueCode.tsx` — staff picker when gcs ≥ 8 |

---

### Task 1: API changes — expose propertyId, add staff query, accept staffProfileId

**Files:**
- Modify: `packages/api/src/routers/feedback.ts`
- Modify: `packages/api/src/routers/staff.ts`

- [ ] **Step 1: Update `getFeedbackFormData` to return `propertyId`**

Open `packages/api/src/routers/feedback.ts`. Find `getFeedbackFormData`. Its return currently is:

```typescript
return { propertyName: property.name }
```

Change it to:

```typescript
return { propertyName: property.name, propertyId: property.id }
```

- [ ] **Step 2: Add `staffProfileId` to `submitFeedback` input schema**

In the same file, find the `submitFeedback` zod input schema. Add this field after `fingerprint`:

```typescript
/** Verified staff profile to attribute this high-score feedback to (optional). */
staffProfileId: z.string().optional(),
```

So the full schema becomes:

```typescript
z.object({
  uniqueCode: z.string(),
  resilience: z.number().int().min(0).max(10),
  empathy: z.number().int().min(0).max(10),
  anticipation: z.number().int().min(0).max(10),
  recognition: z.number().int().min(0).max(10),
  mealTime: z.enum(["morning", "lunch", "dinner", "none"]).nullable().optional(),
  guestEmail: z.string().email().optional(),
  adjectives: z.string().optional(),
  /** Browser-derived device fingerprint for duplicate prevention */
  fingerprint: z.string().optional(),
  /** Verified staff profile to attribute this high-score feedback to (optional). */
  staffProfileId: z.string().optional(),
})
```

- [ ] **Step 3: Write `staffProfileId` to the feedback row**

In the same file, find the `db.insert(feedback).values({...})` call inside `submitFeedback`. Add `staffProfileId` to the values object. Only write it when gcs ≥ 8 (server-side guard):

```typescript
await db.insert(feedback).values({
  id: feedbackId,
  propertyId: qrCode.propertyId,
  qrCodeId: qrCode.id,
  resilience: input.resilience,
  empathy: input.empathy,
  anticipation: input.anticipation,
  recognition: input.recognition,
  gcs: gcs.toFixed(2),
  mealTime: input.mealTime ?? null,
  guestEmail: input.guestEmail ?? null,
  adjectives: input.adjectives ?? null,
  isUniformScore,
  source: "qr_form",
  submittedAt: new Date(),
  staffProfileId: input.staffProfileId && gcs >= 8 ? input.staffProfileId : null,
})
```

- [ ] **Step 4: Add `getVerifiedStaffAtProperty` to the staff router**

Open `packages/api/src/routers/staff.ts`. Add this procedure to the router (after `listPropertyStaff`):

```typescript
  /**
   * Public — returns verified staff at a property for the feedback form picker.
   * Display name is "Firstname L." to protect staff surnames from guests.
   * Only staff with emailVerifiedAt set are returned.
   */
  getVerifiedStaffAtProperty: publicProcedure
    .input(z.object({ propertyId: z.string() }))
    .query(async ({ input }) => {
      const staff = await db
        .select({
          id: staffProfiles.id,
          name: staffProfiles.name,
        })
        .from(staffProfiles)
        .where(
          and(
            eq(staffProfiles.propertyId, input.propertyId),
            isNotNull(staffProfiles.emailVerifiedAt),
          ),
        )
        .orderBy(asc(staffProfiles.name))

      return staff.map((s) => {
        const parts = s.name.trim().split(/\s+/)
        const displayName =
          parts.length === 1
            ? parts[0]
            : `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`
        return { id: s.id, displayName }
      })
    }),
```

You also need to add `isNotNull` to the drizzle-orm imports at the top of `staff.ts`. The current import line is:

```typescript
import { and, asc, eq } from "drizzle-orm"
```

Change to:

```typescript
import { and, asc, eq, isNotNull } from "drizzle-orm"
```

- [ ] **Step 5: Commit**

```bash
cd /c/Users/miste/intuitivestay/intuitivestay
git add packages/api/src/routers/feedback.ts packages/api/src/routers/staff.ts
git commit -m "feat: expose propertyId in getFeedbackFormData, add getVerifiedStaffAtProperty, accept staffProfileId in submitFeedback"
```

---

### Task 2: Feedback form — staff picker when gcs ≥ 8

**Files:**
- Modify: `apps/portal-web/src/routes/f.$uniqueCode.tsx`

**Context:** The form has two paths after all sliders are moved:
- `isLowScore` (gcs ≤ 5): vent box only
- High score (gcs > 5): adjective cloud + staff names + private message

Phase 2 adds a third branch within the high-score path: when gcs ≥ 8, the three free-text staff name inputs are replaced by a button picker showing verified staff at the property.

- [ ] **Step 1: Add `selectedStaffProfileId` state and query verified staff**

Open `apps/portal-web/src/routes/f.$uniqueCode.tsx`.

After the existing state declarations (around line 215), add:

```typescript
// Staff picker — only shown when gcs >= 8
const [selectedStaffProfileId, setSelectedStaffProfileId] = useState<string | null>(null)
```

The form already has `trpc` and `data` in scope. Add a query for verified staff after the existing `useQuery` call for `getFeedbackFormData`:

```typescript
const { data: verifiedStaff } = useQuery({
  ...trpc.staff.getVerifiedStaffAtProperty.queryOptions({
    propertyId: data?.propertyId ?? "",
  }),
  enabled: gcs >= 8 && phase2Visible && !!data?.propertyId,
})
```

Place this after the `const gcs = ...` calculation so `gcs` is in scope.

- [ ] **Step 2: Pass `staffProfileId` in `handleSubmit`**

Find `handleSubmit`. The `submitFeedback` call currently passes these fields:

```typescript
const result = await trpcClient.feedback.submitFeedback.mutate({
  uniqueCode,
  resilience,
  empathy,
  anticipation,
  recognition,
  mealTime,
  guestEmail: guestEmail.trim() || undefined,
  adjectives: selectedAdjectives.length > 0 ? selectedAdjectives.join(',') : undefined,
  fingerprint: fingerprint || undefined,
})
```

Add `staffProfileId` to it:

```typescript
const result = await trpcClient.feedback.submitFeedback.mutate({
  uniqueCode,
  resilience,
  empathy,
  anticipation,
  recognition,
  mealTime,
  guestEmail: guestEmail.trim() || undefined,
  adjectives: selectedAdjectives.length > 0 ? selectedAdjectives.join(',') : undefined,
  fingerprint: fingerprint || undefined,
  staffProfileId: selectedStaffProfileId ?? undefined,
})
```

Also, in `handleSubmit`, find the name-drop block:

```typescript
if (!isLowScore) {
  const names = [staffName1, staffName2, staffName3].filter((n) => n.trim())
  for (const staffName of names) {
    await trpcClient.feedback.submitNameDrop.mutate({
      feedbackId,
      uniqueCode,
      staffName: staffName.trim(),
    })
  }
}
```

Replace it with a guard — only call `submitNameDrop` when gcs < 8 (i.e., no staff picker was shown):

```typescript
if (!isLowScore && gcs < 8) {
  const names = [staffName1, staffName2, staffName3].filter((n) => n.trim())
  for (const staffName of names) {
    await trpcClient.feedback.submitNameDrop.mutate({
      feedbackId,
      uniqueCode,
      staffName: staffName.trim(),
    })
  }
}
```

- [ ] **Step 3: Replace the staff name inputs with the picker in the high-score path**

Find the "Staff names" section in the JSX (inside `{!isLowScore && (...)}` around line 522–558). It currently renders three `<input>` elements for `staffName1`, `staffName2`, `staffName3`.

Replace the entire staff names section with this conditional:

```tsx
{/* Staff attribution — picker when gcs >= 8, free-text otherwise */}
{gcs >= 8 && verifiedStaff && verifiedStaff.length > 0 ? (
  <div className="space-y-3">
    <div className="text-center space-y-1">
      <p className="text-sm font-semibold text-center">
        Did any particular staff member stand out?
        <span className="ml-2 text-xs font-normal text-muted-foreground">(Optional)</span>
      </p>
      <p className="text-xs text-muted-foreground text-center">
        Tap their name if someone went above and beyond.
      </p>
    </div>
    <div className="flex flex-wrap gap-2 justify-center">
      {verifiedStaff.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() =>
            setSelectedStaffProfileId((prev) => (prev === s.id ? null : s.id))
          }
          className={cn(
            "px-4 py-2 rounded-full text-sm border transition-colors",
            selectedStaffProfileId === s.id
              ? "bg-orange-500 text-white border-orange-500"
              : "border-border hover:bg-muted",
          )}
        >
          {s.displayName}
        </button>
      ))}
    </div>
  </div>
) : gcs < 8 ? (
  <div className="space-y-3">
    <div className="text-center space-y-1">
      <p className="text-sm font-semibold text-center">
        Did any particular staff members stand out?
        <span className="ml-2 text-xs font-normal text-muted-foreground">(Optional)</span>
      </p>
      <p className="text-xs text-muted-foreground text-center">
        Did someone go above and beyond? Let us know their name.
      </p>
    </div>
    <div className="space-y-2 flex flex-col items-center">
      <input
        type="text"
        value={staffName1}
        onChange={(e) => setStaffName1(e.target.value)}
        placeholder="Staff member's name"
        className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        maxLength={100}
      />
      <input
        type="text"
        value={staffName2}
        onChange={(e) => setStaffName2(e.target.value)}
        placeholder="Staff member's name"
        className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        maxLength={100}
      />
      <input
        type="text"
        value={staffName3}
        onChange={(e) => setStaffName3(e.target.value)}
        placeholder="Staff member's name"
        className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        maxLength={100}
      />
    </div>
  </div>
) : null}
```

Note: when `gcs >= 8` and `verifiedStaff` is empty or undefined (no registered staff at this property), the section is hidden entirely — clean and simple.

- [ ] **Step 4: Commit and push**

```bash
cd /c/Users/miste/intuitivestay/intuitivestay
git add "apps/portal-web/src/routes/f.\$uniqueCode.tsx"
git commit -m "feat: replace staff name inputs with verified staff picker when gcs >= 8"
git push origin main
```

---

## Self-Review

**Spec coverage:**
- ✅ Staff picker shown when gcs ≥ 8 — Task 2 Step 3
- ✅ Picker lists verified staff at that property — Task 1 Step 4
- ✅ Display name format "Tiffany D." — Task 1 Step 4 (displayName computation)
- ✅ Single-name staff shown as-is — Task 1 Step 4 (parts.length === 1 guard)
- ✅ Picker is optional (guest need not select) — Task 2 Step 3 (toggle off, no required state)
- ✅ `staffProfileId` passed to server — Task 2 Step 2
- ✅ Server writes `staffProfileId` only when gcs ≥ 8 — Task 1 Step 3
- ✅ No DB migrations needed — `feedback.staff_profile_id` added in Phase 1
- ✅ Existing submission flow unbroken — `staffProfileId` is optional, free-text path preserved for gcs < 8

**Placeholder scan:** None found.

**Type consistency:**
- `verifiedStaff` is typed as `Array<{ id: string, displayName: string }>` from the router — matches usage in picker (`s.id`, `s.displayName`).
- `selectedStaffProfileId: string | null` — passed as `selectedStaffProfileId ?? undefined` to match `z.string().optional()`.
- `data?.propertyId` — now returned by `getFeedbackFormData`, used as `queryOptions` input with `enabled` guard preventing query when undefined.

**Phase boundary:** Phase 2 ends here. Staff profiles now accumulate real `staff_profile_id` links on feedback rows from verified, picker-selected staff. Phase 3 will read these to power the staff dashboard.
