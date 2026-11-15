import Link from "next/link";
import {
  CalendarCheckIcon,
  ChartPieIcon,
  QrCodeIcon,
  UsersIcon,
  WalletIcon,
  ArmchairIcon,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

const features = [
  { icon: UsersIcon, title: "ניהול מוזמנים", text: "משפחות, קבוצות, ייבוא מ-Excel וזיהוי כפילויות." },
  { icon: CalendarCheckIcon, title: "אישורי הגעה", text: "קישור אישי לכל אורח, עדכון אוטומטי בזמן אמת." },
  { icon: ArmchairIcon, title: "סידורי ישיבה", text: "גרירה לשולחנות עם מניעת שיבוץ יתר." },
  { icon: WalletIcon, title: "מתנות ותקציב", text: "מעקב מתנות, הוצאות ותקציב מתוכנן מול בפועל." },
  { icon: QrCodeIcon, title: "Check-in", text: "כניסה מהירה עם חיפוש וסריקת QR ביום האירוע." },
  { icon: ChartPieIcon, title: "דוחות", text: "דשבורד חי, גרפים ודוחות לייצוא." },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="outline" size="lg">
            <Link href="/login">התחברות</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-4 py-12 sm:px-6 sm:py-20">
        <section className="flex max-w-2xl flex-col gap-6">
          <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            כל האירוע במקום אחד
          </h1>
          <p className="text-lg text-muted-foreground text-pretty">
            מוזמנים, אישורי הגעה, שולחנות, מתנות, תקציב וכניסה ביום האירוע. בעברית, מכל מכשיר.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="h-11 px-5 text-base">
              <Link href="/signup">יצירת חשבון</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-11 px-5 text-base">
              <Link href="/login">כבר יש לי חשבון</Link>
            </Button>
          </div>
        </section>

        <section aria-label="יכולות" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h2 className="font-semibold">{title}</h2>
              <p className="text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
