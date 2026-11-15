import { z } from "zod";

const email = z
  .string({ error: "יש להזין אימייל" })
  .trim()
  .min(1, { error: "יש להזין אימייל" })
  .max(254, { error: "כתובת האימייל ארוכה מדי" })
  .pipe(z.email({ error: "כתובת אימייל לא תקינה" }))
  .transform((v) => v.toLowerCase());

export const passwordRules = "לפחות 8 תווים, כולל אות ומספר";

const newPassword = z
  .string({ error: "יש להזין סיסמה" })
  .min(8, { error: `הסיסמה קצרה מדי (${passwordRules})` })
  .max(72, { error: "הסיסמה ארוכה מדי (עד 72 תווים)" })
  .refine((v) => /[A-Za-z֐-׿]/.test(v) && /\d/.test(v), {
    error: `הסיסמה חייבת לכלול ${passwordRules}`,
  });

export const loginSchema = z.object({
  email,
  password: z.string({ error: "יש להזין סיסמה" }).min(1, { error: "יש להזין סיסמה" }),
});

export const signupSchema = z
  .object({
    fullName: z
      .string({ error: "יש להזין שם מלא" })
      .trim()
      .min(2, { error: "יש להזין שם מלא" })
      .max(80, { error: "השם ארוך מדי" }),
    email,
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    error: "הסיסמאות אינן תואמות",
  });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password: newPassword, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    error: "הסיסמאות אינן תואמות",
  });
