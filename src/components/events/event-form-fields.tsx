"use client";

import { FieldShell } from "@/components/forms/field-shell";
import { TextField } from "@/components/forms/text-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EVENT_TYPE_LABELS } from "@/lib/labels";

export type EventFormValues = Partial<
  Record<
    | "name"
    | "eventType"
    | "hostNames"
    | "eventDate"
    | "venueName"
    | "venueAddress"
    | "rsvpDeadline"
    | "budgetTotal"
    | "status"
    | "invitationMessage",
    string
  >
>;

type Errors = Record<string, string[] | undefined>;

export function EventFormFields({ values, errors }: { values: EventFormValues; errors: Errors }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <TextField
          label="שם האירוע"
          name="name"
          placeholder="לדוגמה: החתונה של נועה ואיתי"
          defaultValue={values.name}
          errors={errors.name}
          required
          maxLength={120}
        />
      </div>

      <FieldShell label="סוג האירוע" errors={errors.eventType}>
        {(control) => (
          <Select name="eventType" defaultValue={values.eventType || "wedding"}>
            <SelectTrigger {...control} className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FieldShell>

      <TextField
        label="שמות המארחים"
        name="hostNames"
        placeholder="נועה ואיתי"
        description="יופיע בראש דף אישור ההגעה"
        defaultValue={values.hostNames}
        errors={errors.hostNames}
        maxLength={120}
      />

      <FieldShell label="תאריך ושעה" errors={errors.eventDate}>
        {(control) => (
          <Input {...control} type="datetime-local" name="eventDate" dir="ltr" className="text-start" defaultValue={values.eventDate} />
        )}
      </FieldShell>

      <FieldShell
        label="מועד אחרון לאישור הגעה"
        description="אחרי המועד הזה האורחים לא יוכלו לעדכן תשובה"
        errors={errors.rsvpDeadline}
      >
        {(control) => (
          <Input
            {...control}
            type="datetime-local"
            name="rsvpDeadline"
            dir="ltr"
            className="text-start"
            defaultValue={values.rsvpDeadline}
          />
        )}
      </FieldShell>

      <TextField
        label="שם המקום"
        name="venueName"
        placeholder="אולמי הגן"
        defaultValue={values.venueName}
        errors={errors.venueName}
        maxLength={120}
      />
      <TextField
        label="כתובת"
        name="venueAddress"
        placeholder="שדרות הגן 10, ראשון לציון"
        defaultValue={values.venueAddress}
        errors={errors.venueAddress}
        maxLength={200}
      />

      <TextField
        label="תקציב כולל (₪)"
        name="budgetTotal"
        inputMode="decimal"
        placeholder="0"
        dir="ltr"
        className="text-start"
        defaultValue={values.budgetTotal}
        errors={errors.budgetTotal}
      />
    </div>
  );
}
