import type { Metadata } from "next";
import { TopBar } from "@/components/layout/top-bar";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";
import { requirePlatformAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "ניהול מערכת" };

export default async function AdminPage() {
  const user = await requirePlatformAdmin();
  return (
    <div className="flex flex-1 flex-col">
      <TopBar user={user} />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <ModulePlaceholder
          title="ניהול מערכת"
          description="רשימת המשתמשים והאירועים במערכת וניהול הרשאות מערכת יתווספו במודול 12."
        />
      </main>
    </div>
  );
}
