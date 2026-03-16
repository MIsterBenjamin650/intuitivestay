import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@intuitive-stay/ui/components/avatar"
import { Button } from "@intuitive-stay/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@intuitive-stay/ui/components/dropdown-menu"
import { Skeleton } from "@intuitive-stay/ui/components/skeleton"
import { useNavigate } from "@tanstack/react-router"
import { LogOutIcon, SettingsIcon } from "lucide-react"

import { authClient } from "@/lib/auth-client"

function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) {
    return "U"
  }

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("")
}

export function TopbarUserMenu() {
  const navigate = useNavigate()
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="size-8 rounded-full" />
        <Skeleton className="hidden h-4 w-24 md:block" />
      </div>
    )
  }

  if (!session) {
    return (
      <Button variant="outline" size="sm" onClick={() => navigate({ to: "/login" })}>
        Sign in
      </Button>
    )
  }

  const displayName = session.user.name?.trim() || "User"
  const email = session.user.email || "No email"
  const initials = getInitials(displayName)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-auto min-h-10 px-2 py-1.5 md:min-h-11 md:px-2.5 md:py-2"
            aria-label="Open user menu"
          />
        }
      >
        <Avatar className="size-8 rounded-full after:hidden">
          <AvatarImage src={session.user.image ?? undefined} alt={displayName} />
          <AvatarFallback className="rounded-full">{initials}</AvatarFallback>
        </Avatar>
        <div className="hidden min-w-0 text-left md:grid">
          <span className="truncate text-sm font-medium">{displayName}</span>
          <span className="truncate text-xs text-muted-foreground">{email}</span>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="min-w-56 rounded-lg">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="flex items-center gap-2">
              <Avatar className="size-8 rounded-full after:hidden">
                <AvatarImage src={session.user.image ?? undefined} alt={displayName} />
                <AvatarFallback className="rounded-full">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{displayName}</span>
                <span className="truncate text-xs text-muted-foreground">{email}</span>
              </div>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={(event) => event.preventDefault()}>
            <SettingsIcon />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              authClient.signOut({
                fetchOptions: {
                  onSuccess: () => {
                    navigate({
                      to: "/login",
                    })
                  },
                },
              })
            }}
          >
            <LogOutIcon />
            Logout
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
