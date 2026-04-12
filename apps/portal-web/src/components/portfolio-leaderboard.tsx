// apps/portal-web/src/components/portfolio-leaderboard.tsx

import { gcsColor, isGoneQuiet } from "@/utils/gcs"

type Row = {
  id: string
  name: string
  city: string
  avgGcs: number | null
  gcsDelta: number | null
  lastFeedbackAt: string | null
  cityRank: number | null
  cityTotal: number | null
}

interface Props {
  rows: Row[]
}

export function PortfolioLeaderboard({ rows }: Props) {
  const sorted = [...rows]
    .sort((a, b) => (b.avgGcs ?? -1) - (a.avgGcs ?? -1))
    .slice(0, 10)

  const medals = ["🥇", "🥈", "🥉"]

  return (
    <div className="rounded-xl bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div>
          <p className="text-[12px] font-bold text-gray-900">🏆 Property Ranking</p>
          <p className="text-[9px] text-gray-400 mt-0.5">Internal rank + city position this month</p>
        </div>
        <div className="flex gap-1">
          <span
            className="text-[8px] font-bold px-2 py-0.5 rounded-full border"
            style={{ background: "#fff7ed", color: "#ea580c", borderColor: "#f97316" }}
          >
            GCS
          </span>
          <span className="text-[8px] font-bold px-2 py-0.5 rounded-full border border-gray-200 text-gray-400">
            Most improved
          </span>
          <span className="text-[8px] font-bold px-2 py-0.5 rounded-full border border-gray-200 text-gray-400">
            Volume
          </span>
        </div>
      </div>

      {/* Rows */}
      {sorted.map((row, idx) => {
        const quiet = isGoneQuiet(row.lastFeedbackAt)
        const color = gcsColor(row.avgGcs)
        const barWidth = row.avgGcs != null ? Math.min(100, Math.round((row.avgGcs / 10) * 100)) : 0
        const cityRankIsHigh = row.cityRank != null && row.cityRank <= 3

        return (
          <div
            key={row.id}
            className="flex items-center gap-2.5 px-4 py-2.5 border-b border-gray-50 last:border-0"
            style={{ background: quiet ? "#fffbeb" : undefined }}
          >
            {/* Medal / rank */}
            <div className="text-[18px] min-w-[22px] text-center">
              {idx < 3 ? medals[idx] : <span className="text-[13px] font-extrabold text-gray-300">{idx + 1}</span>}
            </div>

            {/* Name + city rank */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-[12px] font-bold text-gray-900 truncate">{row.name}</p>
                {quiet && (
                  <span
                    className="text-[7px] font-bold px-1.5 py-0.5 rounded-full border"
                    style={{ background: "#fef3c7", color: "#b45309", borderColor: "#fde68a" }}
                  >
                    Gone quiet
                  </span>
                )}
              </div>
              <p className="text-[8px] text-gray-400 mt-0.5">
                {row.city}
                {row.cityRank != null && row.cityTotal != null && (
                  <>
                    {" · "}
                    <span style={{ color: cityRankIsHigh ? "#f97316" : "#b45309", fontWeight: 700 }}>
                      #{row.cityRank} in city
                    </span>
                    {" "}out of {row.cityTotal} properties
                  </>
                )}
              </p>
            </div>

            {/* GCS + delta */}
            <div className="text-right mr-2">
              <p className="text-[17px] font-black leading-none" style={{ color }}>
                {row.avgGcs?.toFixed(1) ?? "—"}
              </p>
              {row.gcsDelta != null && (
                <p
                  className="text-[9px] font-semibold"
                  style={{ color: row.gcsDelta > 0 ? "#16a34a" : row.gcsDelta < 0 ? "#dc2626" : "#9ca3af" }}
                >
                  {row.gcsDelta > 0 ? "↑" : row.gcsDelta < 0 ? "↓" : "→"}{" "}
                  {row.gcsDelta !== 0 ? `${row.gcsDelta > 0 ? "+" : ""}${row.gcsDelta.toFixed(1)}` : "stable"}
                </p>
              )}
            </div>

            {/* Bar */}
            <div
              className="rounded-full overflow-hidden"
              style={{ width: 80, height: 5, background: "#f3f4f6", flexShrink: 0 }}
            >
              <div style={{ width: `${barWidth}%`, height: "100%", background: color, borderRadius: 3 }} />
            </div>
          </div>
        )
      })}

      {sorted.length === 0 && (
        <p className="text-sm text-gray-400 px-4 py-5 text-center">No properties yet.</p>
      )}
    </div>
  )
}
