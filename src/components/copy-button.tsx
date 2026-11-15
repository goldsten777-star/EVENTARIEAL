"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Copies text to the clipboard. `path` values are resolved against the current origin. */
export function CopyButton({ value, path, label = "העתקה", ...props }: { value?: string; path?: string; label?: string } & React.ComponentProps<typeof Button>) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    const text = value ?? `${window.location.origin}${path ?? ""}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("הועתק");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("לא ניתן להעתיק. סמנו את הטקסט והעתיקו ידנית.");
    }
  }
  return (
    <Button type="button" variant="outline" onClick={copy} {...props}>
      {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
      {label}
    </Button>
  );
}
