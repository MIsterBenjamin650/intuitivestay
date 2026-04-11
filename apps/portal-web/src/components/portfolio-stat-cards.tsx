// apps/portal-web/src/components/portfolio-stat-cards.tsx

import { type ReactNode } from "react"

interface Props {
  portfolioGcs: number | null
  activeCount: number
  thisWeekCount: number
  thisWeekDelta: number | null
  alertCount: number
  ventCount: number
  ventCountDelta: number | null
  isLoading: boolean
}

function DeltaLine({ delta, suffix = "vs last week" }: { delta: number | null; suffix?: string }) {
  if (delta === null) return <p className="mt-0.5 text-[9px] text-gray-400">no prior data</p>
  const isUp = delta >= 0
  return (
    <p className={`mt-0.5 text-[9px] font-semibold ${isUp ? "text-green-600" : "text-red-600"}`}>
      {isUp ? "↑" : "↓"} {Math.abs(delta)}% {suffix}
    </p>
  )
}

function StatCard({
  label,
  value,
  children,
}: {
  label: string
  value: string
  children?: ReactNode
}) {
  return (
    <div
      className="rounded-xl bg-white shadow-sm p-3"
      style={{ borderLeft: "4px solid #f97316" }}
    >
      <p className="text-[9px] font-bold uppercase tracking-[0.07em] text-[#a8a29e] mb-1">{label}</p>
      <p className="text-[26px] font-black leading-none text-[#f97316]">{value}</p>
      {children}
    </div>
  )
}

export function PortfolioStatCards({
  portfolioGcs,
  activeCount,
  thisWeekCount,
  thisWeekDelta,
  alertCount,
  ventCount,
  ventCountDelta,
  isLoading,
}: Props) {
  const dash = "—"

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <StatCard label="Portfolio GCS" value={isLoading ? dash : portfolioGcs != null ? portfolioGcs.toFixed(1) : dash}>
        <p className="mt-0.5 text-[9px] text-gray-400">avg across all properties</p>
      </StatCard>

      <StatCard label="Active Properties" value={isLoading ? dash : String(activeCount)}>
        <p className="mt-0.5 text-[9px] text-gray-400">approved &amp; live</p>
      </StatCard>

      <StatCard label="This Week" value={isLoading ? dash : String(thisWeekCount)}>
        <DeltaLine delta={isLoading ? null : thisWeekDelta} />
      </StatCard>

      <StatCard label="Open Alerts" value={isLoading ? dash : String(alertCount)}>
        <p className="mt-0.5 text-[9px] text-gray-400">scores ≤ 5.0</p>
      </StatCard>

      <StatCard label="Vent Submissions" value={isLoading ? dash : String(ventCount)}>
        <DeltaLine delta={isLoading ? null : ventCountDelta} />
      </StatCard>
    </div>
  )
}
