import { useQuery } from "@tanstack/react-query"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { useTRPC } from "@/utils/trpc"

interface Props {
  propertyId: string
  days: number
}

function gcsColor(gcs: number | null): string {
  if (gcs === null) return "#e5e7eb" // gray — no data
  if (gcs >= 8.5) return "#22c55e"   // green
  if (gcs >= 7)   return "#f97316"   // orange
  return "#ef4444"                   // red
}

export function AdvancedInsightsSection({ propertyId, days }: Props) {
  const trpc = useTRPC()

  const { data, isLoading, isError } = useQuery(
    trpc.reviews.getAdvancedInsights.queryOptions({ propertyId, days }),
  )

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-white shadow-sm p-5 flex items-center justify-center min-h-[220px]">
        <p className="text-sm text-muted-foreground">Loading advanced insights…</p>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="rounded-2xl bg-white shadow-sm p-5 flex items-center justify-center min-h-[220px]">
        <p className="text-sm text-destructive">Failed to load advanced insights.</p>
      </div>
    )
  }

  const hasTrendData = (data?.sentimentTrend?.length ?? 0) > 0
  const hasDowData = (data?.dayOfWeek?.filter((d) => d.count > 0).length ?? 0) > 0

  return (
    <div className="rounded-2xl bg-white shadow-sm p-5 flex flex-col gap-6">

      {/* ── Header ── */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#a8a29e]">
          Advanced Insights
        </p>
      </div>

      {/* ── Sentiment Trend ── */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-[#44403c]">Weekly Sentiment Trend</p>
        {!hasTrendData ? (
          <div className="flex items-center justify-center h-[140px] rounded-xl bg-gray-50 border border-dashed border-gray-200">
            <p className="text-sm text-muted-foreground">Not enough data yet for this period.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={data.sentimentTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id={`sentGrad-${propertyId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f97316" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
              <XAxis dataKey="week" tick={{ fontSize: 9 }} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 9 }} />
              <Tooltip
                formatter={(v: unknown) => [typeof v === "number" ? v.toFixed(1) : v, "Avg GCS"]}
                labelFormatter={(label) => `w/c ${label}`}
              />
              <Area
                type="monotone"
                dataKey="avgGcs"
                stroke="#f97316"
                strokeWidth={2}
                fill={`url(#sentGrad-${propertyId})`}
                dot={{ fill: "white", stroke: "#f97316", strokeWidth: 2, r: 3 }}
                activeDot={{ r: 4 }}
                name="Avg GCS"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Day-of-Week ── */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-[#44403c]">GCS by Day of Week</p>
        {!hasDowData ? (
          <div className="flex items-center justify-center h-[140px] rounded-xl bg-gray-50 border border-dashed border-gray-200">
            <p className="text-sm text-muted-foreground">Not enough data yet for this period.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={data.dayOfWeek} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
              <XAxis dataKey="day" tick={{ fontSize: 9 }} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 9 }} />
              <Tooltip
                formatter={(v: unknown, _name: unknown, props: { payload?: { count: number } }) => [
                  typeof v === "number" ? v.toFixed(1) : "No data",
                  `Avg GCS (${props.payload?.count ?? 0} submissions)`,
                ]}
              />
              <Bar dataKey="avgGcs" radius={[4, 4, 0, 0]} name="Avg GCS">
                {data.dayOfWeek.map((entry) => (
                  <Cell key={entry.day} fill={gcsColor(entry.avgGcs)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        <p className="text-[9px] text-muted-foreground">
          Green ≥ 8.5 · Orange ≥ 7 · Red &lt; 7 · Grey = no submissions
        </p>
      </div>

    </div>
  )
}
