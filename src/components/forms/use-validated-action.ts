"use client";

import { useActionState, useState } from "react";
import { z } from "zod";
import { initialFormState, type FormState } from "@/lib/form-state";

/**
 * useActionState plus client-side validation with the same Zod schema the
 * Server Action uses: invalid forms never leave the browser, and the server
 * still validates everything it receives.
 */
export function useValidatedAction(
  action: (prev: FormState, formData: FormData) => Promise<FormState>,
  schema: z.ZodType,
  toInput: (formData: FormData) => unknown,
) {
  const [state, formAction] = useActionState(action, initialFormState);
  const [clientErrors, setClientErrors] = useState<Record<string, string[] | undefined> | null>(null);
  const [submittedAt, setSubmittedAt] = useState(0);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const result = schema.safeParse(toInput(new FormData(event.currentTarget)));
    if (!result.success) {
      event.preventDefault();
      setClientErrors(z.flattenError(result.error).fieldErrors as Record<string, string[]>);
      return;
    }
    setClientErrors(null);
    setSubmittedAt(Date.now());
  }

  const errors = clientErrors ?? state.fieldErrors ?? {};
  return {
    state,
    formAction,
    onSubmit,
    errors,
    // the server message belongs to the latest submission only
    message: clientErrors ? "יש לתקן את השדות המסומנים" : state.message,
    ok: !clientErrors && state.ok,
    submittedAt,
  };
}
