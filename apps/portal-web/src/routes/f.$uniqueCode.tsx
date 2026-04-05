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

function RatingInput({
  label,
  description,
  value,
  onChange,
}: {
  label: string
  description: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex gap-1 flex-wrap">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              "h-10 w-10 rounded-md text-sm font-medium border transition-colors",
              value === n
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border hover:bg-muted",
            )}
          >
            {n}
          </button>
        ))}
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

  // Form state
  const [resilience, setResilience] = useState(0)
  const [empathy, setEmpathy] = useState(0)
  const [anticipation, setAnticipation] = useState(0)
  const [recognition, setRecognition] = useState(0)
  const [mealTime, setMealTime] = useState<MealTime>("none")

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

  const allRated = resilience > 0 && empathy > 0 && anticipation > 0 && recognition > 0

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
              How was your experience? Rate each area 1–10.
            </p>

            <RatingInput
              label="Resilience"
              description="How well did staff handle problems or complaints?"
              value={resilience}
              onChange={setResilience}
            />
            <RatingInput
              label="Empathy"
              description="Did staff make you feel genuinely cared for?"
              value={empathy}
              onChange={setEmpathy}
            />
            <RatingInput
              label="Anticipation"
              description="Did staff anticipate your needs before you had to ask?"
              value={anticipation}
              onChange={setAnticipation}
            />
            <RatingInput
              label="Recognition"
              description="Did staff remember your preferences or make you feel valued?"
              value={recognition}
              onChange={setRecognition}
            />

            {/* Meal time */}
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
                    {m === "none" ? "N/A" : m}
                  </button>
                ))}
              </div>
            </div>

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
