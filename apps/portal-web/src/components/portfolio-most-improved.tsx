// apps/portal-web/src/components/portfolio-most-improved.tsx

type MostImproved = {
  name: string
  city: string
  type: string | null
  previousGcs: number
  currentGcs: number
  delta: number
  cityRank: number | null
  cityTotal: number | null
}

interface Props {
  mostImproved: MostImproved
}

export function PortfolioMostImproved({ mostImproved }: Props) {
  const { name, city, previousGcs, currentGcs, delta, cityRank, cityTotal } = mostImproved

  return (
    <div
      className="rounded-xl px-5 py-4 flex items-center justify-between"
      style={{ background: "linear-gradient(135deg,#1c1917,#292524)" }}
    >
      <div>
        <p
          className="text-[8px] font-bold uppercase tracking-[0.1em] mb-1.5"
          style={{ color: "#f97316" }}
        >
          🚀 Most Improved This Month
        </p>
        <p className="text-[16px] font-black text-white">{name}</p>
        <p className="text-[9px] mt-0.5" style={{ color: "#9ca3af" }}>
          {city} · GCS {previousGcs.toFixed(1)} → {currentGcs.toFixed(1)}
          {cityRank != null && cityTotal != null && ` · Now #${cityRank} in city`}
        </p>
      </div>
      <div className="text-right">
        <p className="text-[32px] font-black leading-none" style={{ color: "#f97316" }}>
          +{delta.toFixed(1)}
        </p>
        <p className="text-[9px] mt-0.5" style={{ color: "#9ca3af" }}>
          vs last month
        </p>
      </div>
    </div>
  )
}
