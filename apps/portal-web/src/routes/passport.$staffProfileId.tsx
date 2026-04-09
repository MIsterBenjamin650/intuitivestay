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

  const { data, isLoading, isError } = useQuery(
    trpc.staff.getStaffProfile.queryOptions({ staffProfileId }),
  )

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="font-semibold">Passport not found</p>
          <p className="text-sm text-muted-foreground">
            This passport does not exist or the link is incorrect.
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
            </>
          )}
        </div>

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
