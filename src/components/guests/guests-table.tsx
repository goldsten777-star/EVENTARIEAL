"use client";

import { useState } from "react";
import {
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, ChevronLeftIcon, ChevronRightIcon, PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INVITATION_LABELS, RSVP_LABELS, RSVP_TONE } from "@/lib/labels-guests";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { WhatsAppButton, type InviteContext } from "./invite-actions";
import type { Group, Guest, SeatingTable } from "./types";

export type GuestView = Guest & { group: Group | null; table: SeatingTable | null; fullName: string };

const features = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text, basic: sortFn_basic },
});

const helper = createColumnHelper<typeof features, GuestView>();

const RSVP_ORDER = { attending: 0, maybe: 1, pending: 2, declined: 3 } as const;

function SortHeader({
  label,
  sorted,
  onToggle,
}: {
  label: string;
  sorted: false | "asc" | "desc";
  onToggle?: (e: unknown) => void;
}) {
  const Icon = sorted === "asc" ? ArrowUpIcon : sorted === "desc" ? ArrowDownIcon : ArrowUpDownIcon;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="-mx-1.5 inline-flex items-center gap-1 rounded px-1.5 py-1 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {label}
      <Icon className={cn("size-3.5", !sorted && "opacity-40")} aria-hidden="true" />
    </button>
  );
}

const columns = helper.columns([
  helper.display({
    id: "select",
    header: ({ table }) => (
      <Checkbox
        aria-label="בחירת כל השורות בעמוד"
        checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? "indeterminate" : false}
        onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        aria-label={`בחירת ${row.original.fullName}`}
        checked={row.getIsSelected()}
        onClick={(e) => {
          e.stopPropagation();
          row.getToggleSelectedHandler()(e);
        }}
      />
    ),
  }),
  helper.accessor("fullName", {
    id: "name",
    header: "שם",
    sortFn: "text",
    cell: ({ row }) => (
      <div className="flex min-w-40 flex-col">
        <span className="font-semibold">{row.original.fullName}</span>
        {row.original.inviter_name ? (
          <span className="text-xs text-muted-foreground">{row.original.inviter_name}</span>
        ) : null}
      </div>
    ),
  }),
  helper.accessor("phone", {
    header: "טלפון",
    enableSorting: false,
    cell: ({ getValue }) => (
      <span dir="ltr" className="whitespace-nowrap text-muted-foreground tabular-nums">
        {formatPhone(getValue())}
      </span>
    ),
  }),
  helper.accessor((g) => g.group?.name ?? "", {
    id: "group",
    header: "קבוצה",
    sortFn: "text",
    cell: ({ row }) =>
      row.original.group ? (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span className="size-2.5 rounded-full" style={{ background: row.original.group.color }} aria-hidden="true" />
          {row.original.group.name}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  }),
  helper.accessor("reserved_seats", {
    id: "invited",
    header: "מוזמנים",
    sortFn: "basic",
    cell: ({ row }) => {
      const g = row.original;
      return (
        <span className="whitespace-nowrap">
          {g.invited_adults} מב׳{g.invited_children ? ` · ${g.invited_children} יל׳` : ""}
          {g.reserved_seats !== g.invited_adults + g.invited_children ? (
            <span className="text-muted-foreground"> ({g.reserved_seats} מק׳)</span>
          ) : null}
        </span>
      );
    },
  }),
  helper.accessor("invitation_status", {
    id: "invitation",
    header: "הזמנה",
    sortFn: "text",
    cell: ({ getValue }) => <span className="whitespace-nowrap text-muted-foreground">{INVITATION_LABELS[getValue()]}</span>,
  }),
  helper.accessor((g) => RSVP_ORDER[g.rsvp_status], {
    id: "rsvp",
    header: "אישור הגעה",
    sortFn: "basic",
    cell: ({ row }) => {
      const g = row.original;
      return (
        <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", RSVP_TONE[g.rsvp_status])}>
          {RSVP_LABELS[g.rsvp_status]}
          {g.rsvp_status === "attending" ? ` · ${g.confirmed_adults + g.confirmed_children}` : ""}
        </span>
      );
    },
  }),
  helper.accessor((g) => g.table?.number ?? 9999, {
    id: "table",
    header: "שולחן",
    sortFn: "basic",
    cell: ({ row }) =>
      row.original.table ? (
        <span className="whitespace-nowrap">{row.original.table.number}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  }),
  helper.accessor("dietary_tags", {
    id: "diet",
    header: "תזונה",
    enableSorting: false,
    cell: ({ getValue }) => (
      <span className="block max-w-40 truncate text-xs text-muted-foreground">{getValue().join(", ") || "—"}</span>
    ),
  }),
  helper.display({
    id: "actions",
    header: () => <span className="sr-only">פעולות</span>,
    cell: ({ row, table }) => {
      const invite = (table.options.meta as { invite?: InviteContext } | undefined)?.invite;
      return (
        <div className="flex items-center justify-end gap-1">
          {invite ? <WhatsAppButton ctx={invite} guest={row.original} /> : null}
          <PencilIcon className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100" aria-hidden="true" />
        </div>
      );
    },
  }),
]);

export function GuestsTable({
  data,
  canManage,
  invite,
  rowSelection,
  onRowSelectionChange,
  onOpen,
}: {
  data: GuestView[];
  canManage: boolean;
  invite: InviteContext;
  rowSelection: RowSelectionState;
  onRowSelectionChange: (updater: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)) => void;
  onOpen: (guest: GuestView) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 });

  const table = useTable({
    features,
    columns,
    data,
    getRowId: (row) => row.id,
    state: { sorting, pagination, rowSelection },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onRowSelectionChange,
    enableRowSelection: canManage,
    meta: { invite },
  });

  const rows = table.getRowModel().rows;
  const pageCount = Math.max(table.getPageCount(), 1);
  const from = data.length ? pagination.pageIndex * pagination.pageSize + 1 : 0;
  const to = Math.min((pagination.pageIndex + 1) * pagination.pageSize, data.length);

  return (
    <div className="flex flex-col">
      {/* relative: keeps absolutely positioned descendants (sr-only labels) inside the scroll box */}
      <div className="relative overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} className="border-b">
                {group.headers
                  .filter((h) => canManage || (h.column.id !== "select" && h.column.id !== "actions"))
                  .map((header) => {
                    const sorted = header.column.getIsSorted();
                    return (
                      <th
                        key={header.id}
                        scope="col"
                        aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                        className={cn(
                          "h-11 px-3 text-start text-xs font-medium whitespace-nowrap text-muted-foreground",
                          header.column.id === "select" && "w-10",
                        )}
                      >
                        {header.isPlaceholder ? null : header.column.getCanSort() ? (
                          <SortHeader
                            label={String(header.column.columnDef.header)}
                            sorted={sorted}
                            onToggle={header.column.getToggleSortingHandler()}
                          />
                        ) : (
                          <table.FlexRender header={header} />
                        )}
                      </th>
                    );
                  })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onOpen(row.original)}
                className={cn(
                  "group cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/60",
                  row.getIsSelected() && "bg-accent/50",
                )}
              >
                {row
                  .getAllCells()
                  .filter((c) => canManage || (c.column.id !== "select" && c.column.id !== "actions"))
                  .map((cell) => (
                    <td key={cell.id} className="h-14 px-3 align-middle">
                      {cell.column.id === "name" ? (
                        <button
                          type="button"
                          className="text-start outline-none focus-visible:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpen(row.original);
                          }}
                          aria-label={`${canManage ? "עריכת" : "פרטי"} ${row.original.fullName}`}
                        >
                          <table.FlexRender cell={cell} />
                        </button>
                      ) : (
                        <table.FlexRender cell={cell} />
                      )}
                    </td>
                  ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
        <span aria-live="polite">
          {data.length ? `מציג ${from}–${to} מתוך ${data.length}` : "אין תוצאות"}
        </span>
        <div className="flex items-center gap-2">
          <Select value={String(pagination.pageSize)} onValueChange={(v) => table.setPageSize(Number(v))}>
            <SelectTrigger className="h-9 w-28" aria-label="שורות בעמוד">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[25, 50, 100, 250].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} בעמוד
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            aria-label="העמוד הקודם"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            <ChevronRightIcon />
          </Button>
          <span className="tabular-nums">
            {pagination.pageIndex + 1} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="העמוד הבא"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            <ChevronLeftIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}
