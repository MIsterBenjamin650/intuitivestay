import { cn } from "@intuitive-stay/ui/lib/utils"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"

import { useTRPC, useTRPCClient } from "@/utils/trpc"

export const Route = createFileRoute("/f/$uniqueCode")({
  component: FeedbackPage,
})

type MealTime = "breakfast" | "lunch" | "dinner" | "none"

const RATING_LABELS: Record<number, string> = {
  0: "Very Poor",
  1: "Poor",
  2: "Below Average",
  3: "Disappointing",
  4: "Fair",
  5: "Mediocre",
  6: "Decent",
  7: "Good",
  8: "Great",
  9: "Excellent",
  10: "Magical",
}

const ADJECTIVES = [
  "Attentive", "Calming", "Charming", "Clean", "Comfortable",
  "Cosy", "Delightful", "Efficient", "Elegant", "Exceptional",
  "Friendly", "Generous", "Helpful", "Homely", "Immaculate",
  "Inviting", "Luxurious", "Memorable", "Outstanding", "Peaceful",
  "Personal", "Professional", "Relaxing", "Romantic", "Seamless",
  "Thoughtful", "Tranquil", "Unique", "Warm", "Welcoming",
]

type ColorScheme = {
  selected: string
  unselected: string
}

const COLOR_SCHEMES: ColorScheme[] = [
  {
    selected: "bg-orange-500 text-white border-orange-500",
    unselected: "border-orange-300 text-orange-600 hover:bg-orange-50",
  },
  {
    selected: "bg-blue-500 text-white border-blue-500",
    unselected: "border-blue-300 text-blue-600 hover:bg-blue-50",
  },
  {
    selected: "bg-green-500 text-white border-green-500",
    unselected: "border-green-300 text-green-600 hover:bg-green-50",
  },
  {
    selected: "bg-purple-500 text-white border-purple-500",
    unselected: "border-purple-300 text-purple-600 hover:bg-purple-50",
  },
  {
    selected: "bg-pink-500 text-white border-pink-500",
    unselected: "border-pink-300 text-pink-600 hover:bg-pink-50",
  },
  {
    selected: "bg-teal-500 text-white border-teal-500",
    unselected: "border-teal-300 text-teal-600 hover:bg-teal-50",
  },
]

function SliderInput({
  label,
  description,
  value,
  touched,
  onChange,
}: {
  label: string
  description: string
  value: number
  touched: boolean
  onChange: (v: number) => void
}) {
  const fillPercent = (value / 10) * 100
  const tooltipLeft = `calc(${fillPercent}% + ${10 - value * 2}px)`

  return (
    <div className="space-y-2">
      <div className="text-center">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      <div className="relative pt-9 pb-4">
        {/* Floating tooltip bubble */}
        <div
          className="absolute top-0 pointer-events-none"
          style={{ left: tooltipLeft, transform: "translateX(-50%)" }}
        >
          <div
            className="text-xs font-medium px-2.5 py-1 rounded whitespace-nowrap shadow-sm"
            style={{ background: '#f97316', color: 'white' }}
          >
            {touched ? RATING_LABELS[value] : "Drag to rate"}
          </div>
          <div
            className="mx-auto w-0 h-0"
            style={{
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: "5px solid #f97316",
            }}
          />
        </div>

        {/* Slider */}
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="is-slider w-full h-2 rounded-full appearance-none cursor-pointer outline-none"
          style={{
            background: `linear-gradient(to right, #f97316 ${fillPercent}%, var(--muted) ${fillPercent}%)`,
            fontFamily: 'Inter, sans-serif',
          }}
        />

        {/* Tick marks */}
        <div className="flex justify-between mt-2 px-[1px]">
          {Array.from({ length: 11 }, (_, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <div className="w-px h-1.5 bg-muted-foreground/40" />
              <span className="text-[9px] text-muted-foreground/60">{i}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FeedbackPage() {
  const { uniqueCode } = Route.useParams()
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()

  const { data, isLoading, isError } = useQuery(
    trpc.feedback.getFeedbackFormData.queryOptions({ uniqueCode }),
  )

  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(false)

  // Sliders — start at midpoint
  const [resilience, setResilience] = useState(5)
  const [empathy, setEmpathy] = useState(5)
  const [anticipation, setAnticipation] = useState(5)
  const [recognition, setRecognition] = useState(5)
  const [mealTime, setMealTime] = useState<MealTime | null>(null)

  // Touched tracking — all four must be moved before phase 2 is revealed
  const [resilienceTouched, setResilienceTouched] = useState(false)
  const [empathyTouched, setEmpathyTouched] = useState(false)
  const [anticipationTouched, setAnticipationTouched] = useState(false)
  const [recognitionTouched, setRecognitionTouched] = useState(false)

  // Phase 2 reveal state (driven by useEffect for smooth animation)
  const [phase2Visible, setPhase2Visible] = useState(false)

  // Adjectives cloud
  const [selectedAdjectives, setSelectedAdjectives] = useState<string[]>([])

  // Optional staff names (up to 3)
  const [staffName1, setStaffName1] = useState("")
  const [staffName2, setStaffName2] = useState("")
  const [staffName3, setStaffName3] = useState("")

  // Private message / vent text
  const [ventText, setVentText] = useState("")

  // Optional guest email
  const [guestEmail, setGuestEmail] = useState("")

  const allRated =
    resilienceTouched && empathyTouched && anticipationTouched && recognitionTouched

  const canSubmit = allRated && mealTime !== null

  // Real-time GCS average — used to adapt the form layout
  const gcs = (resilience + empathy + anticipation + recognition) / 4
  const isLowScore = gcs <= 5

  // Reveal phase 2 smoothly once all sliders are touched
  useEffect(() => {
    if (allRated) {
      setPhase2Visible(true)
    }
  }, [allRated])

  // Scroll phase 2 into view when it first appears
  const phase2Ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (phase2Visible) {
      setTimeout(() => {
        phase2Ref.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 150)
    }
  }, [phase2Visible])

  function toggleAdjective(adj: string) {
    setSelectedAdjectives((prev) =>
      prev.includes(adj) ? prev.filter((a) => a !== adj) : [...prev, adj],
    )
  }

  async function handleSubmit() {
    if (!allRated || !mealTime || isSubmitting) return
    setIsSubmitting(true)
    setSubmitError(false)
    try {
      // 1. Submit core feedback
      const { feedbackId } = await trpcClient.feedback.submitFeedback.mutate({
        uniqueCode,
        resilience,
        empathy,
        anticipation,
        recognition,
        mealTime,
        guestEmail: guestEmail.trim() || undefined,
        adjectives: selectedAdjectives.length > 0 ? selectedAdjectives.join(',') : undefined,
      })

      // 2. Submit any staff name recognitions (high score path only)
      if (!isLowScore) {
        const names = [staffName1, staffName2, staffName3].filter((n) => n.trim())
        for (const staffName of names) {
          await trpcClient.feedback.submitNameDrop.mutate({
            feedbackId,
            uniqueCode,
            staffName: staffName.trim(),
          })
        }
      }

      // 3. Submit vent text if provided
      if (ventText.trim()) {
        await trpcClient.feedback.submitVentText.mutate({
          feedbackId,
          uniqueCode,
          text: ventText.trim(),
        })
      }

      setSubmitted(true)
    } catch {
      setSubmitError(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="font-semibold">Invalid feedback link</p>
          <p className="text-sm text-muted-foreground">
            This QR code is not recognised. Please ask staff for a new one.
          </p>
        </div>
      </div>
    )
  }

  // ─── Thank You ───
  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4 px-6">
          <div className="text-5xl">🙏</div>
          <h2 className="text-xl font-bold">Thank you for your feedback!</h2>
          <p className="text-sm text-muted-foreground">
            Your response has been recorded. It helps us improve the experience for every
            guest.
          </p>
        </div>
      </div>
    )
  }

  // ─── Main Form ───
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-4 py-8 space-y-6">

        {/* ── Header ── */}
        <div className="text-center space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            IntuitiveStay
          </p>
          <h1 className="text-xl font-bold">{data?.propertyName}</h1>
        </div>

        <p className="text-sm text-muted-foreground text-center">
          How was your experience? Drag each slider to rate from 0–10.
        </p>

        {/* ── Phase 1: Meal time ── */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-center">When did you visit?</p>
          <div className="flex gap-2 flex-wrap justify-center">
            {(["breakfast", "lunch", "dinner", "none"] as MealTime[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMealTime(m)}
                className={cn(
                  "px-4 py-2 rounded-md text-sm border capitalize transition-colors",
                  mealTime === m
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border hover:bg-muted",
                )}
              >
                {m === "none" ? "Entire Stay" : m}
              </button>
            ))}
          </div>
        </div>

        {/* ── Phase 1: Sliders ── */}
        <SliderInput
          label="Resilience"
          description="How well did staff handle problems or complaints?"
          value={resilience}
          touched={resilienceTouched}
          onChange={(v) => {
            setResilience(v)
            setResilienceTouched(true)
          }}
        />
        <SliderInput
          label="Empathy"
          description="Did staff make you feel genuinely cared for?"
          value={empathy}
          touched={empathyTouched}
          onChange={(v) => {
            setEmpathy(v)
            setEmpathyTouched(true)
          }}
        />
        <SliderInput
          label="Anticipation"
          description="Did staff anticipate your needs before you had to ask?"
          value={anticipation}
          touched={anticipationTouched}
          onChange={(v) => {
            setAnticipation(v)
            setAnticipationTouched(true)
          }}
        />
        <SliderInput
          label="Recognition"
          description="Did staff remember your preferences or make you feel valued?"
          value={recognition}
          touched={recognitionTouched}
          onChange={(v) => {
            setRecognition(v)
            setRecognitionTouched(true)
          }}
        />

        {/* ── Phase 2: Smooth reveal wrapper ── */}
        <div
          ref={phase2Ref}
          className={`transition-all duration-500 ease-out ${
            phase2Visible
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
        >
          <div className="space-y-6">

            <div className="border-t border-border" />

            {/* ── LOW SCORE PATH (GCS ≤ 5) ── */}
            {isLowScore && (
              <div className="space-y-3">
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-center">
                    Give us the opportunity to make it right
                  </p>
                  <p className="text-xs text-muted-foreground text-center">
                    Your message goes directly to the property owner — not a public review.
                    This field is optional.
                  </p>
                </div>
                <textarea
                  value={ventText}
                  onChange={(e) => setVentText(e.target.value)}
                  placeholder="Share your thoughts…"
                  rows={4}
                  className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
                  maxLength={2000}
                />
                <input
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="Your email (optional — if you'd like a response)"
                  className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}

            {/* ── HIGH SCORE PATH (GCS > 5) ── */}
            {!isLowScore && (
              <div className="space-y-6">

                {/* Adjective cloud */}
                <div className="space-y-3">
                  <div className="text-center space-y-1">
                    <p className="text-sm font-semibold text-center">
                      How would you describe your stay?
                    </p>
                    <p className="text-xs text-muted-foreground text-center">
                      Select all that apply — no limit.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {ADJECTIVES.map((adj, i) => {
                      const scheme = COLOR_SCHEMES[i % COLOR_SCHEMES.length]
                      const isSelected = selectedAdjectives.includes(adj)
                      return (
                        <button
                          key={adj}
                          type="button"
                          onClick={() => toggleAdjective(adj)}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                            isSelected ? scheme.selected : scheme.unselected,
                          )}
                        >
                          {adj}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="border-t border-border" />

                {/* Staff names */}
                <div className="space-y-3">
                  <div className="text-center space-y-1">
                    <p className="text-sm font-semibold text-center">
                      Did any particular staff members stand out?
                      <span className="ml-2 text-xs font-normal text-muted-foreground">(Optional)</span>
                    </p>
                    <p className="text-xs text-muted-foreground text-center">
                      Did someone go above and beyond? Let us know their name.
                    </p>
                  </div>
                  <div className="space-y-2 flex flex-col items-center">
                    <input
                      type="text"
                      value={staffName1}
                      onChange={(e) => setStaffName1(e.target.value)}
                      placeholder="Staff member's name"
                      className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      maxLength={100}
                    />
                    <input
                      type="text"
                      value={staffName2}
                      onChange={(e) => setStaffName2(e.target.value)}
                      placeholder="Staff member's name"
                      className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      maxLength={100}
                    />
                    <input
                      type="text"
                      value={staffName3}
                      onChange={(e) => setStaffName3(e.target.value)}
                      placeholder="Staff member's name"
                      className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      maxLength={100}
                    />
                  </div>
                </div>

                <div className="border-t border-border" />

                {/* Private message */}
                <div className="space-y-3">
                  <div className="text-center space-y-1">
                    <p className="text-sm font-semibold text-center">
                      Anything else you'd like to share?
                      <span className="ml-2 text-xs font-normal text-muted-foreground">(Optional)</span>
                    </p>
                    <p className="text-xs text-muted-foreground text-center">
                      Your message goes directly to the property owner — not a public review.
                    </p>
                  </div>
                  <textarea
                    value={ventText}
                    onChange={(e) => setVentText(e.target.value)}
                    placeholder="Share your thoughts…"
                    rows={4}
                    className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
                    maxLength={2000}
                  />
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="Your email (optional — if you'd like a response)"
                    className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

              </div>
            )}

            {/* ── Submit ── */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className={cn(
                "w-full py-3 rounded-lg font-semibold text-sm transition-colors",
                canSubmit && !isSubmitting
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed",
              )}
            >
              {isSubmitting ? "Submitting…" : "Submit Feedback"}
            </button>

            {submitError && (
              <p className="text-sm text-destructive text-center">
                Something went wrong. Please try again.
              </p>
            )}

          </div>
        </div>

        {/* Bottom padding for mobile */}
        <div className="h-4" />
      </div>
    </div>
  )
}
