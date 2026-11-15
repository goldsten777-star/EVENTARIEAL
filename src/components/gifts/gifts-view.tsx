"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, DownloadIcon, GiftIcon, PencilIcon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { deleteGift } from "@/features/gifts/actions";
import type { GiftsPageData } from "@/features/gifts/queries";
import { ProgressRows } from "@/components/dashboard/progress-rows";
import { StatTile } from "@/components/dashboard/stat-tile";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { percent } from "@/lib/dashboard/stats";
import { exportWorkbook } from "@/lib/excel/export";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { GiftDialog, type EditableGift } from "./gift-dialog";

type Gift = GiftsPageData["gifts"][number];
type SortKey = "date" | "amount" | "name";
const ALL = "all";

const guestName = (g: Gift) => {
  const guest = g.guest as { first_name: string; last_name: string } | null;
  return guest ? `${guest.first_name} ${guest.last_name}`.trim() : "";
};

export function SortIcon({ active, desc }: { active: boolean; desc: boolean }) {
  const Icon = !active ? ArrowUpDownIcon : desc ? ArrowDownIcon : ArrowUpIcon;
  return <Icon className={cn("size-3.5", !active && "opacity-40")} aria-hidden="true" />;
}

export function GiftsView({
  eventId,
  eventName,
  data,
  canManage,
  today,
}: {
  eventId: string;
  eventName: string;
  data: GiftsPageData;
  canManage: boolean;
  today: string;
}) {
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState(ALL);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "date", desc: true });
  const [dialog, setDialog] = useState<{ open: boolean; gift: EditableGift | null; key: number }>({ open: false, gift: null, key: 0 });
  const [toDelete, setToDelete] = useState<Gift | null>(null);
  const [pending, start] = useTransition();

  const gifts = data.gifts;
  const total = gifts.reduce((s, g) => s + Number(g.amount), 0);
  const givers = new Set(gifts.map((g) => g.guest_id).filter(Boolean)).size;
  const cashGifts = gifts.filter((g) => Number(g.amount) > 0);
  const average = cashGifts.length ? total / cashGifts.length : 0;

  const byMethod = useMemo(() => {
    const sums = new Map<string, { sum: number; count: number }>();
    for (const g of gifts) {
      const cur = sums.get(g.payment_method) ?? { sum: 0, count: 0 };
      sums.set(g.payment_method, { sum: cur.sum + Number(g.amount), count: cur.count + 1 });
    }
    return [...sums.entries()].sort((a, b) => b[1].sum - a[1].sum);
  }, [gifts]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    const qPhone = digits.startsWith("0") ? "972" + digits.slice(1) : digits;
    const list = gifts.filter((g) => {
      if (method !== ALL && g.payment_method !== method) return false;
      if (!q) return true;
      const phone = (g.guest as { phone: string | null } | null)?.phone ?? "";
      return guestName(g).toLowerCase().includes(q) || (g.notes ?? "").toLowerCase().includes(q) || (digits.length >= 3 && phone.includes(qPhone));
    });
    const dir = sort.desc ? -1 : 1;
    return [...list].sort((a, b) => {
      if (sort.key === "amount") return (Number(a.amount) - Number(b.amount)) * dir;
      if (sort.key === "name") return guestName(a).localeCompare(guestName(b), "he") * dir;
      return a.received_at.localeCompare(b.received_at) * dir;
    });
  }, [gifts, query, method, sort]);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== "name" }));
  }

  async function exportExcel() {
    try {
      await exportWorkbook(`${eventName} - מתנות`, [
        {
          name: "מתנות",
          columns: [
            { header: "אורח", width: 24 },
            { header: "טלפון", width: 15 },
            { header: "סכום", width: 12, format: "currency" },
            { header: "אמצעי תשלום", width: 16 },
            { header: "תאריך", width: 12 },
            { header: "הערות", width: 30 },
          ],
          rows: rows.map((g) => [
            guestName(g) || "ללא שיוך",
            formatPhone((g.guest as { phone: string | null } | null)?.phone),
            Number(g.amount),
            PAYMENT_METHOD_LABELS[g.payment_method],
            g.received_at,
            g.notes ?? "",
          ]),
          footer: ["סה״כ", "", rows.reduce((s, g) => s + Number(g.amount), 0), "", "", ""],
        },
      ]);
      toast.success(`יוצאו ${rows.length} מתנות`);
    } catch {
      toast.error("הייצוא נכשל. נסו שוב.");
    }
  }

  const ariaSort = (k: SortKey) => (sort.key === k ? (sort.desc ? "descending" : "ascending") : undefined);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="מתנות"
        description="תיעוד המתנות שהתקבלו וסיכום ההכנסות מהאירוע."
        actions={
          <>
            <Button variant="outline" size="lg" onClick={() => void exportExcel()} disabled={!gifts.length}>
              <DownloadIcon aria-hidden="true" /> ייצוא
            </Button>
            {canManage ? (
              <Button size="lg" onClick={() => setDialog((d) => ({ open: true, gift: null, key: d.key + 1 }))}>
                <PlusIcon aria-hidden="true" /> מתנה חדשה
              </Button>
            ) : null}
          </>
        }
      />

      <section aria-label="סיכום" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="סך המתנות" value={formatCurrency(total)} context={`${formatNumber(gifts.length)} מתנות נרשמו`} />
        <StatTile label="ממוצע למתנה" value={formatCurrency(average)} context="מתנות כספיות בלבד" />
        <StatTile label="אורחים שנתנו מתנה" value={formatNumber(givers)} context={`${formatNumber(gifts.length - gifts.filter((g) => g.guest_id).length)} מתנות ללא שיוך לאורח`} />
        <StatTile
          label="כיסוי ההוצאות"
          value={`${percent(total, data.actualExpenses)}%`}
          context={data.actualExpenses ? `מתוך ${formatCurrency(data.actualExpenses)} הוצאות בפועל` : "עוד לא הוזנו הוצאות"}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>לפי אמצעי תשלום</CardTitle>
            <CardDescription>חלק מסך המתנות</CardDescription>
          </CardHeader>
          <CardContent>
            <ProgressRows
              empty="עוד לא נרשמו מתנות."
              rows={byMethod.map(([m, v]) => ({
                key: m,
                label: PAYMENT_METHOD_LABELS[m as keyof typeof PAYMENT_METHOD_LABELS],
                value: v.sum,
                total,
                caption: `${formatCurrency(v.sum)} · ${v.count} מתנות`,
              }))}
            />
          </CardContent>
        </Card>

        <div className="flex min-w-0 flex-col rounded-2xl border bg-card lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <label className="relative flex min-w-48 flex-1 items-center">
              <span className="sr-only">חיפוש מתנה</span>
              <SearchIcon className="pointer-events-none absolute start-3 size-4 text-muted-foreground" aria-hidden="true" />
              <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש לפי אורח, טלפון או הערה…" className="ps-9" />
            </label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger aria-label="אמצעי תשלום" className="h-10 w-auto min-w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>כל אמצעי התשלום</SelectItem>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {gifts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <GiftIcon className="size-6" aria-hidden="true" />
              </span>
              <h2 className="text-lg font-semibold">עוד לא נרשמו מתנות</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                {canManage ? "רשמו כל מתנה שמתקבלת: סכום, אמצעי תשלום ותאריך." : "מנהלי האירוע עדיין לא רשמו מתנות."}
              </p>
            </div>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th scope="col" aria-sort={ariaSort("name")} className="h-11 px-3 text-start font-medium">
                      <button type="button" onClick={() => toggleSort("name")} className="inline-flex items-center gap-1 rounded px-1 hover:bg-muted">
                        אורח <SortIcon active={sort.key === "name"} desc={sort.desc} />
                      </button>
                    </th>
                    <th scope="col" aria-sort={ariaSort("amount")} className="px-3 text-start font-medium">
                      <button type="button" onClick={() => toggleSort("amount")} className="inline-flex items-center gap-1 rounded px-1 hover:bg-muted">
                        סכום <SortIcon active={sort.key === "amount"} desc={sort.desc} />
                      </button>
                    </th>
                    <th scope="col" className="px-3 text-start font-medium">אמצעי תשלום</th>
                    <th scope="col" aria-sort={ariaSort("date")} className="px-3 text-start font-medium">
                      <button type="button" onClick={() => toggleSort("date")} className="inline-flex items-center gap-1 rounded px-1 hover:bg-muted">
                        תאריך <SortIcon active={sort.key === "date"} desc={sort.desc} />
                      </button>
                    </th>
                    <th scope="col" className="px-3 text-start font-medium">הערות</th>
                    {canManage ? <th scope="col"><span className="sr-only">פעולות</span></th> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((g) => (
                    <tr key={g.id} className="border-b last:border-0">
                      <td className="h-12 px-3 font-medium whitespace-nowrap">
                        {guestName(g) || <span className="text-muted-foreground">ללא שיוך</span>}
                      </td>
                      <td className="px-3 whitespace-nowrap tabular-nums">{formatCurrency(Number(g.amount))}</td>
                      <td className="px-3 whitespace-nowrap">{PAYMENT_METHOD_LABELS[g.payment_method]}</td>
                      <td className="px-3 whitespace-nowrap text-muted-foreground">{formatDate(`${g.received_at}T12:00:00Z`, { month: "numeric" })}</td>
                      <td className="max-w-56 truncate px-3 text-muted-foreground">{g.notes ?? ""}</td>
                      {canManage ? (
                        <td className="px-2 whitespace-nowrap text-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`עריכת המתנה של ${guestName(g) || "ללא שיוך"}`}
                            onClick={() => setDialog((d) => ({ open: true, gift: { ...g, amount: Number(g.amount) }, key: d.key + 1 }))}
                          >
                            <PencilIcon />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`מחיקת המתנה של ${guestName(g) || "ללא שיוך"}`}
                            disabled={pending}
                            onClick={() => setToDelete(g)}
                          >
                            <Trash2Icon />
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length ? <p className="py-10 text-center text-sm text-muted-foreground">אין תוצאות</p> : null}
            </div>
          )}
        </div>
      </div>

      {canManage ? (
        <GiftDialog
          open={dialog.open}
          onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
          formKey={dialog.key}
          eventId={eventId}
          gift={dialog.gift}
          guests={data.guests}
          today={today}
        />
      ) : null}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק את המתנה?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete ? `${guestName(toDelete) || "ללא שיוך"} · ${formatCurrency(Number(toDelete.amount))}` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const g = toDelete!;
                setToDelete(null);
                start(async () => {
                  const r = await deleteGift(eventId, g.id);
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
    </div>
  );
}
