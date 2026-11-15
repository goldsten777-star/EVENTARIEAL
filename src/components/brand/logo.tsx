import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
        <rect width="32" height="32" rx="9" className="fill-foreground" />
        <path
          d="M10 21V11h11M10 16h8M10 21h11"
          className="stroke-background"
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
      <span className="text-lg font-extrabold tracking-tight">Event Manager</span>
    </span>
  );
}
