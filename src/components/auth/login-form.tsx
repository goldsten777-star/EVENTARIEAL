"use client";

import Link from "next/link";
import { login } from "@/app/(auth)/actions";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { useValidatedAction } from "@/components/forms/use-validated-action";
import { FieldGroup } from "@/components/ui/field";
import { loginSchema } from "@/lib/validation/auth";

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const { state, errors, message, ok, formProps, pending } = useValidatedAction(
    login,
    loginSchema,
    (fd) => ({ email: fd.get("email"), password: fd.get("password") }),
  );

  return (
    <form {...formProps} className="flex flex-col gap-6">
      <input type="hidden" name="next" value={next ?? ""} />
      <FormAlert ok={ok} message={message ?? notice} />
      <FieldGroup>
        <TextField
          label="אימייל"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.values?.email}
          errors={errors.email}
          required
        />
        <div className="flex flex-col gap-2">
          <TextField
            label="סיסמה"
            name="password"
            type="password"
            autoComplete="current-password"
            errors={errors.password}
            required
          />
          <Link href="/forgot-password" className="self-start text-sm text-primary hover:underline">
            שכחתי סיסמה
          </Link>
        </div>
      </FieldGroup>
      <SubmitButton pending={pending} pendingText="מתחברים…" className="w-full">
        התחברות
      </SubmitButton>
    </form>
  );
}
