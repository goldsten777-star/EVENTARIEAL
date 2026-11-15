import { cookies } from "next/headers";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Badge } from "@/components/ui/badge";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getEventAccess, getMyEvents } from "@/lib/auth/access";
import { ROLE_LABELS } from "@/lib/auth/permissions";

export default async function EventLayout({ children, params }: LayoutProps<"/events/[eventId]">) {
  const { eventId } = await params;
  const [{ event, role, user }, events, cookieStore] = await Promise.all([
    getEventAccess(eventId),
    getMyEvents(),
    cookies(),
  ]);
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar
        event={event}
        events={events}
        role={role}
        user={{
          fullName: user.fullName,
          email: user.email,
          isPlatformAdmin: user.isPlatformAdmin,
          roleLabel: ROLE_LABELS[role],
        }}
      />
      <SidebarInset className="min-w-0">
        <header data-print="hide" className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
          <SidebarTrigger className="-ms-1 size-9" aria-label="פתיחה וסגירה של התפריט" />
          <span className="truncate font-semibold">{event.name}</span>
          <Badge variant="secondary" className="ms-auto shrink-0">
            {ROLE_LABELS[role]}
          </Badge>
        </header>
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-8 sm:py-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
