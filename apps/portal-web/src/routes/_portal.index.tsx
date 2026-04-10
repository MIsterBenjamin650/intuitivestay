import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link, redirect, useRouteContext } from "@tanstack/react-router"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { AdminDashboard } from "@/components/admin-dashboard"
import { PushNotificationPrompt } from "@/components/push-notification-prompt"
import { useTRPC } from "@/utils/trpc"

export const Route = createFileRoute("/_portal/")({
  beforeLoad: ({ context }) => {
    const session = context.session as {
      isAdmin?: boolean
      isStaff?: boolean
      staffPropertyId?: string | null
      user?: { properties?: Array<{ id: string }> }
    } | null

    const isAdmin = session?.isAdmin === true
    const isStaff = session?.isStaff === true
    const staffPropertyId = session?.staffPropertyId ?? null
    const properties = session?.user?.properties ?? []

    if (isStaff && staffPropertyId) {
      throw redirect({
        to: "/properties/$propertyId/dashboard",
        params: { propertyId: staffPropertyId },
      })
    }

    if (!isAdmin && properties.length === 1) {
      const firstProperty = properties[0]
      if (firstProperty) {
        throw redirect({
          to: "/properties/$propertyId/dashboard",
          params: { propertyId: firstProperty.id },
        })
      }
    }
  },
  component: RouteComponent,
})

type StatColor = "indigo" | "teal" | "orange"

const COLOR_MAP: Record<StatColor, string> = {
  indigo: "#6366f1",
  teal:   "#14b8a6",
  orange: "#f97316",
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub?: string
  color: StatColor
}) {
  const c = COLOR_MAP[color]
  return (
    <div
      className="rounded-xl bg-white p-4 shadow-sm"
      style={{ borderLeft: `5px solid ${c}` }}
    >
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-[#9ca3af]">
        {label}
      </p>
      <p
        className="text-[28px] font-extrabold leading-none tracking-tight"
        style={{ color: c }}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-1 text-[11px] font-medium text-[#9ca3af]">{sub}</p>
      )}
    </div>
  )
}

function GcsBadge({ gcs }: { gcs: number | null }) {
  if (gcs == null) return <span className="text-xs text-gray-400">No data</span>
  const color = gcs >= 8 ? "#16a34a" : gcs >= 6 ? "#f97316" : "#dc2626"
  return (
    <span className="text-2xl font-black leading-none" style={{ color }}>
      {gcs.toFixed(1)}
      <span className="text-xs font-normal text-gray-400 ml-0.5">/10</span>
    </span>
  )
}

function PortfolioDashboard() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(
    trpc.properties.getPortfolioDashboard.queryOptions(),
  )

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <PushNotificationPrompt />
      <div>
        <h1 className="text-xl font-bold text-[#1c1917]">Portfolio Overview</h1>
        <p className="text-xs text-gray-400 mt-0.5">All your properties at a glance</p>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Portfolio GCS"
          color="indigo"
          value={isLoading ? "—" : data?.portfolioGcs != null ? data.portfolioGcs.toFixed(1) : "—"}
          sub="Average across all properties"
        />
        <StatCard
          label="Active Properties"
          color="teal"
          value={isLoading ? "—" : String(data?.activeCount ?? 0)}
          sub="Approved properties"
        />
        <StatCard
          label="Open Alerts"
          color="orange"
          value={isLoading ? "—" : String(data?.alertCount ?? 0)}
          sub="Scores at or below 5.0"
        />
      </div>

      {/* Property cards */}
      <div>
        <p className="text-[13px] font-semibold text-[#111827] mb-3">Your Properties</p>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(data?.propertyCards ?? []).map((property) => (
              <Link
                key={property.id}
                to="/properties/$propertyId/dashboard"
                params={{ propertyId: property.id }}
                className="block rounded-xl bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{property.name}</p>
                    <p className="text-xs text-gray-400 truncate">{property.city}, {property.country} · {property.type}</p>
                  </div>
                  {property.alertCount > 0 && (
                    <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                      {property.alertCount} alert{property.alertCount !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div className="flex items-end justify-between">
                  <GcsBadge gcs={property.avgGcs} />
                  <p className="text-xs text-gray-400">
                    {property.totalFeedback} feedback
                  </p>
                </div>
                {property.status !== "approved" && (
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-amber-600">
                    {property.status}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Trend chart */}
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <p className="text-[14px] font-bold text-[#111827]">Guest Satisfaction Over Time</p>
        <p className="mb-4 mt-0.5 text-[11px] font-medium text-[#9ca3af]">Average GCS across all properties</p>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !data?.monthlyTrend.length ? (
          <p className="text-sm text-muted-foreground">No feedback yet. Scores will appear once guests start submitting.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.monthlyTrend}>
              <defs>
                <linearGradient id="gcsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                formatter={(v) => (typeof v === "number" ? v.toFixed(2) : v)}
              />
              <Area type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2.5} fill="url(#gcsGradient)" dot={false} />
            </AreaChart>
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
