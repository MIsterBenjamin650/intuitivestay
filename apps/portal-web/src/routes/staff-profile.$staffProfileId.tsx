// apps/portal-web/src/routes/staff-profile.$staffProfileId.tsx
import { cn } from "@intuitive-stay/ui/lib/utils"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { CheckIcon, CopyIcon, LockIcon, ShieldCheckIcon } from "lucide-react"
import { useEffect, useState } from "react"

import { useTRPC, useTRPCClient } from "@/utils/trpc"

export const Route = createFileRoute("/staff-profile/$staffProfileId")({
  validateSearch: (search: Record<string, unknown>) => ({
    activated: search.activated === "true" || search.activated === true,
  }),
  component: StaffProfilePage,
})

function PillarBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round((value / 10) * 100)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{value.toFixed(1)}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-orange-500 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function StaffProfilePage() {
  const { staffProfileId } = Route.useParams()
  const { activated: justPaid } = Route.useSearch()
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()

  const { data, isLoading, isError, error, refetch } = useQuery(
    trpc.staff.getStaffProfile.queryOptions({ staffProfileId }),
  )

  const { data: commendations } = useQuery(
    trpc.staff.getCommendations.queryOptions({ staffProfileId }),
  )

  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [copied, setCopied] = useState(false)

  const isActivated = !!data?.activatedAt
  const tierScore = data ? Math.round(data.avgGcs * 10) : 0
  const passportUrl = `${window.location.origin}/passport/${staffProfileId}`

  // If user just returned from Stripe but webhook hasn't fired yet,
  // refetch once after 3 seconds to pick up the activation.
  useEffect(() => {
    if (justPaid && !isActivated) {
      const t = setTimeout(() => void refetch(), 3000)
      return () => clearTimeout(t)
    }
  }, [justPaid, isActivated, refetch])

  async function handleUnlock() {
    if (isCheckingOut) return
    setIsCheckingOut(true)
    try {
      const result = await trpcClient.staff.createStaffActivationCheckout.mutate({ staffProfileId })
      window.location.href = result.checkoutUrl
    } catch {
      setIsCheckingOut(false)
    }
  }

  function handleCopy() {
    void navigator.clipboard.writeText(passportUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading your profile…</p>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center space-y-2">
          <ShieldCheckIcon className="mx-auto size-8 text-muted-foreground/40" />
          <p className="font-semibold">Profile not found</p>
          <p className="text-sm text-muted-foreground">
            {error?.message ?? "This profile does not exist or the link is incorrect."}
          </p>
          <Link
            to="/staff-login"
            className="text-xs text-orange-500 hover:text-orange-600 underline underline-offset-2"
          >
            Recover your profile link →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-sm space-y-6">

        {/* Payment success banner */}
        {justPaid && (
          <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 text-center">
            🎉 Payment successful! Your Service Signature is now unlocked.
          </div>
        )}

        {/* Header — matches passport */}
        <div className="text-center space-y-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            IntuitiveStay · Service Signature
          </p>
          <div className="flex justify-center">
            <div className="rounded-full bg-orange-100 p-3">
              <ShieldCheckIcon className="size-8 text-orange-500" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold">{data.name}</h1>
            {data.role && <p className="text-xs text-muted-foreground italic">{data.role}</p>}
            <p className="text-sm text-muted-foreground">{data.propertyName}</p>
          </div>
          {data.emailVerifiedAt && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
              <span className="size-1.5 rounded-full bg-green-500" />
              Verified
            </div>
          )}
        </div>

        {/* Stats card — blurred when not activated */}
        <div className="relative rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className={cn("p-5 space-y-5", !isActivated && "blur-sm select-none pointer-events-none")}>

            {/* GCS score */}
            <div className="text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                Guest Connection Score
              </p>
              <p className="text-5xl font-black text-orange-500">
                {data.nominations > 0 ? tierScore : "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.nominations > 0 ? "/ 100" : "No data yet"}
              </p>
            </div>

            <div className="border-t border-border" />

            {/* Nominations */}
            <div className="text-center">
              <p className="text-3xl font-bold">{data.nominations}</p>
              <p className="text-xs text-muted-foreground">
                {data.nominations === 1 ? "Guest nomination" : "Guest nominations"}
              </p>
            </div>

            {data.nominations > 0 && (
              <>
                <div className="border-t border-border" />

                {/* Pillar breakdown */}
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground text-center">
                    Pillar Breakdown
                  </p>
                  <PillarBar label="Resilience" value={data.pillarAverages.resilience} />
                  <PillarBar label="Empathy" value={data.pillarAverages.empathy} />
                  <PillarBar label="Anticipation" value={data.pillarAverages.anticipation} />
                  <PillarBar label="Recognition" value={data.pillarAverages.recognition} />
                </div>

                <div className="border-t border-border" />

                {/* Performance Insights */}
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground text-center">
                    Performance Insights
                  </p>

                  {/* Score Trend */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Score trend</span>
                    <span className={
                      data.scoreTrend === "up" ? "font-semibold text-green-600"
                      : data.scoreTrend === "down" ? "font-semibold text-red-500"
                      : "font-semibold text-gray-500"
                    }>
                      {data.scoreTrend === "up" ? "↑ Improving" : data.scoreTrend === "down" ? "↓ Declining" : "→ Stable"}
                    </span>
                  </div>

                  {/* Consistency */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Consistency</span>
                    <span className={
                      data.consistencyRating === "Very Consistent" ? "font-semibold text-green-600"
                      : data.consistencyRating === "Variable" ? "font-semibold text-orange-500"
                      : "font-semibold text-gray-500"
                    }>
                      {data.consistencyRating}
                    </span>
                  </div>

                  {/* Peak meal time */}
                  {data.peakMealTime && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Peak meal time</span>
                      <span className="font-semibold capitalize">{data.peakMealTime}</span>
                    </div>
                  )}

                  {/* Nominations per month */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Nominations / month</span>
                    <span className="font-semibold">{data.nominationsPerMonth}</span>
                  </div>

                  {/* Top adjectives */}
                  {data.topAdjectives.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <p className="text-xs text-muted-foreground">Guests describe you as</p>
                      <div className="flex flex-wrap gap-1.5">
                        {data.topAdjectives.map((adj) => (
                          <span
                            key={adj}
                            className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700"
                          >
                            {adj}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Unlock overlay */}
          {!isActivated && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white/60 backdrop-blur-[1px]">
              <div className="text-center space-y-1 px-6">
                <LockIcon className="mx-auto size-6 text-muted-foreground mb-2" />
                <p className="font-bold text-base">Unlock Your Service Signature</p>
                <p className="text-xs text-muted-foreground">
                  One-time fee — lifetime access. Your stats and shareable passport link unlock instantly.
                </p>
              </div>
              <button
                type="button"
                onClick={handleUnlock}
                disabled={isCheckingOut}
                className="rounded-xl bg-orange-500 px-6 py-3 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60 transition-colors shadow-md"
              >
                {isCheckingOut ? "Redirecting to payment…" : "Unlock Now — £9.99"}
              </button>
            </div>
          )}
        </div>

        {/* Commendations — only shown when activated and there are entries */}
        {isActivated && commendations && commendations.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground text-center">
              Manager Commendations
            </p>
            {commendations.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border bg-white shadow-sm p-4 space-y-2"
              >
                <p className="text-sm text-foreground leading-relaxed">"{c.body}"</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium">{c.authorName} · {c.propertyName}</span>
                  <span>
                    {new Date(c.createdAt).toLocaleDateString("en-GB", {
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Shareable link — only when activated */}
        {isActivated && (
          <div className="rounded-xl border bg-white shadow-sm p-5 space-y-3">
            <div>
              <p className="font-semibold text-sm">Your Shareable Passport Link</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Share this link with employers. It shows your verified guest feedback stats.
              </p>
            </div>
            <div className="flex gap-2">
              <input
                readOnly
                value={passportUrl}
                className="flex-1 rounded-lg border border-border bg-gray-50 px-3 py-2 text-xs font-mono text-gray-700 outline-none"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium hover:bg-gray-50 transition-colors"
              >
                {copied ? (
                  <CheckIcon className="size-3.5 text-green-600" />
                ) : (
                  <CopyIcon className="size-3.5" />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {/* Footer — login recovery link */}
        <p className="text-center text-xs text-muted-foreground">
          Lost your profile link?{" "}
          <Link
            to="/staff-login"
            className="text-orange-500 hover:text-orange-600 underline underline-offset-2"
          >
            Send it to your email
          </Link>
        </p>

      </div>
    </div>
  )
}
