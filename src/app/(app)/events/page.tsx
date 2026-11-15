import type { Metadata } from "next";
import Link from "next/link";
import { CalendarIcon, CalendarPlusIcon, MapPinIcon } from "lucide-react";
import { CreateEventDialog } from "@/components/events/create-event-dialog";
import { FormAlert } from "@/components/forms/form-alert";
import { TopBar } from "@/components/layout/top-bar";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { getMyEvents } from "@/lib/auth/access";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { countdownLabel, daysUntil, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "האירועים שלי" };

export default async function EventsPage({ searchParams }: PageProps<"/events">) {
  const [user, events, query] = await Promise.all([requireUser(), getMyEvents(), searchParams]);

  return (
    <div className="flex flex-1 flex-col">
      <TopBar user={user} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
        <PageHeader
          title="האירועים שלי"
          description={user.fullName ? `שלום ${user.fullName}` : undefined}
          actions={events.length ? <CreateEventDialog defaultOpen={query.new === "1"} /> : null}
        />

        {query.deleted ? <FormAlert ok message="האירוע נמחק" /> : null}

        {events.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <CalendarPlusIcon className="size-6" aria-hidden="true" />
            </span>
            <h2 className="text-lg font-semibold">עוד אין לך אירועים</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              צרו את האירוע הראשון שלכם. אם צירפו אתכם לצוות של אירוע קיים, הוא יופיע כאן אוטומטית.
            </p>
            <CreateEventDialog defaultOpen={query.new === "1"} />
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => {
              const countdown = countdownLabel(daysUntil(event.event_date));
              return (
                <li key={event.id}>
                  <Link
                    href={`/events/${event.id}`}
                    className="flex h-full flex-col gap-4 rounded-2xl border bg-card p-5 transition-colors hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-lg font-semibold">{event.name}</h2>
                      {event.role ? <Badge variant="secondary">{ROLE_LABELS[event.role]}</Badge> : null}
                    </div>
                    <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <CalendarIcon className="size-4" aria-hidden="true" />
                        {event.event_date ? formatDate(event.event_date, { weekday: "long" }) : "תאריך טרם נקבע"}
                      </span>
                      {event.venue_name ? (
                        <span className="flex items-center gap-2">
                          <MapPinIcon className="size-4" aria-hidden="true" />
                          {event.venue_name}
                        </span>
                      ) : null}
                    </div>
                    {countdown ? (
                      <span className="mt-auto self-start rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
                        {countdown}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
