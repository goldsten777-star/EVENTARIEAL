"use client";

import { useActionState, useState } from "react";
import { Trash2Icon } from "lucide-react";
import { deleteEvent } from "@/features/events/actions";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { initialFormState } from "@/lib/form-state";

function DeleteForm({ eventId, eventName }: { eventId: string; eventName: string }) {
  const [state, action] = useActionState(deleteEvent.bind(null, eventId), initialFormState);
  const [typed, setTyped] = useState("");
  return (
    <form action={action} className="flex flex-col gap-5">
      <FormAlert message={state.fieldErrors ? undefined : state.message} />
      <TextField
        label={`כדי לאשר, הקלידו את שם האירוע: ${eventName}`}
        name="confirmName"
        autoComplete="off"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        errors={state.fieldErrors?.confirmName}
      />
      <SubmitButton variant="destructive" disabled={typed.trim() !== eventName.trim()} pendingText="מוחקים…">
        מחיקה לצמיתות
      </SubmitButton>
    </form>
  );
}

export function DeleteEventCard({ eventId, eventName }: { eventId: string; eventName: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive-soft/40 p-5">
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold">מחיקת האירוע</h3>
        <p className="text-sm text-muted-foreground">
          כל המוזמנים, השולחנות, המתנות וההוצאות של האירוע יימחקו לצמיתות. לא ניתן לבטל פעולה זו.
        </p>
      </div>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="destructive" size="lg">
            <Trash2Icon aria-hidden="true" /> מחיקת האירוע
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>למחוק את האירוע?</DialogTitle>
            <DialogDescription>הפעולה תמחק את כל נתוני האירוע לצמיתות.</DialogDescription>
          </DialogHeader>
          <DeleteForm eventId={eventId} eventName={eventName} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
