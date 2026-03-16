import { createFileRoute } from "@tanstack/react-router"

import { PropertyPage } from "@/components/property-page"

export const Route = createFileRoute("/_portal/properties/$propertyId/insights")({
  component: RouteComponent,
})

function RouteComponent() {
  const { propertyId } = Route.useParams()

  return (
    <PropertyPage
      propertyId={propertyId}
      title="Insights"
      description="Core insight views for trends, historical movement, and weekly summaries."
    />
  )
}
