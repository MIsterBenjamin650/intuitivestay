import * as React from "react"
import { Button } from "@intuitive-stay/ui/components/button"
import { Input } from "@intuitive-stay/ui/components/input"
import { Label } from "@intuitive-stay/ui/components/label"
import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router"
import { z } from "zod"

import { authClient } from "@/lib/auth-client"
import { useTRPC } from "@/utils/trpc"

export const Route = createFileRoute("/invite")({
  validateSearch: z.object({ token: z.string().optional() }),
  component: RouteComponent,
})

function RouteComponent() {
  const { token } = useSearch({ from: "/invite" })
  const navigate = useNavigate()
  const trpc = useTRPC()

  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  const { data: session } = authClient.useSession()

  const { data: details, isLoading } = useQuery(
    trpc.invite.getDetails.queryOptions(
      { token: token ?? "" },
      { enabled: Boolean(token) },
    ),
  )

  const acceptMutation = useMutation(trpc.invite.accept.mutationOptions())

  async function handleAccept() {
    if (!token) return
    setError(null)
    setSubmitting(true)
    try {
      const result = await acceptMutation.mutateAsync({ token })
      void navigate({
        to: "/properties/$propertyId/dashboard",
        params: { propertyId: result.propertyId },
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to accept invite"
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSignUpAndAccept() {
    if (!token || !details || !details.valid) return
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const signUpResult = await authClient.signUp.email({
        email: details.email,
        password,
        name: details.email.split("@")[0] ?? details.email,
      })
      if (signUpResult.error) {
        setError(signUpResult.error.message ?? "Sign up failed")
        setSubmitting(false)
        return
      }
      const result = await acceptMutation.mutateAsync({ token })
      void navigate({
        to: "/properties/$propertyId/dashboard",
        params: { propertyId: result.propertyId },
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong"
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold">Invalid invite link</h1>
          <p className="mt-2 text-muted-foreground">This invite link is missing a token.</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (!details || !details.valid) {
    const reason = details?.reason
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold">
            {reason === "expired"
              ? "Invite expired"
              : reason === "already_accepted"
              ? "Already accepted"
              : "Invalid invite"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {reason === "expired"
              ? "This invite link has expired. Ask your property owner to resend the invitation."
              : reason === "already_accepted"
              ? "This invite has already been accepted. Try logging in."
              : "This invite link is not valid."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">You've been invited</h1>
          <p className="mt-1 text-muted-foreground">
            Access the dashboard for <strong>{details.propertyName}</strong>
          </p>
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {session ? (
          session.user.email === details.email ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Signed in as <strong>{session.user.email}</strong>
              </p>
              <button
                onClick={handleAccept}
                disabled={submitting}
                className="w-full rounded-lg bg-orange-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
              >
                {submitting ? "Accepting…" : "Accept Invitation"}
              </button>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                You are signed in as <strong>{session.user.email}</strong>, but this invite was sent
                to <strong>{details.email}</strong>.
              </p>
              <p className="text-sm text-muted-foreground">
                Please sign out and use the invited email address.
              </p>
              <button
                onClick={() => void authClient.signOut()}
                className="w-full rounded-lg border border-orange-500 py-3 text-sm font-semibold text-orange-600 transition-colors hover:bg-orange-50"
              >
                Sign Out
              </button>
            </div>
          )
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={details.email} readOnly className="bg-muted" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Create a password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
              />
            </div>
            <button
              onClick={handleSignUpAndAccept}
              disabled={submitting}
              className="w-full rounded-lg bg-orange-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
            >
              {submitting ? "Setting up…" : "Create account & accept"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
