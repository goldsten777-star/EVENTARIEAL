"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { createEvent } from "@/features/events/actions";
import { EventFormFields } from "@/components/events/event-form-fields";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { useValidatedAction } from "@/components/forms/use-validated-action";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { eventFormInput, eventSchema } from "@/lib/validation/event";

function CreateEventForm() {
  const { state, formAction, onSubmit, errors, message, ok } = useValidatedAction(
    createEvent,
    eventSchema,
    eventFormInput,
  );
  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <FormAlert ok={ok} message={message} />
      <EventFormFields values={state.values ?? {}} errors={errors} />
      <DialogFooter className="gap-2 sm:justify-start">
        <SubmitButton pendingText="יוצרים…">יצירת האירוע</SubmitButton>
        <DialogClose asChild>
          <Button type="button" variant="outline" size="lg">
            ביטול
          </Button>
        </DialogClose>
      </DialogFooter>
    </form>
  );
}

export function CreateEventDialog({
  defaultOpen = false,
  trigger,
}: {
  defaultOpen?: boolean;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="lg">
            <PlusIcon aria-hidden="true" /> אירוע חדש
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">אירוע חדש</DialogTitle>
          <DialogDescription>
            אפשר להתחיל רק עם שם, ולהשלים את שאר הפרטים בהמשך במסך ההגדרות.
          </DialogDescription>
        </DialogHeader>
        {/* remount on every open so a reopened dialog starts clean */}
        {open ? <CreateEventForm /> : null}
      </DialogContent>
    </Dialog>
  );
}
