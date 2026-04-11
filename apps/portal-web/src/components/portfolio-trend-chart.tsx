// apps/portal-web/src/components/portfolio-trend-chart.tsx

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

interface Props {
  monthlyTrend: Array<{ month: string; score: number }>
  isLoading?: boolean
}

export function PortfolioTrendChart({ monthlyTrend, isLoading = false }: Props) {
  return (
    <div className="rounded-xl bg-white shadow-sm p-5">
      <p className="text-[14px] font-bold text-gray-900">Portfolio Satisfaction Trend</p>
      <p className="mt-0.5 mb-4 text-[11px] text-gray-400">Average GCS across all properties</p>

      {isLoading ? (
        <div className="h-[200px] animate-pulse rounded bg-gray-100" />
      ) : monthlyTrend.length === 0 ? (
        <p className="text-sm text-gray-400">No feedback yet. Scores will appear once guests start submitting.</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={monthlyTrend}>
            <defs>
              <linearGradient id="portfolioGcsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f97316" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
              formatter={(v) => (typeof v === "number" ? v.toFixed(2) : String(v ?? ""))}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="#f97316"
              strokeWidth={2.5}
              fill="url(#portfolioGcsGrad)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
