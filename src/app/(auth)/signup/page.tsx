import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "יצירת חשבון" };

export default function SignupPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">יצירת חשבון</h1>
        <p className="text-muted-foreground">פתחו חשבון והתחילו לנהל את האירוע הראשון שלכם.</p>
      </div>
      <SignupForm />
      <p className="text-center text-sm text-muted-foreground">
        כבר יש לכם חשבון?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          התחברות
        </Link>
      </p>
    </div>
  );
}
