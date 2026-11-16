"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  CheckIcon,
  MinusIcon,
  OctagonAlertIcon,
  PlusIcon,
  QrCodeIcon,
  SearchIcon,
  TriangleAlertIcon,
  Undo2Icon,
  UsersIcon,
} from "lucide-react";
import { Meter } from "@/components/dashboard/stat-tile";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  checkInDoorGuest,
  findDoorGuestByCode,
  getDoorStats,
  searchDoorGuests,
  undoDoorCheckIn,
  type DoorGuest,
} from "@/features/checkin/actions";
import { looksLikeInviteLink, type CheckinStats } from "@/lib/checkin/token";
import { formatNumber, formatTime } from "@/lib/format";
import { RSVP_LABELS, RSVP_TONE } from "@/lib/labels-guests";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { QrScanner } from "./qr-scanner";

const POLL_MS = 10_000;
const fullName = (g: DoorGuest) => `${g.first_name} ${g.last_name}`.trim();

export function CheckinView({
  eventId,
  eventName,
  canUndo,
  initialStats,
}: {
  eventId: string;
  eventName: string;
  canUndo: boolean;
  initialStats: CheckinStats;
}) {
  const [stats, setStats] = useState(initialStats);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ query: string; items: DoorGuest[] } | null>(null);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<DoorGuest | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  const refreshStats = useCallback(async () => {
    const res = await getDoorStats(eventId);
    if (res.ok) setStats(res.data);
  }, [eventId]);

  // live counter: other doors check guests in too
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refreshStats();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && refreshStats();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshStats]);

  const openCode = useCallback(
    async (text: string) => {
      const res = await findDoorGuestByCode(eventId, text);
      if (!res.ok) return res.message;
      setSelected(res.data);
      return null;
    },
    [eventId],
  );

  // search as you type; a hardware scanner "types" the invitation link
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const changeQuery = (value: string) => {
    setQuery(value);
    clearTimeout(timer.current);
    const q = value.trim();
    const mine = ++seq.current;
    if (!q) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(async () => {
      if (looksLikeInviteLink(q)) {
        const message = await openCode(q);
        if (mine !== seq.current) return;
        setSearching(false);
        if (message) toast.error(message);
        else changeQuery("");
        return;
      }
      const res = await searchDoorGuests(eventId, q);
      if (mine !== seq.current) return;
      setSearching(false);
      if (res.ok) setResults({ query: q, items: res.data });
      else toast.error(res.message);
    }, 250);
  };

  const onScanned = async (text: string) => {
    setScanBusy(true);
    setScanError(null);
    const message = await openCode(text);
    setScanBusy(false);
    if (message) setScanError(message);
    else setScanOpen(false);
  };

  const applyGuest = (updated: DoorGuest) => {
    setSelected((cur) => (cur?.id === updated.id ? updated : cur));
    setResults((cur) => cur && { ...cur, items: cur.items.map((g) => (g.id === updated.id ? updated : g)) });
  };

  const peoplePct = stats.expectedPeople ? Math.round((stats.arrivedPeople / stats.expectedPeople) * 100) : 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">{eventName}</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Check-in</h1>
        </div>
        <Button
          size="lg"
          className="h-12 px-5 text-base"
          onClick={() => {
            setScanError(null);
            setScanOpen(true);
          }}
        >
          <QrCodeIcon data-icon="inline-start" />
          סריקת QR
        </Button>
      </div>

      <section role="group" aria-label="מונה הגעות" className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span data-slot="arrived-people" className="text-4xl font-bold tracking-tight tabular-nums">
              {formatNumber(stats.arrivedPeople)}
            </span>
            <span className="text-lg text-muted-foreground tabular-nums">
              / {formatNumber(stats.expectedPeople)} אנשים הגיעו
            </span>
          </div>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground tabular-nums">
            {peoplePct}%
          </span>
        </div>
        <Meter value={stats.arrivedPeople} max={stats.expectedPeople} label="אנשים שהגיעו מתוך מי שאישרו" />
        <p className="text-sm text-muted-foreground">
          <span data-slot="arrived-parties">{formatNumber(stats.arrivedParties)}</span> מתוך{" "}
          {formatNumber(stats.expectedParties)} הזמנות שאישרו נכנסו
          {stats.lastCheckInAt ? ` · כניסה אחרונה ${formatTime(stats.lastCheckInAt)}` : ""}
        </p>
      </section>

      <div className="relative">
        <SearchIcon className="pointer-events-none absolute inset-y-0 start-4 my-auto size-5 text-muted-foreground" aria-hidden="true" />
        <Input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => changeQuery(e.target.value)}
          aria-label="חיפוש אורח"
          placeholder="שם או טלפון של האורח…"
          autoComplete="off"
          autoFocus
          className="h-14 rounded-2xl ps-12 text-lg md:text-lg"
        />
      </div>

      <div aria-live="polite" aria-busy={searching}>
        {!query.trim() ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            הקלידו שם או מספר טלפון, או סרקו את קוד ה-QR מההזמנה.
          </p>
        ) : results && results.items.length === 0 && !searching ? (
          <p className="py-6 text-center text-sm text-muted-foreground">לא נמצאו אורחים עבור &quot;{results.query}&quot;</p>
        ) : results ? (
          <ul aria-label="תוצאות חיפוש" className={cn("flex flex-col gap-2", searching && "opacity-60")}>
            {results.items.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => setSelected(g)}
                  className="flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-start transition-colors hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-base font-semibold">{fullName(g)}</span>
                    <span className="truncate text-sm text-muted-foreground">
                      {[g.group_name, g.phone ? formatPhone(g.phone) : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm tabular-nums">
                      {g.table_number != null ? `שולחן ${g.table_number}` : "ללא שולחן"}
                    </span>
                    <StatusPill guest={g} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <GuestCard
        eventId={eventId}
        guest={selected}
        canUndo={canUndo}
        returnFocusRef={searchRef}
        onClose={() => setSelected(null)}
        onChanged={(g) => {
          applyGuest(g);
          refreshStats();
        }}
        onCheckedIn={() => changeQuery("")}
      />

      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>סריקת קוד QR</DialogTitle>
            <DialogDescription>הקוד מופיע בדף אישור ההגעה של האורח ובהזמנה שנשלחה אליו.</DialogDescription>
          </DialogHeader>
          {scanOpen ? <QrScanner onCode={onScanned} busy={scanBusy} /> : null}
          {scanError ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {scanError}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusPill({ guest }: { guest: DoorGuest }) {
  if (guest.checked_in_at) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">
        <CheckIcon className="size-3" aria-hidden="true" />
        נכנסו {formatTime(guest.checked_in_at)}
      </span>
    );
  }
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", RSVP_TONE[guest.rsvp_status])}>
      {RSVP_LABELS[guest.rsvp_status]}
    </span>
  );
}

function GuestCard({
  eventId,
  guest,
  canUndo,
  returnFocusRef,
  onClose,
  onChanged,
  onCheckedIn,
}: {
  eventId: string;
  guest: DoorGuest | null;
  canUndo: boolean;
  returnFocusRef: React.RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onChanged: (g: DoorGuest) => void;
  onCheckedIn: () => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  return (
    <Dialog open={!!guest} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        ref={contentRef}
        className="sm:max-w-md"
        // Enter checks the guest in right away
        onOpenAutoFocus={(e) => {
          const primary = contentRef.current?.querySelector<HTMLElement>("[data-autofocus]");
          if (primary) {
            e.preventDefault();
            primary.focus();
          }
        }}
        // back to the search box, ready for the next guest
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          returnFocusRef.current?.focus();
        }}
      >
        {guest ? (
          <GuestCardBody
            key={`${guest.id}-${guest.checked_in_at ?? ""}`}
            eventId={eventId}
            guest={guest}
            canUndo={canUndo}
            onClose={onClose}
            onChanged={onChanged}
            onCheckedIn={onCheckedIn}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function GuestCardBody({
  eventId,
  guest,
  canUndo,
  onClose,
  onChanged,
  onCheckedIn,
}: {
  eventId: string;
  guest: DoorGuest;
  canUndo: boolean;
  onClose: () => void;
  onChanged: (g: DoorGuest) => void;
  onCheckedIn: () => void;
}) {
  const [count, setCount] = useState(Math.max(1, guest.expected || 1));
  const [pending, startTransition] = useTransition();
  const name = fullName(guest);
  const attending = guest.rsvp_status === "attending";

  const checkIn = () =>
    startTransition(async () => {
      const res = await checkInDoorGuest(eventId, guest.id, count);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      const updated = { ...guest, checked_in_at: res.data.checkedInAt, arrived_count: res.data.arrivedCount };
      onChanged(updated);
      if (res.data.status === "checked_in") {
        toast.success(`נרשמה כניסה: ${name} (${res.data.arrivedCount})`);
        onCheckedIn();
        onClose();
      } else {
        // someone else got there first: the card now shows the red notice
        toast.error(`${name} כבר נכנסו`);
      }
    });

  const undo = () =>
    startTransition(async () => {
      const res = await undoDoorCheckIn(eventId, guest.id);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("הכניסה בוטלה");
      onChanged({ ...guest, checked_in_at: null, arrived_count: null });
    });

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-2xl">{name}</DialogTitle>
        <DialogDescription>
          {[guest.group_name, guest.phone ? formatPhone(guest.phone) : null].filter(Boolean).join(" · ") || "אורח"}
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-3">
        <div role="group" aria-label="שולחן" className="flex flex-col items-center gap-1 rounded-2xl bg-muted p-4 text-center">
          <span className="text-xs text-muted-foreground">שולחן</span>
          <span className="text-4xl font-bold tabular-nums">{guest.table_number ?? "–"}</span>
          {guest.table_name ? <span className="truncate text-xs text-muted-foreground">{guest.table_name}</span> : null}
        </div>
        <div role="group" aria-label="צפויים להגיע" className="flex flex-col items-center gap-1 rounded-2xl bg-muted p-4 text-center">
          <span className="text-xs text-muted-foreground">צפויים להגיע</span>
          <span className="text-4xl font-bold tabular-nums">{guest.expected}</span>
          <span className="text-xs text-muted-foreground">{RSVP_LABELS[guest.rsvp_status]}</span>
        </div>
      </div>

      {guest.dietary_tags?.length ? (
        <p className="text-sm">
          <span className="text-muted-foreground">תזונה: </span>
          {guest.dietary_tags.join(", ")}
        </p>
      ) : null}

      {guest.checked_in_at ? (
        <>
          <Alert variant="destructive" role="alert" className="border-destructive/40 bg-destructive/5">
            <OctagonAlertIcon aria-hidden="true" />
            <AlertTitle>כבר נכנסו לאירוע</AlertTitle>
            <AlertDescription>
              נרשמה כניסה בשעה {formatTime(guest.checked_in_at)} ({guest.arrived_count} אנשים). אין לרשום כניסה נוספת.
            </AlertDescription>
          </Alert>
          {canUndo ? (
            <Button variant="outline" onClick={undo} disabled={pending}>
              <Undo2Icon data-icon="inline-start" />
              ביטול הכניסה
            </Button>
          ) : null}
        </>
      ) : (
        <>
          {!attending ? (
            <Alert>
              <TriangleAlertIcon aria-hidden="true" />
              <AlertTitle>האורח לא אישר הגעה</AlertTitle>
              <AlertDescription>סטטוס: {RSVP_LABELS[guest.rsvp_status]}. אפשר לרשום כניסה בכל זאת.</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <span id="arrived-label" className="flex items-center gap-2 text-sm font-medium">
              <UsersIcon className="size-4 text-muted-foreground" aria-hidden="true" />
              כמה הגיעו?
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon-lg"
                aria-label="פחות"
                onClick={() => setCount((c) => Math.max(1, c - 1))}
                disabled={count <= 1}
              >
                <MinusIcon />
              </Button>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                value={count}
                aria-labelledby="arrived-label"
                onChange={(e) => setCount(Math.min(100, Math.max(1, Math.trunc(Number(e.target.value) || 1))))}
                className="h-10 w-16 [appearance:textfield] text-center text-lg tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <Button
                variant="outline"
                size="icon-lg"
                aria-label="יותר"
                onClick={() => setCount((c) => Math.min(100, c + 1))}
                disabled={count >= 100}
              >
                <PlusIcon />
              </Button>
            </div>
          </div>
          {count > guest.expected && guest.expected > 0 ? (
            <p className="text-sm text-warning">שימו לב: מגיעים יותר אנשים ממה שאושר ({guest.expected}).</p>
          ) : null}
          <Button data-autofocus size="lg" className="h-14 text-lg" onClick={checkIn} disabled={pending}>
            <CheckIcon data-icon="inline-start" />
            {pending ? "רושמים…" : "סימון הגעה"}
          </Button>
        </>
      )}
    </>
  );
}
