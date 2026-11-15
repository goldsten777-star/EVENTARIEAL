import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "בחירת סיסמה חדשה" };

export default async function ResetPasswordPage() {
  // reached through the email link, which signs the user in first
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">בחירת סיסמה חדשה</h1>
        <p className="text-muted-foreground">
          עבור החשבון <span dir="ltr">{user.email}</span>
        </p>
      </div>
      <ResetPasswordForm />
    </div>
  );
}
