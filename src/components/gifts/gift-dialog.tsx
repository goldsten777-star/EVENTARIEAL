"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { saveGift } from "@/features/gifts/actions";
import { FieldShell } from "@/components/forms/field-shell";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { useValidatedAction } from "@/components/forms/use-validated-action";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { giftFormInput, giftSchema } from "@/lib/validation/gift";
import { GuestPicker, type PickerGuest } from "./guest-picker";

export type EditableGift = {
  id: string;
  guest_id: string | null;
  amount: number;
  payment_method: string;
  received_at: string;
  notes: string | null;
};

function GiftForm({
  eventId,
  gift,
  guests,
  today,
  onDone,
}: {
  eventId: string;
  gift: EditableGift | null;
  guests: PickerGuest[];
  today: string;
  onDone: () => void;
}) {
  const { state, formProps, pending, errors, message, ok } = useValidatedAction(
    saveGift.bind(null, eventId, gift?.id ?? null),
    giftSchema,
    giftFormInput,
  );
  const [method, setMethod] = useState(gift?.payment_method ?? "bit");

  useEffect(() => {
    if (state.ok) {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);

  return (
    <form {...formProps} className="flex flex-col gap-5">
      {!ok ? <FormAlert message={message} /> : null}
      <FieldShell label="אורח" errors={errors.guestId}>
        {(control) => (
          <GuestPicker
            id={control.id}
            name="guestId"
            guests={guests}
            defaultValue={gift?.guest_id}
            invalid={!!errors.guestId?.length}
          />
        )}
      </FieldShell>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={method === "gift_item" ? "שווי (לא חובה)" : "סכום (₪)"}
          name="amount"
          inputMode="decimal"
          dir="ltr"
          className="text-start"
          defaultValue={gift ? String(gift.amount) : ""}
          errors={errors.amount}
          autoFocus={!gift}
        />
        <FieldShell label="אמצעי תשלום" errors={errors.paymentMethod}>
          {(control) => (
            <Select name="paymentMethod" value={method} onValueChange={setMethod}>
              <SelectTrigger {...control} className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FieldShell>
      </div>
      <TextField
        label="תאריך קבלה"
        name="receivedAt"
        type="date"
        dir="ltr"
        className="text-start"
        defaultValue={gift?.received_at ?? today}
        errors={errors.receivedAt}
      />
      <FieldShell label="הערות" errors={errors.notes}>
        {(control) => (
          <Textarea {...control} name="notes" rows={2} maxLength={500} defaultValue={gift?.notes ?? ""} placeholder="לדוגמה: צ׳ק דחוי ל-1.4" />
        )}
      </FieldShell>
      <SubmitButton pending={pending} pendingText="שומרים…">
        {gift ? "שמירת השינויים" : "רישום המתנה"}
      </SubmitButton>
    </form>
  );
}

export function GiftDialog({
  open,
  onOpenChange,
  formKey,
  ...props
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formKey: number;
  eventId: string;
  gift: EditableGift | null;
  guests: PickerGuest[];
  today: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{props.gift ? "עריכת מתנה" : "מתנה חדשה"}</DialogTitle>
          <DialogDescription>אפשר לשייך את המתנה לאורח מהרשימה, או להשאיר ללא שיוך.</DialogDescription>
        </DialogHeader>
        {open ? <GiftForm key={formKey} {...props} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
