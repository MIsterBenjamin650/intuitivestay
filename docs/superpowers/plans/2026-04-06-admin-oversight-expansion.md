# Admin Oversight Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the admin dashboard with plan-distribution and activity stats, clickable property links, and a full property detail page at `/admin/properties/:propertyId`.

**Architecture:** Part 1 adds new computed fields to the existing `getAllProperties` tRPC response (server) and replaces the single row of stat cards with three labelled rows in `AdminDashboard` (client). Part 2 adds a new `getAdminPropertyDetail` tRPC procedure and a new route + component pair that displays the complete data picture for a single property.

**Tech Stack:** Hono + tRPC (`packages/api`), TanStack Start + TanStack Router + React 19 (`apps/portal-web`), Drizzle ORM + PostgreSQL, `@tanstack/react-query`, `@tanstack/react-table`, `@intuitive-stay/ui` component library.

---

## File Map

| Action | File |
|--------|------|
| Modify | `packages/api/src/routers/properties.ts` — add expanded stats to `getAllProperties`, add `getAdminPropertyDetail` procedure |
| Modify | `apps/portal-web/src/components/admin-dashboard.tsx` — 3 rows of stat cards, clickable property names |
| Create | `apps/portal-web/src/components/admin-property-detail.tsx` — full property detail page component |
| Create | `apps/portal-web/src/routes/_portal.admin.properties.$propertyId.tsx` — route file |

---

## Task 1: Expand `getAllProperties` stats in the tRPC router

**Files:**
- Modify: `packages/api/src/routers/properties.ts`

This task adds 7 new fields to the `stats` object already returned by `getAllProperties`. Six are computed in JavaScript from the existing `rows` array. `totalUsers` requires one additional `db.select` query run in parallel with the existing one.

- [ ] **Step 1: Open the file and locate the `getAllProperties` procedure**

  File: `packages/api/src/routers/properties.ts`

  The procedure starts at the line beginning `getAllProperties: adminProcedure.query(async () => {`.

  The `user` table needs to be added to the import on line 2. Replace:
  ```ts
  import { feedback, organisations, properties, propertyScores, qrCodes } from "@intuitive-stay/db/schema"
  ```
  With:
  ```ts
  import { feedback, organisations, properties, propertyScores, qrCodes, user } from "@intuitive-stay/db/schema"
  ```

- [ ] **Step 2: Run the parallel queries**

  Inside `getAllProperties`, the current code does a single `await db.select(...)`. Replace it so the `user` count runs in parallel. Replace the block starting with `const rows = await db` down through the `.orderBy(desc(properties.createdAt))` call:

  ```ts
  const [rows, [userCountRow]] = await Promise.all([
    db
      .select({
        id: properties.id,
        name: properties.name,
        status: properties.status,
        city: properties.city,
        country: properties.country,
        type: properties.type,
        ownerName: properties.ownerName,
        ownerEmail: properties.ownerEmail,
        createdAt: properties.createdAt,
        plan: organisations.plan,
        avgGcs: propertyScores.avgGcs,
        totalFeedback: propertyScores.totalFeedback,
        lastFeedbackAt: lastFeedbackSq.lastFeedbackAt,
      })
      .from(properties)
      .innerJoin(organisations, eq(properties.organisationId, organisations.id))
      .leftJoin(propertyScores, eq(propertyScores.propertyId, properties.id))
      .leftJoin(lastFeedbackSq, eq(lastFeedbackSq.propertyId, properties.id))
      .orderBy(desc(properties.createdAt)),
    db.select({ total: count() }).from(user),
  ])
  ```

- [ ] **Step 3: Compute the new stats fields**

  After the existing `platformAvgGcs` computation block and before the `return` statement, add:

  ```ts
  const hostCount = rows.filter((r) => r.plan === "host").length
  const partnerCount = rows.filter((r) => r.plan === "partner").length
  const founderCount = rows.filter((r) => r.plan === "founder").length
  const platformTotalFeedback = rows.reduce((sum, r) => sum + (r.totalFeedback ?? 0), 0)
  const pendingCount = rows.filter((r) => r.status === "pending").length
  const inactiveCount = rows.filter(
    (r) => r.status === "approved" && (r.totalFeedback ?? 0) === 0,
  ).length
  const totalUsers = userCountRow?.total ?? 0
  ```

- [ ] **Step 4: Add the new fields to the returned `stats` object**

  Replace the existing `stats: { totalCount, approvedCount, platformAvgGcs }` in the `return` statement with:

  ```ts
  stats: {
    totalCount,
    approvedCount,
    platformAvgGcs,
    hostCount,
    partnerCount,
    founderCount,
    platformTotalFeedback,
    pendingCount,
    inactiveCount,
    totalUsers,
  },
  ```

- [ ] **Step 5: Verify the build compiles**

  From the repo root:
  ```bash
  cd C:\Users\miste\intuitivestay\intuitivestay
  pnpm --filter @intuitive-stay/api build
  ```
  Expected: no TypeScript errors. If there are import errors for `user`, confirm the schema index re-exports it:
  `packages/db/src/schema/index.ts` — check that `export * from "./auth"` is present.

- [ ] **Step 6: Commit**

  ```bash
  git add packages/api/src/routers/properties.ts
  git commit -m "feat: expand getAllProperties stats (plan dist, activity, user count)"
  ```

---

## Task 2: Update `AdminDashboard` — three stat rows + clickable property names

**Files:**
- Modify: `apps/portal-web/src/components/admin-dashboard.tsx`

- [ ] **Step 1: Add `Link` import**

  At the top of `apps/portal-web/src/components/admin-dashboard.tsx`, add `Link` to the `@tanstack/react-router` import. Add this line after the existing imports:

  ```ts
  import { Link } from "@tanstack/react-router"
  ```

- [ ] **Step 2: Update the `PropertyRow` type to include new stat fields**

  The `PropertyRow` type is used for the table rows — no changes needed there (the new fields are in `stats`, not per-row). Continue to next step.

- [ ] **Step 3: Update the property name column to be a clickable link**

  Find the `col.accessor("name", {...})` column definition and replace its `cell` renderer:

  ```ts
  col.accessor("name", {
    header: "Property",
    cell: (info) => (
      <Link
        to="/admin/properties/$propertyId"
        params={{ propertyId: info.row.original.id }}
        className="font-medium text-indigo-600 underline hover:text-indigo-800"
      >
        {info.getValue()}
      </Link>
    ),
    enableSorting: false,
  }),
  ```

- [ ] **Step 4: Replace the stats section with three labelled rows**

  Find the existing stats JSX block (the `{/* Stats */}` comment and the single `<div className="grid gap-4 md:grid-cols-3">` beneath it). Replace the entire block with:

  ```tsx
  {/* Stats — Row 1: Overview */}
  <div>
    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Overview</p>
    <div className="grid gap-4 md:grid-cols-3">
      <Card size="sm">
        <CardHeader>
          <CardDescription>Total Properties</CardDescription>
          <CardTitle>{isLoading ? "—" : (stats?.totalCount ?? 0)}</CardTitle>
        </CardHeader>
      </Card>
      <Card size="sm">
        <CardHeader>
          <CardDescription>Approved</CardDescription>
          <CardTitle>{isLoading ? "—" : (stats?.approvedCount ?? 0)}</CardTitle>
        </CardHeader>
      </Card>
      <Card size="sm">
        <CardHeader>
          <CardDescription>Platform Avg GCS</CardDescription>
          <CardTitle>
            {isLoading
              ? "—"
              : stats?.platformAvgGcs != null
                ? stats.platformAvgGcs.toFixed(1)
                : "No data"}
          </CardTitle>
        </CardHeader>
      </Card>
    </div>
  </div>

  {/* Stats — Row 2: Plan Distribution */}
  <div>
    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plan Distribution</p>
    <div className="grid gap-4 md:grid-cols-3">
      <Card size="sm" className="bg-slate-50">
        <CardHeader>
          <CardDescription className="text-slate-600">Host</CardDescription>
          <CardTitle className="text-slate-800">{isLoading ? "—" : (stats?.hostCount ?? 0)}</CardTitle>
        </CardHeader>
      </Card>
      <Card size="sm" className="bg-blue-50">
        <CardHeader>
          <CardDescription className="text-blue-700">Partner</CardDescription>
          <CardTitle className="text-blue-900">{isLoading ? "—" : (stats?.partnerCount ?? 0)}</CardTitle>
        </CardHeader>
      </Card>
      <Card size="sm" className="bg-purple-50">
        <CardHeader>
          <CardDescription className="text-purple-700">Founder</CardDescription>
          <CardTitle className="text-purple-900">{isLoading ? "—" : (stats?.founderCount ?? 0)}</CardTitle>
        </CardHeader>
      </Card>
    </div>
  </div>

  {/* Stats — Row 3: Activity */}
  <div>
    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activity</p>
    <div className="grid gap-4 md:grid-cols-4">
      <Card size="sm" className="bg-green-50">
        <CardHeader>
          <CardDescription className="text-green-700">Total Feedback</CardDescription>
          <CardTitle className="text-green-900">{isLoading ? "—" : (stats?.platformTotalFeedback ?? 0)}</CardTitle>
        </CardHeader>
      </Card>
      <Card size="sm" className="bg-yellow-50">
        <CardHeader>
          <CardDescription className="text-yellow-700">Pending Approval</CardDescription>
          <CardTitle className="text-yellow-900">
            {isLoading ? "—" : (
              <Link to="/admin/approvals" className="hover:underline">
                {stats?.pendingCount ?? 0}
              </Link>
            )}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card size="sm" className="bg-orange-50">
        <CardHeader>
          <CardDescription className="text-orange-700">No Activity</CardDescription>
          <CardTitle className="text-orange-900">{isLoading ? "—" : (stats?.inactiveCount ?? 0)}</CardTitle>
        </CardHeader>
      </Card>
      <Card size="sm">
        <CardHeader>
          <CardDescription>Registered Users</CardDescription>
          <CardTitle>{isLoading ? "—" : (stats?.totalUsers ?? 0)}</CardTitle>
        </CardHeader>
      </Card>
    </div>
  </div>
  ```

  The wrapping `<div className="flex flex-col gap-6 p-4 pt-0">` already exists — you are replacing only the inner stats block, not the outer wrapper.

- [ ] **Step 5: Verify the TypeScript types are satisfied**

  The `stats` object now has new fields from the tRPC response. Since TanStack Query infers the return type from the procedure, no manual type changes are needed in the component. Confirm that `stats?.hostCount`, `stats?.partnerCount`, etc. resolve without TS errors by running:

  ```bash
  cd C:\Users\miste\intuitivestay\intuitivestay
  pnpm --filter portal-web typecheck
  ```

  If `typecheck` script doesn't exist, run:
  ```bash
  pnpm --filter portal-web exec tsc --noEmit
  ```

  Expected: no errors relating to the new stat fields.

- [ ] **Step 6: Commit**

  ```bash
  git add apps/portal-web/src/components/admin-dashboard.tsx
  git commit -m "feat: admin dashboard — 3 stat rows and clickable property names"
  ```

---

## Task 3: Add `getAdminPropertyDetail` tRPC procedure

**Files:**
- Modify: `packages/api/src/routers/properties.ts`

- [ ] **Step 1: Add the procedure inside the router**

  Inside `propertiesRouter`, after the closing brace of `getAllProperties` and before `getMyProperties`, add:

  ```ts
  getAdminPropertyDetail: adminProcedure
    .input(z.object({ propertyId: z.string() }))
    .query(async ({ input }) => {
      // 1. Property + org plan + scores + qr (single row)
      const [row] = await db
        .select({
          id: properties.id,
          name: properties.name,
          status: properties.status,
          city: properties.city,
          country: properties.country,
          address: properties.address,
          type: properties.type,
          ownerName: properties.ownerName,
          ownerEmail: properties.ownerEmail,
          createdAt: properties.createdAt,
          plan: organisations.plan,
          avgGcs: propertyScores.avgGcs,
          avgResilience: propertyScores.avgResilience,
          avgEmpathy: propertyScores.avgEmpathy,
          avgAnticipation: propertyScores.avgAnticipation,
          avgRecognition: propertyScores.avgRecognition,
          totalFeedback: propertyScores.totalFeedback,
          qrUniqueCode: qrCodes.uniqueCode,
          qrFeedbackUrl: qrCodes.feedbackUrl,
          qrCreatedAt: qrCodes.createdAt,
        })
        .from(properties)
        .innerJoin(organisations, eq(properties.organisationId, organisations.id))
        .leftJoin(propertyScores, eq(propertyScores.propertyId, properties.id))
        .leftJoin(qrCodes, eq(qrCodes.propertyId, properties.id))
        .where(eq(properties.id, input.propertyId))

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })
      }

      // 2. All feedback rows for this property (newest first)
      const feedbackRows = await db
        .select({
          id: feedback.id,
          submittedAt: feedback.submittedAt,
          gcs: feedback.gcs,
          resilience: feedback.resilience,
          empathy: feedback.empathy,
          anticipation: feedback.anticipation,
          recognition: feedback.recognition,
          namedStaffMember: feedback.namedStaffMember,
          ventText: feedback.ventText,
          source: feedback.source,
          mealTime: feedback.mealTime,
        })
        .from(feedback)
        .where(eq(feedback.propertyId, input.propertyId))
        .orderBy(desc(feedback.submittedAt))

      const hasScores = row.avgGcs != null

      return {
        property: {
          id: row.id,
          name: row.name,
          status: row.status,
          city: row.city,
          country: row.country,
          address: row.address,
          type: row.type,
          ownerName: row.ownerName,
          ownerEmail: row.ownerEmail,
          plan: row.plan,
          createdAt: row.createdAt,
        },
        scores: hasScores
          ? {
              avgGcs: Number(row.avgGcs),
              avgResilience: row.avgResilience != null ? Number(row.avgResilience) : null,
              avgEmpathy: row.avgEmpathy != null ? Number(row.avgEmpathy) : null,
              avgAnticipation: row.avgAnticipation != null ? Number(row.avgAnticipation) : null,
              avgRecognition: row.avgRecognition != null ? Number(row.avgRecognition) : null,
              totalFeedback: row.totalFeedback ?? 0,
            }
          : null,
        qrCode: row.qrUniqueCode
          ? {
              uniqueCode: row.qrUniqueCode,
              feedbackUrl: row.qrFeedbackUrl!,
              createdAt: row.qrCreatedAt!,
            }
          : null,
        feedback: feedbackRows.map((f) => ({
          id: f.id,
          submittedAt: f.submittedAt,
          gcs: Number(f.gcs),
          resilience: f.resilience,
          empathy: f.empathy,
          anticipation: f.anticipation,
          recognition: f.recognition,
          namedStaffMember: f.namedStaffMember,
          ventText: f.ventText,
          source: f.source,
          mealTime: f.mealTime,
        })),
      }
    }),
  ```

  Note: `address` is a field on the `properties` table. Verify it exists by checking `packages/db/src/schema/properties.ts`. If the column is named differently, adjust accordingly.

- [ ] **Step 2: Check `address` exists on the properties schema**

  ```bash
  grep -n "address" C:\Users\miste\intuitivestay\intuitivestay\packages\db\src\schema\properties.ts
  ```

  If `address` is not a column, remove it from the `select` and from the `property` object in the return. If it has a different column name (e.g., `streetAddress`), use that name instead.

- [ ] **Step 3: Build to verify no TypeScript errors**

  ```bash
  cd C:\Users\miste\intuitivestay\intuitivestay
  pnpm --filter @intuitive-stay/api build
  ```

  Expected: clean build.

- [ ] **Step 4: Commit**

  ```bash
  git add packages/api/src/routers/properties.ts
  git commit -m "feat: add getAdminPropertyDetail tRPC procedure"
  ```

---

## Task 4: Create `admin-property-detail.tsx` component

**Files:**
- Create: `apps/portal-web/src/components/admin-property-detail.tsx`

- [ ] **Step 1: Create the file with the full component**

  Create `apps/portal-web/src/components/admin-property-detail.tsx` with:

  ```tsx
  import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "@intuitive-stay/ui/components/card"
  import { useQuery } from "@tanstack/react-query"
  import { Link } from "@tanstack/react-router"

  import { useTRPC } from "@/utils/trpc"

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  function statusBadge(status: string) {
    const styles: Record<string, string> = {
      approved: "bg-green-100 text-green-800",
      pending: "bg-yellow-100 text-yellow-800",
      rejected: "bg-red-100 text-red-800",
    }
    const cls = styles[status] ?? "bg-gray-100 text-gray-700"
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  function planBadge(plan: string) {
    const styles: Record<string, string> = {
      host: "bg-slate-100 text-slate-700",
      partner: "bg-blue-100 text-blue-700",
      founder: "bg-purple-100 text-purple-700",
    }
    const cls = styles[plan] ?? "bg-gray-100 text-gray-700"
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
        {plan.charAt(0).toUpperCase() + plan.slice(1)}
      </span>
    )
  }

  function scoreCard(label: string, value: number | null | undefined) {
    return (
      <Card size="sm">
        <CardHeader>
          <CardDescription>{label}</CardDescription>
          <CardTitle>{value != null ? value.toFixed(1) : "—"}</CardTitle>
        </CardHeader>
      </Card>
    )
  }

  function truncate(text: string | null | undefined, len: number): string {
    if (!text) return "—"
    return text.length > len ? text.slice(0, len) + "…" : text
  }

  // ─── Component ────────────────────────────────────────────────────────────────

  interface Props {
    propertyId: string
  }

  export function AdminPropertyDetail({ propertyId }: Props) {
    const trpc = useTRPC()
    const { data, isLoading, isError } = useQuery(
      trpc.properties.getAdminPropertyDetail.queryOptions({ propertyId }),
    )

    if (isLoading) {
      return <div className="p-6 text-muted-foreground">Loading…</div>
    }

    if (isError || !data) {
      return (
        <div className="p-6 text-destructive">
          Property not found or access denied.
        </div>
      )
    }

    const { property, scores, qrCode, feedback } = data

    return (
      <div className="flex flex-col gap-6 p-6">
        {/* Header */}
        <div>
          <Link
            to="/"
            className="mb-4 inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
          >
            ← Back to Admin Dashboard
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{property.name}</h1>
            {statusBadge(property.status)}
            {planBadge(property.plan)}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {[property.city, property.country, property.type].filter(Boolean).join(" · ")}
            {" · "}
            Registered {new Date(property.createdAt).toLocaleDateString()}
          </p>
        </div>

        {/* Info cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardDescription>Owner</CardDescription>
              <CardTitle className="text-base">{property.ownerName}</CardTitle>
              <p className="text-sm text-muted-foreground">{property.ownerEmail}</p>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>QR Code</CardDescription>
              {qrCode ? (
                <>
                  <CardTitle className="truncate text-sm font-medium">
                    {truncate(qrCode.feedbackUrl, 50)}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Generated {new Date(qrCode.createdAt).toLocaleDateString()}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No QR code yet</p>
              )}
            </CardHeader>
          </Card>
        </div>

        {/* Performance scores */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Performance</p>
          {scores == null ? (
            <p className="text-sm text-muted-foreground">No data yet</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-6">
              {scoreCard("Avg GCS", scores.avgGcs)}
              {scoreCard("Total Feedback", scores.totalFeedback)}
              {scoreCard("Resilience", scores.avgResilience)}
              {scoreCard("Empathy", scores.avgEmpathy)}
              {scoreCard("Anticipation", scores.avgAnticipation)}
              {scoreCard("Recognition", scores.avgRecognition)}
            </div>
          )}
        </div>

        {/* Feedback history */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Feedback History ({feedback.length} submission{feedback.length !== 1 ? "s" : ""})
          </p>
          {feedback.length === 0 ? (
            <p className="text-sm text-muted-foreground">No feedback received yet</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    {["Date", "GCS", "Resilience", "Empathy", "Anticipation", "Recognition", "Staff Named", "Vent Text"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {feedback.map((f) => (
                    <tr key={f.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(f.submittedAt).toLocaleDateString()}
                      </td>
                      <td className={`px-4 py-3 font-semibold ${f.gcs <= 5 ? "text-red-600" : ""}`}>
                        {f.gcs.toFixed(1)}
                      </td>
                      <td className="px-4 py-3">{f.resilience}</td>
                      <td className="px-4 py-3">{f.empathy}</td>
                      <td className="px-4 py-3">{f.anticipation}</td>
                      <td className="px-4 py-3">{f.recognition}</td>
                      <td className="px-4 py-3">{f.namedStaffMember ?? "—"}</td>
                      <td
                        className="max-w-[200px] truncate px-4 py-3 text-muted-foreground"
                        title={f.ventText ?? undefined}
                      >
                        {truncate(f.ventText, 40)}
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

  Note: `scoreCard("Total Feedback", scores.totalFeedback)` passes a `number` where the helper expects `number | null | undefined`. `toFixed` won't be called on it meaningfully (it's an integer), but it will render fine — the value will show as e.g. `142.0`. If you want it without the decimal, adjust `scoreCard` to accept a special case or display `scores.totalFeedback` directly. The simplest approach that matches the spec is to leave it as-is.

- [ ] **Step 2: Check for TypeScript errors**

  ```bash
  cd C:\Users\miste\intuitivestay\intuitivestay
  pnpm --filter portal-web exec tsc --noEmit
  ```

  Expected: no new errors from this file.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/portal-web/src/components/admin-property-detail.tsx
  git commit -m "feat: add AdminPropertyDetail component"
  ```

---

## Task 5: Create the `/admin/properties/$propertyId` route

**Files:**
- Create: `apps/portal-web/src/routes/_portal.admin.properties.$propertyId.tsx`

- [ ] **Step 1: Create the route file**

  Create `apps/portal-web/src/routes/_portal.admin.properties.$propertyId.tsx`:

  ```tsx
  import { createFileRoute, redirect } from "@tanstack/react-router"

  import { AdminPropertyDetail } from "@/components/admin-property-detail"

  export const Route = createFileRoute("/_portal/admin/properties/$propertyId")({
    beforeLoad: ({ context }) => {
      const isAdmin =
        (context.session as { isAdmin?: boolean } | null)?.isAdmin === true
      if (!isAdmin) {
        throw redirect({ to: "/" })
      }
    },
    component: RouteComponent,
  })

  function RouteComponent() {
    const { propertyId } = Route.useParams()
    return <AdminPropertyDetail propertyId={propertyId} />
  }
  ```

  The `context.session` is provided by the parent `_portal.tsx` layout's `beforeLoad` — it is already available in child route contexts without needing to fetch it again.

- [ ] **Step 2: Verify the TypeScript build**

  ```bash
  cd C:\Users\miste\intuitivestay\intuitivestay
  pnpm --filter portal-web exec tsc --noEmit
  ```

  Expected: no errors. If TanStack Router's generated types complain about the new route path, run the route codegen first:
  ```bash
  pnpm --filter portal-web exec tsr generate
  ```
  Or, if there's a `generate:routes` script in portal-web's package.json, run that. Then recheck.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/portal-web/src/routes/_portal.admin.properties.$propertyId.tsx
  git commit -m "feat: add admin property detail route at /admin/properties/:propertyId"
  ```

---

## Task 6: Deploy and verify end-to-end

**Files:** None (deploy-only task)

- [ ] **Step 1: Push to main to trigger Railway deploy**

  ```bash
  git push origin main
  ```

  Both `intuitivestay-production` (portal-server) and `vibrant-wonder-production` (portal-web) will redeploy automatically.

- [ ] **Step 2: Verify the expanded stats appear on the admin dashboard**

  Log in as admin at `https://vibrant-wonder-production.up.railway.app`. On the main dashboard (`/`), confirm:
  - Three labelled rows of stat cards are visible: "Overview", "Plan Distribution", "Activity"
  - Plan Distribution shows Host / Partner / Founder counts
  - Activity shows Total Feedback (green), Pending Approval (yellow, links to /admin/approvals), No Activity (orange), Registered Users
  - Each property name in the table is a clickable indigo underlined link

- [ ] **Step 3: Verify the property detail page**

  Click any property name in the admin table. Confirm the page at `/admin/properties/<id>`:
  - Shows breadcrumb "← Back to Admin Dashboard"
  - Shows property name, status badge, plan badge
  - Shows subtitle with city, country, type, registered date
  - Shows Owner card (name + email) and QR Code card (URL + date, or "No QR code yet")
  - Shows 6 performance score cards (GCS, Total Feedback, Resilience, Empathy, Anticipation, Recognition)
  - Shows Feedback History table with all submissions, newest first
  - GCS ≤ 5 renders in red
  - Vent Text is truncated at ~40 chars with full text visible on hover

- [ ] **Step 4: Verify non-admin redirect**

  Log in as a regular property owner. Manually navigate to `/admin/properties/<any-id>`. Confirm it redirects to `/` rather than showing property data.
