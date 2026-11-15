"use client";

import { startTransition, useActionState, useState } from "react";
import { z } from "zod";
import { initialFormState, type FormState } from "@/lib/form-state";

/**
 * Form submission with client-side validation using the same Zod schema as
 * the Server Action (which validates again).
 *
 * The action is dispatched from onSubmit instead of <form action>, on
 * purpose: React resets <form action> forms after every submission, which
 * wipes what the user typed after a server-side error and even desyncs
 * controlled hidden inputs (selects) from what is on screen.
 * Editing a field clears that field's error.
 */
export function useValidatedAction(
  action: (prev: FormState, formData: FormData) => Promise<FormState>,
  schema: z.ZodType,
  toInput: (formData: FormData) => unknown,
) {
  const [state, dispatch, pending] = useActionState(action, initialFormState);
  const [clientErrors, setClientErrors] = useState<Record<string, string[] | undefined> | null>(null);
  const [edited, setEdited] = useState<{ state: FormState; fields: Set<string> }>({ state, fields: new Set() });
  const [submittedAt, setSubmittedAt] = useState(0);

  // a new server result (or a new submit) makes all its errors visible again
  const editedFields = edited.state === state ? edited.fields : new Set<string>();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setEdited({ state, fields: new Set() });
    const formData = new FormData(event.currentTarget);
    const result = schema.safeParse(toInput(formData));
    if (!result.success) {
      setClientErrors(z.flattenError(result.error).fieldErrors as Record<string, string[]>);
      return;
    }
    setClientErrors(null);
    setSubmittedAt(Date.now());
    startTransition(() => dispatch(formData));
  }

  /** Typing in a field hides that field's previous error. */
  function onChange(event: React.FormEvent<HTMLFormElement>) {
    const name = (event.target as HTMLInputElement).name;
    if (!name || editedFields.has(name)) return;
    setEdited({ state, fields: new Set(editedFields).add(name) });
  }

  const raw = clientErrors ?? state.fieldErrors ?? {};
  const errors = Object.fromEntries(Object.entries(raw).filter(([k]) => !editedFields.has(k)));
  const hasErrors = Object.values(errors).some((e) => e?.length);

  return {
    state,
    /** Spread onto the <form>. */
    formProps: { onSubmit, onChange, noValidate: true },
    pending,
    errors,
    // the server message belongs to the latest submission only
    message: clientErrors ? (hasErrors ? "יש לתקן את השדות המסומנים" : undefined) : state.message,
    ok: !clientErrors && state.ok,
    submittedAt,
  };
}
