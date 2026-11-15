import { redirect } from "next/navigation";
import { getEventAccess } from "@/lib/auth/access";
import { eventHomePath } from "@/lib/auth/permissions";

export default async function EventIndexPage({ params }: PageProps<"/events/[eventId]">) {
  const { eventId } = await params;
  const { role } = await getEventAccess(eventId);
  redirect(eventHomePath(eventId, role));
}
