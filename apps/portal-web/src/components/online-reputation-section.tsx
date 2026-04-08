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
      <span className="text-lg font-bold">{value.toFixed(1)}</span>
      <span className="text-xs text-gray-400">/ {max}</span>
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

  // Pick best available online review pillars (prefer TripAdvisor, fall back to Google)
  const onlinePillars = data?.tripadvisor ?? data?.google ?? null

  const radarData = [
    {
      subject: "Resilience",
      GCS: gcs.resilience ?? 0,
      "Online Reviews": onlinePillars ? Number(onlinePillars.pillarResilience) : null,
    },
    {
      subject: "Empathy",
      GCS: gcs.empathy ?? 0,
      "Online Reviews": onlinePillars ? Number(onlinePillars.pillarEmpathy) : null,
    },
    {
      subject: "Anticipation",
      GCS: gcs.anticipation ?? 0,
      "Online Reviews": onlinePillars ? Number(onlinePillars.pillarAnticipation) : null,
    },
    {
      subject: "Recognition",
      GCS: gcs.recognition ?? 0,
      "Online Reviews": onlinePillars ? Number(onlinePillars.pillarRecognition) : null,
    },
  ]

  const showChart = hasCache && onlinePillars !== null

  if (isLoading) return null

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-gray-400">
            Online Reputation
          </p>
          {hasCache && (
            <p className="text-xs text-gray-400 mt-0.5">
              Last updated{" "}
              {lastUpdated === 0 ? "today" : `${lastUpdated} day${lastUpdated !== 1 ? "s" : ""} ago`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSetup((v) => !v)}
            className="flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
          >
            <Settings className="h-3 w-3" />
            Setup
          </button>
          {hasSetup && (
            <button
              onClick={handleRefresh}
              disabled={scrapeMutation.isPending || onCooldown}
              className="flex items-center gap-1.5 rounded-md border border-orange-300 bg-white px-2.5 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
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
        <div className="mb-4 rounded-lg border border-dashed border-orange-200 bg-orange-50/50 p-4 space-y-3">
          <p className="text-xs font-medium text-gray-700">
            Enter your property's review page URLs so we can compare your online reputation with your GCS scores.
          </p>
          <div>
            <label className="text-xs font-medium text-gray-600">TripAdvisor URL</label>
            <input
              type="url"
              value={taUrl}
              onChange={(e) => setTaUrl(e.target.value)}
              placeholder="https://www.tripadvisor.co.uk/Restaurant_Review-..."
              className="mt-1 w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-300"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Google Maps URL</label>
            <input
              type="url"
              value={googleId}
              onChange={(e) => setGoogleId(e.target.value)}
              placeholder="https://www.google.com/maps/place/Your+Business+Name/..."
              className="mt-1 w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-300"
            />
            <div className="mt-2 rounded-md bg-blue-50 border border-blue-100 px-3 py-2 space-y-1">
              <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wide">How to find your Google Maps URL</p>
              <ol className="space-y-0.5 text-[11px] text-blue-700 list-none">
                <li>1. Open <span className="font-semibold">Google Maps</span> in your browser</li>
                <li>2. Search for your property by name</li>
                <li>3. Click on your listing in the results</li>
                <li>4. Copy the URL from your browser's address bar</li>
                <li>5. Paste it into the field above</li>
              </ol>
            </div>
          </div>
          <button
            onClick={handleSaveSources}
            disabled={saveMutation.isPending}
            className="rounded-md bg-orange-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {saveMutation.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      )}

      {/* No setup yet */}
      {!hasSetup && !showSetup && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-gray-400">
            Connect your TripAdvisor and Google listings to compare your online reputation with your GCS scores.
          </p>
          <button
            onClick={() => setShowSetup(true)}
            className="mt-3 rounded-md border border-orange-300 px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-50"
          >
            Get started
          </button>
        </div>
      )}

      {/* Setup done but no data yet */}
      {hasSetup && !hasCache && !showSetup && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-gray-400">
            Click "Refresh Reviews" to pull in your latest online reviews and generate a comparison.
          </p>
        </div>
      )}

      {/* Comparison chart */}
      {showChart && (
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "#6b7280" }} />
              <Radar
                name="GCS Score"
                dataKey="GCS"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.25}
              />
              <Radar
                name="Online Reviews"
                dataKey="Online Reviews"
                stroke="#f97316"
                fill="#f97316"
                fillOpacity={0.15}
              />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 11 }}
                formatter={(v: unknown) =>
                  typeof v === "number" ? v.toFixed(1) : (String(v) as string)
                }
              />
            </RadarChart>
          </ResponsiveContainer>

          <div className="flex flex-col gap-3 justify-center min-w-[140px]">
            {data?.tripadvisor && (
              <div className="rounded-lg border p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                  TripAdvisor
                </p>
                <StarRating value={Number(data.tripadvisor.avgRating)} />
                <p className="text-xs text-gray-400 mt-0.5">
                  {data.tripadvisor.reviewCount} reviews
                </p>
              </div>
            )}
            {data?.google && (
              <div className="rounded-lg border p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                  Google
                </p>
                <StarRating value={Number(data.google.avgRating)} />
                <p className="text-xs text-gray-400 mt-0.5">
                  {data.google.reviewCount} reviews
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
