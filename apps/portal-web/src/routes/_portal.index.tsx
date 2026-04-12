import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, redirect, useRouteContext } from "@tanstack/react-router"

import { AdminDashboard } from "@/components/admin-dashboard"
import { PortfolioLeaderboard } from "@/components/portfolio-leaderboard"
import { PortfolioMostImproved } from "@/components/portfolio-most-improved"
import { PortfolioSpotlight } from "@/components/portfolio-spotlight"
import { PortfolioStaffBoard } from "@/components/portfolio-staff-board"
import { PortfolioStatCards } from "@/components/portfolio-stat-cards"
import { PortfolioTable } from "@/components/portfolio-table"
import { PushNotificationPrompt } from "@/components/push-notification-prompt"
import { useTRPC } from "@/utils/trpc"

const PortfolioTrendChart = React.lazy(() =>
  import("@/components/portfolio-trend-chart").then((m) => ({ default: m.PortfolioTrendChart }))
)

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

type Days = 1 | 7 | 30 | 365

function DateRangeTabs({ days, onChange, maxDays }: { days: Days; onChange: (d: Days) => void; maxDays: Days }) {
  const allOptions: { label: string; value: Days }[] = [
    { label: "Today", value: 1 },
    { label: "7 days", value: 7 },
    { label: "30 days", value: 30 },
    { label: "365 days", value: 365 },
  ]
  const options = allOptions.filter((o) => o.value === 1 || o.value <= maxDays)
  return (
    <div className="flex gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={[
            "rounded-full px-3 py-1 text-[11px] font-semibold transition-colors",
            days === o.value
              ? "bg-[#1c1917] text-white"
              : "bg-[#f0ede8] text-[#78716c] hover:bg-[#e8e3dc]",
          ].join(" ")}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function PortfolioDashboard() {
  const { session } = useRouteContext({ from: "/_portal" })
  const plan = (session as { plan?: string | null } | null)?.plan ?? null

  const PLAN_RANK: Record<string, number> = { member: 0, host: 1, partner: 2, founder: 3 }
  const planRank = PLAN_RANK[plan ?? ""] ?? -1
  const maxDays: Days = planRank >= 3 ? 365 : planRank >= 2 ? 30 : 7

  const [days, setDays] = React.useState<Days>(7)

  const trpc = useTRPC()
  const { data, isLoading } = useQuery(
    trpc.properties.getPortfolioDashboard.queryOptions({ days }),
  )

  const rows = data?.enrichedPropertyRows ?? []

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <PushNotificationPrompt />

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-[#1c1917]">Portfolio Overview</h1>
          <p className="text-xs text-gray-400 mt-0.5">All your properties at a glance</p>
        </div>
        <DateRangeTabs days={days} onChange={setDays} maxDays={maxDays} />
      </div>

      <PortfolioStatCards
        portfolioGcs={data?.portfolioGcs ?? null}
        activeCount={data?.activeCount ?? 0}
        thisWeekCount={data?.thisWeekCount ?? 0}
        thisWeekDelta={data?.thisWeekDelta ?? null}
        alertCount={data?.alertCount ?? 0}
        ventCount={data?.ventCount ?? 0}
        ventCountDelta={data?.ventCountDelta ?? null}
        isLoading={isLoading}
      />

      <PortfolioSpotlight rows={rows} />

      <PortfolioTable rows={rows} />

      <div className="grid gap-3 md:grid-cols-2">
        <PortfolioLeaderboard rows={rows} />
        <PortfolioStaffBoard entries={data?.staffLeaderboard ?? []} />
      </div>

      {data?.mostImproved && (
        <PortfolioMostImproved mostImproved={data.mostImproved} />
      )}

      <React.Suspense fallback={<div className="rounded-xl bg-white shadow-sm p-5 animate-pulse min-h-[240px]" />}>
        <PortfolioTrendChart monthlyTrend={data?.monthlyTrend ?? []} isLoading={isLoading} />
      </React.Suspense>
    </div>
  )
}

function RouteComponent() {
  const { session } = useRouteContext({ from: "/_portal" })
  const isAdmin = (session as { isAdmin?: boolean } | null)?.isAdmin === true

  if (isAdmin) return <AdminDashboard />
  return <PortfolioDashboard />
}
