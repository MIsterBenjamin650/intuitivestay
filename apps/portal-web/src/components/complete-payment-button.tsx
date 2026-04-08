import { Button } from "@intuitive-stay/ui/components/button"
import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { useTRPC } from "@/utils/trpc"

export function CompletePaymentButton({ propertyId }: { propertyId: string }) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    try {
      const result = await queryClient.fetchQuery(
        trpc.properties.getAdditionalPropertyCheckoutUrl.queryOptions({ propertyId }),
      )
      window.location.href = result.url
    } catch (err) {
      setError("Could not load payment link. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        onClick={handleClick}
        disabled={loading}
        className="bg-orange-500 hover:bg-orange-600 text-white"
      >
        {loading ? "Loading…" : "Complete payment →"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
