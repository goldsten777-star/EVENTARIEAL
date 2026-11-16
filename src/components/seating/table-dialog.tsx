"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { FieldShell } from "@/components/forms/field-shell";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { useValidatedAction } from "@/components/forms/use-validated-action";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveTable } from "@/features/seating/actions";
import { TABLE_SHAPE_LABELS } from "@/lib/labels";
import type { SeatingTable } from "@/lib/seating/plan";
import { tableFormInput, tableSchema } from "@/lib/validation/table";

function TableForm({
  eventId,
  table,
  nextNumber,
  onDone,
}: {
  eventId: string;
  table: SeatingTable | null;
  nextNumber: number;
  onDone: () => void;
}) {
  const { state, formProps, pending, errors, message, ok } = useValidatedAction(
    saveTable.bind(null, eventId, table?.id ?? null),
    tableSchema,
    tableFormInput,
  );
  useEffect(() => {
    if (state.ok) {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);

  const numeric = { inputMode: "numeric" as const, dir: "ltr" as const, className: "text-start" };
  return (
    <form {...formProps} className="flex flex-col gap-5">
      {!ok ? <FormAlert message={message} /> : null}
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label={table ? "מספר שולחן" : "מספר (הראשון)"}
          name="number"
          defaultValue={String(table?.number ?? nextNumber)}
          errors={errors.number}
          {...numeric}
        />
        {table ? (
          <input type="hidden" name="count" value="1" />
        ) : (
          <TextField
            label="כמה שולחנות"
            name="count"
            defaultValue="1"
            errors={errors.count}
            description="שולחנות זהים במספרים עוקבים"
            {...numeric}
          />
        )}
      </div>
      <TextField
        label="שם (לא חובה)"
        name="name"
        defaultValue={table?.name ?? ""}
        errors={errors.name}
        maxLength={60}
        placeholder="לדוגמה: משפחת הכלה"
        description={table ? undefined : "נשמר רק כשמוסיפים שולחן אחד"}
      />
      <div className="grid grid-cols-2 gap-4">
        <TextField label="מקומות" name="capacity" defaultValue={String(table?.capacity ?? 10)} errors={errors.capacity} {...numeric} />
        <FieldShell label="צורה" errors={errors.shape}>
          {(control) => (
            <Select name="shape" defaultValue={table?.shape ?? "round"}>
              <SelectTrigger {...control} className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TABLE_SHAPE_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FieldShell>
      </div>
      <SubmitButton pending={pending} pendingText="שומרים…">
        {table ? "שמירת השינויים" : "הוספה"}
      </SubmitButton>
    </form>
  );
}

export function TableDialog({
  open,
  onOpenChange,
  formKey,
  eventId,
  table,
  nextNumber,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formKey: number;
  eventId: string;
  table: SeatingTable | null;
  nextNumber: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{table ? `עריכת שולחן ${table.number}` : "הוספת שולחנות"}</DialogTitle>
          <DialogDescription>
            {table ? "אי אפשר להקטין שולחן מתחת למספר המקומות שכבר משובצים בו." : "אפשר להוסיף כמה שולחנות זהים בבת אחת."}
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <TableForm key={formKey} eventId={eventId} table={table} nextNumber={nextNumber} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
