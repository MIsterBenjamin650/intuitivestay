import { createFileRoute } from "@tanstack/react-router"

import { PropertyPage } from "@/components/property-page"

export const Route = createFileRoute("/_portal/properties/$propertyId/qr-form")({
  component: RouteComponent,
})

function RouteComponent() {
  const { propertyId } = Route.useParams()

  return (
    <PropertyPage
      propertyId={propertyId}
      title="QR Form"
      description="Manage property-specific QR feedback form access and distribution."
    />
  )
}
