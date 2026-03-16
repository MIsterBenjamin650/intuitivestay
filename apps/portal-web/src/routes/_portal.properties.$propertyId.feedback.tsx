import { createFileRoute } from "@tanstack/react-router"

import { PropertyPage } from "@/components/property-page"

export const Route = createFileRoute("/_portal/properties/$propertyId/feedback")({
  component: RouteComponent,
})

function RouteComponent() {
  const { propertyId } = Route.useParams()

  return (
    <PropertyPage
      propertyId={propertyId}
      title="Feedback"
      description="Raw guest comments, tagged feedback streams, and filtering workflows."
    />
  )
}
