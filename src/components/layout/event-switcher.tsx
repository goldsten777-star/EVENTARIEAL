"use client";

import Link from "next/link";
import { CheckIcon, ChevronsUpDownIcon, LayoutGridIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/format";

export type SwitcherEvent = { id: string; name: string; event_date: string | null };

export function EventSwitcher({ current, events }: { current: SwitcherEvent; events: SwitcherEvent[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex w-full items-center gap-2.5 rounded-xl border bg-muted/60 p-2.5 text-start outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label={`האירוע הנוכחי: ${current.name}. החלפת אירוע`}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent font-bold text-accent-foreground">
          {current.name.trim().charAt(0)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold">{current.name}</span>
          <span className="truncate text-xs text-muted-foreground">
            {current.event_date ? formatDate(current.event_date, { month: "numeric" }) : "ללא תאריך"}
          </span>
        </span>
        <ChevronsUpDownIcon className="size-4 text-muted-foreground" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">האירועים שלי</DropdownMenuLabel>
        {events.map((e) => (
          <DropdownMenuItem key={e.id} asChild>
            <Link href={`/events/${e.id}`}>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{e.name}</span>
                {e.event_date ? (
                  <span className="text-xs text-muted-foreground">{formatDate(e.event_date)}</span>
                ) : null}
              </span>
              {e.id === current.id ? <CheckIcon className="text-primary" aria-label="נבחר" /> : null}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/events">
            <LayoutGridIcon aria-hidden="true" /> כל האירועים
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
