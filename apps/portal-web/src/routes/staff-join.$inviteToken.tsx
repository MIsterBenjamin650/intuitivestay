// apps/portal-web/src/routes/staff-join.$inviteToken.tsx
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"

import { useTRPC, useTRPCClient } from "@/utils/trpc"

export const Route = createFileRoute("/staff-join/$inviteToken")({
  component: StaffJoinPage,
})

function StaffJoinPage() {
  const { inviteToken } = Route.useParams()
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()

  const { data, isLoading, isError } = useQuery(
    trpc.staff.getInviteInfo.queryOptions({ token: inviteToken }),
  )

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || isSubmitting) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      await trpcClient.staff.registerStaff.mutate({
        token: inviteToken,
        name: name.trim(),
        email: email.trim(),
      })
      setDone(true)
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      setSubmitError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="font-semibold">Invalid or expired link</p>
          <p className="text-sm text-muted-foreground">
            This invite link is no longer valid. Ask your manager for a new one.
          </p>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4 px-6 max-w-sm">
          <div className="text-5xl">🎉</div>
          <h2 className="text-xl font-bold">You're registered!</h2>
          <p className="text-sm text-muted-foreground">
            Your Service Signature profile at <strong>{data?.propertyName}</strong> has
            been created. Guest feedback will now be attributed to your profile.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            IntuitiveStay · Service Signature
          </p>
          <h1 className="text-2xl font-bold">Join {data?.propertyName}</h1>
          <p className="text-sm text-muted-foreground">
            Register your profile so guest feedback can be attributed to you.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="name" className="text-sm font-medium">
              Your name
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              maxLength={100}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium">
              Your email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}

          <button
            type="submit"
            disabled={!name.trim() || !email.trim() || isSubmitting}
            className="w-full rounded-lg bg-orange-500 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60 transition-colors"
          >
            {isSubmitting ? "Registering…" : "Create My Profile"}
          </button>
        </form>
      </div>
    </div>
  )
}
