// apps/portal-web/src/routes/passport.$staffProfileId.tsx
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { ShieldCheckIcon } from "lucide-react"

import { useTRPC } from "@/utils/trpc"

export const Route = createFileRoute("/passport/$staffProfileId")({
  component: PassportPage,
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

function PassportPage() {
  const { staffProfileId } = Route.useParams()
  const trpc = useTRPC()

  const { data, isLoading, isError, error } = useQuery(
    trpc.staff.getStaffProfile.queryOptions({ staffProfileId }),
  )

  const { data: commendations } = useQuery(
    trpc.staff.getCommendations.queryOptions({ staffProfileId }),
  )

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (isError || !data) {
    const isRemoved = error?.message === "This profile is no longer active."
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center space-y-2">
          <ShieldCheckIcon className="mx-auto size-8 text-muted-foreground/40" />
          <p className="font-semibold">
            {isRemoved ? "Passport deactivated" : "Passport not found"}
          </p>
          <p className="text-sm text-muted-foreground">
            {isRemoved
              ? "This Service Signature passport is no longer active."
              : "This passport does not exist or the link is incorrect."}
          </p>
        </div>
      </div>
    )
  }

  if (!data.activatedAt) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center space-y-3">
          <ShieldCheckIcon className="mx-auto size-8 text-muted-foreground/40" />
          <p className="font-semibold">Passport not yet activated</p>
          <p className="text-sm text-muted-foreground">
            This Service Signature passport has not been activated yet.
          </p>
        </div>
      </div>
    )
  }

  const tierScore = Math.round(data.avgGcs * 10)

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-sm space-y-6">

        {/* Header */}
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
          <div className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
            <span className="size-1.5 rounded-full bg-green-500" />
            Verified
          </div>
        </div>

        {/* Stats card */}
        <div className="rounded-xl border bg-white shadow-sm p-5 space-y-5">

          {/* GCS */}
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

              {/* Guest Insights */}
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground text-center">
                  Guest Insights
                </p>

                {/* 2-column grid: nominations/month + consistency */}
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <p className="text-lg font-bold">{data.nominationsPerMonth}</p>
                    <p className="text-xs text-muted-foreground">Noms / month</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <p className={`text-sm font-bold ${data.consistencyRating === "Very Consistent" ? "text-green-600" : data.consistencyRating === "Variable" ? "text-orange-500" : "text-gray-600"}`}>
                      {data.consistencyRating}
                    </p>
                    <p className="text-xs text-muted-foreground">Consistency</p>
                  </div>
                </div>

                {/* Peak meal time */}
                {data.peakMealTime && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Peak meal time</span>
                    <span className="font-semibold capitalize">{data.peakMealTime}</span>
                  </div>
                )}

                {/* Top adjectives */}
                {data.topAdjectives.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <p className="text-xs text-muted-foreground">Guests describe this team member as</p>
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

        {/* Commendations — only shown when there are entries */}
        {commendations && commendations.length > 0 && (
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

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          Active since{" "}
          {new Date(data.activatedAt).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          {" · "}
          Powered by IntuitiveStay
        </p>

      </div>
    </div>
  )
}
