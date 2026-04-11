import { useMutation } from "@tanstack/react-query"
import {
  BarChart3,
  BellRing,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  PartyPopper,
  QrCode,
  Sparkles,
  X,
} from "lucide-react"
import { useState } from "react"

import { Button } from "@intuitive-stay/ui/components/button"

import { useTRPC } from "@/utils/trpc"

const STEPS = [
  {
    icon: PartyPopper,
    title: "Welcome to IntuitiveStay!",
    description:
      "Your property dashboard is live. Let us show you around in 60 seconds so you can start collecting real guest feedback from day one.",
  },
  {
    icon: QrCode,
    title: "Place your QR code",
    description:
      "Your branded QR code is ready to download from the QR Code tab in your property page. Print it and display it where guests can easily scan — at reception, on tables, or in rooms. Every scan brings you closer to understanding your guests.",
  },
  {
    icon: BarChart3,
    title: "Track your Guest Connection Score",
    description:
      "Every scan reveals how guests feel across four pillars: Resilience, Empathy, Anticipation and Recognition. Your GCS is the overall score out of 10 — aim for 8 or above consistently to know your service is landing.",
  },
  {
    icon: BellRing,
    title: "Act fast with Red Alerts",
    description:
      "When a guest scores 5 or below, a Red Alert appears in your dashboard and you receive an email notification instantly. Tap the alert to read their vent text and take action before they leave a public review.",
  },
  {
    icon: Sparkles,
    title: "Your daily AI summary",
    description:
      "Every morning you'll receive an AI-generated summary of the previous day's feedback with specific action points for each service pillar. Start each day knowing exactly where to focus your team.",
  },
  {
    icon: CheckCircle2,
    title: "You're ready to go!",
    description:
      "Head to your property dashboard to download your QR code and start collecting guest feedback. Your first score will appear within minutes of your first scan.",
  },
]

export function OnboardingModal() {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(true)
  const trpc = useTRPC()

  const { mutate: markComplete, isPending } = useMutation(
    trpc.properties.markOnboardingComplete.mutationOptions(),
  )

  function dismiss() {
    markComplete(undefined, {
      onSettled: () => setVisible(false),
    })
  }

  if (!visible) return null

  const current = STEPS[step]!
  const isFirst = step === 0
  const isLast = step === STEPS.length - 1
  const Icon = current.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={dismiss}
        aria-hidden="true"
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl">

        {/* Orange header band */}
        <div className="bg-orange-500 px-6 py-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <span className="text-white font-black text-[12px] tracking-tight">IS</span>
              </div>
              <span className="text-white font-bold text-base">IntuitiveStay</span>
            </div>
            <button
              onClick={dismiss}
              disabled={isPending}
              className="text-white/70 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Step dots */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step
                    ? "w-6 bg-white"
                    : i < step
                    ? "w-3 bg-white/60"
                    : "w-3 bg-white/30"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="bg-white px-8 py-8">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center">
              <Icon className="h-8 w-8 text-orange-500" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-gray-900 tracking-tight mb-2">
                {current.title}
              </h2>
              <p className="text-sm text-gray-500 leading-relaxed max-w-sm mx-auto">
                {current.description}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#fef9f5] border-t border-orange-100 px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => setStep((s) => s - 1)}
            disabled={isFirst}
            className="flex items-center gap-1 text-sm font-medium text-gray-400 hover:text-gray-600 disabled:opacity-0 disabled:pointer-events-none transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          <p className="text-xs text-gray-400">
            {step + 1} of {STEPS.length}
          </p>

          {isLast ? (
            <Button
              onClick={dismiss}
              disabled={isPending}
              className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-5"
              size="sm"
            >
              {isPending ? "Saving…" : "Get Started →"}
            </Button>
          ) : (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="flex items-center gap-1 text-sm font-semibold text-orange-600 hover:text-orange-700 transition-colors"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
