import { Button } from "@intuitive-stay/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@intuitive-stay/ui/components/popover"
import { useQuery } from "@tanstack/react-query"
import { BellIcon } from "lucide-react"

import { useTRPC } from "@/utils/trpc"

export function TopbarNotifications() {
  const trpc = useTRPC()
  const { data: alertCount = 0 } = useQuery(
    trpc.feedback.getRedAlertCount.queryOptions(),
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
      <PopoverContent align="end" sideOffset={10} className="w-80">
        <PopoverHeader>
          <PopoverTitle>Alerts</PopoverTitle>
          <PopoverDescription>
            {alertCount > 0
              ? `${alertCount} low-score ${alertCount === 1 ? "alert" : "alerts"} across your properties`
              : "No low-score alerts"}
          </PopoverDescription>
        </PopoverHeader>
        {alertCount > 0 ? (
          <div className="px-3 py-2">
            <p className="text-sm text-muted-foreground">
              {alertCount} guest {alertCount === 1 ? "submission" : "submissions"} scored 5 or
              below. Visit the Alerts page for each property to review details.
            </p>
          </div>
        ) : (
          <div className="px-3 py-2">
            <p className="text-sm text-muted-foreground">All scores are looking good.</p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
