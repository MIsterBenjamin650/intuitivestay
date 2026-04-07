import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useRouteContext } from "@tanstack/react-router"
import { LockIcon } from "lucide-react"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { useTRPC } from "@/utils/trpc"

export const Route = createFileRoute("/_portal/properties/$propertyId/dashboard")({
  component: RouteComponent,
})

// ─── Constants ──────────────────────────────────────────────────────────────

type Days = 7 | 30 | 90

const PILLAR_COLORS = {
  resilience: "#6366f1",
  empathy: "#14b8a6",
  anticipation: "#a855f7",
  recognition: "#f97316",
} as const

const TIER_CONFIG = {
  member:   { label: "Member",   color: "#9ca3af", bg: "#f3f4f6" },
  bronze:   { label: "Bronze",   color: "#b45309", bg: "#fef3c7" },
  silver:   { label: "Silver",   color: "#64748b", bg: "#f1f5f9" },
  gold:     { label: "Gold",     color: "#ca8a04", bg: "#fefce8" },
  platinum: { label: "Platinum", color: "#6366f1", bg: "#eef2ff" },
} as const

type Tier = keyof typeof TIER_CONFIG

function getTierFromScore(score: number): Tier {
  if (score >= 95) return "platinum"
  if (score >= 80) return "gold"
  if (score >= 70) return "silver"
  if (score >= 50) return "bronze"
  return "member"
}

// ─── GCS Ring Gauge ─────────────────────────────────────────────────────────

function GcsRing({ gcs, tier }: { gcs: number | null; tier: Tier }) {
  const r = 56
  const cx = 70
  const cy = 70
  const C = 2 * Math.PI * r
  const pct = gcs != null ? Math.min(Math.max(gcs / 10, 0), 1) : 0
  const filled = C * pct
  const gap = C - filled
  const t = TIER_CONFIG[tier]

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width="140" height="140">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={t.color}
          strokeWidth="10"
          strokeDasharray={`${filled} ${gap}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="28" fontWeight="800" fill={t.color}>
          {gcs != null ? gcs.toFixed(1) : "—"}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fill="#9ca3af">
          out of 10
        </text>
      </svg>
      <span
        className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
        style={{ background: t.bg, color: t.color }}
      >
        {t.label}
      </span>
    </div>
  )
}

// ─── Locked section wrapper ─────────────────────────────────────────────────

function LockedSection({ title, description }: { title: string; description: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-white p-5 shadow-sm">
      <div className="mb-4 space-y-2 blur-sm select-none pointer-events-none">
        {[80, 60, 90, 45, 70].map((w, i) => (
          <div key={i} className="h-3 rounded-full bg-gray-200" style={{ width: `${w}%` }} />
        ))}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-white/80 backdrop-blur-sm">
        <LockIcon className="size-6 text-gray-400" />
        <p className="text-sm font-semibold text-gray-700">{title}</p>
        <p className="text-xs text-gray-500 text-center px-4">{description}</p>
        <a
          href="/organisation/billing"
          className="mt-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          View Plans
        </a>
      </div>
    </div>
  )
}

// ─── Date range tab bar ─────────────────────────────────────────────────────

function DateRangeTabs({ days, onChange }: { days: Days; onChange: (d: Days) => void }) {
  const options: { label: string; value: Days }[] = [
    { label: "7 days", value: 7 },
    { label: "30 days", value: 30 },
    { label: "90 days", value: 90 },
  ]
  return (
    <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            days === o.value
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ─── Route component ─────────────────────────────────────────────────────────

function RouteComponent() {
  const { propertyId } = Route.useParams()
  const { session } = useRouteContext({ from: "/_portal" })
  const plan = (session as { plan?: string | null } | null)?.plan ?? null
  const canSeeLeaderboard = plan === "member" || plan === "host" || plan === "partner"

  const [days, setDays] = React.useState<Days>(30)
  const trpc = useTRPC()
  const opts = { propertyId, days }

  const { data: stats } = useQuery(trpc.properties.getDashboardStats.queryOptions(opts))
  const { data: history } = useQuery(trpc.properties.getGcsHistory.queryOptions(opts))
  const { data: recentFeedback } = useQuery(trpc.properties.getRecentFeedback.queryOptions(opts))
  const { data: wordCloud } = useQuery(trpc.properties.getWordCloud.queryOptions(opts))
  const { data: staffBubbles } = useQuery(trpc.properties.getStaffBubbles.queryOptions(opts))
  const { data: leaderboard } = useQuery(trpc.properties.getCityLeaderboardLive.queryOptions(opts))
  useQuery(trpc.properties.getTierStatus.queryOptions({ propertyId }))
  const { data: aiSummary } = useQuery(trpc.properties.getAiSummary.queryOptions({ propertyId }))

  const tierScore = stats?.avgGcs != null ? stats.avgGcs * 10 : 0
  const displayTier: Tier = getTierFromScore(tierScore)

  const radarData = history?.length
    ? [
        { subject: "Resilience", score: history.reduce((s, r) => s + (r.resilience ?? 0), 0) / history.length },
        { subject: "Empathy", score: history.reduce((s, r) => s + (r.empathy ?? 0), 0) / history.length },
        { subject: "Anticipation", score: history.reduce((s, r) => s + (r.anticipation ?? 0), 0) / history.length },
        { subject: "Recognition", score: history.reduce((s, r) => s + (r.recognition ?? 0), 0) / history.length },
      ]
    : []

  const TIME_EMOJIS: Record<string, string> = {
    morning: "☀️",
    afternoon: "🌤",
    evening: "🌙",
    night: "⭐",
  }

  const maxStaffCount = Math.max(...(staffBubbles?.map((s) => s.count) ?? [1]), 1)
  const MAX_BUBBLE = 56
  const SENTIMENT_COLORS = { positive: "#22c55e", neutral: "#94a3b8", negative: "#ef4444" }

  const maxWordCount = Math.max(...(wordCloud?.map((w) => w.count) ?? [1]), 1)

  return (
    <div className="flex flex-col gap-5 p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Dashboard</h1>
        <DateRangeTabs days={days} onChange={setDays} />
      </div>

      {/* Row 1: Stat pills */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Feedback", value: String(stats?.totalFeedback ?? "—"), color: "#6366f1" },
          { label: "Avg GCS", value: stats?.avgGcs != null ? stats.avgGcs.toFixed(1) : "—", color: "#14b8a6" },
          { label: "Tier Score", value: stats?.avgGcs != null ? (stats.avgGcs * 10).toFixed(0) : "—", color: "#a855f7" },
          { label: "Current Seal", value: TIER_CONFIG[displayTier].label, color: TIER_CONFIG[displayTier].color },
        ].map((pill) => (
          <div key={pill.label} className="rounded-xl bg-white px-4 py-3 shadow-sm" style={{ borderLeft: `4px solid ${pill.color}` }}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-gray-400">{pill.label}</p>
            <p className="mt-0.5 text-xl font-extrabold leading-tight" style={{ color: pill.color }}>{pill.value}</p>
          </div>
        ))}
      </div>

      {/* Row 2: GCS ring + AI summary */}
      <div className="grid gap-4 md:grid-cols-[auto_1fr]">
        <div className="flex items-center justify-center rounded-xl bg-white p-6 shadow-sm">
          <GcsRing gcs={stats?.avgGcs ?? null} tier={displayTier} />
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.07em] text-gray-400">AI Daily Summary</p>
          {aiSummary ? (
            <>
              <p className="mb-3 text-xs text-gray-500">{aiSummary.date}</p>
              <p className="mb-4 text-sm leading-relaxed text-gray-700">{aiSummary.narrative}</p>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.07em] text-gray-400">Today's Focus</p>
              <ul className="space-y-1.5">
                {aiSummary.focusPoints.map((f, i) => {
                  const pillarKey = f.pillar.toLowerCase() as keyof typeof PILLAR_COLORS
                  const color = PILLAR_COLORS[pillarKey] ?? "#6366f1"
                  return (
                    <li key={i} className="flex gap-2 text-xs text-gray-700">
                      <span className="shrink-0 font-semibold" style={{ color }}>{f.pillar}:</span>
                      <span>{f.action}</span>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            <p className="text-sm text-gray-400">Your first summary will appear tomorrow morning.</p>
          )}
        </div>
      </div>

      {/* Row 3: Pillar trend + Radar */}
      <div className="grid gap-4 md:grid-cols-[3fr_2fr]">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.07em] text-gray-400">Pillar Scores Over Time</p>
          {history?.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 11 }}
                  formatter={(v: unknown) => [typeof v === "number" ? v.toFixed(1) : String(v)]} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="resilience" stroke={PILLAR_COLORS.resilience} strokeWidth={2} dot={false} name="Resilience" />
                <Line type="monotone" dataKey="empathy" stroke={PILLAR_COLORS.empathy} strokeWidth={2} dot={false} name="Empathy" />
                <Line type="monotone" dataKey="anticipation" stroke={PILLAR_COLORS.anticipation} strokeWidth={2} dot={false} name="Anticipation" />
                <Line type="monotone" dataKey="recognition" stroke={PILLAR_COLORS.recognition} strokeWidth={2} dot={false} name="Recognition" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400">No data yet for this period.</p>
          )}
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.07em] text-gray-400">Pillar Radar</p>
          {radarData.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "#6b7280" }} />
                <Radar name="Score" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 11 }}
                  formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(1) : String(v)) as string} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400">No data yet.</p>
          )}
        </div>
      </div>

      {/* Row 4: Pillar donut gauges */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(["resilience", "empathy", "anticipation", "recognition"] as const).map((pillar) => {
          const avgVal = history?.length
            ? history.reduce((s, r) => s + (r[pillar] ?? 0), 0) / history.length
            : null
          const r = 40
          const C = 2 * Math.PI * r
          const pct = avgVal != null ? Math.min(Math.max(avgVal / 10, 0), 1) : 0
          const color = PILLAR_COLORS[pillar]
          return (
            <div key={pillar} className="flex flex-col items-center rounded-xl bg-white p-4 shadow-sm">
              <svg width="100" height="100">
                <circle cx={50} cy={50} r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
                <circle
                  cx={50} cy={50} r={r} fill="none" stroke={color} strokeWidth="8"
                  strokeDasharray={`${C * pct} ${C * (1 - pct)}`}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                />
                <text x={50} y={54} textAnchor="middle" fontSize="20" fontWeight="800" fill={color}>
                  {avgVal != null ? avgVal.toFixed(1) : "—"}
                </text>
              </svg>
              <p className="mt-1 capitalize text-[10px] font-semibold uppercase tracking-[0.07em] text-gray-400">{pillar}</p>
            </div>
          )
        })}
      </div>

      {/* Row 5: Word cloud + Staff bubbles */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-gray-400">Guest Adjectives</p>
          {wordCloud?.length ? (
            <div className="flex flex-wrap gap-2">
              {wordCloud.map(({ word, count }) => {
                const scale = 0.75 + (count / maxWordCount) * 0.75
                return (
                  <span
                    key={word}
                    className="rounded-full px-3 py-1 font-semibold text-white"
                    style={{
                      fontSize: `${Math.round(scale * 12)}px`,
                      background: `hsl(${(word.charCodeAt(0) * 37) % 360}, 70%, 55%)`,
                    }}
                  >
                    {word}
                  </span>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No descriptive words collected yet.</p>
          )}
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-gray-400">Staff Mentions</p>
          {staffBubbles?.length ? (
            <div className="flex flex-wrap gap-3">
              {staffBubbles.map(({ name, count, sentiment }) => {
                const size = Math.round(28 + (count / maxStaffCount) * (MAX_BUBBLE - 28))
                return (
                  <div key={name} className="flex flex-col items-center gap-1">
                    <div
                      className="flex items-center justify-center rounded-full font-bold text-white"
                      style={{
                        width: size,
                        height: size,
                        background: SENTIMENT_COLORS[sentiment],
                        fontSize: Math.max(size * 0.3, 10),
                      }}
                      title={`${name} — ${count} mention${count !== 1 ? "s" : ""}`}
                    >
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-[9px] font-medium text-gray-500">{name.split(" ")[0]}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No staff mentions yet.</p>
          )}
        </div>
      </div>

      {/* Row 6: Recent feedback */}
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-gray-400">Recent Feedback</p>
        {recentFeedback?.length ? (
          <div className="space-y-3">
            {recentFeedback.map((f) => (
              <div key={f.id} className="flex gap-4 rounded-lg border border-gray-100 p-3">
                <div className="text-2xl leading-none">{TIME_EMOJIS[f.mealTime ?? ""] ?? "🕐"}</div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { label: "R", value: f.resilience, color: PILLAR_COLORS.resilience },
                        { label: "E", value: f.empathy, color: PILLAR_COLORS.empathy },
                        { label: "A", value: f.anticipation, color: PILLAR_COLORS.anticipation },
                        { label: "Rec", value: f.recognition, color: PILLAR_COLORS.recognition },
                      ] as const
                    ).map(({ label, value, color }) => (
                      <span key={label} className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: color }}>
                        {label} {value}/10
                      </span>
                    ))}
                  </div>
                  {f.namedStaffMember && (
                    <p className="text-[11px] text-gray-500">
                      Staff: <span className="font-semibold text-gray-700">{f.namedStaffMember}</span>
                    </p>
                  )}
                  {f.ventText && (
                    <p className="rounded-md border border-amber-100 bg-amber-50 px-2 py-1 text-xs text-amber-800">{f.ventText}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No feedback yet for this period.</p>
        )}
      </div>

      {/* Row 7: City leaderboard */}
      {canSeeLeaderboard ? (
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-gray-400">
            City Leaderboard{leaderboard?.city ? ` — ${leaderboard.city}` : ""}
          </p>
          {leaderboard?.rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    {["#", "Property", "GCS", "R", "E", "A", "Rec", "Submissions"].map((h) => (
                      <th key={h} className="py-2 pr-3 text-left font-semibold text-gray-500 last:text-right">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.rows.map((row) => (
                    <tr key={row.propertyId} className={row.isOwn ? "bg-indigo-50" : "border-b border-gray-50"} style={row.isOwn ? { borderLeft: "3px solid #6366f1" } : undefined}>
                      <td className="py-2 pr-3 font-bold text-gray-500">{row.rank}</td>
                      <td className="py-2 pr-3 font-semibold text-gray-800">{row.isOwn ? row.name : `Property #${row.rank}`}</td>
                      <td className="py-2 pr-3 font-bold text-indigo-600">{row.avgGcs != null ? row.avgGcs.toFixed(1) : "—"}</td>
                      <td className="py-2 pr-3 text-gray-500">{row.avgResilience?.toFixed(1) ?? "—"}</td>
                      <td className="py-2 pr-3 text-gray-500">{row.avgEmpathy?.toFixed(1) ?? "—"}</td>
                      <td className="py-2 pr-3 text-gray-500">{row.avgAnticipation?.toFixed(1) ?? "—"}</td>
                      <td className="py-2 pr-3 text-gray-500">{row.avgRecognition?.toFixed(1) ?? "—"}</td>
                      <td className="py-2 text-right text-gray-500">{row.submissions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No other properties found in your city yet.</p>
          )}
        </div>
      ) : (
        <LockedSection
          title="City Leaderboard"
          description="See how you rank against other properties in your city. Available on Host and Partner plans."
        />
      )}

      {/* Row 8: Locked sections */}
      <div className="grid gap-4 md:grid-cols-2">
        <LockedSection title="Advanced Insights" description="Sentiment trend analysis, day-of-week consistency, reputation gap analysis. Upgrade to unlock." />
        <LockedSection title="Local Market" description="Compare your GCS against local hospitality market benchmarks. Upgrade to unlock." />
      </div>
    </div>
  )
}
