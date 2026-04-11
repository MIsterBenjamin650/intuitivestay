import { env } from "@intuitive-stay/env/web"
import { useState } from "react"

import { useTRPCClient } from "@/utils/trpc"

const PLANS = [
  {
    key: "host" as const,
    name: "Host",
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
    buttonStyle: "border border-orange-500 text-orange-600 hover:bg-orange-50",
    urlKey: "host" as const,
  },
  {
    key: "partner" as const,
    name: "Partner",
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
    buttonStyle: "bg-orange-500 text-white hover:bg-orange-600",
    urlKey: "partner" as const,
  },
  {
    key: "founder" as const,
    name: "Founder",
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

export function ChoosePlan({ ownerEmail = "" }: { ownerEmail?: string }) {
  const trpcClient = useTRPCClient()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendError, setSendError] = useState(false)

  async function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (sending) return
    setSending(true)
    setSendError(false)
    try {
      await trpcClient.contact.sendMessage.mutate({ name, email, message })
      setSent(true)
      setName("")
      setEmail("")
      setMessage("")
    } catch {
      setSendError(true)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col items-center px-6 py-12">
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
              plan.popular ? "border-orange-500 ring-1 ring-orange-500" : "border-border"
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-orange-500 px-3 py-0.5 text-[11px] font-semibold text-white">
                Most popular
              </div>
            )}

            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {plan.name}
            </p>

            <span
              className={`mt-2 inline-block w-fit rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${plan.trialBadgeStyle}`}
            >
              {plan.trial}
            </span>

            <hr className="my-4 border-border" />

            <ul className="mb-6 flex-1 space-y-2">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                  <span className="font-bold text-orange-500">✓</span>
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
              href={ownerEmail ? `${PLAN_URLS[plan.urlKey]}?prefilled_email=${encodeURIComponent(ownerEmail)}` : PLAN_URLS[plan.urlKey]}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => localStorage.setItem("pendingPayment", "1")}
              className={`block w-full rounded-lg py-2.5 text-center text-sm font-semibold transition-colors ${plan.buttonStyle}`}
            >
              {plan.buttonText}
            </a>
          </div>
        ))}
      </div>

      {/* How it works link */}
      <div className="mt-8 text-center">
        <a
          href="https://www.intuitivestay.com/how-it-works"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-orange-600 hover:underline"
        >
          How does IntuitiveStay work? →
        </a>
      </div>

      {/* Contact form */}
      <div className="mt-10 w-full max-w-md">
        <div className="mb-4 text-center">
          <h2 className="text-base font-semibold">Have a question?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Send us a message and we'll get back to you.
          </p>
        </div>

        {sent ? (
          <div className="rounded-lg border border-green-200 bg-green-50 px-5 py-4 text-center text-sm text-green-700">
            Message sent! We'll be in touch shortly.
          </div>
        ) : (
          <form onSubmit={handleContactSubmit} className="space-y-3">
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="email"
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <textarea
              placeholder="Your message…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={4}
              maxLength={2000}
              className="w-full resize-none rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            {sendError && (
              <p className="text-sm text-destructive">Something went wrong. Please try again.</p>
            )}
            <button
              type="submit"
              disabled={sending}
              className="w-full rounded-lg bg-orange-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send Message"}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
