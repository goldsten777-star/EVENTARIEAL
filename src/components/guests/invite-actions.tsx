"use client";

import { useEffect, useState } from "react";
import { CheckIcon, CopyIcon, DownloadIcon, MessageCircleIcon } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { bulkGuests } from "@/features/guests/actions";
import { Button } from "@/components/ui/button";
import { buildInvitationMessage, rsvpUrl, whatsappUrl } from "@/lib/rsvp/links";

export type InviteContext = { eventId: string; eventName: string; template: string | null };
type InviteGuest = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  invite_token: string;
  invitation_status: string;
};

function useOrigin() {
  const [origin, setOrigin] = useState("");
  // eslint-disable-next-line react-hooks/set-state-in-effect -- window is only available after mount
  useEffect(() => setOrigin(window.location.origin), []);
  return origin;
}

function messageFor(ctx: InviteContext, guest: InviteGuest, origin: string) {
  const link = rsvpUrl(origin, guest.invite_token);
  return {
    link,
    text: buildInvitationMessage(ctx.template, {
      name: `${guest.first_name} ${guest.last_name}`.trim(),
      link,
      event: ctx.eventName,
    }),
  };
}

/** Opening WhatsApp for a guest marks the invitation as sent. */
function markSent(ctx: InviteContext, guest: InviteGuest) {
  if (guest.invitation_status === "not_sent") void bulkGuests(ctx.eventId, [guest.id], { type: "invitation", status: "sent" });
}

/** Compact WhatsApp button for a table row. */
export function WhatsAppButton({ ctx, guest }: { ctx: InviteContext; guest: InviteGuest }) {
  const origin = useOrigin();
  const name = `${guest.first_name} ${guest.last_name}`.trim();
  if (!origin) return null;
  const { text } = messageFor(ctx, guest, origin);
  return (
    <Button asChild variant="ghost" size="icon" className="text-[#128c4a] hover:text-[#0d6b38]">
      <a
        href={whatsappUrl(guest.phone, text)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`שליחת הזמנה ב-WhatsApp ל${name}`}
        onClick={(e) => {
          e.stopPropagation();
          markSent(ctx, guest);
        }}
      >
        <MessageCircleIcon />
      </a>
    </Button>
  );
}

/** Personal link, WhatsApp message and QR code, shown in the guest panel. */
export function InvitePanel({ ctx, guest }: { ctx: InviteContext; guest: InviteGuest }) {
  const origin = useOrigin();
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const message = origin ? messageFor(ctx, guest, origin) : null;

  useEffect(() => {
    if (!message) return;
    QRCode.toDataURL(message.link, { margin: 1, width: 320, errorCorrectionLevel: "M" })
      .then(setQr)
      .catch(() => setQr(""));
  }, [message?.link]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!message) return null;
  const name = `${guest.first_name} ${guest.last_name}`.trim();

  async function copy() {
    try {
      await navigator.clipboard.writeText(message!.link);
      setCopied(true);
      toast.success("הקישור הועתק");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("לא ניתן להעתיק. סמנו את הקישור והעתיקו ידנית.");
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-muted/40 p-4 sm:flex-row sm:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div>
          <h3 className="font-semibold">הזמנה אישית</h3>
          <p className="text-xs text-muted-foreground">הקישור מוביל לדף אישור ההגעה של {name}.</p>
        </div>
        <input
          readOnly
          value={message.link}
          aria-label="קישור אישי לאישור הגעה"
          dir="ltr"
          onFocus={(e) => e.currentTarget.select()}
          className="h-9 w-full rounded-lg border bg-background px-2.5 text-xs text-muted-foreground"
        />
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" className="bg-[#128c4a] text-white hover:bg-[#0d6b38]">
            <a href={whatsappUrl(guest.phone, message.text)} target="_blank" rel="noopener noreferrer" onClick={() => markSent(ctx, guest)}>
              <MessageCircleIcon aria-hidden="true" /> שליחה ב-WhatsApp
            </a>
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void copy()}>
            {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />} העתקת קישור
          </Button>
          {qr ? (
            <Button asChild size="sm" variant="outline">
              <a href={qr} download={`QR ${name}.png`}>
                <DownloadIcon aria-hidden="true" /> הורדת QR
              </a>
            </Button>
          ) : null}
        </div>
        {!guest.phone ? (
          <p className="text-xs text-muted-foreground">אין טלפון שמור, WhatsApp ייפתח לבחירת איש קשר.</p>
        ) : null}
      </div>
      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element -- generated data URL
        <img src={qr} alt={`קוד QR לאישור ההגעה של ${name}`} width={128} height={128} className="size-32 shrink-0 self-center rounded-lg bg-white p-1" />
      ) : null}
    </div>
  );
}
