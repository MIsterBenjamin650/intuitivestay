import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@intuitive-stay/ui/components/card"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"

import { useTRPC } from "@/utils/trpc"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    approved: "bg-green-100 text-green-800",
    pending: "bg-yellow-100 text-yellow-800",
    rejected: "bg-red-100 text-red-800",
  }
  const cls = styles[status] ?? "bg-gray-100 text-gray-700"
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function planBadge(plan: string) {
  const styles: Record<string, string> = {
    host: "bg-slate-100 text-slate-700",
    partner: "bg-blue-100 text-blue-700",
    founder: "bg-purple-100 text-purple-700",
  }
  const cls = styles[plan] ?? "bg-gray-100 text-gray-700"
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {plan.charAt(0).toUpperCase() + plan.slice(1)}
    </span>
  )
}

function scoreCard(label: string, value: number | null | undefined) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle>{value != null ? value.toFixed(1) : "—"}</CardTitle>
      </CardHeader>
    </Card>
  )
}

function truncate(text: string | null | undefined, len: number): string {
  if (!text) return "—"
  return text.length > len ? text.slice(0, len) + "…" : text
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  propertyId: string
}

export function AdminPropertyDetail({ propertyId }: Props) {
  const trpc = useTRPC()
  const { data, isLoading, isError } = useQuery(
    trpc.properties.getAdminPropertyDetail.queryOptions({ propertyId }),
  )

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Loading…</div>
  }

  if (isError || !data) {
    return (
      <div className="p-6 text-destructive">
        Property not found or access denied.
      </div>
    )
  }

  const { property, scores, qrCode, feedback } = data

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
        >
          ← Back to Admin Dashboard
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{property.name}</h1>
          {statusBadge(property.status)}
          {planBadge(property.plan)}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {[property.city, property.country, property.type].filter(Boolean).join(" · ")}
          {" · "}
          Registered {new Date(property.createdAt).toLocaleDateString()}
        </p>
      </div>

      {/* Info cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Owner</CardDescription>
            <CardTitle className="text-base">{property.ownerName}</CardTitle>
            <p className="text-sm text-muted-foreground">{property.ownerEmail}</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>QR Code</CardDescription>
            {qrCode ? (
              <>
                <CardTitle className="truncate text-sm font-medium">
                  {truncate(qrCode.feedbackUrl, 50)}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Generated {new Date(qrCode.createdAt).toLocaleDateString()}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No QR code yet</p>
            )}
          </CardHeader>
        </Card>
      </div>

      {/* Performance scores */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Performance</p>
        {scores == null ? (
          <p className="text-sm text-muted-foreground">No data yet</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-6">
            {scoreCard("Avg GCS", scores.avgGcs)}
            {scoreCard("Total Feedback", scores.totalFeedback)}
            {scoreCard("Resilience", scores.avgResilience)}
            {scoreCard("Empathy", scores.avgEmpathy)}
            {scoreCard("Anticipation", scores.avgAnticipation)}
            {scoreCard("Recognition", scores.avgRecognition)}
          </div>
        )}
      </div>

      {/* Feedback history */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Feedback History ({feedback.length} submission{feedback.length !== 1 ? "s" : ""})
        </p>
        {feedback.length === 0 ? (
          <p className="text-sm text-muted-foreground">No feedback received yet</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  {["Date", "GCS", "Resilience", "Empathy", "Anticipation", "Recognition", "Staff Named", "Vent Text"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {feedback.map((f) => (
                  <tr key={f.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(f.submittedAt).toLocaleDateString()}
                    </td>
                    <td className={`px-4 py-3 font-semibold ${f.gcs <= 5 ? "text-red-600" : ""}`}>
                      {f.gcs.toFixed(1)}
                    </td>
                    <td className="px-4 py-3">{f.resilience}</td>
                    <td className="px-4 py-3">{f.empathy}</td>
                    <td className="px-4 py-3">{f.anticipation}</td>
                    <td className="px-4 py-3">{f.recognition}</td>
                    <td className="px-4 py-3">{f.namedStaffMember ?? "—"}</td>
                    <td
                      className="max-w-[200px] truncate px-4 py-3 text-muted-foreground"
                      title={f.ventText ?? undefined}
                    >
                      {truncate(f.ventText, 40)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
