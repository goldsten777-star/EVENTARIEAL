"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { Constants } from "@/types/database";

const schema = z.object({
  token: z.string().min(16).max(64),
  status: z.enum(Constants.public.Enums.rsvp_status),
  adults: z.number().int().min(0).max(100),
  children: z.number().int().min(0).max(100),
  note: z.string().max(500),
});

export type RsvpResult = { ok: true; status: "attending" | "declined" } | { ok: false; message: string };

/** Public (no login): the database function validates the token, deadline and seat limit. */
export async function submitRsvp(input: z.input<typeof schema>): Promise<RsvpResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "הנתונים שנשלחו אינם תקינים" };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_rsvp", {
    p_token: d.token,
    p_status: d.status,
    p_adults: d.adults,
    p_children: d.children,
    p_note: d.note,
  });
  if (error) {
    return { ok: false, message: error.code === "P0001" ? error.message : "לא הצלחנו לשמור את התשובה. נסו שוב." };
  }
  return { ok: true, status: d.status === "attending" ? "attending" : "declined" };
}
