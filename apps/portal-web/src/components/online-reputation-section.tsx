import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { RefreshCw, Settings, Star } from "lucide-react"
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts"

import { useTRPC } from "@/utils/trpc"

interface Props {
  propertyId: string
  gcs: {
    resilience: number | null
    empathy: number | null
    anticipation: number | null
    recognition: number | null
  }
}

function StarRating({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
      <span className="text-lg font-bold text-[#1c1917]">{value.toFixed(1)}</span>
      <span className="text-xs text-[#78716c]">/ {max}</span>
    </div>
  )
}

function daysSince(date: string | Date): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
}

export function OnlineReputationSection({ propertyId, gcs }: Props) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [showSetup, setShowSetup] = React.useState(false)
  const [taUrl, setTaUrl] = React.useState("")
  const [googleId, setGoogleId] = React.useState("")
  const [scrapeError, setScrapeError] = React.useState<string | null>(null)

  const { data, isLoading } = useQuery(
    trpc.reviews.getComparison.queryOptions({ propertyId }),
  )

  const saveMutation = useMutation(trpc.reviews.setReviewSources.mutationOptions())
  const scrapeMutation = useMutation(trpc.reviews.triggerScrape.mutationOptions())

  React.useEffect(() => {
    if (data) {
      setTaUrl(data.tripAdvisorUrl ?? "")
      setGoogleId(data.googlePlaceId ?? "")
    }
  }, [data])

  function refetch() {
    void queryClient.invalidateQueries(trpc.reviews.getComparison.queryOptions({ propertyId }))
  }

  async function handleSaveSources() {
    await saveMutation.mutateAsync({
      propertyId,
      tripAdvisorUrl: taUrl || null,
      googlePlaceId: googleId || null,
    })
    setShowSetup(false)
    refetch()
  }

  async function handleRefresh() {
    setScrapeError(null)
    try {
      await scrapeMutation.mutateAsync({ propertyId })
      refetch()
    } catch (e: unknown) {
      setScrapeError(e instanceof Error ? e.message : "Refresh failed")
    }
  }

  const hasSetup = !!(data?.tripAdvisorUrl || data?.googlePlaceId)
  const hasCache = !!(data?.tripadvisor || data?.google)

  const taAge = data?.tripadvisor ? daysSince(data.tripadvisor.lastScrapedAt) : 999
  const gAge = data?.google ? daysSince(data.google.lastScrapedAt) : 999
  const onCooldown = hasSetup && taAge < 7 && gAge < 7
  const lastUpdated = Math.min(taAge, gAge)

  // Pick best available online review pillars for summary (prefer TripAdvisor, fall back to Google)
  const onlinePillars = data?.tripadvisor ?? data?.google ?? null

  const ta = data?.tripadvisor ?? null
  const g = data?.google ?? null

  const radarData = [
    {
      subject: "Resilience",
      GCS: gcs.resilience ?? 0,
      TripAdvisor: ta ? Number(ta.pillarResilience) : undefined,
      Google: g ? Number(g.pillarResilience) : undefined,
    },
    {
      subject: "Empathy",
      GCS: gcs.empathy ?? 0,
      TripAdvisor: ta ? Number(ta.pillarEmpathy) : undefined,
      Google: g ? Number(g.pillarEmpathy) : undefined,
    },
    {
      subject: "Anticipation",
      GCS: gcs.anticipation ?? 0,
      TripAdvisor: ta ? Number(ta.pillarAnticipation) : undefined,
      Google: g ? Number(g.pillarAnticipation) : undefined,
    },
    {
      subject: "Recognition",
      GCS: gcs.recognition ?? 0,
      TripAdvisor: ta ? Number(ta.pillarRecognition) : undefined,
      Google: g ? Number(g.pillarRecognition) : undefined,
    },
  ]

  const showChart = hasCache && onlinePillars !== null

  // Compute plain-English summary from pillar gaps
  function buildSummary() {
    if (!onlinePillars) return null
    const pillars = [
      { name: "Resilience", gcsVal: gcs.resilience ?? 0, onlineVal: Number(onlinePillars.pillarResilience) },
      { name: "Empathy", gcsVal: gcs.empathy ?? 0, onlineVal: Number(onlinePillars.pillarEmpathy) },
      { name: "Anticipation", gcsVal: gcs.anticipation ?? 0, onlineVal: Number(onlinePillars.pillarAnticipation) },
      { name: "Recognition", gcsVal: gcs.recognition ?? 0, onlineVal: Number(onlinePillars.pillarRecognition) },
    ]

    const avgGcs = pillars.reduce((s, p) => s + p.gcsVal, 0) / pillars.length
    const avgOnline = pillars.reduce((s, p) => s + p.onlineVal, 0) / pillars.length
    const overallGap = avgGcs - avgOnline

    // Find biggest gap pillars
    const sorted = [...pillars].sort((a, b) => Math.abs(b.gcsVal - b.onlineVal) - Math.abs(a.gcsVal - a.onlineVal))
    const biggest = sorted[0]!
    const gap = biggest.gcsVal - biggest.onlineVal

    // Overall alignment sentence
    let alignment: string
    if (Math.abs(overallGap) < 0.5) {
      alignment = "Your in-house GCS scores closely match what guests are saying online — a strong sign of consistency across their experience."
    } else if (overallGap > 0) {
      alignment = `Your team is performing better in-house (avg ${avgGcs.toFixed(1)}/10) than your online reviews suggest (avg ${avgOnline.toFixed(1)}/10). This gap may mean great service moments aren't being translated into written reviews.`
    } else {
      alignment = `Your online reviews (avg ${avgOnline.toFixed(1)}/10) are outpacing your internal GCS scores (avg ${avgGcs.toFixed(1)}/10) — guests are leaving positive impressions that your team may not be consistently tracking internally.`
    }

    // Biggest gap pillar sentence
    let pillarInsight: string
    if (Math.abs(gap) < 0.5) {
      const best = [...pillars].sort((a, b) => b.onlineVal - a.onlineVal)[0]!
      pillarInsight = `${best.name} stands out as your strongest pillar in online reviews (${best.onlineVal.toFixed(1)}/10), which aligns well with your GCS data.`
    } else if (gap > 0) {
      pillarInsight = `${biggest.name} shows the largest gap — your internal score (${biggest.gcsVal.toFixed(1)}/10) is higher than what online reviewers mention (${biggest.onlineVal.toFixed(1)}/10). Encouraging guests to specifically comment on ${biggest.name.toLowerCase()} moments could improve your online reputation score.`
    } else {
      pillarInsight = `${biggest.name} is your hidden strength — online reviewers rate it higher (${biggest.onlineVal.toFixed(1)}/10) than your internal GCS captures (${biggest.gcsVal.toFixed(1)}/10). This is worth celebrating with your team.`
    }

    return { alignment, pillarInsight }
  }

  const summary = buildSummary()

  if (isLoading) return null

  return (
    <div className="rounded-2xl bg-white shadow-sm p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#a8a29e]">
            Online Reputation
          </p>
          {hasCache && (
            <p className="text-xs text-[#44403c] mt-0.5">
              Last updated{" "}
              {lastUpdated === 0 ? "today" : `${lastUpdated} day${lastUpdated !== 1 ? "s" : ""} ago`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSetup((v) => !v)}
            className="flex items-center gap-1.5 rounded-md border border-[#e8e3dc] px-2.5 py-1.5 text-xs text-[#78716c] hover:bg-[#f0ede8]"
          >
            <Settings className="h-3 w-3" />
            Setup
          </button>
          {hasSetup && (
            <button
              onClick={handleRefresh}
              disabled={scrapeMutation.isPending || onCooldown}
              className="flex items-center gap-1.5 rounded-md border border-orange-300 bg-white px-2.5 py-1.5 text-xs font-medium text-orange-600 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${scrapeMutation.isPending ? "animate-spin" : ""}`} />
              {scrapeMutation.isPending
                ? "Scraping…"
                : onCooldown
                ? `Refresh in ${7 - lastUpdated}d`
                : "Refresh Reviews"}
            </button>
          )}
        </div>
      </div>

      {scrapeError && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{scrapeError}</p>
      )}

      {/* Setup form */}
      {showSetup && (
        <div className="mb-4 rounded-xl border border-dashed border-orange-200 bg-orange-50 p-4 space-y-3">
          <p className="text-xs font-medium text-[#78716c]">
            Enter your property's review page URLs so we can compare your online reputation with your GCS scores.
          </p>
          <div>
            <label className="text-xs font-medium text-[#78716c]">TripAdvisor URL</label>
            <input
              type="url"
              value={taUrl}
              onChange={(e) => setTaUrl(e.target.value)}
              placeholder="https://www.tripadvisor.co.uk/Restaurant_Review-..."
              className="mt-1 w-full rounded-md border border-[#e8e3dc] bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-300"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#78716c]">Google Maps URL</label>
            <input
              type="url"
              value={googleId}
              onChange={(e) => setGoogleId(e.target.value)}
              placeholder="https://www.google.com/maps/place/Your+Business+Name/..."
              className={`mt-1 w-full rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-300 ${
                googleId && !googleId.includes("/maps/")
                  ? "border-red-300 bg-red-50"
                  : "border-[#e8e3dc] bg-white"
              }`}
            />
            {googleId && !googleId.includes("/maps/") && (
              <p className="mt-1 text-[11px] text-red-600 font-medium">
                ⚠ This looks like a Google Search URL. You need a Google <strong>Maps</strong> URL — see instructions below.
              </p>
            )}
            <div className="mt-2 rounded-md bg-blue-50 border border-blue-100 px-3 py-2 space-y-1">
              <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wide">How to find your Google Maps URL</p>
              <ol className="space-y-0.5 text-[11px] text-blue-700 list-none">
                <li>1. Go to <span className="font-semibold">maps.google.com</span> (not google.com)</li>
                <li>2. Search for your property by name</li>
                <li>3. Click on your listing in the results</li>
                <li>4. Copy the URL — it must contain <span className="font-semibold">/maps/place/</span></li>
                <li>5. Paste it into the field above</li>
              </ol>
              <p className="text-[10px] text-blue-700 mt-1">
                ✓ Valid: <span className="font-mono">google.com/maps/place/My+Restaurant/...</span>
              </p>
            </div>
          </div>
          <button
            onClick={handleSaveSources}
            disabled={saveMutation.isPending || (!!googleId && !googleId.includes("/maps/"))}
            className="rounded-md bg-orange-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saveMutation.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      )}

      {/* No setup yet */}
      {!hasSetup && !showSetup && (
        <div className="rounded-xl border border-dashed border-[#e8e3dc] p-8 text-center">
          <p className="text-sm text-[#44403c]">
            Connect your TripAdvisor and Google listings to compare your online reputation with your GCS scores.
          </p>
          <button
            onClick={() => setShowSetup(true)}
            className="mt-3 rounded-md border border-orange-300 px-4 py-2 text-sm font-medium text-orange-600 hover:bg-orange-50"
          >
            Get started
          </button>
        </div>
      )}

      {/* Setup done but no data yet */}
      {hasSetup && !hasCache && !showSetup && (
        <div className="rounded-xl border border-dashed border-[#e8e3dc] p-8 text-center">
          <p className="text-sm text-[#44403c]">
            Click "Refresh Reviews" to pull in your latest online reviews and generate a comparison.
          </p>
        </div>
      )}

      {/* Comparison chart */}
      {showChart && (
        <>
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#f0ede8" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#a8a29e" }} />
                <Radar
                  name="GCS Score"
                  dataKey="GCS"
                  stroke="#f97316"
                  fill="#f97316"
                  fillOpacity={0.2}
                />
                {ta && (
                  <Radar
                    name="TripAdvisor"
                    dataKey="TripAdvisor"
                    stroke="#22c55e"
                    fill="#22c55e"
                    fillOpacity={0.15}
                  />
                )}
                {g && (
                  <Radar
                    name="Google"
                    dataKey="Google"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.15}
                  />
                )}
                <Legend iconSize={14} iconType="line" wrapperStyle={{ fontSize: 11, display: "flex", gap: "16px", justifyContent: "center", paddingTop: "8px" }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #e8e3dc", fontSize: 11, background: "white" }}
                  formatter={(v: unknown) =>
                    typeof v === "number" ? v.toFixed(1) : (String(v) as string)
                  }
                />
              </RadarChart>
            </ResponsiveContainer>

            <div className="flex flex-col gap-3 justify-center min-w-[140px]">
              {ta && (
                <div className="rounded-lg border border-green-100 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "#22c55e" }}>
                    TripAdvisor
                  </p>
                  <StarRating value={Number(ta.avgRating)} />
                  <p className="text-xs text-[#78716c] mt-0.5">
                    {ta.reviewCount} reviews
                  </p>
                </div>
              )}
              {g && (
                <div className="rounded-lg border border-blue-100 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "#3b82f6" }}>
                    Google
                  </p>
                  <StarRating value={Number(g.avgRating)} />
                  <p className="text-xs text-[#78716c] mt-0.5">
                    {g.reviewCount} reviews
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Summary */}
          {summary && (
            <div className="mt-4 rounded-xl bg-[#f9f7f4] border border-[#e8e3dc] p-4 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#a8a29e]">Reputation Insight</p>
              <p className="text-xs text-[#44403c] leading-relaxed">{summary.alignment}</p>
              <p className="text-xs text-[#44403c] leading-relaxed">{summary.pillarInsight}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
