import { createFileRoute } from "@tanstack/react-router"

import { PropertyInsights } from "@/components/property-insights"

export const Route = createFileRoute("/_portal/properties/$propertyId/insights")({
  component: RouteComponent,
})

function RouteComponent() {
  const { propertyId } = Route.useParams()
  return <PropertyInsights propertyId={propertyId} />
}
