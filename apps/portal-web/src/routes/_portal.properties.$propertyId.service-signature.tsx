import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { CheckIcon, CopyIcon, RefreshCwIcon, ShieldCheckIcon } from "lucide-react"

import { useTRPC } from "@/utils/trpc"

export const Route = createFileRoute(
  "/_portal/properties/$propertyId/service-signature",
)({
  component: RouteComponent,
})

function RouteComponent() {
  const { propertyId } = Route.useParams()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [copied, setCopied] = React.useState(false)
  const [confirmRemoveId, setConfirmRemoveId] = React.useState<string | null>(null)
  const [commendingStaffId, setCommendingStaffId] = React.useState<string | null>(null)
  const [commendBody, setCommendBody] = React.useState("")
  const [resendingId, setResendingId] = React.useState<string | null>(null)
  const [resentId, setResentId] = React.useState<string | null>(null)

  const removeMutation = useMutation(
    trpc.staff.removeStaff.mutationOptions({
      onSuccess: () => {
        setConfirmRemoveId(null)
        void queryClient.invalidateQueries(
          trpc.staff.listPropertyStaff.queryOptions({ propertyId }),
        )
      },
    }),
  )

  const commendMutation = useMutation(
    trpc.staff.addCommendation.mutationOptions({
      onSuccess: () => {
        setTimeout(() => {
          setCommendingStaffId(null)
          setCommendBody("")
        }, 1500)
      },
    }),
  )

  const resendMutation = useMutation(
    trpc.staff.resendVerificationEmail.mutationOptions({
      onSuccess: (_, variables) => {
        setResendingId(null)
        setResentId(variables.staffProfileId)
        setTimeout(() => setResentId(null), 2000)
      },
      onError: () => {
        setResendingId(null)
      },
    }),
  )

  const { data: inviteData, isLoading: inviteLoading } = useQuery(
    trpc.staff.getInviteUrl.queryOptions({ propertyId }),
  )

  const { data: staffList, isLoading: staffLoading } = useQuery(
    trpc.staff.listPropertyStaff.queryOptions({ propertyId }),
  )

  const generateMutation = useMutation(
    trpc.staff.generateInviteToken.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(
          trpc.staff.getInviteUrl.queryOptions({ propertyId }),
        )
      },
    }),
  )

  function handleCopy() {
    if (!inviteData?.inviteUrl) return
    void navigator.clipboard.writeText(inviteData.inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-6 space-y-8 max-w-4xl">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <ShieldCheckIcon className="size-5 text-orange-500" />
          <h1 className="text-2xl font-bold">Service Signature</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Give your team a staff invite link. When they register, guest feedback
          nominations are attributed to their profile — building their Service
          Signature passport over time.
        </p>
      </div>

      {/* Invite link card */}
      <div className="rounded-xl border bg-white p-5 space-y-4 shadow-sm">
        <div>
          <p className="font-semibold text-sm">Staff Registration Link</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Share this link with your team. Anyone with the link can register.
            Regenerating it invalidates the old link immediately.
          </p>
        </div>

        {inviteLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : inviteData?.inviteUrl ? (
          <div className="flex gap-2">
            <input
              readOnly
              value={inviteData.inviteUrl}
              className="flex-1 rounded-lg border border-border bg-gray-50 px-3 py-2 text-xs font-mono text-gray-700 outline-none"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium hover:bg-gray-50 transition-colors"
            >
              {copied ? (
                <CheckIcon className="size-3.5 text-green-600" />
              ) : (
                <CopyIcon className="size-3.5" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No link generated yet. Click below to create one.
          </p>
        )}

        <button
          type="button"
          onClick={() => generateMutation.mutate({ propertyId })}
          disabled={generateMutation.isPending}
          className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60 transition-colors"
        >
          <RefreshCwIcon className="size-3.5" />
          {inviteData?.inviteUrl ? "Regenerate Link" : "Generate Link"}
        </button>
      </div>

      {/* Registered staff */}
      <div className="space-y-3">
        <p className="font-semibold text-sm">Registered Staff</p>
        {staffLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !staffList || staffList.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <ShieldCheckIcon className="mx-auto size-7 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              No staff registered yet. Share the link above to get started.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Joined</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nominations</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map((s) => (
                  <React.Fragment key={s.id}>
                    <tr className="border-b">
                      <td className="px-4 py-3 font-medium">
                        <span className="flex items-center gap-1.5">
                          {staffList && staffList[0]?.id === s.id && s.nominations > 0 && (
                            <span title="Top nominee">🥇</span>
                          )}
                          {s.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{s.email}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(s.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        {s.emailVerifiedAt ? (
                          <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {s.emailVerifiedAt ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-sm">{s.nominations}</span>
                            {s.nominations > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {s.avgGcs > 0 ? `· avg ${(s.avgGcs * 10).toFixed(0)}` : ""}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {!s.emailVerifiedAt && confirmRemoveId !== s.id && (
                            <button
                              type="button"
                              onClick={() => {
                                setResendingId(s.id)
                                resendMutation.mutate({ staffProfileId: s.id })
                              }}
                              disabled={resendingId === s.id}
                              className="text-xs font-medium text-blue-500 hover:text-blue-600 disabled:opacity-50 transition-colors"
                            >
                              {resentId === s.id ? "Sent ✓" : resendingId === s.id ? "Sending…" : "Resend"}
                            </button>
                          )}
                          {s.emailVerifiedAt && confirmRemoveId !== s.id && (
                            <button
                              type="button"
                              onClick={() => {
                                setCommendingStaffId(commendingStaffId === s.id ? null : s.id)
                                setCommendBody("")
                                commendMutation.reset()
                              }}
                              className="text-xs font-medium text-orange-500 hover:text-orange-600 transition-colors"
                            >
                              {commendingStaffId === s.id ? "Cancel" : "Commend"}
                            </button>
                          )}
                          {confirmRemoveId === s.id ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Confirm?</span>
                              <button
                                type="button"
                                onClick={() => removeMutation.mutate({ staffProfileId: s.id })}
                                disabled={removeMutation.isPending}
                                className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                              >
                                {removeMutation.isPending ? "Removing…" : "Yes"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmRemoveId(null)}
                                disabled={removeMutation.isPending}
                                className="text-xs text-muted-foreground hover:text-foreground"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmRemoveId(s.id)}
                              className="text-xs font-medium text-red-500 hover:text-red-600 transition-colors"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {commendingStaffId === s.id && (
                      <tr className="bg-orange-50/40 border-b">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="space-y-3 max-w-lg">
                            <p className="text-xs font-semibold">
                              Write a commendation for {s.name}
                            </p>
                            <textarea
                              value={commendBody}
                              onChange={(e) => setCommendBody(e.target.value)}
                              maxLength={500}
                              rows={3}
                              placeholder="Describe how this staff member went above and beyond…"
                              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
                            />
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                {commendBody.length}/500
                              </span>
                              <div className="flex items-center gap-2">
                                {commendMutation.isSuccess ? (
                                  <span className="text-xs font-medium text-green-600">
                                    Commendation added ✓
                                  </span>
                                ) : (
                                  <div className="flex flex-col items-end gap-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        commendMutation.mutate({
                                          staffProfileId: s.id,
                                          body: commendBody,
                                        })
                                      }
                                      disabled={
                                        commendBody.trim().length < 10 ||
                                        commendMutation.isPending
                                      }
                                      className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-60 transition-colors"
                                    >
                                      {commendMutation.isPending ? "Submitting…" : "Submit"}
                                    </button>
                                    {commendMutation.isError && (
                                      <span className="text-xs text-red-600">
                                        Failed to submit. Please try again.
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
