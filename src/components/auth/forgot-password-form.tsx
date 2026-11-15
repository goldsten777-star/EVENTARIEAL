"use client";

import { requestPasswordReset } from "@/app/(auth)/actions";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { useValidatedAction } from "@/components/forms/use-validated-action";
import { forgotPasswordSchema } from "@/lib/validation/auth";

export function ForgotPasswordForm() {
  const { state, formAction, onSubmit, errors, message, ok } = useValidatedAction(
    requestPasswordReset,
    forgotPasswordSchema,
    (fd) => ({ email: fd.get("email") }),
  );

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <FormAlert ok={ok} message={message} />
      {ok ? null : (
        <>
          <TextField
            label="אימייל"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={state.values?.email}
            errors={errors.email}
            required
          />
          <SubmitButton pendingText="שולחים…" className="w-full">
            שליחת קישור לאיפוס
          </SubmitButton>
        </>
      )}
    </form>
  );
}
