import { HammerIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

/** Temporary content for sections whose module is not built yet. */
export function ModulePlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} />
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <HammerIcon className="size-6" aria-hidden="true" />
        </span>
        <h2 className="font-semibold">המסך הזה בבנייה</h2>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
