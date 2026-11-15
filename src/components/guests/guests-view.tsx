"use client";

import { useCallback, useDeferredValue, useMemo, useState, useTransition } from "react";
import type { RowSelectionState } from "@tanstack/react-table";
import { DownloadIcon, PlusIcon, SearchIcon, Trash2Icon, UsersIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { bulkGuests } from "@/features/guests/actions";
import { PageHeader } from "@/components/layout/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { exportGuestsToExcel } from "@/lib/guests/excel";
import { INVITATION_LABELS, RSVP_LABELS } from "@/lib/labels-guests";
import { formatNumber } from "@/lib/format";
import type { BulkAction } from "@/lib/validation/guest";
import { GuestForm } from "./guest-form";
import { GuestsTable, type GuestView } from "./guests-table";
import { ImportDialog } from "./import-dialog";
import type { Group, Guest, SeatingTable } from "./types";

const ALL = "all";
type Filters = { group: string; rsvp: string; invitation: string; seating: string };
const EMPTY_FILTERS: Filters = { group: ALL, rsvp: ALL, invitation: ALL, seating: ALL };

function digits(s: string) {
  return s.replace(/\D/g, "");
}

export function GuestsView({
  eventId,
  eventName,
  guests,
  groups,
  tables,
  canManage,
}: {
  eventId: string;
  eventName: string;
  guests: Guest[];
  groups: Group[];
  tables: SeatingTable[];
  canManage: boolean;
}) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [sheet, setSheet] = useState<{ open: boolean; guest: GuestView | null; key: number }>({
    open: false,
    guest: null,
    key: 0,
  });
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [pending, start] = useTransition();

  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const tableById = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);

  const all: GuestView[] = useMemo(
    () =>
      guests.map((g) => ({
        ...g,
        fullName: `${g.first_name} ${g.last_name}`.trim(),
        group: g.group_id ? (groupById.get(g.group_id) ?? null) : null,
        table: g.table_id ? (tableById.get(g.table_id) ?? null) : null,
      })),
    [guests, groupById, tableById],
  );

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const qDigits = digits(q);
    const qPhone = qDigits.startsWith("0") ? "972" + qDigits.slice(1) : qDigits;
    return all.filter((g) => {
      if (filters.group !== ALL && (filters.group === "none" ? g.group_id : g.group_id !== filters.group)) return false;
      if (filters.rsvp !== ALL && g.rsvp_status !== filters.rsvp) return false;
      if (filters.invitation !== ALL && g.invitation_status !== filters.invitation) return false;
      if (filters.seating === "seated" && !g.table_id) return false;
      if (filters.seating === "unseated" && (g.table_id || g.rsvp_status === "declined")) return false;
      if (!q) return true;
      return (
        g.fullName.toLowerCase().includes(q) ||
        `${g.last_name} ${g.first_name}`.toLowerCase().includes(q) ||
        (g.inviter_name ?? "").toLowerCase().includes(q) ||
        (g.email ?? "").includes(q) ||
        (qDigits.length >= 3 && !!g.phone && g.phone.includes(qPhone))
      );
    });
  }, [all, deferredQuery, filters]);

  const totals = useMemo(() => {
    const t = { parties: guests.length, people: 0, attending: 0, pending: 0, declined: 0 };
    for (const g of guests) {
      t.people += g.reserved_seats;
      if (g.rsvp_status === "attending") t.attending += g.confirmed_adults + g.confirmed_children;
      else if (g.rsvp_status === "declined") t.declined += g.reserved_seats;
      else t.pending += g.reserved_seats;
    }
    return t;
  }, [guests]);

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id] && guests.some((g) => g.id === id));
  const activeFilters = Object.entries(filters).filter(([, v]) => v !== ALL).length + (query ? 1 : 0);

  const openGuest = useCallback((guest: GuestView | null) => setSheet((s) => ({ open: true, guest, key: s.key + 1 })), []);

  function runBulk(action: BulkAction, ids = selectedIds) {
    start(async () => {
      const r = await bulkGuests(eventId, ids, action);
      if (r.ok) {
        toast.success(r.message);
        if (action.type === "delete") setRowSelection({});
      } else toast.error(r.message);
    });
  }

  async function exportExcel() {
    const rows = (selectedIds.length ? filtered.filter((g) => rowSelection[g.id]) : filtered).map((g) => ({
      ...g,
      groupName: g.group?.name ?? "",
      tableNumber: g.table?.number ?? null,
    }));
    try {
      await exportGuestsToExcel(eventName, rows);
      toast.success(`יוצאו ${rows.length} הזמנות`);
    } catch {
      toast.error("הייצוא נכשל. נסו שוב.");
    }
  }

  const setFilter = (key: keyof Filters) => (value: string) => setFilters((f) => ({ ...f, [key]: value }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="מוזמנים"
        description={`${formatNumber(totals.parties)} הזמנות · ${formatNumber(totals.people)} מקומות שמורים`}
        actions={
          <>
            <Button variant="outline" size="lg" onClick={() => void exportExcel()} disabled={!guests.length}>
              <DownloadIcon aria-hidden="true" /> ייצוא{selectedIds.length ? ` (${selectedIds.length})` : ""}
            </Button>
            {canManage ? (
              <>
                <ImportDialog eventId={eventId} existingPhones={guests.flatMap((g) => (g.phone ? [g.phone] : []))} />
                <Button size="lg" onClick={() => openGuest(null)}>
                  <PlusIcon aria-hidden="true" /> הוספת מוזמן / משפחה
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <section aria-label="סיכום" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "אישרו הגעה", value: totals.attending, filter: "attending", tone: "text-success" },
          { label: "ממתינים", value: totals.pending, filter: "pending", tone: "text-warning" },
          { label: "לא מגיעים", value: totals.declined, filter: "declined", tone: "text-destructive" },
          { label: "סה״כ מקומות", value: totals.people, filter: ALL, tone: "" },
        ].map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => setFilters({ ...EMPTY_FILTERS, rsvp: s.filter })}
            aria-pressed={filters.rsvp === s.filter && s.filter !== ALL}
            className="flex flex-col gap-1 rounded-2xl border bg-card p-4 text-start transition-colors hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-pressed:border-primary"
          >
            <span className="text-xs text-muted-foreground">{s.label}</span>
            <span className={`text-2xl font-bold tabular-nums ${s.tone}`}>{formatNumber(s.value)}</span>
          </button>
        ))}
      </section>

      <div className="flex flex-col rounded-2xl border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <label className="relative flex min-w-56 flex-1 items-center">
            <span className="sr-only">חיפוש מוזמן</span>
            <SearchIcon className="pointer-events-none absolute start-3 size-4 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש לפי שם, טלפון, מזמין או אימייל…"
              className="ps-9"
            />
          </label>
          <FilterSelect label="קבוצה" value={filters.group} onChange={setFilter("group")}>
            <SelectItem value={ALL}>כל הקבוצות</SelectItem>
            {groups.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name}
              </SelectItem>
            ))}
            <SelectItem value="none">ללא קבוצה</SelectItem>
          </FilterSelect>
          <FilterSelect label="אישור הגעה" value={filters.rsvp} onChange={setFilter("rsvp")}>
            <SelectItem value={ALL}>כל הסטטוסים</SelectItem>
            {Object.entries(RSVP_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </FilterSelect>
          <FilterSelect label="סטטוס הזמנה" value={filters.invitation} onChange={setFilter("invitation")}>
            <SelectItem value={ALL}>כל ההזמנות</SelectItem>
            {Object.entries(INVITATION_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                הזמנה {l}
              </SelectItem>
            ))}
          </FilterSelect>
          <FilterSelect label="שיבוץ" value={filters.seating} onChange={setFilter("seating")}>
            <SelectItem value={ALL}>כל השיבוצים</SelectItem>
            <SelectItem value="seated">עם שולחן</SelectItem>
            <SelectItem value="unseated">ללא שולחן</SelectItem>
          </FilterSelect>
          {activeFilters ? (
            <Button
              variant="ghost"
              onClick={() => {
                setFilters(EMPTY_FILTERS);
                setQuery("");
              }}
            >
              <XIcon aria-hidden="true" /> ניקוי ({activeFilters})
            </Button>
          ) : null}
        </div>

        {canManage && selectedIds.length ? (
          <div
            role="region"
            aria-label="פעולות על הנבחרים"
            className="flex flex-wrap items-center gap-2 border-b bg-accent/60 px-3 py-2 text-sm"
          >
            <span className="font-semibold">{selectedIds.length} נבחרו</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={pending}>
                  <UsersIcon aria-hidden="true" /> שיוך לקבוצה
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {groups.map((g) => (
                  <DropdownMenuItem key={g.id} onSelect={() => runBulk({ type: "group", groupId: g.id })}>
                    <span className="size-2.5 rounded-full" style={{ background: g.color }} aria-hidden="true" />
                    {g.name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => runBulk({ type: "group", groupId: null })}>ללא קבוצה</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={pending}>
                  סימון הזמנה
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">סטטוס ההזמנה</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => runBulk({ type: "invitation", status: "sent" })}>נשלחה</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => runBulk({ type: "invitation", status: "not_sent" })}>
                  לא נשלחה
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={() => setConfirmDelete(selectedIds)}
            >
              <Trash2Icon aria-hidden="true" /> מחיקה
            </Button>
            <Button variant="ghost" size="sm" className="ms-auto" onClick={() => setRowSelection({})}>
              ביטול הבחירה
            </Button>
          </div>
        ) : null}

        {guests.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <UsersIcon className="size-6" aria-hidden="true" />
            </span>
            <h2 className="text-lg font-semibold">עוד אין מוזמנים</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              {canManage
                ? "הוסיפו מוזמנים אחד-אחד, או ייבאו רשימה קיימת מקובץ Excel."
                : "מנהלי האירוע עדיין לא הוסיפו מוזמנים."}
            </p>
          </div>
        ) : (
          <GuestsTable
            data={filtered}
            canManage={canManage}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            onOpen={openGuest}
          />
        )}
      </div>

      <Sheet open={sheet.open} onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}>
        <SheetContent side="left" className="w-full gap-0 overflow-y-auto sm:max-w-xl">
          <SheetHeader className="px-6 pt-6">
            <SheetTitle className="text-xl">
              {sheet.guest ? (canManage ? "עריכת מוזמן" : sheet.guest.fullName) : "הוספת מוזמן / משפחה"}
            </SheetTitle>
            <SheetDescription>
              {sheet.guest ? sheet.guest.fullName : "כל הזמנה יכולה לכלול אדם אחד או משפחה שלמה."}
            </SheetDescription>
          </SheetHeader>
          <div className="px-6 pt-4">
            <GuestForm
              key={sheet.key}
              eventId={eventId}
              guest={sheet.guest}
              guests={guests}
              groups={groups}
              tables={tables}
              readOnly={!canManage}
              onSaved={(addAnother) =>
                addAnother ? setSheet((s) => ({ open: true, guest: null, key: s.key + 1 })) : setSheet((s) => ({ ...s, open: false }))
              }
              footerExtra={
                sheet.guest ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => setConfirmDelete([sheet.guest!.id])}
                  >
                    <Trash2Icon aria-hidden="true" /> מחיקה
                  </Button>
                ) : null
              }
            />
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDelete?.length === 1 ? "למחוק את ההזמנה?" : `למחוק ${confirmDelete?.length} הזמנות?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              המוזמנים יוסרו מהרשימה, מהשולחנות ומאישורי ההגעה. מתנות שתועדו יישארו ללא שיוך לאורח.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const ids = confirmDelete ?? [];
                setConfirmDelete(null);
                setSheet((s) => ({ ...s, open: false }));
                runBulk({ type: "delete" }, ids);
              }}
            >
              מחיקה
            </AlertDialogAction>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className={`h-10 w-auto min-w-36 ${value !== ALL ? "border-primary" : ""}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}
