import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { QRCodeCanvas } from "qrcode.react"

import { useTRPC } from "@/utils/trpc"

export const Route = createFileRoute("/_portal/properties/$propertyId/qr-form")({
  component: QrFormPage,
})

function QrFormPage() {
  const { propertyId } = Route.useParams()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [newLabel, setNewLabel] = React.useState("")
  const [creating, setCreating] = React.useState(false)

  const { data } = useQuery(
    trpc.properties.getPropertyQrData.queryOptions({ propertyId }),
  )

  function refetch() {
    queryClient.invalidateQueries({ queryKey: trpc.properties.getPropertyQrData.queryKey({ propertyId }) })
  }

  const createMutation = useMutation({
    ...trpc.properties.createQrCode.mutationOptions(),
    onSuccess: () => {
      refetch()
      setNewLabel("")
      setCreating(false)
    },
  })

  const deleteMutation = useMutation({
    ...trpc.properties.deleteQrCode.mutationOptions(),
    onSuccess: () => refetch(),
  })

  if (!data) {
    return <div className="p-6 animate-pulse text-gray-400">Loading...</div>
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">QR Codes</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data.totalSubmissions} total submission{data.totalSubmissions !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
        >
          + Add QR Code
        </button>
      </div>

      {creating && (
        <div className="rounded-xl border border-orange-100 bg-orange-50 p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-800">New QR Code Label</p>
          <p className="text-xs text-gray-500">e.g. "Table 7", "Room 12", "Bar Area", "Terrace"</p>
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Enter a label..."
            maxLength={60}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <div className="flex gap-2">
            <button
              onClick={() => createMutation.mutate({ propertyId, label: newLabel })}
              disabled={!newLabel.trim() || createMutation.isPending}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </button>
            <button
              onClick={() => { setCreating(false); setNewLabel(""); }}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {data.codes.map((code) => (
          <QrCodeCard
            key={code.id}
            code={code}
            canDelete={data.codes.length > 1}
            onDelete={() => deleteMutation.mutate({ propertyId, qrCodeId: code.id })}
          />
        ))}
      </div>
    </div>
  )
}

type QrCode = {
  id: string;
  label: string | null;
  uniqueCode: string;
  feedbackUrl: string;
  createdAt: Date | string;
};

function QrCodeCard({
  code,
  canDelete,
  onDelete,
}: {
  code: QrCode;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const displayLabel = code.label ?? "General"

  function downloadQr() {
    const canvas = document.getElementById(`qr-${code.id}`) as HTMLCanvasElement
    if (!canvas) return
    const padded = document.createElement("canvas")
    padded.width = canvas.width + 40
    padded.height = canvas.height + 40
    const ctx = padded.getContext("2d")!
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, padded.width, padded.height)
    ctx.drawImage(canvas, 20, 20)
    const link = document.createElement("a")
    link.download = `qr-${displayLabel.replace(/\s+/g, "-").toLowerCase()}.png`
    link.href = padded.toDataURL("image/png")
    link.click()
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-gray-900">{displayLabel}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Added{" "}
            {new Date(code.createdAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
        {canDelete && (
          <button
            onClick={onDelete}
            className="text-xs text-red-400 hover:text-red-600 transition-colors"
          >
            Remove
          </button>
        )}
      </div>

      <div className="flex justify-center">
        <QRCodeCanvas
          id={`qr-${code.id}`}
          value={code.feedbackUrl}
          size={180}
          level="M"
        />
      </div>

      <div className="space-y-2">
        <button
          onClick={downloadQr}
          className="w-full rounded-lg bg-orange-500 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
        >
          ↓ Download PNG
        </button>
        <p className="text-center text-xs text-gray-400 break-all">{code.feedbackUrl}</p>
      </div>

      <p className="text-center text-xs text-gray-400">
        Print at a minimum of 5 × 5 cm for reliable scanning. Use quality paper or card stock.
      </p>
    </div>
  )
}
