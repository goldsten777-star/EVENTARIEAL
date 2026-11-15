import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh flex-1 lg:grid-cols-2">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="Event Manager – דף הבית">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</main>
      </div>

      <aside
        aria-hidden="true"
        className="relative hidden overflow-hidden bg-[#15171c] text-[#f6f6f3] lg:flex lg:flex-col lg:justify-end lg:p-14"
      >
        <svg className="absolute inset-0 size-full opacity-[0.07]" aria-hidden="true">
          <defs>
            <pattern id="auth-dots" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#auth-dots)" />
        </svg>
        <div className="relative flex max-w-md flex-col gap-5">
          <div className="h-px w-12 bg-[#c9a45c]" />
          <p className="text-3xl leading-snug font-semibold text-balance">
            מהרשימה הראשונה ועד האורח האחרון שנכנס לאולם.
          </p>
          <p className="text-[#c9cbd1]">
            מוזמנים, אישורי הגעה, שולחנות, מתנות ותקציב – מסודר, מאובטח ומתעדכן בזמן אמת.
          </p>
        </div>
      </aside>
    </div>
  );
}
