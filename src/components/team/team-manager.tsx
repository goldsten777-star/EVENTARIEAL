"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { ClockIcon, UserMinusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { cancelInvite, changeMemberRole, inviteMember, removeMember } from "@/features/team/actions";
import { CopyButton } from "@/components/copy-button";
import { FieldShell } from "@/components/forms/field-shell";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { initials } from "@/components/layout/user-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type EventRole } from "@/lib/auth/permissions";
import { initialFormState, type FormState } from "@/lib/form-state";
import { formatDate } from "@/lib/format";

export type TeamMember = {
  user_id: string;
  role: EventRole;
  profile: { full_name: string; email: string } | null;
};
export type TeamInvite = { id: string; email: string; role: EventRole; created_at: string };

const ROLES = Object.keys(ROLE_LABELS) as EventRole[];

function report(r: FormState) {
  if (r.ok) toast.success(r.message);
  else toast.error(r.message);
}

function RoleSelect({
  eventId,
  member,
  label,
}: {
  eventId: string;
  member: TeamMember;
  label: string;
}) {
  const [pending, start] = useTransition();
  return (
    <Select
      value={member.role}
      disabled={pending}
      onValueChange={(role) => start(async () => report(await changeMemberRole(eventId, member.user_id, role)))}
    >
      <SelectTrigger className="h-9 w-40" aria-label={`תפקיד של ${label}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((r) => (
          <SelectItem key={r} value={r}>
            {ROLE_LABELS[r]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RemoveMemberButton({ eventId, member, label }: { eventId: string; member: TeamMember; label: string }) {
  const [pending, start] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`הסרת ${label} מהצוות`} disabled={pending}>
          <UserMinusIcon />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>להסיר את {label} מהצוות?</AlertDialogTitle>
          <AlertDialogDescription>הגישה לאירוע תיחסם מיד. אפשר להוסיף אותו/ה מחדש בכל עת.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            variant="destructive"
            onClick={() => start(async () => report(await removeMember(eventId, member.user_id)))}
          >
            הסרה
          </AlertDialogAction>
          <AlertDialogCancel>ביטול</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CancelInviteButton({ eventId, invite }: { eventId: string; invite: TeamInvite }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`ביטול ההזמנה של ${invite.email}`}
      disabled={pending}
      onClick={() => start(async () => report(await cancelInvite(eventId, invite.id)))}
    >
      <XIcon />
    </Button>
  );
}

function InviteForm({ eventId }: { eventId: string }) {
  const [state, action] = useActionState(inviteMember.bind(null, eventId), initialFormState);
  const formRef = useRef<HTMLFormElement>(null);
  const [role, setRole] = useState<EventRole>("viewer");

  useEffect(() => {
    if (state.ok) {
      toast.success(state.message);
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-4">
      {!state.ok && !state.fieldErrors ? <FormAlert message={state.message} /> : null}
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem_auto] sm:items-start">
        <TextField
          label="אימייל"
          name="email"
          type="email"
          autoComplete="off"
          defaultValue={state.ok ? "" : state.values?.email}
          errors={state.fieldErrors?.email}
          required
        />
        <FieldShell label="תפקיד" description={ROLE_DESCRIPTIONS[role]} errors={state.fieldErrors?.role}>
          {(control) => (
            <Select name="role" value={role} onValueChange={(v) => setRole(v as EventRole)}>
              <SelectTrigger {...control} className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FieldShell>
        <SubmitButton pendingText="מוסיפים…" className="sm:mt-6">
          הוספה לצוות
        </SubmitButton>
      </div>
    </form>
  );
}

export function TeamManager({
  eventId,
  ownerId,
  currentUserId,
  members,
  invites,
}: {
  eventId: string;
  ownerId: string;
  currentUserId: string;
  members: TeamMember[];
  invites: TeamInvite[];
}) {
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="invite-title" className="flex flex-col gap-3">
        <h3 id="invite-title" className="font-semibold">
          הוספת איש צוות
        </h3>
        <InviteForm eventId={eventId} />
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          <span className="flex-1">
            מי שעדיין אין לו חשבון יקבל גישה אוטומטית כשיירשם עם אותו אימייל. אפשר לשלוח לו את קישור ההרשמה:
          </span>
          <CopyButton path="/signup" label="העתקת קישור הרשמה" size="sm" />
        </div>
      </section>

      <section aria-labelledby="members-title" className="flex flex-col gap-3">
        <h3 id="members-title" className="font-semibold">
          חברי הצוות ({members.length})
        </h3>
        <ul className="divide-y rounded-xl border">
          {members.map((m) => {
            const name = m.profile?.full_name || m.profile?.email || "משתמש";
            const isOwner = m.user_id === ownerId;
            const isMe = m.user_id === currentUserId;
            return (
              <li key={m.user_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-muted text-sm font-semibold">
                  {initials(m.profile?.full_name ?? "", m.profile?.email ?? "?")}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">
                    {name}
                    {isMe ? <span className="text-muted-foreground"> (את/ה)</span> : null}
                  </span>
                  <span className="truncate text-xs text-muted-foreground" dir="ltr">
                    {m.profile?.email}
                  </span>
                </span>
                {isOwner ? (
                  <Badge>בעלים · {ROLE_LABELS.event_manager}</Badge>
                ) : (
                  <div className="flex items-center gap-1">
                    <RoleSelect eventId={eventId} member={m} label={name} />
                    <RemoveMemberButton eventId={eventId} member={m} label={name} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {invites.length ? (
        <section aria-labelledby="invites-title" className="flex flex-col gap-3">
          <h3 id="invites-title" className="font-semibold">
            ממתינים להרשמה ({invites.length})
          </h3>
          <ul className="divide-y rounded-xl border">
            {invites.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-4 py-3">
                <ClockIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium" dir="ltr">
                    {i.email}
                  </span>
                  <span className="text-xs text-muted-foreground">הוזמן/ה ב-{formatDate(i.created_at)}</span>
                </span>
                <Badge variant="secondary">{ROLE_LABELS[i.role]}</Badge>
                <CancelInviteButton eventId={eventId} invite={i} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
