import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { useTRPC } from "@/utils/trpc"

export const Route = createFileRoute("/_portal/properties/$propertyId/feedback")({
  component: RouteComponent,
})

function RouteComponent() {
  const { propertyId } = Route.useParams()
  const trpc = useTRPC()
  const { data, isLoading, isError } = useQuery(
    trpc.feedback.getPropertyFeedbackSummary.queryOptions({ propertyId }),
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
        <p className="text-sm text-destructive">Failed to load feedback data.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 p-6">
      <div>
        <h1 className="text-2xl font-bold">Guest Feedback</h1>
        <p className="text-muted-foreground text-sm mt-1">
          GCS pillar breakdown and staff recognition · {data.totalFeedback} submission
          {data.totalFeedback !== 1 ? "s" : ""}
        </p>
      </div>

      {data.totalFeedback === 0 ? (
        <p className="text-sm text-muted-foreground">
          No feedback received yet. Share the QR code with guests to start collecting data.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl border bg-card p-4">
              <h2 className="font-semibold mb-4">GCS Pillar Overview</h2>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={data.pillarScores}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="pillar" />
                  <Radar
                    name="Score"
                    dataKey="score"
                    stroke="#6366f1"
                    fill="#6366f1"
                    fillOpacity={0.4}
                  />
                  <Tooltip formatter={(v) => (typeof v === "number" ? v.toFixed(2) : v)} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <h2 className="font-semibold mb-4">Pillar Scores (avg, 1–10)</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.pillarScores}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="pillar" />
                  <YAxis domain={[0, 10]} />
                  <Tooltip formatter={(v) => (typeof v === "number" ? v.toFixed(2) : v)} />
                  <Bar dataKey="score" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {data.staffMentions.length > 0 ? (
            <div className="rounded-xl border bg-card p-4">
              <h2 className="font-semibold mb-4">Staff Mentions in Feedback</h2>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.staffMentions} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis dataKey="name" type="category" width={80} />
                  <Tooltip />
                  <Bar dataKey="mentions" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="rounded-xl border bg-card p-4">
              <h2 className="font-semibold mb-2">Staff Mentions</h2>
              <p className="text-sm text-muted-foreground">
                No staff members named yet. Nominations appear here when high-scoring guests
                use the Name Drop™ screen.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
