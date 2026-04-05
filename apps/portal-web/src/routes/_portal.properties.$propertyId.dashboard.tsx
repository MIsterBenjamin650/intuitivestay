import { Card, CardDescription, CardHeader, CardTitle } from "@intuitive-stay/ui/components/card"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { useTRPC } from "@/utils/trpc"

export const Route = createFileRoute("/_portal/properties/$propertyId/dashboard")({
  component: RouteComponent,
})

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle>{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}

function RouteComponent() {
  const { propertyId } = Route.useParams()
  const trpc = useTRPC()
  const { data, isLoading, isError } = useQuery(
    trpc.properties.getPropertyDashboard.queryOptions({ propertyId }),
  )

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">Failed to load property data.</p>
      </div>
    )
  }

  const fmt = (v: number | null) => (v != null ? v.toFixed(2) : "—")

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{data.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {[data.type, data.city, data.country].filter(Boolean).join(" · ")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="GCS" value={fmt(data.avgGcs)} />
        <StatCard label="Total Feedback" value={String(data.totalFeedback)} />
        <StatCard
          label="Status"
          value={data.status.charAt(0).toUpperCase() + data.status.slice(1)}
        />
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">Pillar Averages</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Resilience" value={fmt(data.avgResilience)} />
          <StatCard label="Empathy" value={fmt(data.avgEmpathy)} />
          <StatCard label="Anticipation" value={fmt(data.avgAnticipation)} />
          <StatCard label="Recognition" value={fmt(data.avgRecognition)} />
        </div>
      </div>

      {data.totalFeedback === 0 && (
        <p className="text-sm text-muted-foreground">
          No feedback received yet. Share the QR code with guests to start collecting data.
        </p>
      )}
    </div>
  )
}
