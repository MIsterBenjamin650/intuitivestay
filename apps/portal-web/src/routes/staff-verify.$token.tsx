// apps/portal-web/src/routes/staff-verify.$token.tsx
import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"

import { useTRPCClient } from "@/utils/trpc"

export const Route = createFileRoute("/staff-verify/$token")({
  component: StaffVerifyPage,
})

function StaffVerifyPage() {
  const { token } = Route.useParams()
  const trpcClient = useTRPCClient()

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    trpcClient.staff.verifyStaffEmail
      .mutate({ token })
      .then((result) => {
        setName(result.name)
        setStatus("success")
      })
      .catch(() => {
        setStatus("error")
      })
  }, [token])

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Verifying your email…</p>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="font-semibold text-destructive">Verification failed</p>
          <p className="text-sm text-muted-foreground">
            This link is invalid or has already been used. If you need help, contact your manager.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4 px-6 max-w-sm">
        <div className="text-5xl">✅</div>
        <h2 className="text-xl font-bold">Email verified!</h2>
        <p className="text-sm text-muted-foreground">
          {name ? `Hi ${name} — your` : "Your"} Service Signature profile is now active. Guest
          feedback will be attributed to your profile going forward.
        </p>
      </div>
    </div>
  )
}
