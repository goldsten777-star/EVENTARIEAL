"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { saveExpense, updateBudgetTotal } from "@/features/budget/actions";
import type { ExpenseRow } from "@/features/budget/queries";
import { FieldShell } from "@/components/forms/field-shell";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { useValidatedAction } from "@/components/forms/use-validated-action";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { initialFormState } from "@/lib/form-state";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/labels";
import { expenseFormInput, expenseSchema } from "@/lib/validation/expense";

const money = (v: number | undefined) => (v ? String(v) : "");

function ExpenseForm({ eventId, expense, onDone }: { eventId: string; expense: ExpenseRow | null; onDone: () => void }) {
  const { state, formProps, pending, errors, message, ok } = useValidatedAction(
    saveExpense.bind(null, eventId, expense?.id ?? null),
    expenseSchema,
    expenseFormInput,
  );
  useEffect(() => {
    if (state.ok) {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);

  const numberProps = { inputMode: "decimal" as const, dir: "ltr" as const, className: "text-start", placeholder: "0" };
  return (
    <form {...formProps} className="flex flex-col gap-5">
      {!ok ? <FormAlert message={message} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldShell label="קטגוריה" errors={errors.category}>
          {(control) => (
            <Select name="category" defaultValue={expense?.category ?? "venue"}>
              <SelectTrigger {...control} className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EXPENSE_CATEGORY_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FieldShell>
        <TextField label="ספק" name="vendorName" defaultValue={expense?.vendor_name ?? ""} errors={errors.vendorName} maxLength={120} autoFocus={!expense} />
      </div>
      <TextField label="תיאור" name="description" defaultValue={expense?.description ?? ""} errors={errors.description} maxLength={500} placeholder="לדוגמה: מקדמה, מנות ילדים" />
      <div className="grid grid-cols-3 gap-4">
        <TextField label="מתוכנן (₪)" name="plannedAmount" defaultValue={money(expense?.planned_amount)} errors={errors.plannedAmount} {...numberProps} />
        <TextField label="בפועל (₪)" name="actualAmount" defaultValue={money(expense?.actual_amount)} errors={errors.actualAmount} {...numberProps} />
        <TextField label="שולם (₪)" name="paidAmount" defaultValue={money(expense?.paid_amount)} errors={errors.paidAmount} {...numberProps} />
      </div>
      <TextField label="מועד תשלום" name="dueDate" type="date" dir="ltr" className="text-start" defaultValue={expense?.due_date ?? ""} errors={errors.dueDate} />
      <FieldShell label="הערות" errors={errors.notes}>
        {(control) => <Textarea {...control} name="notes" rows={2} maxLength={500} defaultValue={expense?.notes ?? ""} />}
      </FieldShell>
      <SubmitButton pending={pending} pendingText="שומרים…">
        {expense ? "שמירת השינויים" : "הוספת ההוצאה"}
      </SubmitButton>
    </form>
  );
}

export function ExpenseDialog({
  open,
  onOpenChange,
  formKey,
  eventId,
  expense,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formKey: number;
  eventId: string;
  expense: ExpenseRow | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{expense ? "עריכת הוצאה" : "הוצאה חדשה"}</DialogTitle>
          <DialogDescription>מתוכנן = הצעת המחיר, בפועל = הסכום הסופי, שולם = מה שכבר שולם לספק.</DialogDescription>
        </DialogHeader>
        {open ? <ExpenseForm key={formKey} eventId={eventId} expense={expense} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function BudgetForm({ eventId, current, onDone }: { eventId: string; current: number; onDone: () => void }) {
  const [state, action, pending] = useActionState(updateBudgetTotal.bind(null, eventId), initialFormState);
  useEffect(() => {
    if (state.ok) {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);
  return (
    <form action={action} className="flex flex-col gap-5">
      <TextField
        label="תקציב כולל (₪)"
        name="budgetTotal"
        inputMode="decimal"
        dir="ltr"
        className="text-start"
        defaultValue={state.values?.budgetTotal ?? (current ? String(current) : "")}
        errors={state.fieldErrors?.budgetTotal}
        autoFocus
      />
      <SubmitButton pending={pending} pendingText="שומרים…">
        שמירה
      </SubmitButton>
    </form>
  );
}

export function BudgetTotalDialog({
  open,
  onOpenChange,
  eventId,
  current,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  current: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>תקציב כולל</DialogTitle>
          <DialogDescription>הסכום שהתכננתם להוציא על האירוע כולו.</DialogDescription>
        </DialogHeader>
        {open ? <BudgetForm eventId={eventId} current={current} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
