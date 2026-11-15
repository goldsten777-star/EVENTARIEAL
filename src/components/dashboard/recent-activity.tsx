import { CheckIcon, EyeIcon, LogInIcon, RotateCcwIcon, XIcon, type LucideIcon } from "lucide-react";
import type { DashboardData } from "@/features/dashboard/queries";

type Item = DashboardData["activity"][number];

const rtf = new Intl.RelativeTimeFormat("he", { numeric: "auto" });

function relative(iso: string, now: number) {
  const diff = (new Date(iso).getTime() - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "עכשיו";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

function describe(item: Item): { icon: LucideIcon; text: string } {
  const p = (item.payload ?? {}) as Record<string, unknown>;
  const people = Number(p.adults ?? 0) + Number(p.children ?? 0);
  const via = p.by_guest ? " דרך הקישור" : "";
  switch (item.action) {
    case "rsvp_updated":
      if (p.to === "attending") return { icon: CheckIcon, text: `אישרו הגעה${via} · ${people} משתתפים` };
      if (p.to === "declined") return { icon: XIcon, text: `עדכנו שלא יגיעו${via}` };
      if (p.to === "maybe") return { icon: RotateCcwIcon, text: "סומנו כ'אולי'" };
      return { icon: RotateCcwIcon, text: "התשובה אופסה לממתין" };
    case "checked_in":
      return { icon: LogInIcon, text: `נכנסו לאירוע · ${Number(p.arrived_count ?? 0)} אורחים` };
    case "check_in_undone":
      return { icon: RotateCcwIcon, text: "בוטל רישום הכניסה" };
    case "invitation_viewed":
      return { icon: EyeIcon, text: "פתחו את ההזמנה" };
    default:
      return { icon: RotateCcwIcon, text: "עדכון" };
  }
}

export function RecentActivity({ items, now }: { items: Item[]; now: number }) {
  if (!items.length) {
    return <p className="py-6 text-center text-sm text-muted-foreground">עוד אין פעילות. תשובות של אורחים יופיעו כאן.</p>;
  }
  return (
    <ul className="flex flex-col divide-y">
      {items.map((item) => {
        const { icon: Icon, text } = describe(item);
        const g = item.guest as { first_name: string; last_name: string } | null;
        return (
          <li key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="line-clamp-2 text-sm">
                <span className="font-semibold">{g ? `${g.first_name} ${g.last_name}`.trim() : "אורח שנמחק"}</span>{" "}
                {text}
              </span>
              <time dateTime={item.created_at} className="text-xs text-muted-foreground">
                {relative(item.created_at, now)}
              </time>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
