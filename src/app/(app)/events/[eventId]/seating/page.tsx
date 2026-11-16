import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { SeatingView } from "@/components/seating/seating-view";
import { getSeatingData } from "@/features/seating/queries";
import { requireEventSection } from "@/lib/auth/access";
import { can } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "סידורי ישיבה" };

export default async function Page({ params }: PageProps<"/events/[eventId]/seating">) {
  const { eventId } = await params;
  const access = await requireEventSection(eventId, "seating");
  const { tables, guests, groups } = await getSeatingData(eventId);
  const canEdit = can(access.role, "manage");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="סידורי ישיבה"
        description={
          canEdit
            ? "גררו אורחים מהרשימה לשולחנות, או השתמשו בכפתור ההעברה שליד כל אורח. שולחן מלא לא יקבל עוד אורחים."
            : "תצוגת השולחנות והאורחים שמשובצים בהם."
        }
      />
      <SeatingView eventId={eventId} tables={tables} guests={guests} groups={groups} canEdit={canEdit} />
    </div>
  );
}
