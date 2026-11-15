"use client";

import { useEffect, useMemo, useState } from "react";
import { TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";
import { saveGuest } from "@/features/guests/actions";
import { FieldShell } from "@/components/forms/field-shell";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { useValidatedAction } from "@/components/forms/use-validated-action";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RSVP_LABELS } from "@/lib/labels-guests";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { DIETARY_OPTIONS, guestFormInput, guestSchema } from "@/lib/validation/guest";
import type { Group, Guest, SeatingTable } from "./types";

const NONE = "__none__";

const PRESETS = [
  { label: "אדם אחד", adults: 1, children: 0 },
  { label: "זוג", adults: 2, children: 0 },
  { label: "משפחה", adults: 2, children: 2 },
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 border-t pt-5 first:border-t-0 first:pt-0">
      <legend className="mb-1 text-sm font-semibold text-muted-foreground">{title}</legend>
      {children}
    </fieldset>
  );
}

export function GuestForm({
  eventId,
  guest,
  guests,
  groups,
  tables,
  readOnly,
  onSaved,
  footerExtra,
}: {
  eventId: string;
  guest: Guest | null;
  guests: Guest[];
  groups: Group[];
  tables: SeatingTable[];
  readOnly: boolean;
  onSaved: (addAnother: boolean) => void;
  footerExtra?: React.ReactNode;
}) {
  const { state, errors, message, ok, formProps, pending } = useValidatedAction(
    saveGuest.bind(null, eventId, guest?.id ?? null),
    guestSchema,
    guestFormInput,
  );
  const [addAnother, setAddAnother] = useState(false);
  // after a rejected submit, React resets the form to these defaults
  const echo = state.ok ? undefined : state.values;

  const [adults, setAdults] = useState(String(guest?.invited_adults ?? 1));
  const [children, setChildren] = useState(String(guest?.invited_children ?? 0));
  const [phone, setPhone] = useState(guest?.phone ? formatPhone(guest.phone) : "");
  const [groupId, setGroupId] = useState(guest?.group_id ?? NONE);
  const [tableId, setTableId] = useState(guest?.table_id ?? NONE);
  const [rsvp, setRsvp] = useState<string>(guest?.rsvp_status ?? "pending");
  const [tags, setTags] = useState<string[]>(guest?.dietary_tags ?? []);

  useEffect(() => {
    if (state.ok) {
      toast.success(state.message);
      onSaved(addAnother);
    }
    // only react to a new server result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const invitedTotal = (Number(adults) || 0) + (Number(children) || 0);

  const duplicate = useMemo(() => {
    const e164 = normalizePhone(phone);
    if (!e164) return null;
    return guests.find((g) => g.phone === e164 && g.id !== guest?.id) ?? null;
  }, [phone, guests, guest?.id]);

  const inviters = useMemo(
    () => [...new Set(guests.map((g) => g.inviter_name).filter((v): v is string => !!v))].sort(),
    [guests],
  );
  const tagOptions = useMemo(
    () => [...new Set([...DIETARY_OPTIONS, ...guests.flatMap((g) => g.dietary_tags)])],
    [guests],
  );

  const showConfirmed = rsvp === "attending" || rsvp === "maybe";

  return (
    <form {...formProps} className="flex flex-col gap-6">
      {!ok ? <FormAlert message={message} /> : null}

      <fieldset disabled={readOnly} className="flex flex-col gap-6">
        <Section title="פרטי המוזמן">
          {!readOnly ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label="סוג ההזמנה">
              {PRESETS.map((p) => {
                const active = Number(adults) === p.adults && Number(children) === p.children;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setAdults(String(p.adults));
                      setChildren(String(p.children));
                    }}
                    aria-pressed={active}
                    className={cn(
                      "h-9 rounded-full border px-3.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      active ? "border-primary bg-accent text-accent-foreground" : "hover:bg-muted",
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="שם פרטי"
              name="firstName"
              defaultValue={echo?.firstName ?? guest?.first_name}
              placeholder="דנה / משפחת"
              errors={errors.firstName}
              maxLength={80}
              required
              autoFocus={!guest}
            />
            <TextField
              label="שם משפחה"
              name="lastName"
              defaultValue={echo?.lastName ?? guest?.last_name}
              errors={errors.lastName}
              maxLength={80}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <TextField
                label="טלפון נייד"
                name="phone"
                type="tel"
                inputMode="tel"
                dir="ltr"
                className="text-start"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="050-1234567"
                errors={errors.phone}
              />
              {duplicate && !errors.phone?.some((e) => e.includes("כבר שייך")) ? (
                <p role="alert" className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
                  <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  המספר כבר שייך ל{duplicate.first_name} {duplicate.last_name}. לא ניתן לשמור שתי הזמנות עם אותו טלפון.
                </p>
              ) : null}
            </div>
            <TextField
              label="אימייל"
              name="email"
              type="email"
              defaultValue={echo?.email ?? guest?.email ?? ""}
              errors={errors.email}
            />
          </div>
        </Section>

        <Section title="שיוך">
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldShell label="קבוצה" errors={errors.groupId}>
              {(control) => (
                <>
                  <input type="hidden" name="groupId" value={groupId === NONE ? "" : groupId} />
                  <Select value={groupId} onValueChange={setGroupId}>
                    <SelectTrigger {...control} className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>ללא קבוצה</SelectItem>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          <span className="size-2.5 rounded-full" style={{ background: g.color }} aria-hidden="true" />
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
            </FieldShell>
            <FieldShell label="שם המזמין" description="לדוגמה: צד הכלה, צד החתן" errors={errors.inviterName}>
              {(control) => (
                <>
                  <Input {...control} name="inviterName" list="inviters" defaultValue={echo?.inviterName ?? guest?.inviter_name ?? ""} maxLength={80} />
                  <datalist id="inviters">
                    {inviters.map((i) => (
                      <option key={i} value={i} />
                    ))}
                  </datalist>
                </>
              )}
            </FieldShell>
          </div>
          <FieldShell label="שולחן" errors={errors.tableId}>
            {(control) => (
              <>
                <input type="hidden" name="tableId" value={tableId === NONE ? "" : tableId} />
                <Select value={tableId} onValueChange={setTableId}>
                  <SelectTrigger {...control} className="h-10 w-full sm:w-1/2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>ללא שולחן</SelectItem>
                    {tables.map((t) => {
                      const mine = guest?.table_id === t.id ? (guest.seats_needed ?? 0) : 0;
                      const free = t.capacity - t.used + mine;
                      return (
                        <SelectItem key={t.id} value={t.id}>
                          שולחן {t.number}
                          {t.name ? ` · ${t.name}` : ""} ({free > 0 ? `${free} פנויים` : "מלא"})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </>
            )}
          </FieldShell>
        </Section>

        <Section title="מוזמנים ומקומות">
          <div className="grid grid-cols-3 gap-4">
            <TextField
              label="מבוגרים"
              name="invitedAdults"
              type="number"
              min={0}
              max={50}
              inputMode="numeric"
              value={adults}
              onChange={(e) => setAdults(e.target.value)}
              errors={errors.invitedAdults}
            />
            <TextField
              label="ילדים"
              name="invitedChildren"
              type="number"
              min={0}
              max={50}
              inputMode="numeric"
              value={children}
              onChange={(e) => setChildren(e.target.value)}
              errors={errors.invitedChildren}
            />
            <TextField
              label="מקומות שמורים"
              name="reservedSeats"
              type="number"
              min={1}
              max={100}
              inputMode="numeric"
              placeholder={String(invitedTotal || "")}
              defaultValue={
                echo?.reservedSeats ??
                (guest && guest.reserved_seats !== guest.invited_adults + guest.invited_children
                  ? String(guest.reserved_seats)
                  : "")
              }
              description="ריק = כמספר המוזמנים"
              errors={errors.reservedSeats}
            />
          </div>
        </Section>

        <Section title="אישור הגעה">
          <div className="grid gap-4 sm:grid-cols-3">
            <FieldShell label="סטטוס" errors={errors.rsvpStatus}>
              {(control) => (
                <Select name="rsvpStatus" value={rsvp} onValueChange={setRsvp}>
                  <SelectTrigger {...control} className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(RSVP_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FieldShell>
            {showConfirmed ? (
              <>
                <TextField
                  label="מבוגרים שאישרו"
                  name="confirmedAdults"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  defaultValue={echo?.confirmedAdults ?? (guest?.confirmed_adults ? String(guest.confirmed_adults) : adults)}
                  errors={errors.confirmedAdults}
                />
                <TextField
                  label="ילדים שאישרו"
                  name="confirmedChildren"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  defaultValue={echo?.confirmedChildren ?? (guest?.confirmed_adults ? String(guest.confirmed_children) : children)}
                  errors={errors.confirmedChildren}
                />
              </>
            ) : null}
          </div>
          {guest?.rsvp_note ? (
            <p className="rounded-lg bg-muted px-3 py-2 text-sm">
              <span className="font-medium">הערת האורח: </span>
              {guest.rsvp_note}
            </p>
          ) : null}
        </Section>

        <Section title="העדפות מזון ורגישויות">
          <div className="flex flex-wrap gap-2" role="group" aria-label="העדפות מזון">
            {tagOptions.map((tag) => {
              const on = tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setTags((t) => (on ? t.filter((x) => x !== tag) : [...t, tag]))}
                  className={cn(
                    "h-9 rounded-full border px-3.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60",
                    on ? "border-primary bg-accent text-accent-foreground" : "hover:bg-muted",
                  )}
                >
                  {tag}
                </button>
              );
            })}
          </div>
          {tags.map((t) => (
            <input key={t} type="hidden" name="dietaryTags" value={t} />
          ))}
          <TextField
            label="הערות תזונה"
            name="dietaryNotes"
            defaultValue={echo?.dietaryNotes ?? guest?.dietary_notes ?? ""}
            placeholder="לדוגמה: אלרגיה לשומשום"
            errors={errors.dietaryNotes}
            maxLength={500}
          />
        </Section>

        <Section title="הערות">
          <FieldShell label="הערות אישיות" errors={errors.notes}>
            {(control) => (
              <Textarea {...control} name="notes" rows={3} maxLength={1000} defaultValue={echo?.notes ?? guest?.notes ?? ""} />
            )}
          </FieldShell>
        </Section>
      </fieldset>

      {!readOnly ? (
        <div className="sticky bottom-0 -mx-6 flex flex-wrap items-center gap-2 border-t bg-background px-6 py-4">
          <SubmitButton pending={pending} pendingText="שומרים…" onClick={() => setAddAnother(false)}>
            {guest ? "שמירת השינויים" : "הוספה"}
          </SubmitButton>
          {!guest ? (
            <SubmitButton pending={pending} variant="outline" pendingText="שומרים…" onClick={() => setAddAnother(true)}>
              הוספה והמשך לבא
            </SubmitButton>
          ) : null}
          <div className="ms-auto">{footerExtra}</div>
        </div>
      ) : null}
    </form>
  );
}
