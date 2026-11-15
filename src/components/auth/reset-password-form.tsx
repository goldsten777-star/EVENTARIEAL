"use client";

import { resetPassword } from "@/app/(auth)/actions";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { useValidatedAction } from "@/components/forms/use-validated-action";
import { FieldGroup } from "@/components/ui/field";
import { passwordRules, resetPasswordSchema } from "@/lib/validation/auth";

export function ResetPasswordForm() {
  const { formAction, onSubmit, errors, message, ok } = useValidatedAction(
    resetPassword,
    resetPasswordSchema,
    (fd) => ({ password: fd.get("password"), confirmPassword: fd.get("confirmPassword") }),
  );

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <FormAlert ok={ok} message={message} />
      <FieldGroup>
        <TextField
          label="סיסמה חדשה"
          name="password"
          type="password"
          autoComplete="new-password"
          description={passwordRules}
          errors={errors.password}
          required
        />
        <TextField
          label="אימות סיסמה"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          errors={errors.confirmPassword}
          required
        />
      </FieldGroup>
      <SubmitButton pendingText="שומרים…" className="w-full">
        שמירת סיסמה חדשה
      </SubmitButton>
    </form>
  );
}
