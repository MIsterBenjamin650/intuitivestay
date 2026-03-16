import * as React from "react"
import { Button } from "@intuitive-stay/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@intuitive-stay/ui/components/dropdown-menu"
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

const themeOptions = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
] as const

export function TopbarThemeSwitcher() {
  const { setTheme, theme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const activeTheme = mounted ? theme : "system"
  const activeIcon =
    themeOptions.find((option) => option.value === activeTheme)?.icon ??
    MonitorIcon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="relative"
            aria-label="Switch theme"
          />
        }
      >
        {React.createElement(activeIcon)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36 rounded-lg">
        <DropdownMenuGroup>
          {themeOptions.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => setTheme(option.value)}
            >
              {React.createElement(option.icon)}
              {option.label}
              {activeTheme === option.value ? <CheckIcon className="ml-auto" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
