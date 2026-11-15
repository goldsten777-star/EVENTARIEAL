"use client";

import { Loader2Icon } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function SubmitButton({
  children,
  pendingText,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} aria-busy={pending} className={className} {...props}>
      {pending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : null}
      {pending ? (pendingText ?? children) : children}
    </Button>
  );
}
