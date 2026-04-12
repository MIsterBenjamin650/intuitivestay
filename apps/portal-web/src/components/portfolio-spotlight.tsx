// apps/portal-web/src/components/portfolio-spotlight.tsx

type Row = {
  id: string
  name: string
  city: string
  type: string | null
  avgGcs: number | null
  gcsDelta: number | null
  alertCount: number
  ventCount: number
}

interface Props {
  rows: Row[]
}

function DeltaBadge({ delta, color }: { delta: number | null; color: "green" | "red" }) {
  if (delta == null) return null
  const sign = delta >= 0 ? "↑" : "↓"
  return (
    <span
      className="text-[9px] font-bold rounded-full px-2 py-0.5"
      style={{
        background: color === "green" ? "#dcfce7" : "#fee2e2",
        color: color === "green" ? "#16a34a" : "#dc2626",
      }}
    >
      {sign} {Math.abs(delta).toFixed(1)} this month
    </span>
  )
}

export function PortfolioSpotlight({ rows }: Props) {
  const withGcs = rows.filter((r): r is Row & { avgGcs: number } => r.avgGcs != null)
  if (withGcs.length < 2) return null

  const sorted = [...withGcs].sort((a, b) => b.avgGcs - a.avgGcs)
  const best  = sorted[0]!
  const worst = sorted[sorted.length - 1]!

  if (best.id === worst.id || best.avgGcs === worst.avgGcs) return null

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {/* Best performer */}
      <div
        className="rounded-xl p-4"
        style={{ background: "linear-gradient(135deg,#f0fdf4,#dcfce7)", border: "1px solid #bbf7d0" }}
      >
        <p className="text-[9px] font-bold uppercase tracking-[0.07em] text-green-600 mb-1.5">⭐ Best Performer</p>
        <p className="text-sm font-extrabold text-gray-900">{best.name}</p>
        <p className="text-[9px] text-gray-500 mb-2">{best.city} · {best.type ?? "Property"}</p>
        <div className="flex items-center gap-2">
          <span className="text-[24px] font-black text-green-600 leading-none">{best.avgGcs?.toFixed(1)}</span>
          <DeltaBadge delta={best.gcsDelta} color="green" />
        </div>
      </div>

      {/* Needs attention */}
      <div
        className="rounded-xl p-4"
        style={{ background: "linear-gradient(135deg,#fff7ed,#ffedd5)", border: "1px solid #fed7aa" }}
      >
        <p className="text-[9px] font-bold uppercase tracking-[0.07em] text-orange-600 mb-1.5">⚠️ Needs Attention</p>
        <p className="text-sm font-extrabold text-gray-900">{worst.name}</p>
        <p className="text-[9px] text-gray-500 mb-2">{worst.city} · {worst.type ?? "Property"}</p>
        <div className="flex items-center gap-2">
          <span className="text-[24px] font-black text-orange-600 leading-none">{worst.avgGcs.toFixed(1)}</span>
          {(() => {
            const worstDetail = [
              worst.gcsDelta != null && worst.gcsDelta < 0 ? `↓ ${Math.abs(worst.gcsDelta).toFixed(1)}` : null,
              worst.alertCount > 0 ? `${worst.alertCount} alert${worst.alertCount !== 1 ? "s" : ""}` : null,
              worst.ventCount > 0 ? `${worst.ventCount} vent${worst.ventCount !== 1 ? "s" : ""}` : null,
            ]
              .filter(Boolean)
              .join(" · ")

            return worstDetail && (
              <span
                className="text-[9px] font-bold rounded-full px-2 py-0.5"
                style={{ background: "#fee2e2", color: "#dc2626" }}
              >
                {worstDetail}
              </span>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
