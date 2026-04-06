import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Area, AreaChart, ResponsiveContainer } from "recharts"

import { useTRPC } from "@/utils/trpc"

function gcsColor(gcs: number | null): string {
  if (gcs == null) return "text-slate-400"
  if (gcs >= 8) return "text-green-600"
  if (gcs >= 6) return "text-amber-500"
  return "text-red-600"
}

function AggregateStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="text-2xl font-extrabold text-indigo-600 mt-1">{value}</p>
    </div>
  )
}

export function FounderInsightsOverview() {
  const trpc = useTRPC()
  const { data, isLoading, isError } = useQuery(
    trpc.properties.getFounderOverview.queryOptions(),
  )

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading overview…</div>
  }

  if (isError || !data) {
    return <div className="p-6 text-sm text-destructive">Failed to load overview.</div>
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Portfolio Insights</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview across all your properties
        </p>
      </div>

      {/* Aggregate stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <AggregateStat
          label="Portfolio GCS"
          value={data.aggregateGcs != null ? data.aggregateGcs.toFixed(1) : "—"}
        />
        <AggregateStat
          label="Total Submissions"
          value={String(data.totalSubmissions)}
        />
        <AggregateStat
          label="Best Property"
          value={
            data.bestProperty
              ? `${data.bestProperty.name} · ${data.bestProperty.avgGcs.toFixed(1)}`
              : "—"
          }
        />
        <AggregateStat
          label="Needs Attention"
          value={
            data.worstProperty
              ? `${data.worstProperty.name} · ${data.worstProperty.avgGcs.toFixed(1)}`
              : "—"
          }
        />
      </div>

      {/* Property cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {data.properties.map((prop) => (
          <div
            key={prop.id}
            className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col gap-3"
          >
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold text-sm">{prop.name}</p>
                <p className="text-[10px] text-slate-400">{prop.city}</p>
              </div>
              <div className="text-right">
                <p className={`text-2xl font-extrabold ${gcsColor(prop.avgGcs)}`}>
                  {prop.avgGcs != null ? prop.avgGcs.toFixed(1) : "—"}
                </p>
                {prop.trendDelta != null && (
                  <p
                    className={`text-[10px] font-semibold ${prop.trendDelta > 0 ? "text-green-600" : prop.trendDelta < 0 ? "text-red-500" : "text-slate-400"}`}
                  >
                    {prop.trendDelta > 0 ? `↑ +${prop.trendDelta.toFixed(1)}` : prop.trendDelta < 0 ? `↓ ${prop.trendDelta.toFixed(1)}` : `→ ${prop.trendDelta.toFixed(1)}`}
                  </p>
                )}
              </div>
            </div>

            {/* Sparkline */}
            {prop.sparkline.length > 1 && (
              <ResponsiveContainer width="100%" height={48}>
                <AreaChart data={prop.sparkline}>
                  <defs>
                    <linearGradient id={`sg-${prop.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="avg"
                    stroke="#6366f1"
                    strokeWidth={1.5}
                    fill={`url(#sg-${prop.id})`}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}

            {/* Stats row */}
            <div className="flex gap-4 text-[10px] text-slate-500">
              <span>{prop.totalFeedback} submissions</span>
              {prop.strongestPillar && (
                <span className="text-green-600">★ {prop.strongestPillar}</span>
              )}
              {prop.weakestPillar && prop.weakestPillar !== prop.strongestPillar && (
                <span className="text-red-500">↓ {prop.weakestPillar}</span>
              )}
            </div>

            {/* Link */}
            <Link
              to="/properties/$propertyId/insights"
              params={{ propertyId: prop.id }}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 mt-auto"
            >
              View Insights →
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
