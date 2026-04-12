import { Badge } from "@intuitive-stay/ui/components/badge"
import { Button } from "@intuitive-stay/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@intuitive-stay/ui/components/card"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useState } from "react"

import { useTRPC } from "@/utils/trpc"

export const Route = createFileRoute("/_portal/properties/$propertyId/feedback")({
  component: RouteComponent,
})

function formatDate(date: Date | string) {
  return new Date(date).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function GcsChip({ gcs }: { gcs: number }) {
  const color =
    gcs >= 8
      ? "bg-green-100 text-green-700 border-green-200"
      : gcs >= 6
        ? "bg-amber-100 text-amber-700 border-amber-200"
        : "bg-red-100 text-red-700 border-red-200"

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold tabular-nums ${color}`}>
      {gcs.toFixed(2)}
    </span>
  )
}

function PillarRow({
  resilience,
  empathy,
  anticipation,
  recognition,
}: {
  resilience: number
  empathy: number
  anticipation: number
  recognition: number
}) {
  return (
    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
      <span>R: <strong>{resilience}</strong></span>
      <span>E: <strong>{empathy}</strong></span>
      <span>A: <strong>{anticipation}</strong></span>
      <span>Rc: <strong>{recognition}</strong></span>
    </div>
  )
}

function RouteComponent() {
  const { propertyId } = Route.useParams()
  const trpc = useTRPC()
  const [offset, setOffset] = useState(0)

  const { data, isLoading, isError } = useQuery(
    trpc.feedback.getFeedbackLog.queryOptions({ propertyId, offset }),
  )

  const pageSize = data?.pageSize ?? 50
  const total = data?.total ?? 0
  const rows = data?.rows ?? []
  const currentPage = Math.floor(offset / pageSize) + 1
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Feedback Log</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every submission received — most recent first.
          {total > 0 && ` ${total.toLocaleString()} total.`}
        </p>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}

      {isError && (
        <p className="text-sm text-destructive">Failed to load feedback.</p>
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">No feedback yet</CardTitle>
            <CardDescription>
              Share your QR code with guests to start collecting submissions.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <>
          <div className="flex flex-col gap-3">
            {rows.map((row) => (
              <Card key={row.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <GcsChip gcs={row.gcs} />
                      {row.gcs <= 5 && (
                        <Badge variant="destructive" className="text-[10px]">Low Score</Badge>
                      )}
                      {row.isUniformScore && (
                        <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 bg-amber-50">
                          ⚠ Uniform
                        </Badge>
                      )}
                      {row.namedStaffMember && (
                        <Badge variant="outline" className="text-[10px] text-green-700 border-green-300 bg-green-50">
                          ★ {row.namedStaffMember}
                        </Badge>
                      )}
                      {row.label && (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                          📍 {row.label}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatDate(row.submittedAt)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <PillarRow
                    resilience={row.resilience}
                    empathy={row.empathy}
                    anticipation={row.anticipation}
                    recognition={row.recognition}
                  />
                  {row.ventText && (
                    <p className="text-sm text-muted-foreground italic">
                      "{row.ventText}"
                    </p>
                  )}
                  {row.guestEmail && (
                    <a
                      href={`mailto:${row.guestEmail}`}
                      className="text-xs text-primary hover:underline"
                    >
                      {row.guestEmail}
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(Math.max(0, offset - pageSize))}
                  disabled={offset === 0}
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(offset + pageSize)}
                  disabled={offset + pageSize >= total}
                >
                  Next
                  <ChevronRightIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
