import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@intuitive-stay/ui/components/card"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { useTRPC } from "@/utils/trpc"

export const Route = createFileRoute("/_portal/")({
  component: RouteComponent,
})

function RouteComponent() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(trpc.properties.getPortfolioDashboard.queryOptions())

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="grid gap-4 md:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Portfolio GCS</CardDescription>
            <CardTitle>
              {isLoading ? "—" : data?.portfolioGcs != null ? data.portfolioGcs.toFixed(1) : "No data"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Active Properties</CardDescription>
            <CardTitle>{isLoading ? "—" : (data?.activeCount ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Open Alerts</CardDescription>
            <CardTitle>{isLoading ? "—" : (data?.alertCount ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organisation Dashboard</CardTitle>
          <CardDescription>
            Cross-property satisfaction health, trends, and priority actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Main dashboard aggregates all properties. Drill into each property from the sidebar.
        </CardContent>
      </Card>

      <div className="mt-2 rounded-lg border p-4">
        <h2 className="mb-4 text-lg font-semibold">Guest Satisfaction Over Time</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !data?.monthlyTrend.length ? (
          <p className="text-sm text-muted-foreground">
            No feedback received yet. Scores will appear here once guests start submitting.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis domain={[0, 10]} />
              <Tooltip formatter={(v) => (typeof v === "number" ? v.toFixed(2) : v)} />
              <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
