"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { updateEvent } from "@/features/events/actions";
import { EventFormFields, type EventFormValues } from "@/components/events/event-form-fields";
import { FieldShell } from "@/components/forms/field-shell";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { useValidatedAction } from "@/components/forms/use-validated-action";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EVENT_STATUS_HINTS, EVENT_STATUS_LABELS } from "@/lib/labels";
import { eventFormInput, eventSettingsSchema } from "@/lib/validation/event";

export function EventSettingsForm({ eventId, initial }: { eventId: string; initial: EventFormValues }) {
  const { state, errors, message, ok, formProps, pending } = useValidatedAction(
    updateEvent.bind(null, eventId),
    eventSettingsSchema,
    eventFormInput,
  );

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
  }, [state]);

  // React resets uncontrolled fields after each submit; the server echoes them back
  const values = state.values ?? initial;

  return (
    <form {...formProps} className="flex flex-col gap-6">
      {!ok ? <FormAlert message={message} /> : null}
      {/* uncontrolled fields keep what the user typed across saves and errors */}
      <div className="flex flex-col gap-5">
        <EventFormFields values={values} errors={errors} />

        <FieldShell label="סטטוס" description={EVENT_STATUS_HINTS[(values.status as keyof typeof EVENT_STATUS_HINTS) ?? "active"]} errors={errors.status}>
          {(control) => (
            <Select name="status" defaultValue={values.status || "active"}>
              <SelectTrigger {...control} className="h-10 w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EVENT_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FieldShell>

        <FieldShell
          label="נוסח הודעת ההזמנה"
          description={
            <>
              ישמש לשליחת ההזמנות ב-WhatsApp. אפשר לשלב{" "}
              <bdi className="rounded bg-muted px-1 font-mono text-foreground">{"{שם}"}</bdi> לשם האורח ו-
              <bdi className="rounded bg-muted px-1 font-mono text-foreground">{"{קישור}"}</bdi> לקישור האישי לאישור
              הגעה.
            </>
          }
          errors={errors.invitationMessage}
        >
          {(control) => (
            <Textarea
              {...control}
              name="invitationMessage"
              rows={4}
              maxLength={2000}
              defaultValue={values.invitationMessage}
              placeholder="שלום {שם}, נשמח לראותכם באירוע שלנו! לאישור הגעה: {קישור}"
            />
          )}
        </FieldShell>
      </div>

      <div>
        <SubmitButton pending={pending} pendingText="שומרים…">שמירת השינויים</SubmitButton>
      </div>
    </form>
  );
}
