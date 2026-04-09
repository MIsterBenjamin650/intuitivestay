import { createFileRoute, Link } from "@tanstack/react-router"
import { useEffect, useState } from "react"

import { useTRPCClient } from "@/utils/trpc"

export const Route = createFileRoute("/verify-property/$token")({
  component: VerifyPropertyPage,
})

function VerifyPropertyPage() {
  const { token } = Route.useParams()
  const trpcClient = useTRPCClient()

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [propertyName, setPropertyName] = useState<string>("")
  const [errorMessage, setErrorMessage] = useState<string>("")

  useEffect(() => {
    trpcClient.properties.verifyBusinessEmail
      .mutate({ token })
      .then((result) => {
        setPropertyName(result.propertyName)
        setStatus("success")
      })
      .catch((err: { message?: string }) => {
        setErrorMessage(err?.message ?? "Verification failed.")
        setStatus("error")
      })
  }, [token])

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f0ede8]">
        <p className="text-sm text-[#78716c]">Verifying your business email…</p>
      </div>
    )
  }

  if (status === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f0ede8] p-6">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
            <svg className="h-6 w-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[#1c1917]">Email verified</h1>
          <p className="text-sm text-[#78716c]">
            <strong className="text-[#44403c]">{propertyName}</strong> has been submitted for review.
            Our team will be in touch shortly.
          </p>
          <Link
            to="/login"
            className="inline-block mt-2 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
          >
            Back to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f0ede8] p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-[#1c1917]">Verification failed</h1>
        <p className="text-sm text-[#78716c]">{errorMessage}</p>
        <Link
          to="/login"
          className="inline-block mt-2 text-sm text-orange-500 hover:underline"
        >
          Back to login
        </Link>
      </div>
    </div>
  )
}
