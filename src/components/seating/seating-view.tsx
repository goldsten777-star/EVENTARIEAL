"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  ArrowRightLeftIcon,
  GripVerticalIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
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
import { assignGuestTable, deleteTable } from "@/features/seating/actions";
import type { SeatingGroup } from "@/features/seating/queries";
import { TABLE_SHAPE_LABELS } from "@/lib/labels";
import { RSVP_LABELS } from "@/lib/labels-guests";
import {
  fitsAt,
  guestName,
  nextTableNumber,
  noRoomMessage,
  seatingTotals,
  tableLabel,
  tableUsage,
  waitingGuests,
  type SeatingGuest,
  type SeatingTable,
  type TableUsage,
} from "@/lib/seating/plan";
import { cn } from "@/lib/utils";
import { TableDialog } from "./table-dialog";

const UNSEATED = "unseated";
type Move = { guestId: string; tableId: string | null };

type Ctx = {
  canEdit: boolean;
  tables: SeatingTable[];
  usage: Map<string, TableUsage>;
  groups: Map<string, SeatingGroup>;
  moveGuest: (guest: SeatingGuest, tableId: string | null) => void;
};

export function SeatingView({
  eventId,
  tables,
  guests,
  groups,
  canEdit,
}: {
  eventId: string;
  tables: SeatingTable[];
  guests: SeatingGuest[];
  groups: SeatingGroup[];
  canEdit: boolean;
}) {
  const [shown, applyMove] = useOptimistic(guests, (state: SeatingGuest[], m: Move) =>
    state.map((g) => (g.id === m.guestId ? { ...g, table_id: m.tableId } : g)),
  );
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState<SeatingGuest | null>(null);
  const [dialog, setDialog] = useState<{ open: boolean; table: SeatingTable | null; key: number }>({
    open: false,
    table: null,
    key: 0,
  });
  const [toDelete, setToDelete] = useState<SeatingTable | null>(null);

  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const groupOrder = useMemo(() => new Map(groups.map((g, i) => [g.id, i])), [groups]);
  const usage = useMemo(() => tableUsage(tables, shown), [tables, shown]);
  const totals = useMemo(() => seatingTotals(tables, shown), [tables, shown]);
  const waiting = useMemo(() => {
    const q = query.trim();
    return waitingGuests(shown, groupOrder).filter(
      (g) => !q || guestName(g).includes(q) || (g.group_id && groupById.get(g.group_id)?.name.includes(q)),
    );
  }, [shown, groupOrder, groupById, query]);
  const byTable = useMemo(() => {
    const m = new Map<string, SeatingGuest[]>();
    for (const g of shown) if (g.table_id) m.set(g.table_id, [...(m.get(g.table_id) ?? []), g]);
    return m;
  }, [shown]);

  const moveGuest = (guest: SeatingGuest, tableId: string | null) => {
    if (guest.table_id === tableId) return;
    const table = tableId ? tables.find((t) => t.id === tableId) : null;
    if (table && !fitsAt(table, usage.get(table.id), guest)) {
      toast.error(noRoomMessage(table, usage.get(table.id), guest));
      return;
    }
    startTransition(async () => {
      applyMove({ guestId: guest.id, tableId });
      const r = await assignGuestTable(eventId, guest.id, tableId);
      if (!r.ok) toast.error(r.message);
      else toast.success(table ? `${guestName(guest)} שובצו ל${tableLabel(table)}` : `${guestName(guest)} הוחזרו לרשימת הממתינים`);
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const onDragStart = (e: DragStartEvent) => setDragging((e.active.data.current?.guest as SeatingGuest) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    const guest = e.active.data.current?.guest as SeatingGuest | undefined;
    setDragging(null);
    if (!guest || !e.over) return;
    const target = String(e.over.id);
    moveGuest(guest, target === UNSEATED ? null : target.replace(/^table:/, ""));
  };

  const ctx: Ctx = { canEdit, tables, usage, groups: groupById, moveGuest };
  const overfull = tables.filter((t) => usage.get(t.id)?.over);

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" data-slot="seating-totals">
            {totals.tables} שולחנות · {totals.capacity} מקומות · {totals.seatedPeople} משובצים ·{" "}
            <span className="font-medium text-foreground">{totals.waitingPeople} ממתינים לשיבוץ</span>
          </p>
          {canEdit ? (
            <Button onClick={() => setDialog((d) => ({ open: true, table: null, key: d.key + 1 }))}>
              <PlusIcon data-icon="inline-start" />
              הוספת שולחנות
            </Button>
          ) : null}
        </div>

        {overfull.length ? (
          <p role="status" className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {overfull.length === 1 ? `בשולחן ${overfull[0].number} יש` : `בשולחנות ${overfull.map((t) => t.number).join(", ")} יש`}{" "}
            יותר אורחים ממקומות, כי אישורי הגעה הגדילו את ההזמנה. כדאי להעביר מישהו או להגדיל את השולחן.
          </p>
        ) : null}

        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(260px,320px)_1fr]">
          <WaitingPanel
            ctx={ctx}
            guests={waiting}
            totalParties={totals.waitingParties}
            query={query}
            onQuery={setQuery}
            dragging={dragging}
          />

          {tables.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
              <h2 className="font-semibold">עוד אין שולחנות</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                {canEdit ? "הוסיפו את השולחנות של האולם, ואז גררו אליהם את האורחים." : "מנהל האירוע עוד לא הוסיף שולחנות."}
              </p>
            </div>
          ) : (
            <div className="grid min-w-0 content-start gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {tables.map((t) => (
                <TableCard
                  key={t.id}
                  ctx={ctx}
                  table={t}
                  guests={byTable.get(t.id) ?? []}
                  dragging={dragging}
                  onEdit={() => setDialog((d) => ({ open: true, table: t, key: d.key + 1 }))}
                  onDelete={() => setToDelete(t)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {dragging ? <GuestChipBody guest={dragging} group={dragging.group_id ? groupById.get(dragging.group_id) : undefined} overlay /> : null}
      </DragOverlay>

      {canEdit ? (
        <>
          <TableDialog
            open={dialog.open}
            onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
            formKey={dialog.key}
            eventId={eventId}
            table={dialog.table}
            nextNumber={nextTableNumber(tables)}
          />
          <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{toDelete ? `למחוק את שולחן ${toDelete.number}?` : ""}</AlertDialogTitle>
                <AlertDialogDescription>
                  {toDelete && (usage.get(toDelete.id)?.guests ?? 0) > 0
                    ? `${usage.get(toDelete.id)!.guests} ההזמנות שמשובצות בו יחזרו לרשימת הממתינים לשיבוץ. האורחים עצמם לא נמחקים.`
                    : "השולחן ריק."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => {
                    const t = toDelete!;
                    setToDelete(null);
                    startTransition(async () => {
                      const r = await deleteTable(eventId, t.id);
                      if (r.ok) toast.success(r.message);
                      else toast.error(r.message);
                    });
                  }}
                >
                  מחיקה
                </AlertDialogAction>
                <AlertDialogCancel>ביטול</AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </DndContext>
  );
}

function WaitingPanel({
  ctx,
  guests,
  totalParties,
  query,
  onQuery,
  dragging,
}: {
  ctx: Ctx;
  guests: SeatingGuest[];
  totalParties: number;
  query: string;
  onQuery: (q: string) => void;
  dragging: SeatingGuest | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: UNSEATED, disabled: !ctx.canEdit });
  const fromTable = !!dragging?.table_id;
  return (
    <section
      ref={setNodeRef}
      aria-label="ממתינים לשיבוץ"
      className={cn(
        "flex max-h-[60svh] min-w-0 flex-col gap-3 rounded-2xl border bg-card p-4 transition-colors lg:sticky lg:top-20 lg:max-h-[calc(100svh-6rem)]",
        fromTable && "border-dashed border-primary/60",
        fromTable && isOver && "bg-accent",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">ממתינים לשיבוץ</h2>
        <span className="text-xs text-muted-foreground tabular-nums">{totalParties} הזמנות</span>
      </div>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" aria-hidden="true" />
        <Input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          aria-label="חיפוש אורח לשיבוץ"
          placeholder="שם או קבוצה…"
          className="ps-9"
        />
      </div>
      {fromTable ? <p className="text-xs text-primary">שחררו כאן כדי להוציא מהשולחן</p> : null}
      <ul className="-mx-1 flex min-h-0 flex-col gap-1.5 overflow-y-auto px-1 pb-1">
        {guests.map((g) => (
          <li key={g.id}>
            <GuestChip ctx={ctx} guest={g} />
          </li>
        ))}
        {guests.length === 0 ? (
          <li className="py-6 text-center text-sm text-muted-foreground">
            {query ? "לא נמצאו אורחים" : "כל האורחים שובצו 🎉"}
          </li>
        ) : null}
      </ul>
    </section>
  );
}

function TableCard({
  ctx,
  table,
  guests,
  dragging,
  onEdit,
  onDelete,
}: {
  ctx: Ctx;
  table: SeatingTable;
  guests: SeatingGuest[];
  dragging: SeatingGuest | null;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `table:${table.id}`, disabled: !ctx.canEdit });
  const u = ctx.usage.get(table.id)!;
  const fits = dragging ? fitsAt(table, u, dragging) : true;
  const isHome = dragging?.table_id === table.id;
  const pct = Math.min(100, (u.used / table.capacity) * 100);

  return (
    <section
      ref={setNodeRef}
      aria-label={tableLabel(table)}
      data-over={isOver || undefined}
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-2xl border bg-card p-4 transition-[colors,opacity]",
        u.over && "border-warning/60",
        dragging && !isHome && fits && "border-dashed border-primary/60",
        dragging && !isHome && !fits && "opacity-50",
        isOver && !isHome && (fits ? "bg-accent" : "border-destructive bg-destructive/5 opacity-100"),
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <h3 className="truncate font-semibold">
            שולחן {table.number}
            {table.name ? <span className="font-normal text-muted-foreground"> · {table.name}</span> : null}
          </h3>
          <span className="text-xs text-muted-foreground">{TABLE_SHAPE_LABELS[table.shape]}</span>
        </div>
        <div className="flex items-center gap-1">
          <span
            data-slot="table-usage"
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
              u.over ? "bg-warning-soft text-warning" : u.free === 0 ? "bg-muted text-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {u.used}/{table.capacity}
          </span>
          {ctx.canEdit ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`פעולות ל${tableLabel(table)}`}>
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onEdit}>
                  <PencilIcon />
                  עריכה
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                  <Trash2Icon />
                  מחיקה
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
      <div
        role="meter"
        aria-label={`תפוסה: ${u.used} מתוך ${table.capacity} מקומות`}
        aria-valuemin={0}
        aria-valuemax={table.capacity}
        aria-valuenow={u.used}
        className="h-1.5 overflow-hidden rounded-full bg-track"
      >
        <div className={cn("h-full rounded-full", u.over ? "bg-warning" : "bg-viz-1")} style={{ width: `${pct}%` }} />
      </div>

      {isOver && !isHome && !fits && dragging ? (
        <p className="text-xs font-medium text-destructive">{noRoomMessage(table, u, dragging)}</p>
      ) : null}

      <ul className="flex flex-col gap-1.5">
        {guests.map((g) => (
          <li key={g.id}>
            <GuestChip ctx={ctx} guest={g} />
          </li>
        ))}
        {guests.length === 0 ? (
          <li className="rounded-xl border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
            {ctx.canEdit ? "גררו לכאן אורחים" : "שולחן ריק"}
          </li>
        ) : null}
      </ul>
    </section>
  );
}

function GuestChip({ ctx, guest }: { ctx: Ctx; guest: SeatingGuest }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: guest.id,
    data: { guest },
    disabled: !ctx.canEdit,
  });
  const name = guestName(guest);
  const group = guest.group_id ? ctx.groups.get(guest.group_id) : undefined;

  return (
    <div ref={setNodeRef} className={cn(isDragging && "opacity-40")}>
      <GuestChipBody
        guest={guest}
        group={group}
        handle={
          ctx.canEdit ? (
            <button
              type="button"
              {...listeners}
              {...attributes}
              aria-label={`גרירת ${name}`}
              aria-roledescription="פריט נגרר"
              className="-ms-1 flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:cursor-grabbing"
            >
              <GripVerticalIcon className="size-4" aria-hidden="true" />
            </button>
          ) : null
        }
        menu={ctx.canEdit ? <MoveMenu ctx={ctx} guest={guest} /> : null}
      />
    </div>
  );
}

function GuestChipBody({
  guest,
  group,
  handle,
  menu,
  overlay,
}: {
  guest: SeatingGuest;
  group?: SeatingGroup;
  handle?: React.ReactNode;
  menu?: React.ReactNode;
  overlay?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border bg-background px-2 py-1.5 text-sm",
        overlay && "cursor-grabbing shadow-lg ring-2 ring-primary/40",
      )}
    >
      {handle ?? (overlay ? <GripVerticalIcon className="size-4 text-muted-foreground" aria-hidden="true" /> : null)}
      <span className="size-2 shrink-0 rounded-full" style={{ background: group?.color ?? "var(--muted-foreground)" }} aria-hidden="true" />
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate font-medium">{guestName(guest)}</span>
        {group || guest.rsvp_status !== "attending" ? (
          <span className="truncate text-xs text-muted-foreground">
            {[group?.name, guest.rsvp_status !== "attending" ? RSVP_LABELS[guest.rsvp_status] : null].filter(Boolean).join(" · ")}
          </span>
        ) : null}
      </span>
      <span
        className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-xs font-semibold tabular-nums"
        aria-label={`${guest.seats_needed} מקומות`}
      >
        {guest.seats_needed}
      </span>
      {menu}
    </div>
  );
}

function MoveMenu({ ctx, guest }: { ctx: Ctx; guest: SeatingGuest }) {
  const name = guestName(guest);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`העברת ${name} לשולחן`}>
          <ArrowRightLeftIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 w-60 overflow-y-auto">
        <DropdownMenuLabel>
          {name} · {guest.seats_needed} מקומות
        </DropdownMenuLabel>
        {guest.table_id ? (
          <>
            <DropdownMenuItem onSelect={() => ctx.moveGuest(guest, null)}>הוצאה מהשולחן</DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        {ctx.tables.map((t) => {
          const u = ctx.usage.get(t.id);
          const here = guest.table_id === t.id;
          const fits = fitsAt(t, u, guest);
          return (
            <DropdownMenuItem key={t.id} disabled={here || !fits} onSelect={() => ctx.moveGuest(guest, t.id)}>
              <span className="flex-1 truncate">{tableLabel(t)}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{here ? "כאן" : `${u?.free ?? t.capacity} פנויים`}</span>
            </DropdownMenuItem>
          );
        })}
        {ctx.tables.length === 0 ? <DropdownMenuItem disabled>אין עדיין שולחנות</DropdownMenuItem> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
