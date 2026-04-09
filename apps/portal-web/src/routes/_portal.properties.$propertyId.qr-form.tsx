import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { QRCodeCanvas } from "qrcode.react"

import { useTRPC } from "@/utils/trpc"

export const Route = createFileRoute("/_portal/properties/$propertyId/qr-form")({
  component: QrFormPage,
})

function QrFormPage() {
  const { propertyId } = Route.useParams()
  const trpc = useTRPC()
  const { data, isLoading, isError } = useQuery(
    trpc.properties.getPropertyQrData.queryOptions({ propertyId }),
  )
  const qrWrapRef = React.useRef<HTMLDivElement>(null)

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading QR data…</div>
  if (isError) return <div className="p-6"><p className="text-sm text-destructive">Failed to load QR data.</p></div>

  if (!data?.qrCode) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">QR Code</h1>
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <p className="font-medium">No QR Code Yet</p>
          <p className="text-sm mt-1">
            Your property is pending approval. Once approved, a QR code will be generated and emailed to you.
          </p>
        </div>
      </div>
    )
  }

  const { feedbackUrl, createdAt } = data.qrCode
  const totalSubmissions = data.totalSubmissions

  function downloadPng() {
    const canvas = qrWrapRef.current?.querySelector("canvas")
    if (!canvas) return

    // Create a padded version for printing
    const pad = 32
    const out = document.createElement("canvas")
    out.width = canvas.width + pad * 2
    out.height = canvas.height + pad * 2
    const ctx = out.getContext("2d")!
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, out.width, out.height)
    ctx.drawImage(canvas, pad, pad)

    const link = document.createElement("a")
    link.download = "intuitivestay-qr-code.png"
    link.href = out.toDataURL("image/png")
    link.click()
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">QR Code</h1>

      {/* Stat */}
      <div className="rounded-lg border p-4 flex items-center gap-4 w-fit">
        <div>
          <p className="text-sm text-muted-foreground">Total Submissions</p>
          <p className="text-3xl font-bold">{totalSubmissions}</p>
        </div>
      </div>

      {/* QR code display + download */}
      <div className="rounded-lg border p-6 flex flex-col items-center gap-5">
        <p className="text-sm text-muted-foreground self-start">Your QR Code</p>

        {/* Rendered QR */}
        <div ref={qrWrapRef} className="rounded-xl bg-white p-4 shadow-sm border">
          <QRCodeCanvas
            value={feedbackUrl}
            size={220}
            level="H"
            marginSize={1}
            imageSettings={{
              src: "/logo-icon.png",
              width: 40,
              height: 40,
              excavate: true,
            }}
          />
        </div>

        <p className="text-xs text-muted-foreground text-center max-w-xs">
          Print at a minimum of 5 × 5 cm for reliable scanning. Use quality paper or card stock.
        </p>

        <button
          onClick={downloadPng}
          className="flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download PNG
        </button>
      </div>

      {/* Details */}
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
          <p className="text-sm text-muted-foreground mb-1">Generated</p>
          <p className="text-sm">
            {new Date(createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* Placement tips */}
      <div className="rounded-lg border p-6 space-y-2">
        <h2 className="font-semibold">Placement Tips</h2>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Place in a prominent location guests will see on departure.</li>
          <li>Reception desks, checkout counters, and room key sleeves work well.</li>
          <li>Print at a minimum of 5 × 5 cm for reliable scanning.</li>
          <li>Test the scan on your own phone before displaying.</li>
        </ul>
      </div>
    </div>
  )
}
