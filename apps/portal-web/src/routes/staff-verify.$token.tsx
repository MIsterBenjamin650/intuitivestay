// apps/portal-web/src/routes/staff-verify.$token.tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"

import { useTRPCClient } from "@/utils/trpc"

export const Route = createFileRoute("/staff-verify/$token")({
  component: StaffVerifyPage,
})

function StaffVerifyPage() {
  const { token } = Route.useParams()
  const trpcClient = useTRPCClient()
  const navigate = useNavigate()

  const [status, setStatus] = useState<"loading" | "error">("loading")

  useEffect(() => {
    trpcClient.staff.verifyStaffEmail
      .mutate({ token })
      .then((result) => {
        void navigate({
          to: "/staff-profile/$staffProfileId",
          params: { staffProfileId: result.staffProfileId },
        })
      })
      .catch(() => {
        setStatus("error")
      })
  }, [token])

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
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">Verifying your email…</p>
    </div>
  )
}
