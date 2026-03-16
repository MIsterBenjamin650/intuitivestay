import { Button } from "@intuitive-stay/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@intuitive-stay/ui/components/popover"
import { BellIcon } from "lucide-react"

const notifications = [
  {
    id: "n1",
    title: "New booking received",
    description: "Casa Verde - 2 nights - check-in tomorrow",
    time: "2m ago",
    unread: true,
  },
  {
    id: "n2",
    title: "Payment completed",
    description: "Invoice #3482 has been successfully paid.",
    time: "1h ago",
    unread: true,
  },
  {
    id: "n3",
    title: "Payout scheduled",
    description: "Weekly payout is scheduled for Monday.",
    time: "Yesterday",
    unread: false,
  },
]

export function TopbarNotifications() {
  const unreadCount = notifications.filter((notification) => notification.unread).length

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
        {unreadCount > 0 ? (
          <span className="pointer-events-none absolute -top-1 -right-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
            {unreadCount}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={10} className="w-80">
        <PopoverHeader>
          <PopoverTitle>Notifications</PopoverTitle>
          <PopoverDescription>{unreadCount} unread updates</PopoverDescription>
        </PopoverHeader>
        <div className="flex flex-col gap-1">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className="rounded-md border border-border/70 bg-background/70 px-3 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{notification.title}</p>
                {notification.unread ? (
                  <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">{notification.description}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{notification.time}</p>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
