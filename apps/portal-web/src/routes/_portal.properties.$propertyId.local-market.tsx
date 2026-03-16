import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@intuitive-stay/ui/components/card"
import { createFileRoute } from "@tanstack/react-router"
import { LockIcon } from "lucide-react"

import { PropertyPage } from "@/components/property-page"
import { isFeatureEnabled, resolvePortalAccess } from "@/lib/portal-access"

export const Route = createFileRoute("/_portal/properties/$propertyId/local-market")({
  component: RouteComponent,
})

function RouteComponent() {
  const { propertyId } = Route.useParams()
  const { session } = Route.useRouteContext()
  const access = resolvePortalAccess(session)
  const enabled = isFeatureEnabled(access, "local-market")

  return (
    <PropertyPage
      propertyId={propertyId}
      title="Local Market"
      description="Elite-tier benchmarking and city leaderboard analysis."
    >
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-sm">Local City Leaderboard</CardTitle>
          <CardDescription>
            {enabled ? "Enabled for current plan." : "Elite plan required."}
          </CardDescription>
        </CardHeader>
        {!enabled ? (
          <CardContent className="text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-md border border-border/70 px-2 py-1">
              <LockIcon />
              Upgrade to Elite
            </span>
          </CardContent>
        ) : null}
      </Card>
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-sm">Market Benchmarking</CardTitle>
          <CardDescription>
            {enabled ? "Enabled for current plan." : "Elite plan required."}
          </CardDescription>
        </CardHeader>
        {!enabled ? (
          <CardContent className="text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-md border border-border/70 px-2 py-1">
              <LockIcon />
              Upgrade to Elite
            </span>
          </CardContent>
        ) : null}
      </Card>
    </PropertyPage>
  )
}
