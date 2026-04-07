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
import { useState } from "react"

import { useTRPC } from "@/utils/trpc"

export const Route = createFileRoute("/_portal/properties/$propertyId/alerts")({
  component: RouteComponent,
})

type Tab = "low-scores" | "flagged"

function formatDate(date: Date | string) {
  return new Date(date).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function PillarGrid({
  resilience,
  empathy,
  anticipation,
  recognition,
}: {
  resilience: number
  empathy: number
  anticipation: number
  recognition: number
}) {
  return (
    <div className="grid grid-cols-4 gap-2 text-center">
      {[
        { label: "Resilience", value: resilience },
        { label: "Empathy", value: empathy },
        { label: "Anticipation", value: anticipation },
        { label: "Recognition", value: recognition },
      ].map(({ label, value }) => (
        <div key={label} className="rounded-md border p-2">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-semibold">{value}/10</p>
        </div>
      ))}
    </div>
  )
}

function RouteComponent() {
  const { propertyId } = Route.useParams()
  const trpc = useTRPC()
  const [activeTab, setActiveTab] = useState<Tab>("low-scores")

  const {
    data: alerts = [],
    isLoading: alertsLoading,
    isError: alertsError,
  } = useQuery(trpc.feedback.getPropertyAlertFeedback.queryOptions({ propertyId }))

  const {
    data: flagged = [],
    isLoading: flaggedLoading,
    isError: flaggedError,
  } = useQuery(trpc.feedback.getUniformScoreFeedback.queryOptions({ propertyId }))

  const isLoading = alertsLoading || flaggedLoading
  const isError = alertsError || flaggedError

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
          Monitor low scores and flagged submissions for this property.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-lg border bg-muted p-1 w-fit">
        <button
          onClick={() => setActiveTab("low-scores")}
          className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            activeTab === "low-scores"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Low Scores
          {alerts.length > 0 && (
            <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
              {alerts.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("flagged")}
          className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            activeTab === "flagged"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Flagged Submissions
          {flagged.length > 0 && (
            <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
              {flagged.length}
            </span>
          )}
        </button>
      </div>

      {/* ─── Low Scores Tab ─── */}
      {activeTab === "low-scores" && (
        <>
          {alerts.length === 0 ? (
            <Card size="sm">
              <CardHeader>
                <CardTitle className="text-sm">No low-score alerts</CardTitle>
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
                    <CardDescription>{formatDate(alert.submittedAt)}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <PillarGrid
                      resilience={alert.resilience}
                      empathy={alert.empathy}
                      anticipation={alert.anticipation}
                      recognition={alert.recognition}
                    />
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
        </>
      )}

      {/* ─── Flagged Submissions Tab ─── */}
      {activeTab === "flagged" && (
        <>
          <p className="text-sm text-muted-foreground -mt-3">
            These submissions had all four pillar scores rated identically — this pattern can
            indicate a guest who clicked through without reading, or a deliberate attempt to
            skew results. Most recent first, up to 50 entries.
          </p>
          {flagged.length === 0 ? (
            <Card size="sm">
              <CardHeader>
                <CardTitle className="text-sm">No flagged submissions</CardTitle>
                <CardDescription>
                  No uniform-score submissions have been received yet.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              {flagged.map((row) => (
                <Card key={row.id} className="border-amber-200">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm">
                        GCS:{" "}
                        <span className="font-bold">
                          {row.gcs.toFixed(2)}
                        </span>
                      </CardTitle>
                      <Badge variant="outline" className="text-amber-600 border-amber-400 bg-amber-50">
                        ⚠ Uniform score
                      </Badge>
                    </div>
                    <CardDescription>
                      {formatDate(row.submittedAt)}
                      {row.mealTime && row.mealTime !== "none" && (
                        <span className="ml-2 capitalize">· {row.mealTime}</span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <PillarGrid
                      resilience={row.resilience}
                      empathy={row.empathy}
                      anticipation={row.anticipation}
                      recognition={row.recognition}
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      All four pillars rated <strong>{row.resilience}/10</strong> — identical scores across the board.
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
