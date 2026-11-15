import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { UserMenu, type MenuUser } from "@/components/layout/user-menu";

/** Header for pages outside a specific event (event list, admin). */
export function TopBar({ user }: { user: MenuUser }) {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/events" aria-label="כל האירועים">
          <Logo />
        </Link>
        <UserMenu user={user} compact />
      </div>
    </header>
  );
}
