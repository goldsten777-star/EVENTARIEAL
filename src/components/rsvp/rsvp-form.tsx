"use client";

import { useState, useTransition } from "react";
import { CheckIcon, HeartIcon, Loader2Icon, MinusIcon, PlusIcon, XIcon } from "lucide-react";
import { submitRsvp } from "@/features/rsvp/actions";
import { cn } from "@/lib/utils";

type Props = {
  token: string;
  reserved: number;
  initial: { status: string; adults: number; children: number; note: string };
  isOpen: boolean;
  deadlineText: string | null;
};

function Stepper({
  label,
  hint,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border px-4 py-3">
      <div>
        <div className="font-semibold">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`הוספת ${label}`}
          className="flex size-11 items-center justify-center rounded-xl border hover:bg-muted disabled:opacity-40"
        >
          <PlusIcon className="size-5" />
        </button>
        <output aria-live="polite" aria-label={label} className="w-10 text-center text-xl font-bold tabular-nums">
          {value}
        </output>
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`הפחתת ${label}`}
          className="flex size-11 items-center justify-center rounded-xl border hover:bg-muted disabled:opacity-40"
        >
          <MinusIcon className="size-5" />
        </button>
      </div>
    </div>
  );
}

export function RsvpForm({ token, reserved, initial, isOpen, deadlineText }: Props) {
  const answered = initial.status === "attending" || initial.status === "declined";
  const [screen, setScreen] = useState<"form" | "attending" | "declined">(
    answered ? (initial.status as "attending" | "declined") : "form",
  );
  const [choice, setChoice] = useState<"attending" | "declined" | null>(answered ? (initial.status as "attending" | "declined") : null);
  const [adults, setAdults] = useState(Math.max(1, Math.min(initial.adults, reserved)));
  const [children, setChildren] = useState(Math.max(0, Math.min(initial.children, reserved - Math.max(1, Math.min(initial.adults, reserved)))));
  const [note, setNote] = useState(initial.note);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const total = adults + children;
  const over = total > reserved;

  function submit() {
    if (!choice || (choice === "attending" && over)) return;
    setError("");
    start(async () => {
      const r = await submitRsvp({
        token,
        status: choice,
        adults: choice === "attending" ? adults : 0,
        children: choice === "attending" ? children : 0,
        note,
      });
      if (r.ok) setScreen(r.status);
      else setError(r.message);
    });
  }

  if (screen !== "form") {
    const yes = screen === "attending";
    return (
      <div role="status" className="flex flex-col items-center gap-4 py-2 text-center">
        <span
          className={cn(
            "flex size-16 items-center justify-center rounded-full",
            yes ? "bg-success-soft text-success" : "bg-muted text-muted-foreground",
          )}
        >
          {yes ? <CheckIcon className="size-8" /> : <HeartIcon className="size-7" />}
        </span>
        <h2 className="text-2xl font-bold">{yes ? "תודה! נתראה בשמחה" : "תודה על העדכון"}</h2>
        <p className="text-muted-foreground">
          {yes
            ? `אישרתם הגעה של ${adults} ${adults === 1 ? "מבוגר" : "מבוגרים"}${children ? ` ו-${children} ${children === 1 ? "ילד" : "ילדים"}` : ""}.`
            : "חבל שלא תוכלו להגיע. אם התוכניות ישתנו, אפשר לעדכן כאן."}
        </p>
        {isOpen ? (
          <button
            type="button"
            onClick={() => setScreen("form")}
            className="h-12 rounded-2xl border px-6 font-medium hover:bg-muted"
          >
            עדכון התשובה
          </button>
        ) : null}
      </div>
    );
  }

  if (!isOpen) {
    return (
      <p role="status" className="rounded-2xl bg-muted px-4 py-5 text-center">
        מועד אישור ההגעה הסתיים{deadlineText ? ` (${deadlineText})` : ""}. לשינויים פנו למארחים.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div role="radiogroup" aria-label="האם תגיעו?" className="grid grid-cols-2 gap-3">
        {(
          [
            ["attending", "מגיעים", CheckIcon],
            ["declined", "לא נוכל להגיע", XIcon],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={choice === value}
            onClick={() => setChoice(value)}
            className={cn(
              "flex h-24 flex-col items-center justify-center gap-1.5 rounded-2xl border text-base font-semibold transition-colors",
              choice === value ? "border-2 border-primary bg-accent text-accent-foreground" : "hover:bg-muted",
            )}
          >
            <Icon className="size-6" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {choice === "attending" ? (
        <div className="flex flex-col gap-3">
          <Stepper label="מבוגרים" hint="גיל 13 ומעלה" value={adults} onChange={setAdults} min={1} max={reserved} />
          <Stepper label="ילדים" hint="עד גיל 12" value={children} onChange={setChildren} min={0} max={reserved} />
          <p
            className={cn(
              "rounded-xl px-3 py-2.5 text-sm",
              over ? "bg-destructive-soft font-medium text-destructive" : "bg-muted text-muted-foreground",
            )}
            aria-live="polite"
          >
            {over
              ? `שמרנו עבורכם ${reserved} מקומות בלבד. לתוספת מקומות פנו למארחים.`
              : `סה״כ ${total} מתוך ${reserved} מקומות`}
          </p>
        </div>
      ) : null}

      {choice ? (
        <label className="flex flex-col gap-2 text-sm font-medium">
          הערות (רגישויות, בקשות מיוחדות)
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="לדוגמה: מנה צמחונית אחת"
            className="rounded-2xl border bg-transparent px-3.5 py-3 text-base font-normal outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl bg-destructive-soft px-3 py-2.5 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={submit}
        disabled={!choice || pending || (choice === "attending" && over)}
        className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-bold text-primary-foreground transition-opacity disabled:opacity-40"
      >
        {pending ? <Loader2Icon className="size-5 animate-spin" aria-hidden="true" /> : null}
        שליחת תשובה
      </button>
    </div>
  );
}
