import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DeleteEventCard } from "@/components/events/delete-event-card";
import { EventSettingsForm } from "@/components/events/event-settings-form";
import { GroupsManager } from "@/components/events/groups-manager";
import { FormAlert } from "@/components/forms/form-alert";
import { PageHeader } from "@/components/layout/page-header";
import { TeamManager } from "@/components/team/team-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getGroups, getTeam } from "@/features/team/queries";
import { requireEventSection } from "@/lib/auth/access";
import { isoToIsraelLocal } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "הגדרות וצוות" };

const TABS = ["details", "groups", "team"] as const;

export default async function SettingsPage({ params, searchParams }: PageProps<"/events/[eventId]/settings">) {
  const { eventId } = await params;
  const query = await searchParams;
  const access = await requireEventSection(eventId, "settings");

  const supabase = await createClient();
  const [{ data: event }, groups, team] = await Promise.all([
    supabase.from("events").select("*").eq("id", eventId).single(),
    getGroups(eventId),
    getTeam(eventId),
  ]);
  if (!event) notFound();

  const tab = TABS.find((t) => t === query.tab) ?? "details";
  const canDelete = access.isOwner || access.user.isPlatformAdmin;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="הגדרות וצוות" description="פרטי האירוע, קבוצות המוזמנים ואנשי הצוות שעובדים איתך." />

      {query.created ? (
        <FormAlert
          ok
          message="האירוע נוצר. השלימו את הפרטים, הוסיפו אנשי צוות אם צריך, ואז אפשר להתחיל להוסיף מוזמנים."
        />
      ) : null}

      <Tabs defaultValue={tab} className="gap-6">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="details">פרטי האירוע</TabsTrigger>
          <TabsTrigger value="groups">קבוצות</TabsTrigger>
          <TabsTrigger value="team">צוות והרשאות</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>פרטי האירוע</CardTitle>
              <CardDescription>הפרטים מופיעים בדף אישור ההגעה שהאורחים רואים.</CardDescription>
            </CardHeader>
            <CardContent>
              <EventSettingsForm
                eventId={eventId}
                initial={{
                  name: event.name,
                  eventType: event.event_type,
                  hostNames: event.host_names ?? "",
                  eventDate: isoToIsraelLocal(event.event_date),
                  venueName: event.venue_name ?? "",
                  venueAddress: event.venue_address ?? "",
                  rsvpDeadline: isoToIsraelLocal(event.rsvp_deadline),
                  budgetTotal: event.budget_total ? String(event.budget_total) : "",
                  status: event.status,
                  invitationMessage: event.invitation_message ?? "",
                }}
              />
            </CardContent>
          </Card>
          {canDelete ? <DeleteEventCard eventId={eventId} eventName={event.name} /> : null}
        </TabsContent>

        <TabsContent value="groups">
          <Card>
            <CardHeader>
              <CardTitle>קבוצות מוזמנים</CardTitle>
              <CardDescription>לדוגמה: משפחת הכלה, חברים מהעבודה, שכנים.</CardDescription>
            </CardHeader>
            <CardContent>
              <GroupsManager eventId={eventId} groups={groups} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team">
          <Card>
            <CardHeader>
              <CardTitle>צוות והרשאות</CardTitle>
              <CardDescription>
                מנהלי אירוע יכולים לערוך הכול, משתמשי צפייה רק לראות, וצוות כניסה עובד רק במסך ה-Check-in.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TeamManager
                eventId={eventId}
                ownerId={event.owner_id}
                currentUserId={access.user.id}
                members={team.members}
                invites={team.invites}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
