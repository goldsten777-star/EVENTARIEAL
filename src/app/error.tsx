"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="text-3xl font-bold">משהו השתבש</h1>
      <p className="max-w-md text-muted-foreground">
        אירעה שגיאה בלתי צפויה. אפשר לנסות שוב, ואם הבעיה חוזרת – לרענן את הדף.
      </p>
      {error.digest ? <p className="text-xs text-muted-foreground">קוד שגיאה: {error.digest}</p> : null}
      <Button size="lg" onClick={reset}>
        ניסיון נוסף
      </Button>
    </main>
  );
}
