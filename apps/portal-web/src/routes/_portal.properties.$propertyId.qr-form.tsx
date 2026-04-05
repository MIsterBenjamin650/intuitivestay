import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { useTRPC } from "@/utils/trpc"

export const Route = createFileRoute("/_portal/properties/$propertyId/qr-form")({
  component: QrFormPage,
})

function QrFormPage() {
  const { propertyId } = Route.useParams()
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(
    trpc.properties.getPropertyQrData.queryOptions({ propertyId }),
  )

  if (isLoading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Loading QR data…</div>
    )
  }

  if (!data?.qrCode) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">QR Code</h1>
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <p className="font-medium">No QR Code Yet</p>
          <p className="text-sm mt-1">
            Your property is pending approval. Once approved, a QR code will be generated and
            emailed to you.
          </p>
        </div>
      </div>
    )
  }

  const { uniqueCode, feedbackUrl, createdAt } = data.qrCode
  const totalSubmissions = data.totalSubmissions

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">QR Code</h1>

      {/* Stat card */}
      <div className="rounded-lg border p-4 flex items-center gap-4 w-fit">
        <div>
          <p className="text-sm text-muted-foreground">Total Submissions</p>
          <p className="text-3xl font-bold">{totalSubmissions}</p>
        </div>
      </div>

      {/* QR details card */}
      <div className="rounded-lg border p-6 space-y-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Feedback URL</p>
          <a
            href={feedbackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline break-all font-mono text-sm"
          >
            {feedbackUrl}
          </a>
        </div>

        <div>
          <p className="text-sm text-muted-foreground mb-1">Unique Code</p>
          <span className="inline-block rounded bg-muted px-3 py-1 font-mono text-sm">
            {uniqueCode}
          </span>
        </div>

        <div>
          <p className="text-sm text-muted-foreground mb-1">Generated</p>
          <p className="text-sm">
            {new Date(createdAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Placement instructions */}
      <div className="rounded-lg border p-6 space-y-2">
        <h2 className="font-semibold">Placement Tips</h2>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Place your QR code in a prominent location guests will see on departure.</li>
          <li>Reception desks, checkout counters, and room key sleeves work well.</li>
          <li>Ensure the code is printed at a minimum of 3 × 3 cm for reliable scanning.</li>
          <li>Download the QR PDF from the approval email and print on quality paper.</li>
        </ul>
      </div>
    </div>
  )
}
