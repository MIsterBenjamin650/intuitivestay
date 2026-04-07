import { cn } from "@intuitive-stay/ui/lib/utils"
import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"

import { useTRPC, useTRPCClient } from "@/utils/trpc"

export const Route = createFileRoute("/f/$uniqueCode")({
  component: FeedbackPage,
})

type Step = "form" | "name-drop" | "vent-box" | "thank-you"
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
  // Formula: keeps the tooltip centred over the thumb at both extremes.
  // thumbWidth ≈ 20px → offset = 10 - value*2
  const tooltipLeft = `calc(${fillPercent}% + ${10 - value * 2}px)`

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      <div className="relative pt-9 pb-4">
        {/* Floating tooltip bubble */}
        <div
          className="absolute top-0 pointer-events-none"
          style={{ left: tooltipLeft, transform: "translateX(-50%)" }}
        >
          <div className="bg-primary text-primary-foreground text-xs font-medium px-2.5 py-1 rounded whitespace-nowrap shadow-sm">
            {touched ? RATING_LABELS[value] : "Drag to rate"}
          </div>
          {/* Caret arrow */}
          <div
            className="mx-auto w-0 h-0"
            style={{
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: "5px solid var(--primary)",
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
            background: `linear-gradient(to right, var(--primary) ${fillPercent}%, var(--muted) ${fillPercent}%)`,
          }}
        />

        {/* Tick labels */}
        <div className="flex justify-between mt-1.5 text-xs text-muted-foreground select-none">
          <span>0</span>
          <span>5</span>
          <span>10</span>
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

  const [step, setStep] = useState<Step>("form")
  const [feedbackId, setFeedbackId] = useState<string | null>(null)

  // Form state — sliders start at midpoint
  const [resilience, setResilience] = useState(5)
  const [empathy, setEmpathy] = useState(5)
  const [anticipation, setAnticipation] = useState(5)
  const [recognition, setRecognition] = useState(5)
  const [mealTime, setMealTime] = useState<MealTime>("none")

  // Touched tracking — submit is disabled until every slider has been moved at least once
  const [resilienceTouched, setResilienceTouched] = useState(false)
  const [empathyTouched, setEmpathyTouched] = useState(false)
  const [anticipationTouched, setAnticipationTouched] = useState(false)
  const [recognitionTouched, setRecognitionTouched] = useState(false)

  // Name Drop / Vent Box input state
  const [staffName, setStaffName] = useState("")
  const [ventText, setVentText] = useState("")

  const submitFeedback = useMutation({
    mutationFn: () =>
      trpcClient.feedback.submitFeedback.mutate({
        uniqueCode,
        resilience,
        empathy,
        anticipation,
        recognition,
        mealTime,
      }),
    onSuccess: ({ feedbackId: id, gcs }) => {
      setFeedbackId(id)
      if (gcs >= 8) setStep("name-drop")
      else if (gcs <= 5) setStep("vent-box")
      else setStep("thank-you")
    },
  })

  const submitNameDrop = useMutation({
    mutationFn: () =>
      trpcClient.feedback.submitNameDrop.mutate({
        feedbackId: feedbackId!,
        uniqueCode,
        staffName,
      }),
    onSuccess: () => setStep("thank-you"),
  })

  const submitVentText = useMutation({
    mutationFn: () =>
      trpcClient.feedback.submitVentText.mutate({
        feedbackId: feedbackId!,
        uniqueCode,
        text: ventText,
      }),
    onSuccess: () => setStep("thank-you"),
  })

  const allRated =
    resilienceTouched && empathyTouched && anticipationTouched && recognitionTouched

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

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            IntuItiveStay
          </p>
          <h1 className="text-xl font-bold">{data?.propertyName}</h1>
        </div>

        {/* ─── Step: Form ─── */}
        {step === "form" && (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground text-center">
              How was your experience? Drag each slider to rate from 0–10.
            </p>

            {/* Meal time — at the top */}
            <div className="space-y-2">
              <p className="text-sm font-semibold">Meal time (optional)</p>
              <div className="flex gap-2 flex-wrap">
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

            <button
              type="button"
              onClick={() => submitFeedback.mutate()}
              disabled={!allRated || submitFeedback.isPending}
              className={cn(
                "w-full py-3 rounded-lg font-semibold text-sm transition-colors",
                allRated && !submitFeedback.isPending
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed",
              )}
            >
              {submitFeedback.isPending ? "Submitting…" : "Submit Feedback"}
            </button>

            {submitFeedback.isError && (
              <p className="text-sm text-destructive text-center">
                Something went wrong. Please try again.
              </p>
            )}
          </div>
        )}

        {/* ─── Step: Name Drop™ ─── */}
        {step === "name-drop" && (
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <h2 className="text-lg font-bold">Who made your stay exceptional?</h2>
              <p className="text-sm text-muted-foreground">
                If a team member went above and beyond, let us know their name so we can
                recognise them.
              </p>
            </div>
            <input
              type="text"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              placeholder="Staff member's name (optional)"
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              maxLength={100}
            />
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => submitNameDrop.mutate()}
                disabled={!staffName.trim() || submitNameDrop.isPending}
                className={cn(
                  "w-full py-3 rounded-lg font-semibold text-sm transition-colors",
                  staffName.trim() && !submitNameDrop.isPending
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground cursor-not-allowed",
                )}
              >
                {submitNameDrop.isPending ? "Sending…" : "Send Recognition"}
              </button>
              <button
                type="button"
                onClick={() => setStep("thank-you")}
                className="w-full py-3 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {/* ─── Step: Vent Box™ ─── */}
        {step === "vent-box" && (
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <h2 className="text-lg font-bold">We're sorry to hear that.</h2>
              <p className="text-sm text-muted-foreground">
                Would you like to share more privately? Your message goes directly to the
                property owner — not a public review.
              </p>
            </div>
            <textarea
              value={ventText}
              onChange={(e) => setVentText(e.target.value)}
              placeholder="Tell us what went wrong (optional)"
              rows={4}
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
              maxLength={2000}
            />
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => submitVentText.mutate()}
                disabled={!ventText.trim() || submitVentText.isPending}
                className={cn(
                  "w-full py-3 rounded-lg font-semibold text-sm transition-colors",
                  ventText.trim() && !submitVentText.isPending
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground cursor-not-allowed",
                )}
              >
                {submitVentText.isPending ? "Sending…" : "Send Privately"}
              </button>
              <button
                type="button"
                onClick={() => setStep("thank-you")}
                className="w-full py-3 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {/* ─── Step: Thank You ─── */}
        {step === "thank-you" && (
          <div className="text-center space-y-4 py-8">
            <div className="text-5xl">🙏</div>
            <h2 className="text-xl font-bold">Thank you for your feedback!</h2>
            <p className="text-sm text-muted-foreground">
              Your response has been recorded. It helps us improve the experience for every
              guest.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
