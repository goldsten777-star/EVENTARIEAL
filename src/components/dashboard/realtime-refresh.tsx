"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Re-renders the page when guests of this event change (an RSVP arrives,
 * someone checks in, a manager edits). Realtime respects RLS, so the socket
 * must carry the user's token before subscribing; otherwise it connects as
 * anonymous and silently receives nothing.
 */
export function RealtimeRefresh({ eventId }: { eventId: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled || !data.session) return;
      await supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`dashboard:${eventId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "guests", filter: `event_id=eq.${eventId}` }, () => {
          // coalesce bursts (bulk imports) into one refresh
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => router.refresh(), 800);
        })
        .subscribe((status) => setLive(status === "SUBSCRIBED"));
    })();

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [eventId, router]);

  // marks when live updates are connected (also lets tests wait for it)
  return <span hidden data-realtime={live ? "live" : "connecting"} />;
}
