# Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the main `/` dashboard with a purpose-built admin view for the site owner, showing all registered properties with filtering, sorting, and activity indicators.

**Architecture:** Four focused changes — a new tRPC query on the server, an `isAdmin` flag added to the session returned by `get-user.ts`, a new `AdminDashboard` component that owns all filter/sort/table logic, and a one-line branch in the index route to pick which dashboard to render.

**Tech Stack:** Hono + tRPC (backend), TanStack Router + React 19 + `@tanstack/react-table` (frontend), Drizzle ORM (DB queries)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `packages/api/src/routers/properties.ts` | Modify | Add `getAllProperties` adminProcedure |
| `apps/portal-web/src/functions/get-user.ts` | Modify | Append `isAdmin` boolean to returned session |
| `apps/portal-web/src/components/admin-dashboard.tsx` | Create | All admin UI: stats cards, filters, sortable table |
| `apps/portal-web/src/routes/_portal.index.tsx` | Modify | Branch on `session.isAdmin` to render AdminDashboard |

---

### Task 1: Add `getAllProperties` tRPC procedure

**Files:**
- Modify: `packages/api/src/routers/properties.ts`

- [ ] **Step 1: Add the procedure to the router**

Open `packages/api/src/routers/properties.ts`. Add these imports at the top (merge with existing imports):

```ts
import { db } from "@intuitive-stay/db"
import { feedback, organisations, properties, propertyScores, qrCodes } from "@intuitive-stay/db/schema"
import { env } from "@intuitive-stay/env/server"
import { TRPCError } from "@trpc/server"
import { and, count, desc, eq, inArray, max, sql } from "drizzle-orm"
import { z } from "zod"

import { adminProcedure, protectedProcedure, router } from "../index"
import { sendApprovalEmail, sendRejectionEmail } from "../lib/email"
import { generateQrPdf, generateUniqueCode } from "../lib/generate-qr"
```

Then add `getAllProperties` inside the `propertiesRouter` object (after the existing `rejectProperty` procedure and before `getMyProperties`):

```ts
getAllProperties: adminProcedure.query(async () => {
  // Subquery: MAX(submitted_at) per property
  const lastFeedbackSq = db
    .select({
      propertyId: feedback.propertyId,
      lastFeedbackAt: max(feedback.submittedAt).as("last_feedback_at"),
    })
    .from(feedback)
    .groupBy(feedback.propertyId)
    .as("last_feedback_sq")

  const rows = await db
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
    .orderBy(desc(properties.createdAt))

  const totalCount = rows.length
  const approvedCount = rows.filter((r) => r.status === "approved").length

  const approvedGcsValues = rows
    .filter((r) => r.status === "approved" && r.avgGcs != null)
    .map((r) => Number(r.avgGcs))
    .filter((n) => !isNaN(n) && n > 0)

  const platformAvgGcs =
    approvedGcsValues.length > 0
      ? Math.round((approvedGcsValues.reduce((a, b) => a + b, 0) / approvedGcsValues.length) * 10) / 10
      : null

  return {
    properties: rows.map((r) => ({
      ...r,
      avgGcs: r.avgGcs != null ? Number(r.avgGcs) : null,
      totalFeedback: r.totalFeedback ?? 0,
      lastFeedbackAt: r.lastFeedbackAt ?? null,
    })),
    stats: { totalCount, approvedCount, platformAvgGcs },
  }
}),
```

- [ ] **Step 2: Verify the build compiles**

```bash
cd C:\Users\miste\intuitivestay\intuitivestay
pnpm --filter @intuitive-stay/portal-server build
```

Expected: no TypeScript errors. Fix any import issues before continuing.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/routers/properties.ts
git commit -m "feat: add getAllProperties admin tRPC procedure"
```

---

### Task 2: Expose `isAdmin` in the session

**Files:**
- Modify: `apps/portal-web/src/functions/get-user.ts`

- [ ] **Step 1: Update `get-user.ts`**

Replace the entire file content with:

```ts
import { createServerFn } from "@tanstack/react-start";

import { authMiddleware } from "@/middleware/auth";

export const getUser = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!context.session) return null;
    return {
      ...context.session,
      isAdmin: context.session.user.email === process.env.ADMIN_EMAIL,
    };
  });
```

- [ ] **Step 2: Add `ADMIN_EMAIL` to portal-web Railway env vars**

Go to Railway → `vibrant-wonder` service → Variables tab → Add:
```
ADMIN_EMAIL = benjamin@intuitivestay.com
```

This is needed because `get-user.ts` runs inside the portal-web process, which is a separate Railway service from portal-server.

- [ ] **Step 3: Verify the build compiles**

```bash
pnpm --filter @intuitive-stay/portal-web build
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add apps/portal-web/src/functions/get-user.ts
git commit -m "feat: append isAdmin flag to getUser session response"
```

---

### Task 3: Build the AdminDashboard component

**Files:**
- Create: `apps/portal-web/src/components/admin-dashboard.tsx`

- [ ] **Step 1: Create the file**

Create `apps/portal-web/src/components/admin-dashboard.tsx` with the following content:

```tsx
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@intuitive-stay/ui/components/card"
import { Input } from "@intuitive-stay/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@intuitive-stay/ui/components/select"
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table"
import { useQuery } from "@tanstack/react-query"
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { useMemo, useState } from "react"

import { useTRPC } from "@/utils/trpc"

// ─── Types ───────────────────────────────────────────────────────────────────

type PropertyRow = {
  id: string
  name: string
  status: string
  city: string
  country: string
  type: string | null
  ownerName: string
  ownerEmail: string
  plan: string
  avgGcs: number | null
  totalFeedback: number
  lastFeedbackAt: Date | string | null
  createdAt: Date | string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeDate(date: Date | string | null): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  const diffMs = Date.now() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 30) return `${diffDays} days ago`
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) return `${diffMonths}mo ago`
  return `${Math.floor(diffMonths / 12)}yr ago`
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    approved: "bg-green-100 text-green-800",
    pending: "bg-yellow-100 text-yellow-800",
    rejected: "bg-red-100 text-red-800",
  }
  const cls = styles[status] ?? "bg-gray-100 text-gray-700"
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
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
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {plan.charAt(0).toUpperCase() + plan.slice(1)}
    </span>
  )
}

// ─── Table columns ────────────────────────────────────────────────────────────

const col = createColumnHelper<PropertyRow>()

const columns = [
  col.accessor("name", {
    header: "Property",
    cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    enableSorting: false,
  }),
  col.display({
    id: "owner",
    header: "Owner",
    cell: ({ row }) => (
      <div>
        <div className="font-medium text-sm">{row.original.ownerName}</div>
        <div className="text-xs text-muted-foreground">{row.original.ownerEmail}</div>
      </div>
    ),
  }),
  col.accessor("plan", {
    header: "Plan",
    cell: (info) => planBadge(info.getValue()),
    enableSorting: false,
  }),
  col.accessor("status", {
    header: "Status",
    cell: (info) => statusBadge(info.getValue()),
    enableSorting: false,
  }),
  col.accessor("city", {
    header: "City",
    cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
    enableSorting: false,
  }),
  col.accessor("avgGcs", {
    header: "GCS",
    cell: (info) => {
      const v = info.getValue()
      return v != null ? <span className="font-semibold">{v.toFixed(1)}</span> : <span className="text-muted-foreground">—</span>
    },
    sortingFn: (a, b) => {
      const av = a.original.avgGcs ?? -1
      const bv = b.original.avgGcs ?? -1
      return av - bv
    },
  }),
  col.accessor("totalFeedback", {
    header: "Feedback",
    cell: ({ row }) => {
      const count = row.original.totalFeedback
      const status = row.original.status
      if (status === "approved" && count === 0) {
        return (
          <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
            No activity
          </span>
        )
      }
      if (count === 0) return <span className="text-muted-foreground">—</span>
      return <span>{count}</span>
    },
    sortingFn: (a, b) => a.original.totalFeedback - b.original.totalFeedback,
  }),
  col.accessor("lastFeedbackAt", {
    header: "Last Feedback",
    cell: (info) => (
      <span className="text-muted-foreground text-sm">{relativeDate(info.getValue())}</span>
    ),
    sortingFn: (a, b) => {
      const av = a.original.lastFeedbackAt ? new Date(a.original.lastFeedbackAt).getTime() : 0
      const bv = b.original.lastFeedbackAt ? new Date(b.original.lastFeedbackAt).getTime() : 0
      return av - bv
    },
  }),
]

// ─── GCS filter logic ─────────────────────────────────────────────────────────

type GcsRange = "any" | "below5" | "5to7" | "above7"

function matchesGcsRange(gcs: number | null, range: GcsRange): boolean {
  if (range === "any") return true
  if (gcs == null) return false
  if (range === "below5") return gcs < 5
  if (range === "5to7") return gcs >= 5 && gcs <= 7
  if (range === "above7") return gcs > 7
  return true
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AdminDashboard() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(trpc.properties.getAllProperties.queryOptions())

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [cityFilter, setCityFilter] = useState("all")
  const [countryFilter, setCountryFilter] = useState("all")
  const [gcsRange, setGcsRange] = useState<GcsRange>("any")
  const [sorting, setSorting] = useState<SortingState>([])

  const allProperties: PropertyRow[] = data?.properties ?? []

  const cities = useMemo(
    () => Array.from(new Set(allProperties.map((p) => p.city))).sort(),
    [allProperties],
  )
  const countries = useMemo(
    () => Array.from(new Set(allProperties.map((p) => p.country))).sort(),
    [allProperties],
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return allProperties.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !p.ownerName.toLowerCase().includes(q)) return false
      if (statusFilter !== "all" && p.status !== statusFilter) return false
      if (cityFilter !== "all" && p.city !== cityFilter) return false
      if (countryFilter !== "all" && p.country !== countryFilter) return false
      if (!matchesGcsRange(p.avgGcs, gcsRange)) return false
      return true
    })
  }, [allProperties, search, statusFilter, cityFilter, countryFilter, gcsRange])

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const stats = data?.stats

  return (
    <div className="flex flex-col gap-6 p-4 pt-0">
      {/* Stats */}
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

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search property or owner..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full max-w-xs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="All Cities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cities</SelectItem>
            {cities.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={countryFilter} onValueChange={setCountryFilter}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="All Countries" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Countries</SelectItem>
            {countries.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={gcsRange} onValueChange={(v) => setGcsRange(v as GcsRange)}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue placeholder="Any Score" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any Score</SelectItem>
            <SelectItem value="below5">Below 5 (critical)</SelectItem>
            <SelectItem value="5to7">5–7 (average)</SelectItem>
            <SelectItem value="above7">Above 7 (good)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b bg-muted/30">
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  return (
                    <th
                      key={header.id}
                      className={`px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide ${canSort ? "cursor-pointer select-none hover:text-foreground" : ""}`}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && (
                          sorted === "asc" ? <ArrowUp className="h-3 w-3" /> :
                          sorted === "desc" ? <ArrowDown className="h-3 w-3" /> :
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </span>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">
                  No properties match your filters.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the build compiles**

```bash
pnpm --filter @intuitive-stay/portal-web build
```

Expected: no TypeScript errors. If Select components don't exist in the UI package, check available components:

```bash
find C:\Users\miste\intuitivestay\intuitivestay\packages\ui\src -name "select*"
```

If missing, use a plain `<select>` HTML element styled with Tailwind instead.

- [ ] **Step 3: Commit**

```bash
git add apps/portal-web/src/components/admin-dashboard.tsx
git commit -m "feat: add AdminDashboard component with filters and sortable table"
```

---

### Task 4: Wire up the index route to branch on `isAdmin`

**Files:**
- Modify: `apps/portal-web/src/routes/_portal.index.tsx`

- [ ] **Step 1: Update the index route**

Replace the entire file with:

```tsx
import { Card, CardDescription, CardHeader, CardTitle } from "@intuitive-stay/ui/components/card"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useRouteContext } from "@tanstack/react-router"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { AdminDashboard } from "@/components/admin-dashboard"
import { useTRPC } from "@/utils/trpc"

export const Route = createFileRoute("/_portal/")({
  component: RouteComponent,
})

function PortfolioDashboard() {
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
              <Tooltip formatter={(v) => (typeof v === "number" ? v.toFixed(2) : v)} />
              <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

function RouteComponent() {
  const { session } = useRouteContext({ from: "/_portal" })
  const isAdmin = (session as { isAdmin?: boolean } | null)?.isAdmin === true

  if (isAdmin) return <AdminDashboard />
  return <PortfolioDashboard />
}
```

- [ ] **Step 2: Build and verify**

```bash
pnpm --filter @intuitive-stay/portal-web build
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit and push**

```bash
git add apps/portal-web/src/routes/_portal.index.tsx
git commit -m "feat: show AdminDashboard on main route when user is admin"
git push
```

---

### Task 5: Deploy and verify

- [ ] **Step 1: Add `ADMIN_EMAIL` to Railway portal-web service**

Go to Railway → `vibrant-wonder` (portal-web) service → Variables → add:
```
ADMIN_EMAIL = benjamin@intuitivestay.com
```

Trigger a redeploy if Railway doesn't auto-deploy after the variable is added.

- [ ] **Step 2: Wait for both services to redeploy**

Railway auto-deploys `intuitivestay` (portal-server) and `vibrant-wonder` (portal-web) from the `main` branch push. Check both are green before testing.

- [ ] **Step 3: Test as admin**

1. Go to https://vibrant-wonder-production.up.railway.app
2. Log in as `benjamin@intuitivestay.com`
3. Verify the main dashboard shows the admin view: three stat cards + filter bar + properties table
4. Verify the property "Ben Hostels London" appears in the table with correct status, plan badge, and "No activity" badge in the Feedback column
5. Test search: type "Ben" — only Ben Hostels London should remain
6. Test status filter: select "Pending" — table should be empty (no pending properties)
7. Test GCS range: select "Below 5" — table should be empty (no low-scoring properties yet)
8. Test column sorting: click GCS header — arrow appears, rows reorder

- [ ] **Step 4: Verify regular users are unaffected**

Create a second test account (different email from `ADMIN_EMAIL`) via the Wix form flow and approve it. Log in as that user — the main dashboard should show the portfolio view (Portfolio GCS, Active Properties, Guest Satisfaction chart), not the admin table.
