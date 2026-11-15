import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <p className="text-sm font-semibold text-primary">404</p>
      <h1 className="text-3xl font-bold">הדף לא נמצא</h1>
      <p className="text-muted-foreground">ייתכן שהקישור שגוי או שהדף הוסר.</p>
      <Button asChild size="lg">
        <Link href="/">חזרה לדף הבית</Link>
      </Button>
    </main>
  );
}
