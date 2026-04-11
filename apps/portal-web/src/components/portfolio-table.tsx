// apps/portal-web/src/components/portfolio-table.tsx

import { useMemo, useState } from "react"
import { Link } from "@tanstack/react-router"

type Row = {
  id: string
  name: string
  type: string | null
  city: string
  avgGcs: number | null
  gcsDelta: number | null
  sparkline: Array<number | null>
  thisWeekCount: number
  thisWeekDelta: number | null
  topStaffName: string | null
  topStaffMentions: number
  ventCount: number
  alertCount: number
  lastFeedbackAt: string | null
}

interface Props {
  rows: Row[]
}

// ── helpers ──────────────────────────────────────────────────────────────────

function gcsColor(gcs: number | null): string {
  if (gcs == null) return "#9ca3af"
  if (gcs >= 8.5) return "#16a34a"
  if (gcs >= 7) return "#f97316"
  return "#dc2626"
}

function sparklinePoints(values: Array<number | null>, width = 54, height = 24): string {
  const n = values.length
  if (n < 2) return ""
  const pts: string[] = []
  values.forEach((v, i) => {
    if (v == null) return
    const x = Math.round((i / (n - 1)) * width)
    const clamped = Math.max(5, Math.min(10, v))
    const y = Math.round((1 - (clamped - 5) / 5) * height)
    pts.push(`${x},${y}`)
  })
  return pts.join(" ")
}

function timeAgo(iso: string | null): string {
  if (!iso) return "no data"
  const ms = Date.now() - new Date(iso).getTime()
  const h = Math.floor(ms / (1000 * 60 * 60))
  if (h < 1) return "just now"
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function isGoneQuiet(iso: string | null): boolean {
  if (!iso) return false
  return Date.now() - new Date(iso).getTime() > 7 * 24 * 60 * 60 * 1000
}

// ── sub-components ───────────────────────────────────────────────────────────

type SortCol = "name" | "gcs" | "thisWeek" | "vents" | "alerts"
type SortDir = "asc" | "desc"

function ColHeader({
  label,
  col,
  active,
  sortDir,
  align = "center",
  onSort,
}: {
  label: string
  col: SortCol
  active: boolean
  sortDir: SortDir
  align?: "left" | "center" | "right"
  onSort: (col: SortCol) => void
}) {
  return (
    <button
      onClick={() => onSort(col)}
      className={`text-[8px] font-bold uppercase tracking-[0.05em] cursor-pointer select-none w-full ${
        align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center"
      } ${active ? "text-[#f97316]" : "text-gray-400"}`}
    >
      {label} {active ? (sortDir === "desc" ? "↓" : "↑") : ""}
    </button>
  )
}

function Pill({
  label,
  active,
  color,
  onClick,
}: {
  label: string
  active: boolean
  color?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="text-[8px] font-bold px-2 py-0.5 rounded-full border cursor-pointer"
      style={
        active
          ? { background: "#fff7ed", color: "#ea580c", borderColor: "#f97316" }
          : { background: "#fff", color: color ?? "#6b7280", borderColor: "#e5e7eb" }
      }
    >
      {label}
    </button>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export function PortfolioTable({ rows }: Props) {
  const [sortCol, setSortCol] = useState<SortCol>("gcs")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [gcsFilter, setGcsFilter] = useState<"all" | "high" | "mid" | "low">("all")
  const [trendFilter, setTrendFilter] = useState<"all" | "up" | "down">("all")
  const [activityFilter, setActivityFilter] = useState<"all" | "quiet" | "active">("all")
  const [alertFilter, setAlertFilter] = useState(false)
  const [ventFilter, setVentFilter] = useState(false)

  function handleSort(col: SortCol) {
    if (col === sortCol) setSortDir((d) => (d === "desc" ? "asc" : "desc"))
    else { setSortCol(col); setSortDir("desc") }
  }

  const filtered = useMemo(() => {
    let r = [...rows]
    if (gcsFilter === "high") r = r.filter((x) => x.avgGcs != null && x.avgGcs >= 8.5)
    else if (gcsFilter === "mid") r = r.filter((x) => x.avgGcs != null && x.avgGcs >= 7 && x.avgGcs < 8.5)
    else if (gcsFilter === "low") r = r.filter((x) => x.avgGcs != null && x.avgGcs < 7)
    if (trendFilter === "up") r = r.filter((x) => x.gcsDelta != null && x.gcsDelta > 0)
    else if (trendFilter === "down") r = r.filter((x) => x.gcsDelta != null && x.gcsDelta < 0)
    if (activityFilter === "quiet") r = r.filter((x) => isGoneQuiet(x.lastFeedbackAt))
    else if (activityFilter === "active") r = r.filter((x) => !isGoneQuiet(x.lastFeedbackAt))
    if (alertFilter) r = r.filter((x) => x.alertCount > 0)
    if (ventFilter) r = r.filter((x) => x.ventCount > 0)
    return r
  }, [rows, gcsFilter, trendFilter, activityFilter, alertFilter, ventFilter])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let diff = 0
      if (sortCol === "gcs") diff = (b.avgGcs ?? -1) - (a.avgGcs ?? -1)
      else if (sortCol === "name") diff = a.name.localeCompare(b.name)
      else if (sortCol === "thisWeek") diff = b.thisWeekCount - a.thisWeekCount
      else if (sortCol === "vents") diff = b.ventCount - a.ventCount
      else if (sortCol === "alerts") diff = b.alertCount - a.alertCount
      return sortDir === "asc" ? -diff : diff
    })
  }, [filtered, sortCol, sortDir])

  const COLS = "1.8fr 70px 62px 62px 90px 56px 52px"

  return (
    <div className="rounded-xl bg-white shadow-sm overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-1.5 flex-wrap px-4 py-2.5 bg-[#fafaf9] border-b border-gray-100">
        <span className="text-[8px] font-bold uppercase tracking-[0.05em] text-[#a8a29e]">Filter:</span>

        <Pill label="All GCS"  active={gcsFilter === "all"}  onClick={() => setGcsFilter("all")} />
        <Pill label="≥ 8.5"   active={gcsFilter === "high"} onClick={() => setGcsFilter("high")} color="#16a34a" />
        <Pill label="7–8.5"   active={gcsFilter === "mid"}  onClick={() => setGcsFilter("mid")}  color="#f97316" />
        <Pill label="< 7"     active={gcsFilter === "low"}  onClick={() => setGcsFilter("low")}  color="#dc2626" />

        <div className="w-px h-3.5 bg-gray-200" />

        <Pill label="All trends"  active={trendFilter === "all"}  onClick={() => setTrendFilter("all")} />
        <Pill label="↑ Improving" active={trendFilter === "up"}   onClick={() => setTrendFilter("up")}   color="#16a34a" />
        <Pill label="↓ Declining" active={trendFilter === "down"} onClick={() => setTrendFilter("down")} color="#dc2626" />

        <div className="w-px h-3.5 bg-gray-200" />

        <Pill label="⚠ Gone quiet"    active={activityFilter === "quiet"}  onClick={() => setActivityFilter(activityFilter === "quiet" ? "all" : "quiet")}  color="#b45309" />
        <Pill label="Active this week" active={activityFilter === "active"} onClick={() => setActivityFilter(activityFilter === "active" ? "all" : "active")} />

        <div className="w-px h-3.5 bg-gray-200" />

        <Pill label="Has alerts" active={alertFilter} onClick={() => setAlertFilter((v) => !v)} color="#dc2626" />
        <Pill label="Has vents"  active={ventFilter}  onClick={() => setVentFilter((v) => !v)} />
      </div>

      {/* Column headers */}
      <div
        className="grid px-4 py-2 bg-gray-50 border-b border-gray-200 gap-1"
        style={{ gridTemplateColumns: COLS }}
      >
        <ColHeader label="Property"  col="name"     active={sortCol === "name"}     sortDir={sortDir} align="left"  onSort={handleSort} />
        <ColHeader label="GCS"       col="gcs"      active={sortCol === "gcs"}      sortDir={sortDir}               onSort={handleSort} />
        <div className="text-[8px] font-bold uppercase tracking-[0.05em] text-gray-400 text-center">Trend</div>
        <ColHeader label="This week" col="thisWeek" active={sortCol === "thisWeek"} sortDir={sortDir}               onSort={handleSort} />
        <div className="text-[8px] font-bold uppercase tracking-[0.05em] text-gray-400 text-center">Top staff</div>
        <ColHeader label="Vents"     col="vents"    active={sortCol === "vents"}    sortDir={sortDir}               onSort={handleSort} />
        <ColHeader label="Alerts"    col="alerts"   active={sortCol === "alerts"}   sortDir={sortDir} align="right"  onSort={handleSort} />
      </div>

      {/* Rows */}
      {sorted.length === 0 ? (
        <p className="text-sm text-gray-400 px-4 py-6 text-center">No properties match the current filters.</p>
      ) : (
        sorted.map((row) => {
          const quiet = isGoneQuiet(row.lastFeedbackAt)
          const pts = sparklinePoints(row.sparkline)
          const hasData = pts.length > 0
          const gcsDeltaDir = row.gcsDelta != null ? (row.gcsDelta > 0 ? "up" : row.gcsDelta < 0 ? "down" : "flat") : null

          return (
            <Link
              key={row.id}
              to="/properties/$propertyId/dashboard"
              params={{ propertyId: row.id }}
              className="grid px-4 py-2.5 border-b border-gray-50 gap-1 items-center last:border-0 hover:bg-[#fafaf9] transition-colors"
              style={{
                gridTemplateColumns: COLS,
                background: quiet ? "#fffbeb" : undefined,
              }}
            >
              {/* Property name */}
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-gray-900">{row.name}</span>
                  {quiet && row.lastFeedbackAt && (
                    <span
                      className="text-[7px] font-bold px-1.5 py-0.5 rounded-full border"
                      style={{ background: "#fef3c7", color: "#b45309", borderColor: "#fde68a" }}
                    >
                      Gone quiet · {Math.floor((Date.now() - new Date(row.lastFeedbackAt).getTime()) / (1000 * 60 * 60 * 24))}d
                    </span>
                  )}
                </div>
                <p className="text-[8px] text-gray-400">
                  {row.city} · {row.type ?? "Property"} · Last: {timeAgo(row.lastFeedbackAt)}
                </p>
              </div>

              {/* GCS */}
              <div className="text-center">
                <p className="text-[16px] font-black leading-none" style={{ color: gcsColor(row.avgGcs) }}>
                  {row.avgGcs?.toFixed(1) ?? "—"}
                </p>
                {gcsDeltaDir && row.gcsDelta != null && (
                  <p
                    className="text-[8px] font-bold"
                    style={{ color: gcsDeltaDir === "up" ? "#16a34a" : gcsDeltaDir === "down" ? "#dc2626" : "#9ca3af" }}
                  >
                    {gcsDeltaDir === "up" ? `↑ +${row.gcsDelta.toFixed(1)}` : gcsDeltaDir === "down" ? `↓ ${row.gcsDelta.toFixed(1)}` : "→"}
                  </p>
                )}
              </div>

              {/* Trend sparkline */}
              <div className="flex justify-center">
                {hasData ? (
                  <svg width="54" height="24" viewBox="0 0 54 24">
                    <polyline
                      points={pts}
                      fill="none"
                      stroke={quiet ? "#d1d5db" : "#f97316"}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={quiet ? "3 2" : undefined}
                    />
                  </svg>
                ) : (
                  <span className="text-[9px] text-gray-300">—</span>
                )}
              </div>

              {/* This week */}
              <div className="text-center">
                <p className="text-[12px] font-bold text-gray-900">{row.thisWeekCount}</p>
                {row.thisWeekDelta != null && (
                  <p
                    className="text-[8px] font-semibold"
                    style={{ color: row.thisWeekDelta >= 0 ? "#16a34a" : "#dc2626" }}
                  >
                    {row.thisWeekDelta >= 0 ? "↑" : "↓"} {Math.abs(row.thisWeekDelta)}%
                  </p>
                )}
              </div>

              {/* Top staff */}
              <div className="text-center">
                {row.topStaffName ? (
                  <>
                    <p className="text-[9px] font-bold text-[#f97316]">{row.topStaffName}</p>
                    <p className="text-[8px] text-gray-400">{row.topStaffMentions} mentions</p>
                  </>
                ) : (
                  <p className="text-[9px] text-gray-300">—</p>
                )}
              </div>

              {/* Vents */}
              <div className="text-center">
                <p
                  className="text-[11px] font-bold"
                  style={{ color: row.ventCount > 0 ? "#dc2626" : "#9ca3af" }}
                >
                  {row.ventCount}
                </p>
              </div>

              {/* Alerts */}
              <div className="text-right">
                {row.alertCount > 0 ? (
                  <span
                    className="text-[8.5px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: "#fef2f2", color: "#dc2626" }}
                  >
                    {row.alertCount}
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-300">—</span>
                )}
              </div>
            </Link>
          )
        })
      )}
    </div>
  )
}
