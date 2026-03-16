import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@intuitive-stay/ui/components/card"
import { createFileRoute } from "@tanstack/react-router"

import { PropertyPage } from "@/components/property-page"

export const Route = createFileRoute("/_portal/properties/$propertyId/alerts")({
  component: RouteComponent,
})

function RouteComponent() {
  const { propertyId } = Route.useParams()

  return (
    <PropertyPage
      propertyId={propertyId}
      title="Property Alerts"
      description="Property-specific alert center and red-alert monitoring for this location."
    >
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-sm">Current Property Alerts</CardTitle>
          <CardDescription>
            Alerts shown here are scoped to this property only.
          </CardDescription>
        </CardHeader>
      </Card>
    </PropertyPage>
  )
}
