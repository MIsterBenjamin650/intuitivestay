import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@intuitive-stay/ui/components/card"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useState } from "react"

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
    member: "bg-gray-100 text-gray-600",
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
  const queryClient = useQueryClient()
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
    <AdminPropertyDetailInner
      propertyId={propertyId}
      property={property}
      scores={scores}
      qrCode={qrCode}
      feedback={feedback}
      queryClient={queryClient}
      trpc={trpc}
    />
  )
}

function AdminPropertyDetailInner({
  propertyId,
  property,
  scores,
  qrCode,
  feedback,
  queryClient,
  trpc,
}: {
  propertyId: string
  property: { id: string; name: string; status: string; city: string | null; country: string | null; address: string | null; type: string | null; ownerName: string; ownerEmail: string; plan: string; subscriptionStatus: string; createdAt: string | Date }
  scores: { avgGcs: number; avgResilience: number | null; avgEmpathy: number | null; avgAnticipation: number | null; avgRecognition: number | null; totalFeedback: number } | null
  qrCode: { uniqueCode: string; feedbackUrl: string; createdAt: string | Date } | null
  feedback: { id: string; submittedAt: string | Date; gcs: number; resilience: number; empathy: number; anticipation: number; recognition: number; namedStaffMember: string | null; ventText: string | null; source: string | null; mealTime: string | null }[]
  queryClient: ReturnType<typeof useQueryClient>
  trpc: ReturnType<typeof useTRPC>
}) {
  const [selectedPlan, setSelectedPlan] = useState(property.plan as "member" | "host" | "partner" | "founder")
  const [selectedStatus, setSelectedStatus] = useState<"none" | "trial" | "active" | "grace" | "expired">(
    (property.subscriptionStatus as "none" | "trial" | "active" | "grace" | "expired") ?? "none",
  )
  const [planSuccess, setPlanSuccess] = useState(false)

  const updatePlanMutation = useMutation(
    trpc.properties.adminUpdatePlan.mutationOptions({
      onSuccess: () => {
        setPlanSuccess(true)
        setTimeout(() => setPlanSuccess(false), 3000)
        void queryClient.invalidateQueries(
          trpc.properties.getAdminPropertyDetail.queryOptions({ propertyId }),
        )
      },
    }),
  )

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
                <a
                  href={qrCode.feedbackUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-sm font-medium text-primary underline"
                >
                  {qrCode.feedbackUrl}
                </a>
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

      {/* Plan Management */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plan Management</p>
        <div className="flex flex-wrap items-end gap-4 rounded-lg border p-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Plan</label>
            <select
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value as typeof selectedPlan)}
              className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="member">Member</option>
              <option value="host">Host</option>
              <option value="partner">Partner</option>
              <option value="founder">Founder</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Subscription Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as typeof selectedStatus)}
              className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="none">None</option>
              <option value="trial">Trial</option>
              <option value="active">Active</option>
              <option value="grace">Grace</option>
              <option value="expired">Expired</option>
            </select>
          </div>
          <button
            onClick={() =>
              updatePlanMutation.mutate({
                propertyId,
                plan: selectedPlan,
                subscriptionStatus: selectedStatus,
              })
            }
            disabled={updatePlanMutation.isPending}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {updatePlanMutation.isPending ? "Updating…" : "Update Plan"}
          </button>
          {planSuccess && (
            <p className="text-sm text-green-600">Plan updated successfully.</p>
          )}
          {updatePlanMutation.isError && (
            <p className="text-sm text-destructive">Failed to update plan. Please try again.</p>
          )}
        </div>
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
