import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function FormAlert({
  ok,
  message,
  className,
}: {
  ok?: boolean;
  message?: string;
  className?: string;
}) {
  if (!message) return null;
  const Icon = ok ? CircleCheckIcon : CircleAlertIcon;
  return (
    <div
      role={ok ? "status" : "alert"}
      className={cn(
        "flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm font-medium",
        ok ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive",
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
