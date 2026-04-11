// apps/portal-web/src/components/portfolio-staff-board.tsx

type Entry = {
  name: string
  propertyName: string
  city: string
  mentionCount: number
  avgGcs: number | null
}

interface Props {
  entries: Entry[]
}

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#f97316,#fb923c)",
  "linear-gradient(135deg,#6366f1,#818cf8)",
  "linear-gradient(135deg,#14b8a6,#5eead4)",
  "linear-gradient(135deg,#f59e0b,#fbbf24)",
  "linear-gradient(135deg,#ec4899,#f472b6)",
]

const MEDALS = ["🥇", "🥈", "🥉"]

function gcsColor(gcs: number | null): string {
  if (gcs == null) return "#9ca3af"
  if (gcs >= 8.5) return "#16a34a"
  if (gcs >= 7) return "#f97316"
  return "#dc2626"
}

export function PortfolioStaffBoard({ entries }: Props) {
  return (
    <div className="rounded-xl bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div>
          <p className="text-[12px] font-bold text-gray-900">⭐ Top Staff Across All Sites</p>
          <p className="text-[9px] text-gray-400 mt-0.5">Guest nominations this month</p>
        </div>
        <div className="flex gap-1">
          <span
            className="text-[8px] font-bold px-2 py-0.5 rounded-full border"
            style={{ background: "#fff7ed", color: "#ea580c", borderColor: "#f97316" }}
          >
            Mentions
          </span>
          <span className="text-[8px] font-bold px-2 py-0.5 rounded-full border border-gray-200 text-gray-400">
            GCS
          </span>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-gray-400 px-4 py-5 text-center">
          No staff nominations yet. Name drops appear once guests start nominating team members.
        </p>
      ) : (
        entries.map((entry, idx) => (
          <div
            key={`${entry.name}-${entry.propertyName}`}
            className="flex items-center gap-2.5 px-4 py-2.5 border-b border-gray-50 last:border-0"
          >
            {/* Medal / rank */}
            <div className="text-[18px] min-w-[22px] text-center">
              {idx < 3 ? MEDALS[idx] : <span className="text-[13px] font-extrabold text-gray-300">{idx + 1}</span>}
            </div>

            {/* Avatar */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-extrabold text-white flex-shrink-0"
              style={{ background: AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length] }}
            >
              {entry.name.charAt(0).toUpperCase()}
            </div>

            {/* Name + property */}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold text-gray-900 truncate">{entry.name}</p>
              <p className="text-[9px] text-gray-400 truncate">
                {entry.propertyName} · {entry.city}
              </p>
            </div>

            {/* Mentions + avg GCS */}
            <div className="text-right">
              <p className="text-[12px] font-extrabold text-[#f97316]">
                {entry.mentionCount}{" "}
                <span className="text-[9px] font-normal text-gray-400">mentions</span>
              </p>
              {entry.avgGcs != null && (
                <p className="text-[9px] font-semibold" style={{ color: gcsColor(entry.avgGcs) }}>
                  GCS {entry.avgGcs.toFixed(1)}
                </p>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
