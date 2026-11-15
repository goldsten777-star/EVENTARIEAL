import { redirect } from "next/navigation";
import { requireEventSection } from "@/lib/auth/access";

/** Invitations are sent from the guest list (WhatsApp button per guest). */
export default async function InvitationsPage({ params }: PageProps<"/events/[eventId]/invitations">) {
  const { eventId } = await params;
  await requireEventSection(eventId, "invitations");
  redirect(`/events/${eventId}/guests`);
}
