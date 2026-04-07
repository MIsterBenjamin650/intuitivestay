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
import { Link } from "@tanstack/react-router"
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
    member: "bg-gray-100 text-gray-600",
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
        <div className="grid gap-4 md:grid-cols-4">
          <Card size="sm" className="bg-gray-50">
            <CardHeader>
              <CardDescription className="text-gray-600">Member</CardDescription>
              <CardTitle className="text-gray-800">{isLoading ? "—" : (stats?.memberCount ?? 0)}</CardTitle>
            </CardHeader>
          </Card>
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
