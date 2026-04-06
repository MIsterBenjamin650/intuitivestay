import { env } from "@intuitive-stay/env/web"

const PLANS = [
  {
    key: "host" as const,
    name: "Host",
    price: "Contact us",
    trial: "30-day free trial",
    trialBadgeStyle: "bg-green-50 text-green-700 border border-green-200",
    popular: false,
    features: [
      "GCS Over Time chart",
      "Pillar Averages radar",
      "Pillar Spotlight",
      "Total Submissions stat",
      "Staff Tag Cloud",
      "Last 7 days of data",
    ],
    locked: [
      "Score Distribution",
      "GCS by Meal Time",
      "City Leaderboard",
    ],
    buttonText: "Start free trial",
    buttonStyle: "border border-indigo-500 text-indigo-600 hover:bg-indigo-50",
    urlKey: "host" as const,
  },
  {
    key: "partner" as const,
    name: "Partner",
    price: "Contact us",
    trial: "14-day free trial",
    trialBadgeStyle: "bg-green-50 text-green-700 border border-green-200",
    popular: true,
    features: [
      "Everything in Host",
      "Last 30 days of data",
      "Score Distribution",
      "GCS by Meal Time",
      "Submissions per Week",
      "Engagement Stats",
      "City Leaderboard",
    ],
    locked: [
      "Vent Keyword Cloud",
      "Multi-property overview",
    ],
    buttonText: "Start free trial",
    buttonStyle: "bg-indigo-500 text-white hover:bg-indigo-600",
    urlKey: "partner" as const,
  },
  {
    key: "founder" as const,
    name: "Founder",
    price: "Contact us",
    trial: "No free trial",
    trialBadgeStyle: "bg-slate-50 text-slate-400 border border-slate-200",
    popular: false,
    features: [
      "Everything in Partner",
      "Up to 365 days of data",
      "Vent Keyword Cloud",
      "Within-city ranking",
      "Multi-property overview",
    ],
    locked: [],
    buttonText: "Subscribe now",
    buttonStyle: "bg-slate-900 text-white hover:bg-slate-800",
    urlKey: "founder" as const,
  },
]

const PLAN_URLS: Record<"host" | "partner" | "founder", string> = {
  host: env.VITE_WIX_PLAN_URL_HOST,
  partner: env.VITE_WIX_PLAN_URL_PARTNER,
  founder: env.VITE_WIX_PLAN_URL_FOUNDER,
}

export function ChoosePlan() {
  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center px-6 py-12">
      <div className="mb-10 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Choose your plan</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your property has been approved. Select a plan to access your dashboard.
        </p>
      </div>

      <div className="grid w-full max-w-4xl grid-cols-1 gap-5 md:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.key}
            className={`relative flex flex-col rounded-xl border bg-card p-6 shadow-sm ${
              plan.popular ? "border-indigo-500 ring-1 ring-indigo-500" : "border-border"
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-500 px-3 py-0.5 text-[11px] font-semibold text-white">
                Most popular
              </div>
            )}

            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {plan.name}
            </p>
            <p className="mt-1 text-2xl font-bold">{plan.price}</p>

            <span
              className={`mt-2 inline-block w-fit rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${plan.trialBadgeStyle}`}
            >
              {plan.trial}
            </span>

            <hr className="my-4 border-border" />

            <ul className="mb-6 flex-1 space-y-2">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                  <span className="font-bold text-indigo-500">✓</span>
                  {f}
                </li>
              ))}
              {plan.locked.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground/50">
                  <span className="text-[11px]">🔒</span>
                  {f}
                </li>
              ))}
            </ul>

            <a
              href={PLAN_URLS[plan.urlKey]}
              target="_blank"
              rel="noopener noreferrer"
              className={`block w-full rounded-lg py-2.5 text-center text-sm font-semibold transition-colors ${plan.buttonStyle}`}
            >
              {plan.buttonText}
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}
