import { useState } from "react"
import { Download } from "lucide-react"
import type { PdfDashboardData } from "./property-pdf-document"

interface ExportPdfButtonProps {
  data: PdfDashboardData
  disabled?: boolean
}

export function ExportPdfButton({ data, disabled }: ExportPdfButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    if (loading || disabled) return
    setLoading(true)
    try {
      // Dynamic import — runs client-side only, never on the server
      const { pdf } = await import("@react-pdf/renderer")
      const { PropertyPdfDocument } = await import("./property-pdf-document")

      const blob = await pdf(<PropertyPdfDocument data={data} />).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      const safeName = data.propertyName.replace(/[^a-z0-9]/gi, "-").toLowerCase()
      link.href = url
      link.download = `${safeName}-report-${data.days}d.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("PDF export failed:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading || disabled}
      className="flex items-center gap-2 rounded-lg border border-orange-300 bg-white px-3 py-2 text-sm font-medium text-orange-700 shadow-sm transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Download className="h-4 w-4" />
      {loading ? "Generating…" : "Export PDF"}
    </button>
  )
}
