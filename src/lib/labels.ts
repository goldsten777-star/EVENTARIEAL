import type { Database } from "@/types/database";

type Enums = Database["public"]["Enums"];

export const EVENT_TYPE_LABELS: Record<Enums["event_type"], string> = {
  wedding: "חתונה",
  bar_mitzvah: "בר מצווה",
  bat_mitzvah: "בת מצווה",
  brit: "ברית / בריתה",
  birthday: "יום הולדת",
  corporate: "אירוע חברה",
  other: "אחר",
};

export const EVENT_STATUS_LABELS: Record<Enums["event_status"], string> = {
  draft: "טיוטה",
  active: "פעיל",
  completed: "הסתיים",
  archived: "בארכיון",
};

export const EVENT_STATUS_HINTS: Record<Enums["event_status"], string> = {
  draft: "בהכנה. אורחים כבר יכולים לאשר הגעה.",
  active: "פתוח לאישורי הגעה.",
  completed: "האירוע הסתיים. אישורי ההגעה סגורים.",
  archived: "מוסתר מרשימת האירועים הפעילים. אישורי ההגעה סגורים.",
};

/** Swatches offered for guest groups (all pass contrast as small chips). */
export const GROUP_COLORS = ["#1f3a93", "#0e6e52", "#c2554a", "#8a8f99", "#7a4fb5", "#b06a00", "#0f7490", "#a33c6e"];
