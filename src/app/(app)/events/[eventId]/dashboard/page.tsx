import type { Metadata } from "next";
import Link from "next/link";
import { CalendarIcon, MapPinIcon } from "lucide-react";
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { ProgressRows } from "@/components/dashboard/progress-rows";
import { ResponsesChart } from "@/components/dashboard/responses-chart";
import { RsvpBreakdown } from "@/components/dashboard/rsvp-breakdown";
import { Meter, PercentBadge, StatTile } from "@/components/dashboard/stat-tile";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardData } from "@/features/dashboard/queries";
import { requireEventSection } from "@/lib/auth/access";
import { can } from "@/lib/auth/permissions";
import { cumulativeTimeline, percent } from "@/lib/dashboard/stats";
import { countdownLabel, daysUntil, formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "לוח בקרה" };

export default async function DashboardPage({ params }: PageProps<"/events/[eventId]/dashboard">) {
  const { eventId } = await params;
  const access = await requireEventSection(eventId, "dashboard");
  const { stats, event, activity, fetchedAt, today } = await getDashboardData(eventId);
  const t = stats.totals;
  const canManage = can(access.role, "manage");
  const countdown = countdownLabel(daysUntil(event?.event_date));
  const budget = stats.money.budget_total || stats.money.planned_total;
  const timeline = cumulativeTimeline(stats.timeline, today);

  return (
    <div className="flex flex-col gap-6">
      <RealtimeRefresh eventId={eventId} />
      <PageHeader
        title="לוח בקרה"
        eyebrow={
          countdown ? (
            <span className="self-start rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
              {countdown}
            </span>
          ) : null
        }
        description={
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            {event?.event_date ? (
              <span className="inline-flex items-center gap-1.5">
                <CalendarIcon className="size-4" aria-hidden="true" />
                {formatDateTime(event.event_date)}
              </span>
            ) : null}
            {event?.venue_name ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPinIcon className="size-4" aria-hidden="true" />
                {event.venue_name}
              </span>
            ) : null}
          </span>
        }
        actions={
          canManage ? (
            <Button asChild size="lg">
              <Link href={`/events/${eventId}/guests`}>לרשימת המוזמנים</Link>
            </Button>
          ) : null
        }
      />

      <section aria-label="נתונים מרכזיים" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="סך המוזמנים"
          value={formatNumber(t.people_invited)}
          context={`${formatNumber(t.parties)} הזמנות · ${formatNumber(t.adults_invited)} מבוגרים · ${formatNumber(t.children_invited)} ילדים`}
        />
        <StatTile
          label="אישרו הגעה"
          value={formatNumber(t.attending_people)}
          badge={<PercentBadge value={percent(t.attending_people, t.people_invited)} />}
          context={`${formatNumber(t.attending_parties)} הזמנות · ${formatNumber(t.attending_children)} ילדים`}
        />
        <StatTile
          label="ממתינים לתשובה"
          value={formatNumber(t.pending_people)}
          badge={<PercentBadge value={percent(t.pending_people, t.people_invited)} />}
          context={
            t.invitations_not_sent
              ? `${formatNumber(t.invitations_not_sent)} הזמנות עוד לא נשלחו`
              : "כל ההזמנות נשלחו"
          }
        />
        <StatTile
          label="לא מגיעים"
          value={formatNumber(t.declined_people)}
          badge={<PercentBadge value={percent(t.declined_people, t.people_invited)} />}
          context={`${formatNumber(t.declined_parties)} הזמנות`}
        />
        <StatTile
          label="הגיעו בפועל"
          value={
            <>
              {formatNumber(t.arrived_people)}
              <span className="text-base font-medium text-muted-foreground"> מתוך {formatNumber(t.attending_people)}</span>
            </>
          }
          context={t.arrived_people ? `${formatNumber(t.arrived_parties)} הזמנות נכנסו` : "יתעדכן בזמן אמת ביום האירוע"}
        />
        <StatTile
          label="שולחנות ותפוסה"
          value={
            <>
              {formatNumber(stats.tables.tables_count)}
              <span className="text-base font-medium text-muted-foreground"> שולחנות</span>
            </>
          }
          context={`${formatNumber(t.seated_people)} מתוך ${formatNumber(stats.tables.total_capacity)} מקומות שובצו · ${formatNumber(t.unseated_people)} ממתינים לשיבוץ`}
        >
          <Meter value={t.seated_people} max={stats.tables.total_capacity} label="מקומות ששובצו" />
        </StatTile>
        <StatTile
          className="sm:col-span-2"
          label="תקציב מול הוצאות בפועל"
          value={formatCurrency(stats.money.actual_total)}
          badge={
            budget ? <span className="text-sm text-muted-foreground">מתוך {formatCurrency(budget)}</span> : null
          }
          context={
            budget
              ? `${percent(stats.money.actual_total, budget)}% נוצל · יתרה ${formatCurrency(budget - stats.money.actual_total)} · מתנות ${formatCurrency(stats.gifts.gifts_total)}`
              : "עוד לא הוגדר תקציב (בהגדרות האירוע)"
          }
        >
          {budget ? <Meter value={stats.money.actual_total} max={budget} label="ניצול התקציב" /> : null}
        </StatTile>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>סטטוס אישורי הגעה</CardTitle>
            <CardDescription>לפי מספר האנשים</CardDescription>
          </CardHeader>
          <CardContent>
            <RsvpBreakdown attending={t.attending_people} declined={t.declined_people} pending={t.pending_people} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>אישורים לפי קבוצה</CardTitle>
            <CardDescription>אנשים שאישרו מתוך המוזמנים בכל קבוצה</CardDescription>
          </CardHeader>
          <CardContent>
            <ProgressRows
              empty="אין קבוצות עם מוזמנים."
              rows={stats.by_group
                .filter((g) => g.invited > 0)
                .map((g) => ({
                  key: g.name,
                  label: g.name,
                  marker: g.color,
                  value: g.attending,
                  total: g.invited,
                  caption: `${formatNumber(g.attending)} מתוך ${formatNumber(g.invited)}`,
                }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>קצב התשובות</CardTitle>
            <CardDescription>הזמנות שענו, מצטבר לפי יום</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsesChart data={timeline} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>תקציב לפי קטגוריה</CardTitle>
            <CardDescription>הוצאה בפועל מתוך המתוכנן</CardDescription>
          </CardHeader>
          <CardContent>
            <ProgressRows
              empty="עוד לא הוזנו הוצאות."
              rows={stats.by_category.map((c) => ({
                key: c.category,
                label: EXPENSE_CATEGORY_LABELS[c.category as keyof typeof EXPENSE_CATEGORY_LABELS] ?? c.category,
                value: c.actual,
                total: c.planned || c.actual,
                caption: `${formatCurrency(c.actual)} מתוך ${formatCurrency(c.planned)}`,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div className="flex flex-col gap-1.5">
              <CardTitle>פעילות אחרונה</CardTitle>
              <CardDescription>מתעדכן אוטומטית</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <RecentActivity items={activity} now={fetchedAt} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
