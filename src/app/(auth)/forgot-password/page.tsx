import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "שחזור סיסמה" };

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">שחזור סיסמה</h1>
        <p className="text-muted-foreground">הזינו את האימייל של החשבון ונשלח אליו קישור לבחירת סיסמה חדשה.</p>
      </div>
      <ForgotPasswordForm />
      <Link href="/login" className="text-center text-sm font-medium text-primary hover:underline">
        חזרה להתחברות
      </Link>
    </div>
  );
}
