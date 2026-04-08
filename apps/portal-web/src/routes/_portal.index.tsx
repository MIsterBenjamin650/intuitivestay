import { useQuery } from "@tanstack/react-query"
import { createFileRoute, redirect, useRouteContext } from "@tanstack/react-router"
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

    if (!isAdmin && properties.length > 0) {
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

function PortfolioDashboard() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(
    trpc.properties.getPortfolioDashboard.queryOptions(),
  )

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Portfolio GCS"
          color="indigo"
          value={
            isLoading
              ? "—"
              : data?.portfolioGcs != null
                ? data.portfolioGcs.toFixed(1)
                : "No data"
          }
          sub="Guest Comfort Score"
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

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <p className="text-[14px] font-bold text-[#111827]">
          Guest Satisfaction Over Time
        </p>
        <p className="mb-4 mt-0.5 text-[11px] font-medium text-[#9ca3af]">
          Average GCS across all properties
        </p>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !data?.monthlyTrend.length ? (
          <p className="text-sm text-muted-foreground">
            No feedback yet. Scores will appear once guests start submitting.
          </p>
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
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 10]}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  fontSize: 12,
                }}
                formatter={(v) => (typeof v === "number" ? v.toFixed(2) : v)}
              />
              <Area
                type="monotone"
                dataKey="score"
                stroke="#6366f1"
                strokeWidth={2.5}
                fill="url(#gcsGradient)"
                dot={false}
              />
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
