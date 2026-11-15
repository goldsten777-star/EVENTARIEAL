import { whatsappNumber } from "@/lib/phone";

export function rsvpPath(token: string) {
  return `/r/${encodeURIComponent(token)}`;
}

export function rsvpUrl(origin: string, token: string) {
  return `${origin.replace(/\/$/, "")}${rsvpPath(token)}`;
}

export const DEFAULT_INVITATION = "שלום {שם}, נשמח לראותכם ב{אירוע}! לאישור הגעה: {קישור}";

/** Fills the event's invitation text; the link is appended if the text has no {קישור}. */
export function buildInvitationMessage(
  template: string | null | undefined,
  vars: { name: string; link: string; event: string },
) {
  const text = (template?.trim() || DEFAULT_INVITATION)
    .replaceAll("{שם}", vars.name)
    .replaceAll("{אירוע}", vars.event)
    .replaceAll("{קישור}", vars.link);
  return text.includes(vars.link) ? text : `${text}\n${vars.link}`;
}

/** wa.me link with a prefilled message; without a phone the user picks the chat. */
export function whatsappUrl(phoneE164: string | null | undefined, message: string) {
  const base = phoneE164 ? `https://wa.me/${whatsappNumber(phoneE164)}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(message)}`;
}
