import { Badge } from "@intuitive-stay/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@intuitive-stay/ui/components/card"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { useTRPC } from "@/utils/trpc"

export const Route = createFileRoute("/_portal/properties/$propertyId/alerts")({
  component: RouteComponent,
})

function RouteComponent() {
  const { propertyId } = Route.useParams()
  const trpc = useTRPC()
  const { data: alerts = [], isLoading, isError } = useQuery(
    trpc.feedback.getPropertyAlertFeedback.queryOptions({ propertyId }),
  )

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">Failed to load alerts.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Property Alerts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Submissions with a GCS of 5 or below — most recent first.
        </p>
      </div>

      {alerts.length === 0 ? (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">No alerts</CardTitle>
            <CardDescription>All guest scores are above 5. Keep it up!</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {alerts.map((alert) => (
            <Card key={alert.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm">
                    GCS:{" "}
                    <span className="text-destructive font-bold">
                      {alert.gcs.toFixed(2)}
                    </span>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {alert.isUniformScore && (
                      <Badge variant="outline" className="text-amber-600 border-amber-400 bg-amber-50">
                        ⚠ Uniform score
                      </Badge>
                    )}
                    <Badge variant="destructive">Low Score</Badge>
                  </div>
                </div>
                <CardDescription>
                  {new Date(alert.submittedAt).toLocaleString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: "Resilience", value: alert.resilience },
                    { label: "Empathy", value: alert.empathy },
                    { label: "Anticipation", value: alert.anticipation },
                    { label: "Recognition", value: alert.recognition },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-md border p-2">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="font-semibold">{value}/10</p>
                    </div>
                  ))}
                </div>
                {alert.ventText && (
                  <div className="rounded-md bg-muted p-3">
                    <p className="text-xs text-muted-foreground mb-1">Guest message:</p>
                    <p className="text-sm">{alert.ventText}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
