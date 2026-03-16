import { createFileRoute } from "@tanstack/react-router"

import { PropertyPage } from "@/components/property-page"

export const Route = createFileRoute("/_portal/properties/$propertyId/dashboard")({
  component: RouteComponent,
})

function RouteComponent() {
  const { propertyId } = Route.useParams()

  return (
    <PropertyPage
      propertyId={propertyId}
      title="Property Dashboard"
      description="Daily trendline, satisfaction shifts, and top action priorities."
    />
  )
}
