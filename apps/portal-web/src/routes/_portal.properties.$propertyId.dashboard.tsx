import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { useTRPC } from "@/utils/trpc"

export const Route = createFileRoute(
  "/_portal/properties/$propertyId/dashboard",
)({
  component: RouteComponent,
})

type StatColor = "indigo" | "teal" | "orange" | "purple"

const COLOR_VALUES: Record<StatColor, string> = {
  indigo: "#6366f1",
  teal:   "#14b8a6",
  orange: "#f97316",
  purple: "#8b5cf6",
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub?: string
  color: StatColor
}) {
  const c = COLOR_VALUES[color]
  return (
    <div
      className="rounded-xl bg-white p-4 shadow-sm"
      style={{ borderLeft: `5px solid ${c}` }}
    >
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-[#9ca3af]">
        {label}
      </p>
      <p
        className="text-[28px] font-extrabold leading-none tracking-tight"
        style={{ color: c }}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-1 text-[11px] font-medium text-[#9ca3af]">{sub}</p>
      )}
    </div>
  )
}

function PillarCard({
  label,
  score,
  color,
}: {
  label: string
  score: number | null
  color: StatColor
}) {
  const c = COLOR_VALUES[color]
  const pct = score != null ? Math.round((score / 10) * 100) : 0
  return (
    <div className="rounded-xl bg-white p-4 text-center shadow-sm">
      <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-[#9ca3af]">
        {label}
      </p>
      <div className="mb-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[#f3f4f6]">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: c }}
        />
      </div>
      <p
        className="text-[24px] font-extrabold leading-none tracking-tight"
        style={{ color: c }}
      >
        {score != null ? score.toFixed(2) : "—"}
      </p>
    </div>
  )
}

function RouteComponent() {
  const { propertyId } = Route.useParams()
  const trpc = useTRPC()
  const { data, isLoading, isError } = useQuery(
    trpc.properties.getPropertyDashboard.queryOptions({ propertyId }),
  )

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>
  }

  if (isError || !data) {
    return (
      <div className="p-6 text-sm text-destructive">
        Failed to load property data.
      </div>
    )
  }

  const statusLabel =
    data.status === "approved"
      ? "Approved ✓"
      : String(data.status).charAt(0).toUpperCase() + String(data.status).slice(1)

  const pillars: { label: string; score: number | null; color: StatColor }[] = [
    { label: "Resilience",   score: data.avgResilience != null   ? Number(data.avgResilience)   : null, color: "indigo"  },
    { label: "Empathy",      score: data.avgEmpathy != null      ? Number(data.avgEmpathy)      : null, color: "teal"    },
    { label: "Anticipation", score: data.avgAnticipation != null ? Number(data.avgAnticipation) : null, color: "purple"  },
    { label: "Recognition",  score: data.avgRecognition != null  ? Number(data.avgRecognition)  : null, color: "orange"  },
  ]

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="GCS Score"
          color="indigo"
          value={data.avgGcs != null ? Number(data.avgGcs).toFixed(2) : "—"}
          sub="Out of 10"
        />
        <StatCard
          label="Total Feedback"
          color="teal"
          value={String(data.totalFeedback)}
          sub="All time submissions"
        />
        <StatCard
          label="Status"
          color="purple"
          value={statusLabel}
          sub={[data.type, data.city].filter(Boolean).join(" · ")}
        />
      </div>

      <div>
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.08em] text-[#9ca3af]">
          Pillar Averages
        </p>
        <div className="grid gap-4 md:grid-cols-4">
          {pillars.map(({ label, score, color }) => (
            <PillarCard key={label} label={label} score={score} color={color} />
          ))}
        </div>
      </div>

      {data.totalFeedback === 0 && (
        <p className="text-sm text-muted-foreground">
          No feedback yet. Share the QR code with guests to start collecting data.
        </p>
      )}
    </div>
  )
}
