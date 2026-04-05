import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@intuitive-stay/ui/components/card"
import { Button } from "@intuitive-stay/ui/components/button"
import { createFileRoute } from "@tanstack/react-router"
import { LockIcon } from "lucide-react"

import { useActiveProperty } from "@/lib/active-property-context"
import { isFeatureEnabled, resolvePortalAccess } from "@/lib/portal-access"

export const Route = createFileRoute("/_portal/organisation/alerts")({
  component: RouteComponent,
})

function RouteComponent() {
  const { session } = Route.useRouteContext()
  const access = resolvePortalAccess(session)
  const redAlertsEnabled = isFeatureEnabled(access, "venting-box-red-alerts")

  const { activePropertyId, properties, setActivePropertyId } = useActiveProperty()

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <Card>
        <CardHeader>
          <CardTitle>Organisation Alerts</CardTitle>
          <CardDescription>
            Organisation-level alert center with property filtering.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {properties.map((property) => (
            <Button
              key={property.id}
              variant={activePropertyId === property.id ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setActivePropertyId(property.id)
              }}
            >
              {property.name}
            </Button>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">Standard Monthly Reporting</CardTitle>
            <CardDescription>Available on all plans.</CardDescription>
          </CardHeader>
        </Card>
        <Card size="sm" className={!redAlertsEnabled ? "opacity-80" : undefined}>
          <CardHeader>
            <CardTitle className="text-sm">Venting Box Red Alerts</CardTitle>
            <CardDescription>
              {redAlertsEnabled ? "Enabled for current plan." : "Partner or above required."}
            </CardDescription>
          </CardHeader>
          {!redAlertsEnabled ? (
            <CardContent className="text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-md border border-border/70 px-2 py-1">
                <LockIcon />
                Upgrade to Partner
              </span>
            </CardContent>
          ) : null}
        </Card>
      </div>
    </div>
  )
}
