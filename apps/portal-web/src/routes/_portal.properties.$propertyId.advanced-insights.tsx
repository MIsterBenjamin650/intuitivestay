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

export const Route = createFileRoute("/_portal/properties/$propertyId/advanced-insights")({
  component: RouteComponent,
})

const ADVANCED_MODULES = [
  {
    id: "sentiment-vibe-maps",
    label: "Sentiment Vibe Maps",
  },
  {
    id: "day-of-week-consistency",
    label: "Day-of-Week Consistency Tracking",
  },
  {
    id: "advanced-yearly-trends",
    label: "Advanced Yearly Trends",
  },
  {
    id: "reputation-gap-analysis",
    label: "Reputation Gap Analysis",
  },
] as const

function RouteComponent() {
  const { propertyId } = Route.useParams()
  const { session } = Route.useRouteContext()
  const access = resolvePortalAccess(session)

  return (
    <PropertyPage
      propertyId={propertyId}
      title="Advanced Insights"
      description="All plans can access this page; premium modules unlock by plan."
    >
      <div className="grid gap-3 md:grid-cols-2">
        {ADVANCED_MODULES.map((module) => {
          const enabled = isFeatureEnabled(access, module.id)
          return (
            <Card key={module.id} size="sm" className={!enabled ? "opacity-80" : undefined}>
              <CardHeader>
                <CardTitle className="text-sm">{module.label}</CardTitle>
                <CardDescription>
                  {enabled ? "Enabled for current plan." : "Locked for current plan."}
                </CardDescription>
              </CardHeader>
              {!enabled ? (
                <CardContent className="text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-md border border-border/70 px-2 py-1">
                    <LockIcon />
                    Upgrade to unlock
                  </span>
                </CardContent>
              ) : null}
            </Card>
          )
        })}
      </div>
    </PropertyPage>
  )
}
