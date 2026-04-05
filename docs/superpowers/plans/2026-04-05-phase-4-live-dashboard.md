# Phase 4 — Live Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the "Consistency" pillar to "Anticipation" across the entire codebase and database, then replace all hardcoded placeholder data across portal dashboard pages with real data.

**Architecture:** Task 0 renames the DB column (via drizzle-kit push rename detection) and updates all code references. Tasks 1–6 add new tRPC procedures and wire each dashboard route to real data from `property_scores`, `feedback`, and `qr_codes`. The GCS scale is 1–10 (not 0–100).

**Tech Stack:** Drizzle ORM, drizzle-kit push, tRPC protectedProcedure, TanStack Query, Recharts

---

## File Map

**Task 0 — Rename:**
- Modify: `packages/db/src/schema/feedback.ts` — rename `consistency` field
- Modify: `packages/db/src/schema/property-scores.ts` — rename `avgConsistency` field
- Modify: `packages/api/src/routers/feedback.ts` — rename all `consistency`/`avgConsistency` refs
- Modify: `apps/portal-web/src/routes/f.$uniqueCode.tsx` — rename pillar label + state var

**Tasks 1–6 — Live Data:**
- Modify: `packages/api/src/routers/properties.ts` — add `getPortfolioDashboard`, `getPropertyDashboard`, `getPropertyQrData`
- Modify: `packages/api/src/routers/feedback.ts` — add `getPropertyFeedbackSummary`, `getPropertyAlertFeedback`
- Modify: `apps/portal-web/src/routes/_portal.index.tsx`
- Modify: `apps/portal-web/src/routes/_portal.properties.tsx`
- Modify: `apps/portal-web/src/routes/_portal.properties.$propertyId.dashboard.tsx`
- Modify: `apps/portal-web/src/routes/_portal.properties.$propertyId.feedback.tsx`
- Modify: `apps/portal-web/src/routes/_portal.properties.$propertyId.alerts.tsx`
- Modify: `apps/portal-web/src/routes/_portal.properties.$propertyId.qr-form.tsx`

---

## Task 0: Rename consistency → anticipation everywhere

**Files:**
- Modify: `packages/db/src/schema/feedback.ts`
- Modify: `packages/db/src/schema/property-scores.ts`
- Modify: `packages/api/src/routers/feedback.ts`
- Modify: `apps/portal-web/src/routes/f.$uniqueCode.tsx`

- [ ] **Step 1: Read the feedback schema file**

  Read `packages/db/src/schema/feedback.ts` fully.

- [ ] **Step 2: Rename the consistency column in feedback.ts**

  In `packages/db/src/schema/feedback.ts`, find the line:
  ```typescript
  consistency: integer("consistency").notNull(),
  ```
  Replace with:
  ```typescript
  anticipation: integer("anticipation").notNull(),
  ```

- [ ] **Step 3: Read the property-scores schema file**

  Read `packages/db/src/schema/property-scores.ts` fully.

- [ ] **Step 4: Rename the avgConsistency column in property-scores.ts**

  In `packages/db/src/schema/property-scores.ts`, find the line:
  ```typescript
  avgConsistency: numeric("avg_consistency", { precision: 4, scale: 2 }),
  ```
  Replace with:
  ```typescript
  avgAnticipation: numeric("avg_anticipation", { precision: 4, scale: 2 }),
  ```

- [ ] **Step 5: Push the schema change to the database**

  Run from `packages/db`:
  ```bash
  cd C:/Users/miste/intuitivestay/intuitivestay/packages/db && pnpm db:push
  ```

  Drizzle-kit will detect the column rename and prompt interactively:
  - For `feedback.consistency → feedback.anticipation`: confirm the **rename** (not drop+add)
  - For `property_scores.avg_consistency → property_scores.avg_anticipation`: confirm the **rename**

  **IMPORTANT:** Choose "rename column" when prompted. Do NOT choose "drop and add" as that destroys existing data.

- [ ] **Step 6: Read feedback.ts tRPC router**

  Read `packages/api/src/routers/feedback.ts` fully before editing.

- [ ] **Step 7: Rename all consistency references in feedback.ts**

  In `packages/api/src/routers/feedback.ts`, replace every occurrence of:
  - `consistency` → `anticipation`
  - `avgConsistency` → `avgAnticipation`

  Specific locations (check all of them):
  - The `updatePropertyScores` helper function: `scores.consistency`, `existing.avgConsistency`, `prev.consistency`
  - The `submitFeedback` mutation: `consistency: input.consistency`, `consistency: input.consistency` (in the insert values and in the `updatePropertyScores` call)
  - The `getPropertyFeedbackSummary` procedure (if already added from a prior task): `avgConsistency`

  After editing, verify the file has zero instances of "consistency" (case-sensitive search):
  ```bash
  grep -n "consistency" C:/Users/miste/intuitivestay/intuitivestay/packages/api/src/routers/feedback.ts
  ```
  Expected: No output (no matches).

- [ ] **Step 8: Read the guest feedback form**

  Read `apps/portal-web/src/routes/f.$uniqueCode.tsx` fully.

- [ ] **Step 9: Rename consistency in the guest feedback form**

  In `apps/portal-web/src/routes/f.$uniqueCode.tsx`:

  a) Rename the state variable (find and replace all occurrences):
  ```typescript
  // Before:
  const [consistency, setConsistency] = useState(0)
  // After:
  const [anticipation, setAnticipation] = useState(0)
  ```

  b) Update the `submitFeedback` mutation payload:
  ```typescript
  // Before:
  consistency,
  // After:
  anticipation,
  ```

  c) Update the `allRated` check:
  ```typescript
  // Before:
  const allRated = resilience > 0 && empathy > 0 && consistency > 0 && recognition > 0
  // After:
  const allRated = resilience > 0 && empathy > 0 && anticipation > 0 && recognition > 0
  ```

  d) Update the `RatingInput` component that shows the "Consistency" label:
  ```tsx
  // Before:
  <RatingInput
    label="Consistency"
    description="Was the quality of service consistent throughout?"
    value={consistency}
    onChange={setConsistency}
  />
  // After:
  <RatingInput
    label="Anticipation"
    description="Did staff anticipate your needs before you had to ask?"
    value={anticipation}
    onChange={setAnticipation}
  />
  ```

  e) Verify zero instances of "consistency" (case-insensitive) remain:
  ```bash
  grep -in "consistency" "C:/Users/miste/intuitivestay/intuitivestay/apps/portal-web/src/routes/f.\$uniqueCode.tsx"
  ```
  Expected: No output.

- [ ] **Step 10: Update submitFeedback input schema in feedback.ts**

  In `packages/api/src/routers/feedback.ts`, the `submitFeedback` input Zod schema has:
  ```typescript
  consistency: z.number().int().min(1).max(10),
  ```
  Replace with:
  ```typescript
  anticipation: z.number().int().min(1).max(10),
  ```

- [ ] **Step 11: Verify TypeScript compiles across both packages**

  ```bash
  cd C:/Users/miste/intuitivestay/intuitivestay/packages/api && npx tsc --noEmit
  cd C:/Users/miste/intuitivestay/intuitivestay/apps/portal-web && npx tsc --noEmit
  ```

  Expected: No errors. Fix any remaining "consistency" references that TypeScript flags.

- [ ] **Step 12: Commit all rename changes**

  ```bash
  git -C C:/Users/miste/intuitivestay/intuitivestay add \
    packages/db/src/schema/feedback.ts \
    packages/db/src/schema/property-scores.ts \
    packages/api/src/routers/feedback.ts \
    "apps/portal-web/src/routes/f.\$uniqueCode.tsx"
  git -C C:/Users/miste/intuitivestay/intuitivestay commit -m "feat: rename consistency pillar to anticipation across schema, API, and guest form"
  ```

---

## Task 1: Add portfolio dashboard procedure + wire index page

**Files:**
- Modify: `packages/api/src/routers/properties.ts`
- Modify: `apps/portal-web/src/routes/_portal.index.tsx`

### Schema facts
- `propertyScores.avgGcs` is a `numeric(4,2)` string — convert with `Number()`
- `feedback.gcs` is `numeric(4,2)` — compare with SQL cast: `${feedback.gcs}::numeric <= 5`
- GCS scale is **1–10**, not 0–100

- [ ] **Step 1: Read properties.ts**

  Read `packages/api/src/routers/properties.ts` in full before editing.

- [ ] **Step 2: Add imports to properties.ts**

  Add these to the existing import lines (only what is missing):

  ```typescript
  import { feedback, propertyScores } from "@intuitive-stay/db/schema"
  import { and, count, inArray, sql } from "drizzle-orm"
  ```

- [ ] **Step 3: Add getPortfolioDashboard procedure**

  Inside `propertiesRouter`, add after `getMyProperties`:

  ```typescript
  getPortfolioDashboard: protectedProcedure.query(async ({ ctx }) => {
    const org = await db.query.organisations.findFirst({
      where: eq(organisations.ownerId, ctx.session.user.id),
    })

    if (!org) {
      return { portfolioGcs: null, activeCount: 0, alertCount: 0, monthlyTrend: [] }
    }

    const orgProperties = await db
      .select({ id: properties.id, status: properties.status })
      .from(properties)
      .where(eq(properties.organisationId, org.id))

    const activeCount = orgProperties.filter((p) => p.status === "approved").length
    const propertyIds = orgProperties.map((p) => p.id)

    if (propertyIds.length === 0) {
      return { portfolioGcs: null, activeCount, alertCount: 0, monthlyTrend: [] }
    }

    // Portfolio GCS = average of all properties' avgGcs
    const scoreRows = await db
      .select({ avgGcs: propertyScores.avgGcs })
      .from(propertyScores)
      .where(inArray(propertyScores.propertyId, propertyIds))

    const validScores = scoreRows
      .map((r) => Number(r.avgGcs))
      .filter((n) => !isNaN(n) && n > 0)
    const portfolioGcs =
      validScores.length > 0
        ? Math.round((validScores.reduce((a, b) => a + b, 0) / validScores.length) * 10) / 10
        : null

    // Alert count = feedback where GCS <= 5
    const [alertResult] = await db
      .select({ total: count() })
      .from(feedback)
      .where(and(inArray(feedback.propertyId, propertyIds), sql`${feedback.gcs}::numeric <= 5`))
    const alertCount = alertResult?.total ?? 0

    // Monthly trend: avg GCS per month (last 6 months)
    const trendRows = await db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${feedback.submittedAt}), 'Mon YYYY')`,
        avgGcs: sql<string>`round(avg(${feedback.gcs}::numeric), 2)`,
      })
      .from(feedback)
      .where(
        and(
          inArray(feedback.propertyId, propertyIds),
          sql`${feedback.submittedAt} >= now() - interval '6 months'`,
        ),
      )
      .groupBy(sql`date_trunc('month', ${feedback.submittedAt})`)
      .orderBy(sql`date_trunc('month', ${feedback.submittedAt})`)

    const monthlyTrend = trendRows.map((r) => ({
      month: r.month,
      score: Number(r.avgGcs),
    }))

    return { portfolioGcs, activeCount, alertCount, monthlyTrend }
  }),
  ```

- [ ] **Step 4: Verify properties.ts compiles**

  ```bash
  cd C:/Users/miste/intuitivestay/intuitivestay/packages/api && npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 5: Commit backend change**

  ```bash
  git -C C:/Users/miste/intuitivestay/intuitivestay add packages/api/src/routers/properties.ts
  git -C C:/Users/miste/intuitivestay/intuitivestay commit -m "feat(api): add getPortfolioDashboard procedure"
  ```

- [ ] **Step 6: Replace _portal.index.tsx**

  Replace the entire file with:

  ```tsx
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@intuitive-stay/ui/components/card"
  import { useQuery } from "@tanstack/react-query"
  import { createFileRoute } from "@tanstack/react-router"
  import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

  import { useTRPC } from "@/utils/trpc"

  export const Route = createFileRoute("/_portal/")({
    component: RouteComponent,
  })

  function RouteComponent() {
    const trpc = useTRPC()
    const { data, isLoading } = useQuery(trpc.properties.getPortfolioDashboard.queryOptions())

    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="grid gap-4 md:grid-cols-3">
          <Card size="sm">
            <CardHeader>
              <CardDescription>Portfolio GCS</CardDescription>
              <CardTitle>
                {isLoading ? "—" : data?.portfolioGcs != null ? data.portfolioGcs.toFixed(1) : "No data"}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardDescription>Active Properties</CardDescription>
              <CardTitle>{isLoading ? "—" : (data?.activeCount ?? 0)}</CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardDescription>Open Alerts</CardDescription>
              <CardTitle>{isLoading ? "—" : (data?.alertCount ?? 0)}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Organisation Dashboard</CardTitle>
            <CardDescription>
              Cross-property satisfaction health, trends, and priority actions.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Main dashboard aggregates all properties. Drill into each property from the sidebar.
          </CardContent>
        </Card>

        <div className="mt-2 rounded-lg border p-4">
          <h2 className="mb-4 text-lg font-semibold">Guest Satisfaction Over Time</h2>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !data?.monthlyTrend.length ? (
            <p className="text-sm text-muted-foreground">
              No feedback received yet. Scores will appear here once guests start submitting.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis domain={[0, 10]} />
                <Tooltip formatter={(v: number) => v.toFixed(2)} />
                <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 7: Verify portal-web compiles**

  ```bash
  cd C:/Users/miste/intuitivestay/intuitivestay/apps/portal-web && npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 8: Commit frontend change**

  ```bash
  git -C C:/Users/miste/intuitivestay/intuitivestay add apps/portal-web/src/routes/_portal.index.tsx
  git -C C:/Users/miste/intuitivestay/intuitivestay commit -m "feat(web): wire org dashboard to real portfolio GCS, property count, alert count, trend chart"
  ```

---

## Task 2: Wire properties list to real data

**Files:**
- Modify: `apps/portal-web/src/routes/_portal.properties.tsx`

The DB schema for properties has: `id`, `name`, `type`, `status`, `ownerEmail`, `ownerName`, `address`, `city`, `country`. The mock has extra fields (`businessPhone`, `businessWebsite`, `routePropertyId`) that don't exist in the schema — drop those columns from the table. Use `property.id` (UUID) as the route parameter.

- [ ] **Step 1: Read the current file**

  Read `apps/portal-web/src/routes/_portal.properties.tsx` in sections (it's large):
  - Lines 1–200: imports, types, MOCK_PROPERTIES
  - Lines 200+: component code, columns, table JSX

- [ ] **Step 2: Add tRPC imports**

  Add near the top alongside existing `@tanstack/react-*` imports:

  ```typescript
  import { useQuery } from "@tanstack/react-query"
  import { useTRPC } from "@/utils/trpc"
  ```

- [ ] **Step 3: Update the PropertyRow type**

  Replace the existing `PropertyRow` type with:

  ```typescript
  type PropertyRow = {
    id: string
    name: string
    status: "pending" | "approved" | "rejected"
    type: string | null
    ownerName: string
    ownerEmail: string
    city: string
    country: string
  }
  ```

- [ ] **Step 4: Delete MOCK_PROPERTIES**

  Remove the entire `const MOCK_PROPERTIES: PropertyRow[] = [...]` block.

- [ ] **Step 5: Replace local data state with tRPC query**

  In the main route component, find and remove:
  ```typescript
  const [data, setData] = React.useState<PropertyRow[]>(MOCK_PROPERTIES)
  ```
  Replace with:
  ```typescript
  const trpc = useTRPC()
  const { data: rawProperties = [], isLoading } = useQuery(
    trpc.properties.getMyProperties.queryOptions(),
  )
  const data: PropertyRow[] = rawProperties.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status as "pending" | "approved" | "rejected",
    type: p.type,
    ownerName: p.ownerName,
    ownerEmail: p.ownerEmail,
    city: p.city,
    country: p.country,
  }))
  ```

- [ ] **Step 6: Replace the columns definition**

  Find the `columns` array. Replace it with:

  ```typescript
  const columns: ColumnDef<PropertyRow>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button variant="ghost" size="sm" onClick={() => column.toggleSorting()}>
          Property Name <ArrowUpDownIcon className="ml-1 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <Link to="/properties/$propertyId/dashboard" params={{ propertyId: row.original.id }}>
          <span className="font-medium hover:underline">{row.original.name}</span>
        </Link>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const s = row.original.status
        return (
          <Badge
            variant={
              s === "approved" ? "default" : s === "rejected" ? "destructive" : "secondary"
            }
          >
            {s === "pending"
              ? "Awaiting Approval"
              : s.charAt(0).toUpperCase() + s.slice(1)}
          </Badge>
        )
      },
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => row.original.type ?? "—",
    },
    {
      accessorKey: "city",
      header: "City",
    },
    {
      accessorKey: "ownerName",
      header: "Owner",
    },
    {
      accessorKey: "ownerEmail",
      header: "Email",
    },
  ]
  ```

- [ ] **Step 7: Add loading state**

  In the JSX where the table is rendered, wrap it with a loading guard. Find the `<Table>` element and wrap the section with:

  ```tsx
  {isLoading ? (
    <p className="text-sm text-muted-foreground py-8 text-center">Loading properties…</p>
  ) : (
    /* the existing <Table>...</Table> JSX */
  )}
  ```

- [ ] **Step 8: Fix any remaining references to removed fields**

  Search for lingering references to old fields (`propertyId`, `propertyName`, `businessPhone`, `businessWebsite`, `routePropertyId`) and update or remove them. Common locations: filter functions, sort accessors, popover content, dialog prefill.

  ```bash
  grep -n "propertyName\|businessPhone\|businessWebsite\|routePropertyId" C:/Users/miste/intuitivestay/intuitivestay/apps/portal-web/src/routes/_portal.properties.tsx
  ```

  Fix each hit to use the new type fields.

- [ ] **Step 9: Verify TypeScript compiles**

  ```bash
  cd C:/Users/miste/intuitivestay/intuitivestay/apps/portal-web && npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 10: Commit**

  ```bash
  git -C C:/Users/miste/intuitivestay/intuitivestay add apps/portal-web/src/routes/_portal.properties.tsx
  git -C C:/Users/miste/intuitivestay/intuitivestay commit -m "feat(web): replace MOCK_PROPERTIES with real getMyProperties data"
  ```

---

## Task 3: Add getPropertyDashboard + wire property dashboard route

**Files:**
- Modify: `packages/api/src/routers/properties.ts`
- Modify: `apps/portal-web/src/routes/_portal.properties.$propertyId.dashboard.tsx`

- [ ] **Step 1: Read properties.ts**

  Read `packages/api/src/routers/properties.ts` to check current state.

- [ ] **Step 2: Add getPropertyDashboard procedure**

  Inside `propertiesRouter`, add after `getPortfolioDashboard`:

  ```typescript
  getPropertyDashboard: protectedProcedure
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

      const scores = await db.query.propertyScores.findFirst({
        where: eq(propertyScores.propertyId, input.propertyId),
      })

      return {
        name: property.name,
        type: property.type,
        city: property.city,
        country: property.country,
        status: property.status,
        avgGcs: scores?.avgGcs != null ? Number(scores.avgGcs) : null,
        totalFeedback: scores?.totalFeedback ?? 0,
        avgResilience: scores?.avgResilience != null ? Number(scores.avgResilience) : null,
        avgEmpathy: scores?.avgEmpathy != null ? Number(scores.avgEmpathy) : null,
        avgAnticipation: scores?.avgAnticipation != null ? Number(scores.avgAnticipation) : null,
        avgRecognition: scores?.avgRecognition != null ? Number(scores.avgRecognition) : null,
      }
    }),
  ```

- [ ] **Step 3: Verify properties.ts compiles**

  ```bash
  cd C:/Users/miste/intuitivestay/intuitivestay/packages/api && npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 4: Commit backend change**

  ```bash
  git -C C:/Users/miste/intuitivestay/intuitivestay add packages/api/src/routers/properties.ts
  git -C C:/Users/miste/intuitivestay/intuitivestay commit -m "feat(api): add getPropertyDashboard procedure"
  ```

- [ ] **Step 5: Replace the property dashboard route**

  Replace the entire file `apps/portal-web/src/routes/_portal.properties.$propertyId.dashboard.tsx` with:

  ```tsx
  import { Card, CardDescription, CardHeader, CardTitle } from "@intuitive-stay/ui/components/card"
  import { useQuery } from "@tanstack/react-query"
  import { createFileRoute } from "@tanstack/react-router"

  import { useTRPC } from "@/utils/trpc"

  export const Route = createFileRoute("/_portal/properties/$propertyId/dashboard")({
    component: RouteComponent,
  })

  function StatCard({ label, value }: { label: string; value: string }) {
    return (
      <Card size="sm">
        <CardHeader>
          <CardDescription>{label}</CardDescription>
          <CardTitle>{value}</CardTitle>
        </CardHeader>
      </Card>
    )
  }

  function RouteComponent() {
    const { propertyId } = Route.useParams()
    const trpc = useTRPC()
    const { data, isLoading, isError } = useQuery(
      trpc.properties.getPropertyDashboard.queryOptions({ propertyId }),
    )

    if (isLoading) {
      return (
        <div className="p-6">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      )
    }

    if (isError || !data) {
      return (
        <div className="p-6">
          <p className="text-sm text-destructive">Failed to load property data.</p>
        </div>
      )
    }

    const fmt = (v: number | null) => (v != null ? v.toFixed(2) : "—")

    return (
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-bold">{data.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {[data.type, data.city, data.country].filter(Boolean).join(" · ")}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="GCS" value={fmt(data.avgGcs)} />
          <StatCard label="Total Feedback" value={String(data.totalFeedback)} />
          <StatCard
            label="Status"
            value={data.status.charAt(0).toUpperCase() + data.status.slice(1)}
          />
        </div>

        <div>
          <h2 className="text-base font-semibold mb-3">Pillar Averages</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Resilience" value={fmt(data.avgResilience)} />
            <StatCard label="Empathy" value={fmt(data.avgEmpathy)} />
            <StatCard label="Anticipation" value={fmt(data.avgAnticipation)} />
            <StatCard label="Recognition" value={fmt(data.avgRecognition)} />
          </div>
        </div>

        {data.totalFeedback === 0 && (
          <p className="text-sm text-muted-foreground">
            No feedback received yet. Share the QR code with guests to start collecting data.
          </p>
        )}
      </div>
    )
  }
  ```

- [ ] **Step 6: Verify portal-web compiles**

  ```bash
  cd C:/Users/miste/intuitivestay/intuitivestay/apps/portal-web && npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 7: Commit frontend change**

  ```bash
  git -C C:/Users/miste/intuitivestay/intuitivestay add "apps/portal-web/src/routes/_portal.properties.\$propertyId.dashboard.tsx"
  git -C C:/Users/miste/intuitivestay/intuitivestay commit -m "feat(web): wire property dashboard to real GCS and pillar averages"
  ```

---

## Task 4: Add getPropertyFeedbackSummary + wire feedback page

**Files:**
- Modify: `packages/api/src/routers/feedback.ts`
- Modify: `apps/portal-web/src/routes/_portal.properties.$propertyId.feedback.tsx`

Pillars are: **Resilience, Empathy, Anticipation, Recognition**. The old "Anticipation" label in the mock (previously "Consistency") is now correct. The per-pillar monthly trend chart is removed — it requires historical time-series data not yet computed. Radar + bar chart show real averages. Staff mentions count `namedStaffMember` occurrences.

- [ ] **Step 1: Read feedback.ts**

  Read `packages/api/src/routers/feedback.ts` in full.

- [ ] **Step 2: Add missing imports**

  Check which are already imported; add only missing ones:

  ```typescript
  import { desc, isNotNull } from "drizzle-orm"
  ```

- [ ] **Step 3: Add getPropertyFeedbackSummary procedure**

  Inside `feedbackRouter`, add after `getRedAlertCount`:

  ```typescript
  getPropertyFeedbackSummary: protectedProcedure
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

      const scores = await db.query.propertyScores.findFirst({
        where: eq(propertyScores.propertyId, input.propertyId),
      })

      const pillarScores = [
        {
          pillar: "Resilience",
          score: scores?.avgResilience != null ? Number(scores.avgResilience) : 0,
        },
        {
          pillar: "Empathy",
          score: scores?.avgEmpathy != null ? Number(scores.avgEmpathy) : 0,
        },
        {
          pillar: "Anticipation",
          score: scores?.avgAnticipation != null ? Number(scores.avgAnticipation) : 0,
        },
        {
          pillar: "Recognition",
          score: scores?.avgRecognition != null ? Number(scores.avgRecognition) : 0,
        },
      ]

      const mentionRows = await db
        .select({ name: feedback.namedStaffMember })
        .from(feedback)
        .where(and(eq(feedback.propertyId, input.propertyId), isNotNull(feedback.namedStaffMember)))

      const mentionMap: Record<string, number> = {}
      for (const row of mentionRows) {
        if (row.name) {
          mentionMap[row.name] = (mentionMap[row.name] ?? 0) + 1
        }
      }
      const staffMentions = Object.entries(mentionMap)
        .map(([name, mentions]) => ({ name, mentions }))
        .sort((a, b) => b.mentions - a.mentions)
        .slice(0, 10)

      return {
        pillarScores,
        staffMentions,
        totalFeedback: scores?.totalFeedback ?? 0,
      }
    }),
  ```

- [ ] **Step 4: Verify feedback.ts compiles**

  ```bash
  cd C:/Users/miste/intuitivestay/intuitivestay/packages/api && npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 5: Commit backend change**

  ```bash
  git -C C:/Users/miste/intuitivestay/intuitivestay add packages/api/src/routers/feedback.ts
  git -C C:/Users/miste/intuitivestay/intuitivestay commit -m "feat(api): add getPropertyFeedbackSummary procedure"
  ```

- [ ] **Step 6: Replace the feedback route**

  Replace the entire file `apps/portal-web/src/routes/_portal.properties.$propertyId.feedback.tsx` with:

  ```tsx
  import { useQuery } from "@tanstack/react-query"
  import { createFileRoute } from "@tanstack/react-router"
  import {
    Bar,
    BarChart,
    CartesianGrid,
    PolarAngleAxis,
    PolarGrid,
    Radar,
    RadarChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
  } from "recharts"

  import { useTRPC } from "@/utils/trpc"

  export const Route = createFileRoute("/_portal/properties/$propertyId/feedback")({
    component: RouteComponent,
  })

  function RouteComponent() {
    const { propertyId } = Route.useParams()
    const trpc = useTRPC()
    const { data, isLoading, isError } = useQuery(
      trpc.feedback.getPropertyFeedbackSummary.queryOptions({ propertyId }),
    )

    if (isLoading) {
      return (
        <div className="p-6">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      )
    }

    if (isError || !data) {
      return (
        <div className="p-6">
          <p className="text-sm text-destructive">Failed to load feedback data.</p>
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-8 p-6">
        <div>
          <h1 className="text-2xl font-bold">Guest Feedback</h1>
          <p className="text-muted-foreground text-sm mt-1">
            GCS pillar breakdown and staff recognition · {data.totalFeedback} submission
            {data.totalFeedback !== 1 ? "s" : ""}
          </p>
        </div>

        {data.totalFeedback === 0 ? (
          <p className="text-sm text-muted-foreground">
            No feedback received yet. Share the QR code with guests to start collecting data.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-xl border bg-card p-4">
                <h2 className="font-semibold mb-4">GCS Pillar Overview</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={data.pillarScores}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="pillar" />
                    <Radar
                      name="Score"
                      dataKey="score"
                      stroke="#6366f1"
                      fill="#6366f1"
                      fillOpacity={0.4}
                    />
                    <Tooltip formatter={(v: number) => v.toFixed(2)} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-xl border bg-card p-4">
                <h2 className="font-semibold mb-4">Pillar Scores (avg, 1–10)</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.pillarScores}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="pillar" />
                    <YAxis domain={[0, 10]} />
                    <Tooltip formatter={(v: number) => v.toFixed(2)} />
                    <Bar dataKey="score" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {data.staffMentions.length > 0 ? (
              <div className="rounded-xl border bg-card p-4">
                <h2 className="font-semibold mb-4">Staff Mentions in Feedback</h2>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data.staffMentions} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis dataKey="name" type="category" width={80} />
                    <Tooltip />
                    <Bar dataKey="mentions" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="rounded-xl border bg-card p-4">
                <h2 className="font-semibold mb-2">Staff Mentions</h2>
                <p className="text-sm text-muted-foreground">
                  No staff members named yet. Nominations appear here when high-scoring guests
                  use the Name Drop™ screen.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    )
  }
  ```

- [ ] **Step 7: Verify portal-web compiles**

  ```bash
  cd C:/Users/miste/intuitivestay/intuitivestay/apps/portal-web && npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 8: Commit frontend change**

  ```bash
  git -C C:/Users/miste/intuitivestay/intuitivestay add "apps/portal-web/src/routes/_portal.properties.\$propertyId.feedback.tsx"
  git -C C:/Users/miste/intuitivestay/intuitivestay commit -m "feat(web): wire property feedback page to real pillar scores and staff mentions"
  ```

---

## Task 5: Add getPropertyAlertFeedback + wire alerts page

**Files:**
- Modify: `packages/api/src/routers/feedback.ts`
- Modify: `apps/portal-web/src/routes/_portal.properties.$propertyId.alerts.tsx`

- [ ] **Step 1: Read feedback.ts**

  Read `packages/api/src/routers/feedback.ts` to confirm current state.

- [ ] **Step 2: Add getPropertyAlertFeedback procedure**

  Inside `feedbackRouter`, add after `getPropertyFeedbackSummary`:

  ```typescript
  getPropertyAlertFeedback: protectedProcedure
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

      const alertRows = await db
        .select()
        .from(feedback)
        .where(
          and(
            eq(feedback.propertyId, input.propertyId),
            sql`${feedback.gcs}::numeric <= 5`,
          ),
        )
        .orderBy(desc(feedback.submittedAt))
        .limit(20)

      return alertRows.map((row) => ({
        id: row.id,
        gcs: Number(row.gcs),
        resilience: row.resilience,
        empathy: row.empathy,
        anticipation: row.anticipation,
        recognition: row.recognition,
        ventText: row.ventText,
        submittedAt: row.submittedAt,
      }))
    }),
  ```

- [ ] **Step 3: Verify feedback.ts compiles**

  ```bash
  cd C:/Users/miste/intuitivestay/intuitivestay/packages/api && npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 4: Commit backend change**

  ```bash
  git -C C:/Users/miste/intuitivestay/intuitivestay add packages/api/src/routers/feedback.ts
  git -C C:/Users/miste/intuitivestay/intuitivestay commit -m "feat(api): add getPropertyAlertFeedback procedure"
  ```

- [ ] **Step 5: Replace the alerts route**

  Replace the entire file `apps/portal-web/src/routes/_portal.properties.$propertyId.alerts.tsx` with:

  ```tsx
  import { Badge } from "@intuitive-stay/ui/components/badge"
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "@intuitive-stay/ui/components/card"
  import { useQuery } from "@tanstack/react-query"
  import { createFileRoute } from "@tanstack/react-router"

  import { useTRPC } from "@/utils/trpc"

  export const Route = createFileRoute("/_portal/properties/$propertyId/alerts")({
    component: RouteComponent,
  })

  function RouteComponent() {
    const { propertyId } = Route.useParams()
    const trpc = useTRPC()
    const { data: alerts = [], isLoading, isError } = useQuery(
      trpc.feedback.getPropertyAlertFeedback.queryOptions({ propertyId }),
    )

    if (isLoading) {
      return (
        <div className="p-6">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      )
    }

    if (isError) {
      return (
        <div className="p-6">
          <p className="text-sm text-destructive">Failed to load alerts.</p>
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-bold">Property Alerts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Submissions with a GCS of 5 or below — most recent first.
          </p>
        </div>

        {alerts.length === 0 ? (
          <Card size="sm">
            <CardHeader>
              <CardTitle className="text-sm">No alerts</CardTitle>
              <CardDescription>All guest scores are above 5. Keep it up!</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {alerts.map((alert) => (
              <Card key={alert.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">
                      GCS:{" "}
                      <span className="text-destructive font-bold">
                        {alert.gcs.toFixed(2)}
                      </span>
                    </CardTitle>
                    <Badge variant="destructive">Low Score</Badge>
                  </div>
                  <CardDescription>
                    {new Date(alert.submittedAt).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      { label: "Resilience", value: alert.resilience },
                      { label: "Empathy", value: alert.empathy },
                      { label: "Anticipation", value: alert.anticipation },
                      { label: "Recognition", value: alert.recognition },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-md border p-2">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="font-semibold">{value}/10</p>
                      </div>
                    ))}
                  </div>
                  {alert.ventText && (
                    <div className="rounded-md bg-muted p-3">
                      <p className="text-xs text-muted-foreground mb-1">Guest message:</p>
                      <p className="text-sm">{alert.ventText}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    )
  }
  ```

- [ ] **Step 6: Verify portal-web compiles**

  ```bash
  cd C:/Users/miste/intuitivestay/intuitivestay/apps/portal-web && npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 7: Commit frontend change**

  ```bash
  git -C C:/Users/miste/intuitivestay/intuitivestay add "apps/portal-web/src/routes/_portal.properties.\$propertyId.alerts.tsx"
  git -C C:/Users/miste/intuitivestay/intuitivestay commit -m "feat(web): wire property alerts page to real low-GCS feedback list"
  ```

---

## Task 6: Add getPropertyQrData + wire QR codes page

**Files:**
- Modify: `packages/api/src/routers/properties.ts`
- Modify: `apps/portal-web/src/routes/_portal.properties.$propertyId.qr-form.tsx`

- [ ] **Step 1: Read properties.ts**

  Read `packages/api/src/routers/properties.ts` to confirm current state.

- [ ] **Step 2: Add getPropertyQrData procedure**

  Inside `propertiesRouter`, add after `getPropertyDashboard`:

  ```typescript
  getPropertyQrData: protectedProcedure
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

      const qrCode = await db.query.qrCodes.findFirst({
        where: eq(qrCodes.propertyId, input.propertyId),
      })

      const scores = await db.query.propertyScores.findFirst({
        where: eq(propertyScores.propertyId, input.propertyId),
      })

      return {
        qrCode: qrCode
          ? {
              uniqueCode: qrCode.uniqueCode,
              feedbackUrl: qrCode.feedbackUrl,
              createdAt: qrCode.createdAt,
            }
          : null,
        totalSubmissions: scores?.totalFeedback ?? 0,
      }
    }),
  ```

- [ ] **Step 3: Verify properties.ts compiles**

  ```bash
  cd C:/Users/miste/intuitivestay/intuitivestay/packages/api && npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 4: Commit backend change**

  ```bash
  git -C C:/Users/miste/intuitivestay/intuitivestay add packages/api/src/routers/properties.ts
  git -C C:/Users/miste/intuitivestay/intuitivestay commit -m "feat(api): add getPropertyQrData procedure"
  ```

- [ ] **Step 5: Replace the QR codes route**

  Replace the entire file `apps/portal-web/src/routes/_portal.properties.$propertyId.qr-form.tsx` with:

  ```tsx
  import { Badge } from "@intuitive-stay/ui/components/badge"
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "@intuitive-stay/ui/components/card"
  import { useQuery } from "@tanstack/react-query"
  import { createFileRoute } from "@tanstack/react-router"
  import { LinkIcon, QrCodeIcon } from "lucide-react"

  import { useTRPC } from "@/utils/trpc"

  export const Route = createFileRoute("/_portal/properties/$propertyId/qr-form")({
    component: RouteComponent,
  })

  function RouteComponent() {
    const { propertyId } = Route.useParams()
    const trpc = useTRPC()
    const { data, isLoading, isError } = useQuery(
      trpc.properties.getPropertyQrData.queryOptions({ propertyId }),
    )

    if (isLoading) {
      return (
        <div className="p-6">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      )
    }

    if (isError) {
      return (
        <div className="p-6">
          <p className="text-sm text-destructive">Failed to load QR data.</p>
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-bold">Feedback QR Code</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Share this link or print the PDF that was emailed to you on approval.
          </p>
        </div>

        {!data?.qrCode ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <QrCodeIcon className="h-4 w-4" />
                No QR Code Yet
              </CardTitle>
              <CardDescription>
                A QR code is generated automatically when your property is approved. Check your
                email for the branded PDF.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <QrCodeIcon className="h-4 w-4" />
                  Feedback Link
                </CardTitle>
                <CardDescription>
                  Active since{" "}
                  {new Date(data.qrCode.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2">
                  <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a
                    href={data.qrCode.feedbackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-mono text-primary hover:underline truncate"
                  >
                    {data.qrCode.feedbackUrl}
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Unique code:</span>
                  <Badge variant="secondary" className="font-mono">
                    {data.qrCode.uniqueCode}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card size="sm">
              <CardHeader>
                <CardDescription>Total Submissions</CardDescription>
                <CardTitle>{data.totalSubmissions}</CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Placing your QR code</CardTitle>
                <CardDescription>
                  Print the PDF attached to your approval email and display it at reception,
                  bedside tables, or dining areas. Guests scan the code with their phone camera
                  — no app required.
                </CardDescription>
              </CardHeader>
            </Card>
          </>
        )}
      </div>
    )
  }
  ```

- [ ] **Step 6: Verify portal-web compiles**

  ```bash
  cd C:/Users/miste/intuitivestay/intuitivestay/apps/portal-web && npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 7: Commit frontend change**

  ```bash
  git -C C:/Users/miste/intuitivestay/intuitivestay add "apps/portal-web/src/routes/_portal.properties.\$propertyId.qr-form.tsx"
  git -C C:/Users/miste/intuitivestay/intuitivestay commit -m "feat(web): wire QR codes page to real feedback URL and submission count"
  ```

---

## Phase 4 Complete ✓

At this point:
- "Consistency" is fully renamed to "Anticipation" in DB, API, and all UI
- Portfolio dashboard shows real GCS, property count, alert count, monthly trend
- Properties table shows real properties from the database
- Property dashboard shows real GCS, total feedback, and all 4 pillar averages
- Property feedback page shows real pillar scores with correct names, staff mentions
- Property alerts page lists low-GCS submissions with vent text and pillar breakdown
- QR codes page shows the real feedback URL, unique code, and submission count

**Phase 5 candidates:** Per-pillar monthly trend charts, billing page, team/roles management, advanced insights, organisation-level alerts page.
