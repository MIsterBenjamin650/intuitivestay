// apps/portal-web/src/routes/staff-login.tsx
import { useMutation } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { ShieldCheckIcon } from "lucide-react"
import { useState } from "react"

import { useTRPC } from "@/utils/trpc"

export const Route = createFileRoute("/staff-login")({
  component: StaffLoginPage,
})

function StaffLoginPage() {
  const trpc = useTRPC()
  const [email, setEmail] = useState("")

  const mutation = useMutation(trpc.staff.requestProfileLink.mutationOptions())

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    mutation.mutate({ email: email.trim() })
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="mx-auto max-w-sm w-full space-y-6">

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="rounded-full bg-orange-100 p-3">
              <ShieldCheckIcon className="size-8 text-orange-500" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Find your profile</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Enter the email address you used to register. We'll send you a link to your Service Signature profile.
            </p>
          </div>
        </div>

        {/* Form / Success state */}
        {mutation.isSuccess ? (
          <div className="rounded-xl border bg-white shadow-sm p-6 text-center space-y-2">
            <p className="font-semibold text-sm">Check your inbox</p>
            <p className="text-sm text-muted-foreground">
              If we found a profile linked to this email, we've sent you a link.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-xl border bg-white shadow-sm p-6 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-border bg-gray-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              type="submit"
              disabled={mutation.isPending || !email.trim()}
              className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60 transition-colors"
            >
              {mutation.isPending ? "Sending…" : "Send my profile link"}
            </button>
            {mutation.isError && (
              <p className="text-xs text-red-600 text-center">
                Something went wrong. Please try again.
              </p>
            )}
          </form>
        )}

      </div>
    </div>
  )
}
