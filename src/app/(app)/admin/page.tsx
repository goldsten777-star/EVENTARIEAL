import type { Metadata } from "next";
import { AdminView } from "@/components/admin/admin-view";
import { StatTile } from "@/components/dashboard/stat-tile";
import { PageHeader } from "@/components/layout/page-header";
import { TopBar } from "@/components/layout/top-bar";
import { getAdminOverview } from "@/features/admin/queries";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "ניהול מערכת" };

export default async function AdminPage() {
  const user = await requirePlatformAdmin();
  const { users, events, totals } = await getAdminOverview();

  return (
    <div className="flex flex-1 flex-col">
      <TopBar user={user} />
      <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
        <PageHeader title="ניהול מערכת" description="כל המשתמשים והאירועים במערכת, והרשאות מנהל מערכת." />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="משתמשים"
            value={formatNumber(totals.users)}
            context={`${formatNumber(totals.newUsers30d)} חדשים ב-30 הימים האחרונים`}
          />
          <StatTile
            label="אימייל לא אושר"
            value={formatNumber(totals.unconfirmedUsers)}
            context="נרשמו ועדיין לא אישרו את כתובת האימייל"
          />
          <StatTile
            label="אירועים"
            value={formatNumber(totals.events)}
            context={`${formatNumber(totals.upcomingEvents)} עתידיים`}
          />
          <StatTile label="מוזמנים בכל האירועים" value={formatNumber(totals.guests)} context={totals.admins === 1 ? "מנהל מערכת אחד" : `${totals.admins} מנהלי מערכת`} />
        </div>

        <AdminView users={users} events={events} currentUserId={user.id} />
      </main>
    </div>
  );
}
