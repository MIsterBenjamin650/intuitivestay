import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@intuitive-stay/ui/components/card"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"

import { useTRPC, useTRPCClient } from "@/utils/trpc"

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

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "N/A"
  return new Date(d).toLocaleDateString()
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

type PropertyShape = {
  id: string
  name: string
  status: string
  city: string | null
  country: string | null
  address: string | null
  type: string | null
  postcode?: string | null
  ownerName: string
  ownerEmail: string
  plan: string
  subscriptionStatus: string
  adminNotes: string | null
  isVip: boolean
  trialEndsAt: string | Date | null
  subscriptionEndsAt: string | Date | null
  stripeCustomerId: string | null
  createdAt: string | Date
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
  property: PropertyShape
  scores: { avgGcs: number; avgResilience: number | null; avgEmpathy: number | null; avgAnticipation: number | null; avgRecognition: number | null; totalFeedback: number } | null
  qrCode: { uniqueCode: string; feedbackUrl: string; createdAt: string | Date } | null
  feedback: { id: string; submittedAt: string | Date; gcs: number; resilience: number; empathy: number; anticipation: number; recognition: number; namedStaffMember: string | null; ventText: string | null; source: string | null; mealTime: string | null }[]
  queryClient: ReturnType<typeof useQueryClient>
  trpc: ReturnType<typeof useTRPC>
}) {
  const navigate = useNavigate()
  const trpcClient = useTRPCClient()

  // Plan management state
  const [selectedPlan, setSelectedPlan] = useState(property.plan as "member" | "host" | "partner" | "founder")
  const [selectedStatus, setSelectedStatus] = useState<"none" | "trial" | "active" | "grace" | "expired">(
    (property.subscriptionStatus as "none" | "trial" | "active" | "grace" | "expired") ?? "none",
  )
  const [planSuccess, setPlanSuccess] = useState(false)

  // Edit property details state
  const [editName, setEditName] = useState(property.name)
  const [editCity, setEditCity] = useState(property.city ?? "")
  const [editCountry, setEditCountry] = useState(property.country ?? "")
  const [editPostcode, setEditPostcode] = useState(property.postcode ?? "")
  const [editType, setEditType] = useState(property.type ?? "")
  const [detailsSuccess, setDetailsSuccess] = useState(false)
  const [detailsError, setDetailsError] = useState("")

  // Admin notes state
  const [adminNote, setAdminNote] = useState(property.adminNotes ?? "")
  const [noteSuccess, setNoteSuccess] = useState(false)
  const [noteError, setNoteError] = useState("")

  // VIP state
  const [isVip, setIsVip] = useState(property.isVip)

  // Quick action feedback states
  const [actionMessage, setActionMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Loading states for quick actions
  const [resendEmailPending, setResendEmailPending] = useState(false)
  const [resetPasswordPending, setResetPasswordPending] = useState(false)
  const [deletePending, setDeletePending] = useState(false)
  const [vipPending, setVipPending] = useState(false)

  const invalidate = () =>
    queryClient.invalidateQueries(
      trpc.properties.getAdminPropertyDetail.queryOptions({ propertyId }),
    )

  function showAction(text: string, type: "success" | "error") {
    setActionMessage({ text, type })
    setTimeout(() => setActionMessage(null), 4000)
  }

  // Plan mutation
  const updatePlanMutation = useMutation(
    trpc.properties.adminUpdatePlan.mutationOptions({
      onSuccess: () => {
        setPlanSuccess(true)
        setTimeout(() => setPlanSuccess(false), 3000)
        void invalidate()
      },
    }),
  )

  // Details mutation
  const updateDetailsMutation = useMutation(
    trpc.properties.updatePropertyDetails.mutationOptions({
      onSuccess: () => {
        setDetailsSuccess(true)
        setDetailsError("")
        setTimeout(() => setDetailsSuccess(false), 3000)
        void invalidate()
      },
      onError: () => setDetailsError("Failed to save changes. Please try again."),
    }),
  )

  // Note mutation
  const updateNoteMutation = useMutation(
    trpc.properties.updateAdminNote.mutationOptions({
      onSuccess: () => {
        setNoteSuccess(true)
        setNoteError("")
        setTimeout(() => setNoteSuccess(false), 3000)
        void invalidate()
      },
      onError: () => setNoteError("Failed to save note. Please try again."),
    }),
  )

  // Quick actions (using trpcClient directly)
  async function handleResendEmail() {
    setResendEmailPending(true)
    try {
      await trpcClient.properties.resendApprovalEmail.mutate({ propertyId })
      showAction("Approval email sent.", "success")
    } catch {
      showAction("Failed to send email. Please try again.", "error")
    } finally {
      setResendEmailPending(false)
    }
  }

  async function handleResetPassword() {
    setResetPasswordPending(true)
    try {
      await trpcClient.properties.resetOwnerPassword.mutate({ propertyId })
      showAction("Password reset email sent to owner.", "success")
    } catch {
      showAction("Failed to send password reset. Please try again.", "error")
    } finally {
      setResetPasswordPending(false)
    }
  }

  async function handleDelete() {
    setDeletePending(true)
    try {
      await trpcClient.properties.deleteProperty.mutate({ propertyId })
      void navigate({ to: "/" })
    } catch {
      showAction("Failed to delete property. Please try again.", "error")
      setShowDeleteConfirm(false)
    } finally {
      setDeletePending(false)
    }
  }

  async function handleToggleVip() {
    setVipPending(true)
    const newVip = !isVip
    try {
      await trpcClient.properties.toggleVip.mutate({ propertyId, isVip: newVip })
      setIsVip(newVip)
      showAction(`VIP ${newVip ? "enabled" : "disabled"}.`, "success")
      void invalidate()
    } catch {
      showAction("Failed to update VIP status.", "error")
    } finally {
      setVipPending(false)
    }
  }

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
          {isVip && (
            <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
              ⭐ VIP
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {[property.city, property.country, property.type].filter(Boolean).join(" · ")}
          {" · "}
          Registered {new Date(property.createdAt).toLocaleDateString()}
        </p>
      </div>

      {/* Quick Actions */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick Actions</p>
        <div className="flex flex-wrap gap-2 rounded-lg border p-4">
          <button
            onClick={handleResendEmail}
            disabled={resendEmailPending}
            className="rounded-md border border-indigo-300 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
          >
            {resendEmailPending ? "Sending…" : "Resend Approval Email"}
          </button>
          <button
            onClick={() => showAction("Coming soon", "success")}
            className="rounded-md border border-indigo-300 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
          >
            Resend QR Code
          </button>
          <button
            onClick={handleResetPassword}
            disabled={resetPasswordPending}
            className="rounded-md border border-indigo-300 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
          >
            {resetPasswordPending ? "Sending…" : "Reset Password"}
          </button>
          <button
            onClick={handleToggleVip}
            disabled={vipPending}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
              isVip
                ? "border-yellow-400 bg-yellow-400 text-white hover:bg-yellow-500"
                : "border-yellow-400 text-yellow-700 hover:bg-yellow-50"
            }`}
          >
            {vipPending ? "Updating…" : isVip ? "⭐ VIP (On)" : "⭐ VIP (Off)"}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Delete Property
          </button>
        </div>

        {/* Action feedback */}
        {actionMessage && (
          <p className={`mt-2 text-sm ${actionMessage.type === "success" ? "text-green-600" : "text-destructive"}`}>
            {actionMessage.text}
          </p>
        )}

        {/* Delete confirmation */}
        {showDeleteConfirm && (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">
              Are you sure you want to permanently delete <strong>{property.name}</strong>? This cannot be undone.
            </p>
            <button
              onClick={handleDelete}
              disabled={deletePending}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deletePending ? "Deleting…" : "Yes, Delete"}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        )}
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

      {/* Edit Property Details */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Edit Property Details</p>
        <div className="rounded-lg border p-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Property Name</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">City</label>
              <input
                value={editCity}
                onChange={(e) => setEditCity(e.target.value)}
                className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Country</label>
              <input
                value={editCountry}
                onChange={(e) => setEditCountry(e.target.value)}
                className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Postcode</label>
              <input
                value={editPostcode}
                onChange={(e) => setEditPostcode(e.target.value)}
                className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <select
                value={editType}
                onChange={(e) => setEditType(e.target.value)}
                className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— Select type —</option>
                <option value="hotel">Hotel</option>
                <option value="villa">Villa</option>
                <option value="bnb">B&amp;B</option>
                <option value="restaurant">Restaurant</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() =>
                updateDetailsMutation.mutate({
                  propertyId,
                  name: editName || undefined,
                  city: editCity || undefined,
                  country: editCountry || undefined,
                  postcode: editPostcode || undefined,
                  type: editType || undefined,
                })
              }
              disabled={updateDetailsMutation.isPending}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {updateDetailsMutation.isPending ? "Saving…" : "Save Changes"}
            </button>
            {detailsSuccess && <p className="text-sm text-green-600">Changes saved.</p>}
            {detailsError && <p className="text-sm text-destructive">{detailsError}</p>}
          </div>
        </div>
      </div>

      {/* Admin Notes */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admin Notes</p>
        <div className="rounded-lg border p-4">
          <textarea
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            rows={4}
            placeholder="Internal notes about this property…"
            className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => updateNoteMutation.mutate({ propertyId, note: adminNote })}
              disabled={updateNoteMutation.isPending}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {updateNoteMutation.isPending ? "Saving…" : "Save Note"}
            </button>
            {noteSuccess && <p className="text-sm text-green-600">Note saved.</p>}
            {noteError && <p className="text-sm text-destructive">{noteError}</p>}
          </div>
        </div>
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

      {/* Subscription History */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subscription History</p>
        <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Stripe Customer</p>
            {property.stripeCustomerId ? (
              <a
                href={`https://dashboard.stripe.com/customers/${property.stripeCustomerId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-sm font-medium text-indigo-600 underline"
              >
                {property.stripeCustomerId}
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">N/A</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Subscription Status</p>
            <p className="text-sm font-medium">{property.subscriptionStatus}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Trial Ends</p>
            <p className="text-sm font-medium">{formatDate(property.trialEndsAt)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Subscription Ends</p>
            <p className="text-sm font-medium">{formatDate(property.subscriptionEndsAt)}</p>
          </div>
        </div>
      </div>

      {/* Usage Stats */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Usage Stats</p>
        <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Total Feedback Received</p>
            <p className="text-sm font-medium">{scores?.totalFeedback ?? 0}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Property Registered</p>
            <p className="text-sm font-medium">{new Date(property.createdAt).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Login Tracking</p>
            <p className="text-sm italic text-muted-foreground">Coming soon</p>
          </div>
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
