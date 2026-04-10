self.addEventListener("push", (event) => {
  if (!event.data) return

  let data
  try {
    data = event.data.json()
  } catch {
    data = { title: "IntuitiveStay Alert", body: "" }
  }

  // Only allow same-origin URLs to prevent open redirect via push payload
  const rawUrl = data.url ?? "/"
  const safeUrl = rawUrl.startsWith(self.location.origin) || rawUrl.startsWith("/")
    ? rawUrl
    : "/"

  const title = data.title ?? "IntuitiveStay Alert"
  const options = {
    body: data.body ?? "",
    icon: "/favicon.png",
    badge: "/favicon.png",
    data: { url: safeUrl },
    requireInteraction: true,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? "/"
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    }),
  )
})
