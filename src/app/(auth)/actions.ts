"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { authErrorMessage } from "@/lib/errors";
import { formValues, validationError, type FormState } from "@/lib/form-state";
import { requestOrigin } from "@/lib/request-origin";
import { safeNextPath } from "@/lib/safe-redirect";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/validation/auth";

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["email"]);
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, message: authErrorMessage(error), values };

  redirect(safeNextPath(formData.get("next")));
}

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["fullName", "email"]);
  const parsed = signupSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const origin = await requestOrigin();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${origin}/auth/callback?next=/events`,
    },
  });
  if (error) return { ok: false, message: authErrorMessage(error), values };

  // Email confirmation disabled → we already have a session.
  if (data.session) redirect("/events");

  // Same answer whether or not the address was already registered,
  // so the form cannot be used to discover who has an account.
  return {
    ok: true,
    message: `שלחנו מייל לאישור לכתובת ${parsed.data.email}. לחצו על הקישור שבמייל כדי להפעיל את החשבון.`,
  };
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["email"]);
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const origin = await requestOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  if (error && error.status === 429) {
    return { ok: false, message: authErrorMessage(error), values };
  }

  return {
    ok: true,
    message: "אם קיים חשבון עם הכתובת הזו, נשלח אליו קישור לאיפוס הסיסמה בדקות הקרובות.",
  };
}

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, message: authErrorMessage(error) };

  redirect("/events");
}

export async function signOut() {
  const supabase = await createClient();
  // "local" signs out this browser only, not the user's other devices
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
