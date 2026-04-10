import { useMutation } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import { useTRPC } from "@/utils/trpc"

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ""

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

export type PushState = "unsupported" | "default" | "granted" | "denied" | "loading"

export function usePushNotifications() {
  const trpc = useTRPC()
  const [state, setState] = useState<PushState>("default")

  const saveMutation = useMutation(trpc.push.saveSubscription.mutationOptions())

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported")
      return
    }
    const permission = Notification.permission
    if (permission === "granted") setState("granted")
    else if (permission === "denied") setState("denied")
    else setState("default")
  }, [])

  async function enable() {
    if (!("serviceWorker" in navigator)) return
    setState("loading")

    try {
      const registration = await navigator.serviceWorker.register("/sw.js")
      await navigator.serviceWorker.ready

      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setState("denied")
        return
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      const json = subscription.toJSON()
      await saveMutation.mutateAsync({
        endpoint: json.endpoint!,
        p256dh: json.keys!.p256dh,
        auth: json.keys!.auth,
      })

      setState("granted")
    } catch (err) {
      console.error("Push subscription failed:", err)
      setState("default")
    }
  }

  return { state, enable }
}
