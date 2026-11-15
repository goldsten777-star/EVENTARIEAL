"use client";

import Link from "next/link";
import { ChevronsUpDownIcon, LogOutIcon, MonitorIcon, MoonIcon, ShieldIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { signOut } from "@/app/(auth)/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type MenuUser = { fullName: string; email: string; isPlatformAdmin: boolean; roleLabel?: string };

export function initials(name: string, email: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return parts[0][0] + parts[1][0];
  if (parts.length === 1) return parts[0].slice(0, 2);
  return email.slice(0, 2).toUpperCase();
}

export function UserMenu({ user, compact = false }: { user: MenuUser; compact?: boolean }) {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2.5 rounded-xl text-start outline-none hover:bg-sidebar-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50",
          compact ? "p-1" : "w-full p-2",
        )}
        aria-label="תפריט משתמש"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-muted text-sm font-semibold">
          {initials(user.fullName, user.email)}
        </span>
        {compact ? null : (
          <>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold">{user.fullName || user.email}</span>
              <span className="truncate text-xs text-muted-foreground">
                {user.roleLabel ?? (user.isPlatformAdmin ? "מנהל מערכת" : user.email)}
              </span>
            </span>
            <ChevronsUpDownIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side={compact ? "bottom" : "top"} className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="font-semibold">{user.fullName || "החשבון שלי"}</span>
          <span className="text-xs font-normal text-muted-foreground" dir="ltr">
            {user.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">תצוגה</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <SunIcon aria-hidden="true" /> בהיר
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <MoonIcon aria-hidden="true" /> כהה
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <MonitorIcon aria-hidden="true" /> לפי המכשיר
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {user.isPlatformAdmin ? (
            <DropdownMenuItem asChild>
              <Link href="/admin">
                <ShieldIcon aria-hidden="true" /> ניהול מערכת
              </Link>
            </DropdownMenuItem>
          ) : null}
          <form action={signOut}>
            <DropdownMenuItem asChild>
              <button type="submit" className="w-full">
                <LogOutIcon aria-hidden="true" /> התנתקות
              </button>
            </DropdownMenuItem>
          </form>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
