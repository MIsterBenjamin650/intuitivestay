import { Input } from "@intuitive-stay/ui/components/input";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@intuitive-stay/ui/components/sidebar";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import { TopbarNotifications } from "@/components/topbar-notifications";
import { TopbarThemeSwitcher } from "@/components/topbar-theme-switcher";
import { TopbarUserMenu } from "@/components/topbar-user-menu";
import { getUser } from "@/functions/get-user";

export const Route = createFileRoute("/_portal")({
  beforeLoad: async () => {
    const session = await getUser();

    if (!session) {
      throw redirect({
        to: "/login",
      });
    }

    return { session };
  },
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center border-b bg-background/90 backdrop-blur-md">
          <div className="flex w-full items-center justify-between gap-3 px-3 md:px-4">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <div className="relative w-full max-w-sm md:max-w-md">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search"
                  className="h-9 pr-14 pl-9"
                  aria-label="Search"
                />
                <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded-md border border-border/70 bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  ⌘ F
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2">
              <TopbarThemeSwitcher />
              <TopbarNotifications />
              <TopbarUserMenu />
            </div>
          </div>
        </header>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
