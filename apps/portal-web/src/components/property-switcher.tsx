import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@intuitive-stay/ui/components/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@intuitive-stay/ui/components/sidebar"
import { useNavigate } from "@tanstack/react-router"
import {
  Building2Icon,
  ChevronsUpDownIcon,
  FolderCogIcon,
} from "lucide-react"

import { useActiveProperty } from "@/lib/active-property-context"

export function PropertySwitcher() {
  const navigate = useNavigate()
  const { isMobile } = useSidebar()
  const { properties, activeProperty, switchProperty } = useActiveProperty()

  if (!activeProperty) {
    return null
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
              />
            }
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Building2Icon />
            </div>
            <div className="grid flex-1 min-w-0 text-left text-sm leading-tight">
              <span className="truncate font-medium">{activeProperty.name}</span>
              <span className="truncate text-xs text-muted-foreground">Current property</span>
            </div>
            <ChevronsUpDownIcon className="ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Properties
              </DropdownMenuLabel>
              {properties.map((property) => (
                <DropdownMenuItem
                  key={property.id}
                  onClick={() => {
                    switchProperty(property.id)
                  }}
                >
                  <Building2Icon />
                  <span className="truncate">{property.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => {
                  navigate({ to: "/properties" })
                }}
              >
                <FolderCogIcon />
                Manage properties
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
