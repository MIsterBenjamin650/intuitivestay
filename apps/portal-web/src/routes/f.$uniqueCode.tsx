import { cn } from "@intuitive-stay/ui/lib/utils"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { ShieldCheckIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { useTRPC, useTRPCClient } from "@/utils/trpc"

export const Route = createFileRoute("/f/$uniqueCode")({
  component: FeedbackPage,
})

type MealTime = "morning" | "lunch" | "dinner" | "none"

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

/**
 * Generates a lightweight device fingerprint from stable browser attributes.
 * This is not cryptographically strong but is sufficient for casual deduplication.
 */
function generateFingerprint(): string {
  const parts = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency ?? 0,
    (navigator as { deviceMemory?: number }).deviceMemory ?? 0,
  ]
  const raw = parts.join("|")
  // Simple hash: sum of char codes mod 2^32, returned as hex
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(16)
}

function ThankYouScreen({
  propertyName,
  nominatedStaff,
  shouldShowReviewPrompt,
  reviewText,
  showGoogle,
  showTripAdvisor,
  googlePlaceId,
  tripAdvisorUrl,
}: {
  propertyName: string
  nominatedStaff: { displayName: string } | null
  shouldShowReviewPrompt: boolean
  reviewText: string
  showGoogle: boolean
  showTripAdvisor: boolean
  googlePlaceId: string | null
  tripAdvisorUrl: string | null
}) {
  const [useSuggested, setUseSuggested] = useState<boolean | null>(null)

  function handleUseSuggested() {
    navigator.clipboard.writeText(reviewText).catch(() => {})
    setUseSuggested(true)
  }

  function handleWriteOwn() {
    setUseSuggested(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="mx-auto max-w-sm w-full space-y-6 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-orange-100 p-4">
            <ShieldCheckIcon className="size-10 text-orange-500" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Thank you!</h2>
          <p className="text-sm text-muted-foreground">
            Your feedback for <span className="font-medium text-foreground">{propertyName}</span> has been recorded.
            It helps us improve the experience for every guest.
          </p>
        </div>
        {nominatedStaff && (
          <div className="rounded-xl bg-orange-50 border border-orange-100 px-5 py-4 space-y-1">
            <p className="text-sm font-semibold text-orange-800">
              Nomination received
            </p>
            <p className="text-sm text-orange-700">
              Your kind words about <span className="font-medium">{nominatedStaff.displayName}</span> have been passed on. They'll be notified.
            </p>
          </div>
        )}

        {/* Review prompt — only when GCS >= threshold and platform links exist */}
        {shouldShowReviewPrompt && (
          <div className="mt-6 rounded-xl border border-orange-200 bg-orange-50 p-5 space-y-4 text-left">
            <div className="text-center space-y-1">
              <p className="font-semibold text-[#1c1917]">Would you like to share your experience?</p>
              <p className="text-sm text-[#78716c]">Help others find great hospitality — it only takes a moment.</p>
            </div>

            {/* Choice — only shown before a selection is made */}
            {useSuggested === null && (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleUseSuggested}
                  className="w-full rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
                >
                  Use our suggested review
                </button>
                <button
                  type="button"
                  onClick={handleWriteOwn}
                  className="w-full rounded-lg bg-white border border-[#e8e3dc] px-4 py-3 text-sm font-semibold text-[#1c1917] hover:bg-gray-50 transition-colors"
                >
                  I'd prefer to write my own
                </button>
              </div>
            )}

            {/* Suggested review — shown after choosing "use suggested" */}
            {useSuggested === true && (
              <div className="space-y-3">
                <div className="rounded-lg bg-white border border-orange-100 px-4 py-3 text-sm text-[#44403c] italic leading-relaxed">
                  "{reviewText}"
                </div>
                <p className="text-xs text-center text-green-600 font-medium">✓ Copied to clipboard — just paste it in</p>
              </div>
            )}

            {/* Write own — just a short nudge */}
            {useSuggested === false && (
              <p className="text-xs text-center text-[#78716c]">Tell them in your own words — tap a platform below to get started.</p>
            )}

            {/* Platform buttons — shown once a choice is made */}
            {useSuggested !== null && (
            <div className="flex flex-col gap-2">
              {showGoogle && googlePlaceId && (
                <a
                  href={googlePlaceId}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-lg bg-white border border-[#e8e3dc] px-4 py-3 text-sm font-semibold text-[#1c1917] hover:bg-gray-50 transition-colors shadow-sm"
                >
                  <svg className="size-4" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Post to Google Reviews
                </a>
              )}
              {showTripAdvisor && tripAdvisorUrl && (
                <a
                  href={tripAdvisorUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-lg bg-white border border-[#e8e3dc] px-4 py-3 text-sm font-semibold text-[#1c1917] hover:bg-gray-50 transition-colors shadow-sm"
                >
                  <svg className="size-4" viewBox="0 0 24 24" fill="#00AF87">
                    <circle cx="12" cy="12" r="12"/>
                    <path d="M12 7C9.24 7 6.8 8.28 5.24 10.31L3 9l1.5 3.5S3 13 3 15c0 2.76 2.24 5 5 5s5-2.24 5-5c0-.34-.04-.68-.1-1H12h.1c-.06.32-.1.66-.1 1 0 2.76 2.24 5 5 5s5-2.24 5-5c0-2-.97-3.08-1.5-3.5L21 9l-2.24 1.31C17.2 8.28 14.76 7 12 7z" fill="white"/>
                  </svg>
                  Post to TripAdvisor
                </a>
              )}
            </div>
            )}
          </div>
        )}
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

  // Device fingerprint generated once on mount for duplicate detection
  const [fingerprint] = useState<string>(() => {
    try {
      return generateFingerprint()
    } catch {
      return ""
    }
  })

  const [submitted, setSubmitted] = useState(false)
  const [submittedGcs, setSubmittedGcs] = useState<number>(0)
  const [submittedAdjectives, setSubmittedAdjectives] = useState<string>("")
  const [alreadySubmitted, setAlreadySubmitted] = useState(false)
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

  // Staff picker — shown when gcs >= 8 and verified staff exist
  const [selectedStaffProfileId, setSelectedStaffProfileId] = useState<string | null>(null)

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

  const { data: verifiedStaff } = useQuery({
    ...trpc.staff.getVerifiedStaffAtProperty.queryOptions({
      propertyId: data?.propertyId ?? "",
    }),
    enabled: gcs >= 8 && phase2Visible && !!data?.propertyId,
  })

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
      // 1. Submit core feedback (with device fingerprint for deduplication)
      const result = await trpcClient.feedback.submitFeedback.mutate({
        uniqueCode,
        resilience,
        empathy,
        anticipation,
        recognition,
        mealTime,
        guestEmail: guestEmail.trim() || undefined,
        adjectives: selectedAdjectives.length > 0 ? selectedAdjectives.join(',') : undefined,
        fingerprint: fingerprint || undefined,
        staffProfileId: selectedStaffProfileId ?? undefined,
      })

      // Device already submitted in the last 24 hours — show friendly block screen
      if (result.blocked) {
        setAlreadySubmitted(true)
        return
      }

      // feedbackId is guaranteed non-null when blocked === false
      const feedbackId = result.feedbackId as string

      // 2. Submit any staff name recognitions (high score path, free-text only when gcs < 8)
      if (!isLowScore && gcs < 8) {
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

      setSubmittedGcs(gcs)
      setSubmittedAdjectives(selectedAdjectives.join(","))
      setSubmitted(true)
    } catch {
      setSubmitError(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  function generateReviewText(propertyName: string, score: number, adjectives: string): string {
    const adjList = adjectives ? adjectives.split(",").map((a) => a.trim()).filter(Boolean) : []

    const scoreWord =
      score >= 9.5
        ? "outstanding"
        : score >= 8.5
          ? "excellent"
          : score >= 7.5
            ? "really impressive"
            : "great"

    let adjSentence = ""
    if (adjList.length >= 3) {
      const picked = adjList.slice(0, 3)
      adjSentence = `The experience was ${picked[0]}, ${picked[1]} and ${picked[2]}. `
    } else if (adjList.length === 2) {
      adjSentence = `The experience was ${adjList[0]} and ${adjList[1]}. `
    } else if (adjList.length === 1) {
      adjSentence = `The experience was ${adjList[0]}. `
    }

    return `I recently visited ${propertyName} and had a ${scoreWord} experience. ${adjSentence}I would highly recommend ${propertyName} to anyone looking for great hospitality.`
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

  // ─── Already Submitted (24-hour block) ───
  if (alreadySubmitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4 px-6">
          <div className="text-5xl">✅</div>
          <h2 className="text-xl font-bold">Already received!</h2>
          <p className="text-sm text-muted-foreground">
            We've already recorded your feedback today. Thank you — we really appreciate it!
          </p>
        </div>
      </div>
    )
  }

  // ─── Thank You ───
  if (submitted) {
    const nominatedStaff = selectedStaffProfileId
      ? verifiedStaff?.find((s) => s.id === selectedStaffProfileId)
      : null

    const threshold = data?.reviewPromptThreshold ?? 8
    const platforms = (data?.reviewPromptPlatforms ?? "google,tripadvisor").split(",").map((p) => p.trim())
    const showGoogle = platforms.includes("google") && !!data?.googlePlaceId
    const showTripAdvisor = platforms.includes("tripadvisor") && !!data?.tripAdvisorUrl
    const shouldShowReviewPrompt = submittedGcs >= threshold && (showGoogle || showTripAdvisor)
    const reviewText = data?.propertyName
      ? generateReviewText(data.propertyName, submittedGcs, submittedAdjectives)
      : ""

    return (
      <ThankYouScreen
        propertyName={data?.propertyName ?? ""}
        nominatedStaff={nominatedStaff ?? null}
        shouldShowReviewPrompt={shouldShowReviewPrompt}
        reviewText={reviewText}
        showGoogle={showGoogle}
        showTripAdvisor={showTripAdvisor}
        googlePlaceId={data?.googlePlaceId ?? null}
        tripAdvisorUrl={data?.tripAdvisorUrl ?? null}
      />
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
            {(["morning", "lunch", "dinner", "none"] as MealTime[]).map((m) => (
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

                {/* Staff attribution — picker when gcs >= 8 with verified staff, free-text otherwise */}
                {gcs >= 8 && verifiedStaff && verifiedStaff.length > 0 ? (
                  <div className="space-y-3">
                    <div className="text-center space-y-1">
                      <p className="text-sm font-semibold text-center">
                        Did any particular staff member stand out?
                        <span className="ml-2 text-xs font-normal text-muted-foreground">(Optional)</span>
                      </p>
                      <p className="text-xs text-muted-foreground text-center">
                        Tap their name if someone went above and beyond.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {verifiedStaff.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() =>
                            setSelectedStaffProfileId((prev) => (prev === s.id ? null : s.id))
                          }
                          className={cn(
                            "px-4 py-2 rounded-full text-sm border transition-colors",
                            selectedStaffProfileId === s.id
                              ? "bg-orange-500 text-white border-orange-500"
                              : "border-border hover:bg-muted",
                          )}
                        >
                          {s.displayName}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : gcs < 8 ? (
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
                ) : null}

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
