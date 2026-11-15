"use client";

import { MailCheckIcon } from "lucide-react";
import { signup } from "@/app/(auth)/actions";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { useValidatedAction } from "@/components/forms/use-validated-action";
import { FieldGroup } from "@/components/ui/field";
import { passwordRules, signupSchema } from "@/lib/validation/auth";

export function SignupForm() {
  const { state, errors, message, ok, formProps, pending } = useValidatedAction(
    signup,
    signupSchema,
    (fd) => ({
      fullName: fd.get("fullName"),
      email: fd.get("email"),
      password: fd.get("password"),
      confirmPassword: fd.get("confirmPassword"),
    }),
  );

  if (ok) {
    return (
      <div role="status" className="flex flex-col items-center gap-4 rounded-2xl border bg-card p-8 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-success-soft text-success">
          <MailCheckIcon className="size-7" aria-hidden="true" />
        </span>
        <h2 className="text-xl font-bold">כמעט סיימנו</h2>
        <p className="text-muted-foreground">{message}</p>
        <p className="text-sm text-muted-foreground">לא קיבלתם מייל? בדקו בתיקיית הספאם.</p>
      </div>
    );
  }

  return (
    <form {...formProps} className="flex flex-col gap-6">
      <FormAlert ok={false} message={message} />
      <FieldGroup>
        <TextField
          label="שם מלא"
          name="fullName"
          autoComplete="name"
          defaultValue={state.values?.fullName}
          errors={errors.fullName}
          required
        />
        <TextField
          label="אימייל"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.values?.email}
          errors={errors.email}
          required
        />
        <TextField
          label="סיסמה"
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
      <SubmitButton pending={pending} pendingText="יוצרים חשבון…" className="w-full">
        יצירת חשבון
      </SubmitButton>
    </form>
  );
}
