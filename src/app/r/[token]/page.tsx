import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Frank_Ruhl_Libre } from "next/font/google";
import { CalendarIcon, MapPinIcon } from "lucide-react";
import { RsvpForm } from "@/components/rsvp/rsvp-form";
import { formatDate, formatDateTime } from "@/lib/format";
import { EVENT_TYPE_LABELS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

const display = Frank_Ruhl_Libre({ subsets: ["hebrew"], weight: ["700"], display: "swap" });

export const metadata: Metadata = {
  title: "אישור הגעה",
  robots: { index: false, follow: false },
};

type Invitation = {
  guest: {
    first_name: string;
    last_name: string;
    reserved_seats: number;
    invited_adults: number;
    invited_children: number;
    rsvp_status: Database["public"]["Enums"]["rsvp_status"];
    confirmed_adults: number;
    confirmed_children: number;
    rsvp_note: string | null;
  };
  event: {
    name: string;
    event_type: Database["public"]["Enums"]["event_type"];
    host_names: string | null;
    event_date: string | null;
    venue_name: string | null;
    venue_address: string | null;
    rsvp_deadline: string | null;
  };
  is_open: boolean;
};

export default async function RsvpPage({ params }: PageProps<"/r/[token]">) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.rpc("get_rsvp", { p_token: token });
  if (!data) notFound();
  const { guest, event, is_open } = data as unknown as Invitation;

  const greeting = `${guest.first_name} ${guest.last_name}`.trim();
  const mapsUrl = event.venue_address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venue_address)}`
    : null;

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col bg-background">
      <header className="flex flex-col items-center gap-3 bg-[#15171c] px-6 pt-12 pb-16 text-center text-[#f6f6f3]">
        <p className="text-sm text-[#c9cbd1]">
          הנכם מוזמנים {event.event_type === "wedding" ? "לחתונה של" : `ל${EVENT_TYPE_LABELS[event.event_type]}`}
        </p>
        <h1 className={`${display.className} text-4xl leading-tight font-bold text-balance`}>
          {event.host_names || event.name}
        </h1>
        <div className="h-px w-10 bg-[#c9a45c]" aria-hidden="true" />
        {event.event_date ? (
          <p className="text-sm text-[#c9cbd1]">{formatDate(event.event_date, { weekday: "long" })}</p>
        ) : null}
      </header>

      <section className="relative z-10 mx-4 -mt-9 mb-6 flex flex-col gap-5 rounded-3xl border bg-card p-5 shadow-lg">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-xl font-bold">שלום {greeting},</h2>
          <p className="text-muted-foreground">
            נשמח מאוד לחגוג איתכם. שמרנו עבורכם{" "}
            <strong className="text-foreground">
              {guest.reserved_seats === 1 ? "מקום אחד" : `${guest.reserved_seats} מקומות`}
            </strong>
            .{event.rsvp_deadline && is_open ? ` נודה לאישור עד ${formatDate(event.rsvp_deadline)}.` : ""}
          </p>
        </div>

        <ul className="flex flex-col gap-2.5 text-sm">
          {event.event_date ? (
            <li className="flex items-center gap-2.5">
              <CalendarIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {formatDateTime(event.event_date)}
            </li>
          ) : null}
          {event.venue_name || event.venue_address ? (
            <li className="flex items-center gap-2.5">
              <MapPinIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>
                {[event.venue_name, event.venue_address].filter(Boolean).join(", ")}
                {mapsUrl ? (
                  <>
                    {" · "}
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-4 hover:underline">
                      ניווט
                    </a>
                  </>
                ) : null}
              </span>
            </li>
          ) : null}
        </ul>

        <RsvpForm
          token={token}
          reserved={guest.reserved_seats}
          isOpen={is_open}
          deadlineText={event.rsvp_deadline ? formatDate(event.rsvp_deadline) : null}
          initial={{
            status: guest.rsvp_status,
            // first answer: start from who was invited; later: from the last answer
            adults: guest.rsvp_status === "attending" ? guest.confirmed_adults : guest.invited_adults,
            children: guest.rsvp_status === "attending" ? guest.confirmed_children : guest.invited_children,
            note: guest.rsvp_note ?? "",
          }}
        />
      </section>

      <p className="pb-8 text-center text-xs text-muted-foreground">הקישור אישי, אנא אל תעבירו אותו הלאה</p>
    </main>
  );
}
