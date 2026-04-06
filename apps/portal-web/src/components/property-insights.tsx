import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { env } from "@intuitive-stay/env/web"

import { useTRPC } from "@/utils/trpc"

// ─── Types ────────────────────────────────────────────────────────────────────

type TimeRange = "7d" | "30d" | "180d" | "365d"
type Plan = "host" | "partner" | "founder"

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "180d": "Last 6 months",
  "365d": "Last 12 months",
}

const PLAN_MAX: Record<Plan, TimeRange> = {
  host: "7d",
  partner: "30d",
  founder: "365d",
}

const TIER_ORDER: TimeRange[] = ["7d", "30d", "180d", "365d"]

function isRangeAllowed(range: TimeRange, plan: Plan): boolean {
  return TIER_ORDER.indexOf(range) <= TIER_ORDER.indexOf(PLAN_MAX[plan])
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">
      {children}
    </p>
  )
}

function ChartCard({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50 p-4 ${className}`}>
      {children}
    </div>
  )
}

function LockedCard({ requiredPlan }: { requiredPlan: string }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 h-32">
      <p className="text-sm text-muted-foreground">
        🔒 Upgrade to {requiredPlan} plan to unlock
      </p>
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="text-3xl font-extrabold text-indigo-600 mt-1">{value}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
    </div>
  )
}

// ─── Score distribution colours ───────────────────────────────────────────────

function distColor(score: number): string {
  if (score <= 3) return "#fca5a5"
  if (score <= 5) return "#fcd34d"
  if (score <= 7) return "rgba(99,102,241,0.6)"
  if (score <= 9) return "#6366f1"
  return "#22c55e"
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  propertyId: string
}

export function PropertyInsights({ propertyId }: Props) {
  const trpc = useTRPC()
  const [timeRange, setTimeRange] = useState<TimeRange>("30d")

  const { data, isLoading, isError } = useQuery(
    trpc.properties.getPropertyInsights.queryOptions({ propertyId, timeRange }),
  )

  const { data: cityData } = useQuery(
    trpc.properties.getCityLeaderboard.queryOptions({ propertyId }),
  )

  const plan: Plan = (data?.userPlan as Plan) ?? "host"
  const subscriptionStatus = data?.subscriptionStatus

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading insights…</div>
  }

  if (isError || !data) {
    return <div className="p-6 text-sm text-destructive">Failed to load insights.</div>
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Property Insights</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Guest satisfaction analytics for this property
        </p>
      </div>

      {/* ── Tier filter bar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
          Time Range
        </span>
        {TIER_ORDER.map((range) => {
          const allowed = isRangeAllowed(range, plan)
          const active = timeRange === range
          return (
            <button
              key={range}
              onClick={() => allowed && setTimeRange(range)}
              disabled={!allowed}
              className={[
                "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                active
                  ? "bg-indigo-600 text-white border border-indigo-600"
                  : allowed
                    ? "bg-indigo-50 text-indigo-600 border border-indigo-300 hover:bg-indigo-100"
                    : "bg-slate-50 text-slate-400 border border-slate-200 cursor-default",
              ].join(" ")}
            >
              {!allowed ? "🔒 " : ""}
              {TIME_RANGE_LABELS[range]}
            </button>
          )
        })}
        <span className="text-[9px] text-slate-400 ml-1">🔒 = higher plan required</span>
      </div>

      {/* Subscription status banners */}
      {subscriptionStatus === "grace" && (
        <div className="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-orange-700">⚠️ Payment failed</p>
            <p className="text-xs text-orange-600 mt-0.5">
              You have 3 days to update your payment details before access is restricted.
            </p>
          </div>
          <a
            href={env.VITE_WIX_BILLING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-4 shrink-0 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600"
          >
            Update payment →
          </a>
        </div>
      )}

      {subscriptionStatus === "expired" && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-red-700">Your subscription has ended</p>
            <p className="text-xs text-red-600 mt-0.5">
              You&apos;re on restricted access. Reactivate to restore your full dashboard.
            </p>
          </div>
          <a
            href={env.VITE_WIX_BILLING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-4 shrink-0 rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600"
          >
            Reactivate →
          </a>
        </div>
      )}

      {/* ── GCS Over Time ── */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <SectionLabel>GCS Over Time</SectionLabel>
          {data.gcsOverTime.length >= 2 &&
            (() => {
              const first = data.gcsOverTime[0]!.avg
              const last = data.gcsOverTime[data.gcsOverTime.length - 1]!.avg
              const delta = Math.round((last - first) * 10) / 10
              return (
                <span
                  className={`text-xs font-semibold ${delta >= 0 ? "text-indigo-500" : "text-red-500"}`}
                >
                  {delta >= 0 ? "↑" : "↓"} {delta >= 0 ? "+" : ""}
                  {delta} vs start of period
                </span>
              )
            })()}
        </div>
        <ChartCard>
          {data.gcsOverTime.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No data for this period yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={data.gcsOverTime}>
                <defs>
                  <linearGradient id="gcsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => (typeof v === "number" ? v.toFixed(1) : v)} />
                <Area
                  type="monotone"
                  dataKey="avg"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#gcsGrad)"
                  dot={{ fill: "white", stroke: "#6366f1", strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 5 }}
                  name="GCS"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── Score Distribution + Pillar Radar ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <SectionLabel>Score Distribution</SectionLabel>
          {plan === "host" ? (
            <LockedCard requiredPlan="Partner" />
          ) : (
            <ChartCard>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.scoreDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="score" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [`${v} submissions`, "Count"]} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Submissions">
                    {data.scoreDistribution.map((entry) => (
                      <Cell key={entry.score} fill={distColor(entry.score)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </div>

        <div>
          <SectionLabel>Pillar Averages</SectionLabel>
          <ChartCard>
            {data.engagementStats.totalSubmissions === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No feedback yet in this period.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <RadarChart
                  data={[
                    { pillar: "Resilience", score: data.pillarAverages.resilience },
                    { pillar: "Empathy", score: data.pillarAverages.empathy },
                    { pillar: "Anticipation", score: data.pillarAverages.anticipation },
                    { pillar: "Recognition", score: data.pillarAverages.recognition },
                  ]}
                >
                  <PolarGrid />
                  <PolarAngleAxis dataKey="pillar" tick={{ fontSize: 10 }} />
                  <Radar
                    name="Score"
                    dataKey="score"
                    stroke="#6366f1"
                    fill="#6366f1"
                    fillOpacity={0.25}
                  />
                  <Tooltip formatter={(v) => (typeof v === "number" ? v.toFixed(1) : v)} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      </div>

      {/* ── Meal Time + Submissions + Pillar Spotlight ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <SectionLabel>GCS by Meal Time</SectionLabel>
          {plan === "host" ? (
            <LockedCard requiredPlan="Partner" />
          ) : (
            <ChartCard>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={data.gcsByMealTime} layout="vertical">
                  <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 10 }} />
                  <YAxis
                    type="category"
                    dataKey="mealTime"
                    width={70}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip formatter={(v) => (typeof v === "number" ? v.toFixed(1) : v)} />
                  <Bar dataKey="avg" fill="#6366f1" radius={[0, 4, 4, 0]} name="Avg GCS" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </div>

        <div>
          <SectionLabel>Submissions per Week</SectionLabel>
          {plan === "host" ? (
            <LockedCard requiredPlan="Partner" />
          ) : (
            <ChartCard>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={data.submissionsPerWeek}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="week" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [`${v} submissions`, "Count"]} />
                  <Bar dataKey="count" fill="#818cf8" radius={[4, 4, 0, 0]} name="Submissions" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </div>

        <div>
          <SectionLabel>Pillar Spotlight</SectionLabel>
          {/* data.pillarSpotlight is null when totalSubmissions === 0 */}
          {data.pillarSpotlight == null ? (
            <ChartCard className="flex items-center justify-center h-[160px]">
              <p className="text-sm text-muted-foreground text-center">
                No feedback yet in this period.
              </p>
            </ChartCard>
          ) : (
            <ChartCard className="flex flex-col gap-3 justify-center h-[160px]">
              <div className="rounded-lg bg-green-50 px-3 py-2 flex justify-between items-center">
                <div>
                  <p className="text-[8px] font-semibold text-green-700 uppercase">
                    ★ Strongest
                  </p>
                  <p className="text-sm font-bold capitalize">
                    {data.pillarSpotlight.strongest}
                  </p>
                </div>
                <p className="text-xl font-extrabold text-green-600">
                  {data.pillarSpotlight.strongestScore.toFixed(1)}
                </p>
              </div>
              <div className="rounded-lg bg-red-50 px-3 py-2 flex justify-between items-center">
                <div>
                  <p className="text-[8px] font-semibold text-red-700 uppercase">
                    ↓ Needs focus
                  </p>
                  <p className="text-sm font-bold capitalize">{data.pillarSpotlight.weakest}</p>
                </div>
                <p className="text-xl font-extrabold text-red-600">
                  {data.pillarSpotlight.weakestScore.toFixed(1)}
                </p>
              </div>
            </ChartCard>
          )}
        </div>
      </div>

      {/* ── Engagement Stats ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Total Submissions"
          value={String(data.engagementStats.totalSubmissions)}
          sub="this period"
        />
        {plan === "host" ? (
          <>
            <LockedCard requiredPlan="Partner" />
            <LockedCard requiredPlan="Partner" />
          </>
        ) : (
          <>
            <StatCard
              label="Name Drop Rate"
              value={`${data.engagementStats.nameDropRate}%`}
              sub="of happy guests named staff"
            />
            <StatCard
              label="Vent Box Rate"
              value={`${data.engagementStats.ventRate}%`}
              sub="of low-score guests left feedback"
            />
          </>
        )}
      </div>

      {/* ── Staff Tag Cloud ── */}
      <div>
        <SectionLabel>Staff Recognition — Name Drop™</SectionLabel>
        {data.staffTagCloud.length === 0 ? (
          <ChartCard>
            <p className="text-sm text-muted-foreground text-center py-4">
              No staff mentions yet in this period.
            </p>
          </ChartCard>
        ) : (
          <ChartCard>
            {(() => {
              const maxMentions = Math.max(...data.staffTagCloud.map((s) => s.mentions), 1)
              return (
                <div className="flex flex-wrap gap-3 items-center justify-center min-h-[80px]">
                  {data.staffTagCloud.map((staff) => {
                    const fontSize = Math.round(12 + (staff.mentions / maxMentions) * 20)
                    const color =
                      staff.avgGcs >= 9
                        ? "#4f46e5"
                        : staff.avgGcs >= 8
                          ? "#6366f1"
                          : staff.avgGcs >= 7
                            ? "#818cf8"
                            : "#a5b4fc"
                    return (
                      <span
                        key={staff.name}
                        title={`${staff.mentions} mention${staff.mentions !== 1 ? "s" : ""} · avg GCS ${staff.avgGcs.toFixed(1)}`}
                        style={{ fontSize, color, fontWeight: 700, cursor: "default" }}
                      >
                        {staff.name}
                      </span>
                    )
                  })}
                </div>
              )
            })()}
            <p className="text-[9px] text-slate-400 mt-3 text-center">
              Size = mentions · Darker = higher avg GCS · Hover for details
            </p>
          </ChartCard>
        )}
      </div>

      {/* ── Vent Keyword Cloud ── */}
      <div>
        <SectionLabel>Complaint Themes — Vent Keywords</SectionLabel>
        {plan !== "founder" ? (
          <LockedCard requiredPlan="Founder" />
        ) : data.ventKeywords.length === 0 ? (
          <ChartCard>
            <p className="text-sm text-muted-foreground text-center py-4">
              No vent text in this period.
            </p>
          </ChartCard>
        ) : (
          <ChartCard className="bg-red-50 border-red-200">
            {(() => {
              const maxCount = Math.max(...data.ventKeywords.map((k) => k.count), 1)
              return (
                <div className="flex flex-wrap gap-3 items-center justify-center min-h-[70px]">
                  {data.ventKeywords.map((kw) => {
                    const fontSize = Math.round(11 + (kw.count / maxCount) * 20)
                    const color =
                      kw.count / maxCount > 0.6
                        ? "#dc2626"
                        : kw.count / maxCount > 0.3
                          ? "#ef4444"
                          : "#f87171"
                    return (
                      <span
                        key={kw.word}
                        title={`${kw.count} occurrence${kw.count !== 1 ? "s" : ""}`}
                        style={{ fontSize, color, fontWeight: 600, cursor: "default" }}
                      >
                        {kw.word}
                      </span>
                    )
                  })}
                </div>
              )
            })()}
            <p className="text-[9px] text-slate-400 mt-3 text-center">
              Extracted from vent text · Size = frequency · Hover for count
            </p>
          </ChartCard>
        )}
      </div>

      {/* ── City Leaderboard ── */}
      {/* yourRank, yourGcs, cityAvgGcs, gapToCityAvg can all be null — handled below */}
      {cityData && plan !== "host" && (
        <>
          {/* City ranking banner — only show if property has a rank and a GCS score */}
          {cityData.yourRank != null && cityData.yourGcs != null ? (
            <div className="rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-400 p-5 text-white flex justify-between items-center">
              <div>
                <p className="text-xs opacity-80 uppercase tracking-wide font-semibold">
                  Your ranking in {cityData.cityName}
                </p>
                <p className="text-3xl font-extrabold mt-1">
                  #{cityData.yourRank}{" "}
                  <span className="text-base font-medium opacity-75">
                    of {cityData.totalInCity} properties
                  </span>
                </p>
                <p className="text-xs opacity-70 mt-1">
                  Your avg GCS: {cityData.yourGcs.toFixed(1)}
                  {cityData.cityAvgGcs != null
                    ? ` · City avg: ${cityData.cityAvgGcs.toFixed(1)}`
                    : ""}
                </p>
              </div>
              {cityData.gapToCityAvg != null && (
                <div className="text-right">
                  <p className="text-xs opacity-75">vs city average</p>
                  <p className="text-3xl font-extrabold">
                    {cityData.gapToCityAvg >= 0 ? "+" : ""}
                    {cityData.gapToCityAvg.toFixed(1)}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
              <p className="text-sm text-indigo-700">
                City ranking will appear once your property has received feedback.
              </p>
            </div>
          )}

          {/* Within-city bar chart */}
          {plan === "founder" && cityData.withinCityRankings.length > 0 && (
            <div>
              <SectionLabel>{cityData.cityName} — Property Rankings</SectionLabel>
              <ChartCard>
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(160, cityData.withinCityRankings.length * 44)}
                >
                  <BarChart
                    data={cityData.withinCityRankings.map((r) => ({
                      ...r,
                      label: r.isYou ? (r.name ?? "Your Property") : `#${r.rank} Anonymous`,
                    }))}
                    layout="vertical"
                  >
                    <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 10 }} />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={140}
                      tick={({ x, y, payload }: { x: string | number; y: string | number; payload: { value: string } }) => (
                        <text
                          x={x}
                          y={y}
                          dy={4}
                          textAnchor="end"
                          fill={payload.value.includes("Anonymous") ? "#94a3b8" : "#6366f1"}
                          fontWeight={payload.value.includes("Anonymous") ? 400 : 700}
                          fontSize={10}
                        >
                          {payload.value}
                        </text>
                      )}
                    />
                    <Tooltip formatter={(v) => (typeof v === "number" ? v.toFixed(1) : v)} />
                    {cityData.cityAvgGcs != null && (
                      <ReferenceLine
                        x={cityData.cityAvgGcs}
                        stroke="#94a3b8"
                        strokeDasharray="4 4"
                        label={{
                          value: `Avg ${cityData.cityAvgGcs.toFixed(1)}`,
                          position: "top",
                          fill: "#94a3b8",
                          fontSize: 10,
                        }}
                      />
                    )}
                    <Bar dataKey="gcs" radius={[0, 4, 4, 0]} name="Avg GCS">
                      {cityData.withinCityRankings.map((entry, idx) => (
                        <Cell key={idx} fill={entry.isYou ? "#6366f1" : "#c7d2fe"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-[9px] text-slate-400 mt-2">
                  Only your property is named · All others remain anonymous
                </p>
              </ChartCard>
            </div>
          )}

          {/* National city leaderboard */}
          {cityData.nationalCityRankings.length > 0 && (
            <div>
              <SectionLabel>National City Rankings</SectionLabel>
              <ChartCard>
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(160, cityData.nationalCityRankings.length * 40)}
                >
                  <BarChart data={cityData.nationalCityRankings} layout="vertical">
                    <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 10 }} />
                    <YAxis
                      type="category"
                      dataKey="city"
                      width={100}
                      tick={({ x, y, payload }: { x: string | number; y: string | number; payload: { value: string } }) => (
                        <text
                          x={x}
                          y={y}
                          dy={4}
                          textAnchor="end"
                          fill={payload.value === cityData.cityName ? "#6366f1" : "#64748b"}
                          fontWeight={payload.value === cityData.cityName ? 700 : 400}
                          fontSize={10}
                        >
                          {payload.value}
                        </text>
                      )}
                    />
                    <Tooltip
                      formatter={(v, _name, props) => [
                        `${typeof v === "number" ? v.toFixed(1) : v} avg GCS (${(props.payload as { propertyCount: number }).propertyCount} properties)`,
                        "City",
                      ]}
                    />
                    <Bar dataKey="avgGcs" radius={[0, 4, 4, 0]} name="Avg GCS">
                      {cityData.nationalCityRankings.map((entry, idx) => (
                        <Cell key={idx} fill={entry.isYou ? "#6366f1" : "#c7d2fe"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-[9px] text-slate-400 mt-2">
                  City averages across all active properties · Individual properties never shown
                </p>
              </ChartCard>
            </div>
          )}
        </>
      )}
    </div>
  )
}
