import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useRouteContext } from "@tanstack/react-router"
import { LockIcon } from "lucide-react"

import { ExportPdfButton } from "@/components/export-pdf-button"
import { OnlineReputationSection } from "@/components/online-reputation-section"
import type { PdfDashboardData } from "@/components/property-pdf-document"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
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

// ─── Locked section wrapper ─────────────────────────────────────────────────

function LockedSection({ title, description }: { title: string; description: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-4 space-y-2 blur-sm select-none pointer-events-none">
        {[80, 60, 90, 45, 70].map((w, i) => (
          <div key={i} className="h-3 rounded-full bg-gray-200" style={{ width: `${w}%` }} />
        ))}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-white/80 backdrop-blur-sm">
        <LockIcon className="size-6 text-gray-400" />
        <p className="text-sm font-semibold text-gray-700">{title}</p>
        <p className="text-xs text-gray-500 text-center px-4">{description}</p>
        <a
          href="/organisation/billing"
          className="mt-1 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600"
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
    <div className="flex gap-1 rounded-lg bg-[#f0ede8] p-1">
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
  const PLAN_RANK: Record<string, number> = { member: 0, host: 1, partner: 2, founder: 3 }
  const planRank = PLAN_RANK[plan ?? ""] ?? -1
  const canSeeLeaderboard = planRank >= 1       // host, partner, founder
  const canSeeAdvancedInsights = planRank >= 2  // partner, founder
  const canSeeLocalMarket = planRank >= 2       // partner, founder

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

  const avgPillars = history?.length
    ? {
        resilience: history.reduce((s, r) => s + (r.resilience ?? 0), 0) / history.length,
        empathy: history.reduce((s, r) => s + (r.empathy ?? 0), 0) / history.length,
        anticipation: history.reduce((s, r) => s + (r.anticipation ?? 0), 0) / history.length,
        recognition: history.reduce((s, r) => s + (r.recognition ?? 0), 0) / history.length,
      }
    : { resilience: null, empathy: null, anticipation: null, recognition: null }

  const TIME_EMOJIS: Record<string, string> = {
    morning: "☀️",
    afternoon: "🌤",
    evening: "🌙",
    night: "⭐",
  }

  const maxStaffCount = Math.max(...(staffBubbles?.map((s) => s.count) ?? [1]), 1)
  const MAX_BUBBLE = 56
  const SENTIMENT_COLORS = { positive: "#f97316", neutral: "#a8a29e", negative: "#dc2626" }
  const PILL_PALETTE = ["#f97316", "#ea580c", "#fb923c", "#c2410c", "#f59e0b", "#d97706"]

  const maxWordCount = Math.max(...(wordCloud?.map((w) => w.count) ?? [1]), 1)

  return (
    <div className="flex flex-col gap-5 p-4 md:p-5 min-w-0 w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#1c1917]">Dashboard</h1>
        <div className="flex items-center gap-3">
          <DateRangeTabs days={days} onChange={setDays} />
          {(() => {
            const sessionProperties = (session as { user?: { properties?: Array<{ id: string; name: string }> } } | null)?.user?.properties ?? []
            const propertyName = sessionProperties.find((p) => p.id === propertyId)?.name ?? "Property"
            const pdfData: PdfDashboardData = {
              propertyName,
              days,
              exportedAt: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
              stats: stats ? { totalFeedback: stats.totalFeedback, avgGcs: stats.avgGcs ?? 0 } : null,
              tier: { currentTier: displayTier },
              recentFeedback: (recentFeedback ?? []).map((fb) => ({
                id: fb.id,
                resilience: fb.resilience,
                empathy: fb.empathy,
                anticipation: fb.anticipation,
                recognition: fb.recognition,
                gcs: Number(fb.gcs),
                mealTime: fb.mealTime ?? null,
                namedStaffMember: fb.namedStaffMember ?? null,
                ventText: fb.ventText ?? null,
                submittedAt: String(fb.submittedAt),
              })),
              wordCloud: wordCloud ?? [],
              staffBubbles: staffBubbles ?? [],
              aiSummary: aiSummary
                ? { narrative: aiSummary.narrative, focusPoints: aiSummary.focusPoints as Array<{ pillar: string; action: string }> }
                : null,
              gcsHistory: (history ?? []).map((h) => ({
                bucket: h.bucket,
                gcs: h.gcs ?? 0,
                resilience: h.resilience ?? 0,
                empathy: h.empathy ?? 0,
                anticipation: h.anticipation ?? 0,
                recognition: h.recognition ?? 0,
              })),
            }
            return <ExportPdfButton data={pdfData} disabled={!stats || stats.totalFeedback === 0} />
          })()}
        </div>
      </div>

      {/* Row 1+2: GCS hero + AI summary */}
      <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
        {/* GCS hero card */}
        <div className="rounded-2xl bg-white p-6 shadow-sm flex flex-col justify-between gap-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-gray-400">GCS Score</p>
          <div className="flex items-end gap-3">
            <span className="text-8xl font-black leading-none text-orange-500">
              {stats?.avgGcs != null ? stats.avgGcs.toFixed(1) : "—"}
            </span>
            <span className="text-2xl font-light text-gray-300 mb-2">/10</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="rounded-full px-3 py-1 text-xs font-bold"
              style={{ background: TIER_CONFIG[displayTier].bg, color: TIER_CONFIG[displayTier].color }}
            >
              {TIER_CONFIG[displayTier].label} Seal
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 border-t border-gray-100 pt-4">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-400">Feedback</p>
              <p className="text-xl font-bold text-gray-800">{stats?.totalFeedback ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-400">Tier Score</p>
              <p className="text-xl font-bold text-orange-500">
                {stats?.avgGcs != null ? (stats.avgGcs * 10).toFixed(0) : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-400">Period</p>
              <p className="text-xl font-bold text-gray-800">{days}d</p>
            </div>
          </div>
        </div>

        {/* AI summary — white card */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-1.5 w-1.5 rounded-full bg-orange-400" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-gray-400">AI Daily Summary</p>
          </div>
          {aiSummary ? (
            <>
              <p className="mb-3 text-xs text-gray-400">{aiSummary.date}</p>
              <p className="mb-4 text-sm leading-relaxed text-gray-700">{aiSummary.narrative}</p>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.07em] text-gray-400">Today's Focus</p>
              <ul className="space-y-1.5">
                {aiSummary.focusPoints.map((f, i) => {
                  const pillarKey = f.pillar.toLowerCase() as keyof typeof PILLAR_COLORS
                  const color = PILLAR_COLORS[pillarKey] ?? "#f97316"
                  return (
                    <li key={i} className="flex gap-2 text-xs text-gray-600">
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

      {/* Row 3: A2 Line chart + B1 Grouped bar chart */}
      <div className="grid gap-4 md:grid-cols-[3fr_2fr]">
        {/* A2 — clean lines with dots */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.07em] text-gray-400">Pillar Scores Over Time</p>
          {history?.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="0" stroke="#f5f5f4" />
                <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 11 }}
                  formatter={(v: unknown) => [typeof v === "number" ? v.toFixed(1) : String(v)]} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Line type="linear" dataKey="resilience" stroke={PILLAR_COLORS.resilience} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: PILLAR_COLORS.resilience }} name="Resilience" />
                <Line type="linear" dataKey="empathy" stroke={PILLAR_COLORS.empathy} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: PILLAR_COLORS.empathy }} name="Empathy" />
                <Line type="linear" dataKey="anticipation" stroke={PILLAR_COLORS.anticipation} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: PILLAR_COLORS.anticipation }} name="Anticipation" />
                <Line type="linear" dataKey="recognition" stroke={PILLAR_COLORS.recognition} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: PILLAR_COLORS.recognition }} name="Recognition" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400">No data yet for this period.</p>
          )}
        </div>

        {/* B1 — grouped bar chart */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.07em] text-gray-400">Pillar Breakdown</p>
          {history?.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={history.slice(-5)} barCategoryGap="30%" barGap={2}>
                <CartesianGrid strokeDasharray="0" stroke="#f5f5f4" vertical={false} />
                <XAxis dataKey="bucket" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={20} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 11 }}
                  formatter={(v: unknown) => [typeof v === "number" ? v.toFixed(1) : String(v)]} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="resilience" fill={PILLAR_COLORS.resilience} radius={[4, 4, 0, 0]} name="Resilience" />
                <Bar dataKey="empathy" fill={PILLAR_COLORS.empathy} radius={[4, 4, 0, 0]} name="Empathy" />
                <Bar dataKey="anticipation" fill={PILLAR_COLORS.anticipation} radius={[4, 4, 0, 0]} name="Anticipation" />
                <Bar dataKey="recognition" fill={PILLAR_COLORS.recognition} radius={[4, 4, 0, 0]} name="Recognition" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400">No data yet.</p>
          )}
        </div>
      </div>

      {/* Row 4: D1 — gradient horizontal bars for all pillars */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="mb-5 text-[10px] font-semibold uppercase tracking-[0.07em] text-gray-400">Pillar Scores</p>
        <div className="grid gap-5 sm:grid-cols-2">
          {(["resilience", "empathy", "anticipation", "recognition"] as const).map((pillar) => {
            const avgVal = history?.length
              ? history.reduce((s, r) => s + (r[pillar] ?? 0), 0) / history.length
              : null
            const pct = avgVal != null ? Math.min(Math.max((avgVal / 10) * 100, 0), 100) : 0
            const color = PILLAR_COLORS[pillar]
            const gradientMap: Record<string, string> = {
              resilience: "linear-gradient(90deg, #818cf8, #6366f1)",
              empathy: "linear-gradient(90deg, #2dd4bf, #14b8a6)",
              anticipation: "linear-gradient(90deg, #c084fc, #a855f7)",
              recognition: "linear-gradient(90deg, #fb923c, #f97316)",
            }
            return (
              <div key={pillar}>
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-[11px] font-semibold capitalize text-gray-700">{pillar}</span>
                  <span className="text-lg font-extrabold" style={{ color }}>
                    {avgVal != null ? avgVal.toFixed(1) : "—"}
                    <span className="text-xs font-normal text-gray-400 ml-0.5">/10</span>
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: gradientMap[pillar] }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Row 5: Word cloud + Staff bubbles */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
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
                      background: PILL_PALETTE[word.charCodeAt(0) % PILL_PALETTE.length],
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
        <div className="rounded-2xl bg-white p-5 shadow-sm">
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
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-gray-400">Recent Feedback</p>
        {recentFeedback?.length ? (
          <div className="space-y-3">
            {recentFeedback.map((f) => (
              <div key={f.id} className="flex gap-4 rounded-xl border border-gray-100 p-3">
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
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-gray-400">
            City Leaderboard{leaderboard?.city ? ` — ${leaderboard.city}` : ""}
          </p>
          {leaderboard?.rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    {["#", "Property", "GCS", "R", "E", "A", "Rec", "Submissions"].map((h) => (
                      <th key={h} className="py-3 pr-4 text-left font-semibold text-gray-500 last:text-right">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.rows.map((row) => (
                    <tr key={row.propertyId} className={row.isOwn ? "bg-orange-50" : "border-b border-gray-50"} style={row.isOwn ? { borderLeft: "3px solid #f97316" } : undefined}>
                      <td className="py-3 pr-4 font-bold text-gray-500">{row.rank}</td>
                      <td className="py-3 pr-4 font-semibold text-gray-800">{row.isOwn ? row.name : `Property #${row.rank}`}</td>
                      <td className="py-3 pr-4 font-bold text-orange-500">{row.avgGcs != null ? row.avgGcs.toFixed(1) : "—"}</td>
                      <td className="py-3 pr-4 text-gray-500">{row.avgResilience?.toFixed(1) ?? "—"}</td>
                      <td className="py-3 pr-4 text-gray-500">{row.avgEmpathy?.toFixed(1) ?? "—"}</td>
                      <td className="py-3 pr-4 text-gray-500">{row.avgAnticipation?.toFixed(1) ?? "—"}</td>
                      <td className="py-3 pr-4 text-gray-500">{row.avgRecognition?.toFixed(1) ?? "—"}</td>
                      <td className="py-3 text-right text-gray-500">{row.submissions}</td>
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

      {/* Row 8: Online Reputation */}
      <OnlineReputationSection propertyId={propertyId} gcs={avgPillars} />

      {/* Row 9: Advanced Insights + Local Market */}
      <div className="grid gap-4 md:grid-cols-2">
        {canSeeAdvancedInsights ? (
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-gray-400">Advanced Insights</p>
            <p className="text-sm text-gray-400">Sentiment trend analysis and reputation gap analysis coming soon.</p>
          </div>
        ) : (
          <LockedSection title="Advanced Insights" description="Sentiment trend analysis, day-of-week consistency, reputation gap analysis. Available on Partner and Founder plans." />
        )}
        {canSeeLocalMarket ? (
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-gray-400">Local Market</p>
            <p className="text-sm text-gray-400">Local hospitality market benchmarks coming soon.</p>
          </div>
        ) : (
          <LockedSection title="Local Market" description="Compare your GCS against local hospitality market benchmarks. Available on Partner and Founder plans." />
        )}
      </div>
    </div>
  )
}
