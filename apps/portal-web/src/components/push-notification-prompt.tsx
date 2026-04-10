import { Bell, X } from "lucide-react"
import { useState } from "react"

import { Button } from "@intuitive-stay/ui/components/button"

import { usePushNotifications } from "@/hooks/use-push-notifications"

export function PushNotificationPrompt() {
  const { state, enable } = usePushNotifications()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || state === "unsupported" || state === "granted" || state === "denied") {
    return null
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 mb-4">
      <div className="flex items-center gap-3">
        <Bell className="h-5 w-5 text-orange-500 shrink-0" />
        <div>
          <p className="text-sm font-medium text-orange-900">Enable Red Alert notifications</p>
          <p className="text-xs text-orange-700">
            Get an instant notification on this device when a guest submits a low score.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          onClick={enable}
          disabled={state === "loading"}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          {state === "loading" ? "Enabling…" : "Enable"}
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="text-orange-400 hover:text-orange-600"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
