import { createFileRoute } from "@tanstack/react-router"

import { FounderInsightsOverview } from "@/components/founder-insights-overview"

export const Route = createFileRoute("/_portal/insights")({
  component: RouteComponent,
})

function RouteComponent() {
  return <FounderInsightsOverview />
}
