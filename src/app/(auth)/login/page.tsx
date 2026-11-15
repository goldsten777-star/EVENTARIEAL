import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { safeNextPath } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "התחברות" };

const NOTICES: Record<string, string> = {
  link: "הקישור אינו תקף או שפג תוקפו. נסו שוב או בקשו קישור חדש.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeNextPath(params.next) : undefined;
  const notice = typeof params.error === "string" ? NOTICES[params.error] : undefined;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">ברוכים השבים</h1>
        <p className="text-muted-foreground">התחברו כדי לנהל את האירועים שלכם.</p>
      </div>
      <LoginForm next={next} notice={notice} />
      <p className="text-center text-sm text-muted-foreground">
        אין לכם חשבון?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          יצירת חשבון
        </Link>
      </p>
    </div>
  );
}
