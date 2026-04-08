import { Button } from "@intuitive-stay/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@intuitive-stay/ui/components/popover"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { BellIcon } from "lucide-react"

import { useTRPC } from "@/utils/trpc"

function formatDate(date: Date | string) {
  return new Date(date).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function TopbarNotifications() {
  const trpc = useTRPC()
  const { data: alertCount = 0 } = useQuery(
    trpc.feedback.getRedAlertCount.queryOptions(),
  )
  const { data: recentAlerts = [] } = useQuery(
    trpc.feedback.getRecentUnreadAlerts.queryOptions(),
  )

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="relative"
            aria-label="View notifications"
          />
        }
      >
        <BellIcon />
        {alertCount > 0 ? (
          <span className="pointer-events-none absolute -top-1 -right-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
            {alertCount}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={10} className="w-96 p-0">
        <PopoverHeader className="px-4 pt-4 pb-3">
          <PopoverTitle>
            {alertCount > 0
              ? `${alertCount} unread alert${alertCount === 1 ? "" : "s"}`
              : "Alerts"}
          </PopoverTitle>
        </PopoverHeader>

        {recentAlerts.length === 0 ? (
          <div className="px-4 pb-4">
            <p className="text-sm text-muted-foreground">All scores are looking good.</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y">
            {recentAlerts.map((alert) => (
              <Link
                key={alert.id}
                to="/properties/$propertyId/alerts"
                params={{ propertyId: alert.propertyId }}
                hash={alert.id}
                className="flex flex-col gap-1 px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                      !
                    </span>
                    <span className="text-sm font-medium">{alert.propertyName}</span>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatDate(alert.submittedAt)}
                  </span>
                </div>
                <p className="text-xs text-destructive font-semibold pl-7">
                  GCS: {alert.gcs.toFixed(2)} / 10
                </p>
                {alert.ventText && (
                  <p className="text-xs text-muted-foreground pl-7 line-clamp-2">
                    "{alert.ventText}"
                  </p>
                )}
              </Link>
            ))}

            {alertCount > recentAlerts.length && (
              <div className="px-4 py-3 text-xs text-muted-foreground text-center">
                +{alertCount - recentAlerts.length} more unread alert{alertCount - recentAlerts.length === 1 ? "" : "s"} — visit each property's Alerts page
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
