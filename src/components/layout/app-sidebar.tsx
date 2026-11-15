"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArmchairIcon,
  ChartColumnIcon,
  FileTextIcon,
  GiftIcon,
  LayoutDashboardIcon,
  MailIcon,
  ScanLineIcon,
  SettingsIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { EventSwitcher, type SwitcherEvent } from "@/components/layout/event-switcher";
import { UserMenu, type MenuUser } from "@/components/layout/user-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { can, SECTION_CAPABILITY, type EventRole, type EventSection } from "@/lib/auth/permissions";

type NavItem = { section: EventSection; label: string; icon: LucideIcon };

const MAIN_NAV: NavItem[] = [
  { section: "dashboard", label: "לוח בקרה", icon: LayoutDashboardIcon },
  { section: "guests", label: "מוזמנים", icon: UsersIcon },
  { section: "invitations", label: "הזמנות ואישורים", icon: MailIcon },
  { section: "seating", label: "סידורי ישיבה", icon: ArmchairIcon },
  { section: "gifts", label: "מתנות", icon: GiftIcon },
  { section: "budget", label: "תקציב", icon: ChartColumnIcon },
];

const EVENT_DAY_NAV: NavItem[] = [
  { section: "checkin", label: "Check-in", icon: ScanLineIcon },
  { section: "reports", label: "דוחות", icon: FileTextIcon },
  { section: "settings", label: "הגדרות וצוות", icon: SettingsIcon },
];

export function AppSidebar({
  event,
  events,
  role,
  user,
}: {
  event: SwitcherEvent;
  events: SwitcherEvent[];
  role: EventRole;
  user: MenuUser;
}) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  function renderItems(items: NavItem[]) {
    return items
      .filter((item) => can(role, SECTION_CAPABILITY[item.section]))
      .map((item) => {
        const href = `/events/${event.id}/${item.section}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <SidebarMenuItem key={item.section}>
            <SidebarMenuButton asChild isActive={active} tooltip={item.label} size="lg" className="h-10">
              <Link href={href} aria-current={active ? "page" : undefined} onClick={() => setOpenMobile(false)}>
                <item.icon aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      });
  }

  const main = renderItems(MAIN_NAV);
  const eventDay = renderItems(EVENT_DAY_NAV);

  return (
    <Sidebar side="right" collapsible="offcanvas">
      <SidebarHeader className="gap-4 p-4">
        <Link href="/events" className="px-1" aria-label="כל האירועים">
          <Logo />
        </Link>
        <EventSwitcher current={event} events={events} />
      </SidebarHeader>
      <SidebarContent className="px-2">
        {main.length ? (
          <SidebarGroup>
            <SidebarGroupLabel>ניהול</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{main}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
        {eventDay.length ? (
          <SidebarGroup>
            <SidebarGroupLabel>יום האירוע</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{eventDay}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>
      <SidebarFooter className="border-t p-3">
        <UserMenu user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
