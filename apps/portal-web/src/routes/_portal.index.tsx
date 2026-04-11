import { useQuery } from "@tanstack/react-query"
import { createFileRoute, redirect, useRouteContext } from "@tanstack/react-router"

import { AdminDashboard } from "@/components/admin-dashboard"
import { PortfolioLeaderboard } from "@/components/portfolio-leaderboard"
import { PortfolioMostImproved } from "@/components/portfolio-most-improved"
import { PortfolioSpotlight } from "@/components/portfolio-spotlight"
import { PortfolioStaffBoard } from "@/components/portfolio-staff-board"
import { PortfolioStatCards } from "@/components/portfolio-stat-cards"
import { PortfolioTable } from "@/components/portfolio-table"
import { PortfolioTrendChart } from "@/components/portfolio-trend-chart"
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

function PortfolioDashboard() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(
    trpc.properties.getPortfolioDashboard.queryOptions(),
  )

  const rows = data?.enrichedPropertyRows ?? []

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <PushNotificationPrompt />

      <div>
        <h1 className="text-xl font-black text-[#1c1917]">Portfolio Overview</h1>
        <p className="text-xs text-gray-400 mt-0.5">All your properties at a glance</p>
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

      <PortfolioTrendChart monthlyTrend={data?.monthlyTrend ?? []} isLoading={isLoading} />
    </div>
  )
}

function RouteComponent() {
  const { session } = useRouteContext({ from: "/_portal" })
  const isAdmin = (session as { isAdmin?: boolean } | null)?.isAdmin === true

  if (isAdmin) return <AdminDashboard />
  return <PortfolioDashboard />
}
