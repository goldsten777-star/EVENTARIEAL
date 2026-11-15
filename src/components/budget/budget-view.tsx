"use client";

import { useMemo, useState, useTransition } from "react";
import { CircleCheckIcon, CircleDashedIcon, CircleDotIcon, ClockIcon, DownloadIcon, PencilIcon, PlusIcon, Trash2Icon, WalletIcon } from "lucide-react";
import { toast } from "sonner";
import { deleteExpense } from "@/features/budget/actions";
import type { BudgetPageData, ExpenseRow } from "@/features/budget/queries";
import { ProgressRows } from "@/components/dashboard/progress-rows";
import { Meter, StatTile } from "@/components/dashboard/stat-tile";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { percent } from "@/lib/dashboard/stats";
import { exportWorkbook } from "@/lib/excel/export";
import { formatCurrency, formatDate } from "@/lib/format";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { paymentStatus } from "@/lib/validation/expense";
import { BudgetTotalDialog, ExpenseDialog } from "./expense-dialog";

const ALL = "all";
const CATEGORY_ORDER = Object.keys(EXPENSE_CATEGORY_LABELS);
const STATUS = {
  paid: { label: "שולם", icon: CircleCheckIcon, tone: "bg-success-soft text-success" },
  partial: { label: "שולם חלקית", icon: CircleDotIcon, tone: "bg-warning-soft text-warning" },
  unpaid: { label: "לא שולם", icon: CircleDashedIcon, tone: "bg-muted text-muted-foreground" },
  none: { label: "ללא עלות", icon: CircleDashedIcon, tone: "bg-muted text-muted-foreground" },
} as const;

const cost = (e: ExpenseRow) => e.actual_amount || e.planned_amount;
const leftToPay = (e: ExpenseRow) => Math.max(cost(e) - e.paid_amount, 0);
const label = (e: ExpenseRow) => e.vendor_name || e.description || EXPENSE_CATEGORY_LABELS[e.category];

export function BudgetView({
  eventId,
  eventName,
  data,
  canManage,
  today,
}: {
  eventId: string;
  eventName: string;
  data: BudgetPageData;
  canManage: boolean;
  today: string;
}) {
  const [category, setCategory] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [dialog, setDialog] = useState<{ open: boolean; expense: ExpenseRow | null; key: number }>({ open: false, expense: null, key: 0 });
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [toDelete, setToDelete] = useState<ExpenseRow | null>(null);
  const [pending, start] = useTransition();

  const { expenses, budgetTotal, giftsTotal } = data;
  const planned = expenses.reduce((s, e) => s + e.planned_amount, 0);
  const actual = expenses.reduce((s, e) => s + e.actual_amount, 0);
  const paid = expenses.reduce((s, e) => s + e.paid_amount, 0);
  const owed = expenses.reduce((s, e) => s + leftToPay(e), 0);
  const base = budgetTotal || planned;
  const soon = new Date(`${today}T00:00:00Z`);
  soon.setUTCDate(soon.getUTCDate() + 14);
  const soonIso = soon.toISOString().slice(0, 10);
  const dueSoon = (e: ExpenseRow) => !!e.due_date && e.due_date <= soonIso && leftToPay(e) > 0;

  const byCategory = useMemo(() => {
    const m = new Map<string, { planned: number; actual: number }>();
    for (const e of expenses) {
      const cur = m.get(e.category) ?? { planned: 0, actual: 0 };
      m.set(e.category, { planned: cur.planned + e.planned_amount, actual: cur.actual + e.actual_amount });
    }
    return CATEGORY_ORDER.filter((c) => m.has(c)).map((c) => ({ category: c, ...m.get(c)! }));
  }, [expenses]);

  const rows = useMemo(
    () =>
      expenses
        .filter((e) => (category === ALL || e.category === category) && (status === ALL || paymentStatus(e) === status))
        .sort(
          (a, b) =>
            CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || (a.due_date ?? "9").localeCompare(b.due_date ?? "9"),
        ),
    [expenses, category, status],
  );

  async function exportExcel() {
    try {
      await exportWorkbook(`${eventName} - תקציב`, [
        {
          name: "הוצאות",
          columns: [
            { header: "קטגוריה", width: 14 },
            { header: "ספק", width: 22 },
            { header: "תיאור", width: 26 },
            { header: "מתוכנן", width: 12, format: "currency" },
            { header: "בפועל", width: 12, format: "currency" },
            { header: "שולם", width: 12, format: "currency" },
            { header: "יתרה לתשלום", width: 14, format: "currency" },
            { header: "מועד תשלום", width: 12 },
            { header: "סטטוס", width: 12 },
            { header: "הערות", width: 26 },
          ],
          rows: rows.map((e) => [
            EXPENSE_CATEGORY_LABELS[e.category],
            e.vendor_name ?? "",
            e.description ?? "",
            e.planned_amount,
            e.actual_amount,
            e.paid_amount,
            leftToPay(e),
            e.due_date ?? "",
            STATUS[paymentStatus(e)].label,
            e.notes ?? "",
          ]),
          footer: [
            "סה״כ",
            "",
            "",
            rows.reduce((s, e) => s + e.planned_amount, 0),
            rows.reduce((s, e) => s + e.actual_amount, 0),
            rows.reduce((s, e) => s + e.paid_amount, 0),
            rows.reduce((s, e) => s + leftToPay(e), 0),
            "",
            "",
            "",
          ],
        },
      ]);
      toast.success(`יוצאו ${rows.length} הוצאות`);
    } catch {
      toast.error("הייצוא נכשל. נסו שוב.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="תקציב"
        description="הוצאות לפי קטגוריה, תקציב מתוכנן מול בפועל ומעקב תשלומים לספקים."
        actions={
          <>
            <Button variant="outline" size="lg" onClick={() => void exportExcel()} disabled={!expenses.length}>
              <DownloadIcon aria-hidden="true" /> ייצוא
            </Button>
            {canManage ? (
              <Button size="lg" onClick={() => setDialog((d) => ({ open: true, expense: null, key: d.key + 1 }))}>
                <PlusIcon aria-hidden="true" /> הוצאה חדשה
              </Button>
            ) : null}
          </>
        }
      />

      <section aria-label="סיכום" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="תקציב כולל"
          value={budgetTotal ? formatCurrency(budgetTotal) : "לא הוגדר"}
          context={
            canManage ? (
              <button type="button" onClick={() => setBudgetOpen(true)} className="inline-flex items-center gap-1 text-primary hover:underline">
                <PencilIcon className="size-3.5" aria-hidden="true" /> עדכון התקציב
              </button>
            ) : (
              `מתוכנן בהוצאות: ${formatCurrency(planned)}`
            )
          }
        />
        <StatTile
          label="הוצאות בפועל"
          value={formatCurrency(actual)}
          context={base ? `${percent(actual, base)}% מהתקציב · מתוכנן ${formatCurrency(planned)}` : `מתוכנן ${formatCurrency(planned)}`}
        >
          {base ? <Meter value={actual} max={base} label="ניצול התקציב" /> : null}
        </StatTile>
        <StatTile label="שולם לספקים" value={formatCurrency(paid)} context={`נותר לשלם ${formatCurrency(owed)}`}>
          <Meter value={paid} max={paid + owed} label="שולם מתוך העלות" />
        </StatTile>
        <StatTile
          label="מאזן מול מתנות"
          value={formatCurrency(giftsTotal - actual)}
          context={`מתנות ${formatCurrency(giftsTotal)} פחות הוצאות בפועל`}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>לפי קטגוריה</CardTitle>
            <CardDescription>בפועל מתוך המתוכנן</CardDescription>
          </CardHeader>
          <CardContent>
            <ProgressRows
              empty="עוד לא הוזנו הוצאות."
              rows={byCategory.map((c) => ({
                key: c.category,
                label: EXPENSE_CATEGORY_LABELS[c.category as keyof typeof EXPENSE_CATEGORY_LABELS],
                value: c.actual,
                total: c.planned || c.actual,
                caption: `${formatCurrency(c.actual)} מתוך ${formatCurrency(c.planned)}`,
              }))}
            />
          </CardContent>
        </Card>

        <div className="flex min-w-0 flex-col rounded-2xl border bg-card lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger aria-label="קטגוריה" className="h-10 w-auto min-w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>כל הקטגוריות</SelectItem>
                {Object.entries(EXPENSE_CATEGORY_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger aria-label="סטטוס תשלום" className="h-10 w-auto min-w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>כל הסטטוסים</SelectItem>
                <SelectItem value="unpaid">לא שולם</SelectItem>
                <SelectItem value="partial">שולם חלקית</SelectItem>
                <SelectItem value="paid">שולם</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {expenses.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <WalletIcon className="size-6" aria-hidden="true" />
              </span>
              <h2 className="text-lg font-semibold">עוד לא הוזנו הוצאות</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                {canManage ? "הוסיפו את ההוצאות לפי ספק: אולם, קייטרינג, צלם, מוזיקה ועוד." : "מנהלי האירוע עדיין לא הזינו הוצאות."}
              </p>
            </div>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th scope="col" className="h-11 px-3 text-start font-medium">הוצאה</th>
                    <th scope="col" className="px-3 text-start font-medium">מתוכנן</th>
                    <th scope="col" className="px-3 text-start font-medium">בפועל</th>
                    <th scope="col" className="px-3 text-start font-medium">שולם</th>
                    <th scope="col" className="px-3 text-start font-medium">תשלום</th>
                    {canManage ? <th scope="col"><span className="sr-only">פעולות</span></th> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => {
                    const st = STATUS[paymentStatus(e)];
                    return (
                      <tr key={e.id} className="border-b last:border-0">
                        <td className="px-3 py-2.5">
                          <div className="flex min-w-36 flex-col">
                            <span className="font-medium">{label(e)}</span>
                            <span className="text-xs text-muted-foreground">
                              {EXPENSE_CATEGORY_LABELS[e.category]}
                              {e.vendor_name && e.description ? ` · ${e.description}` : ""}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 whitespace-nowrap tabular-nums">{formatCurrency(e.planned_amount)}</td>
                        <td className="px-3 whitespace-nowrap tabular-nums">{formatCurrency(e.actual_amount)}</td>
                        <td className="px-3 whitespace-nowrap tabular-nums">{formatCurrency(e.paid_amount)}</td>
                        <td className="px-3">
                          <div className="flex flex-col items-start gap-1">
                            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap", st.tone)}>
                              <st.icon className="size-3.5" aria-hidden="true" />
                              {st.label}
                            </span>
                            {e.due_date && leftToPay(e) > 0 ? (
                              <span className={cn("inline-flex items-center gap-1 text-xs whitespace-nowrap", dueSoon(e) ? "font-semibold text-destructive" : "text-muted-foreground")}>
                                <ClockIcon className="size-3" aria-hidden="true" />
                                {formatCurrency(leftToPay(e))} עד {formatDate(`${e.due_date}T12:00:00Z`, { month: "numeric" })}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        {canManage ? (
                          <td className="px-2 whitespace-nowrap text-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`עריכת ההוצאה ${label(e)}`}
                              onClick={() => setDialog((d) => ({ open: true, expense: e, key: d.key + 1 }))}
                            >
                              <PencilIcon />
                            </Button>
                            <Button variant="ghost" size="icon" aria-label={`מחיקת ההוצאה ${label(e)}`} disabled={pending} onClick={() => setToDelete(e)}>
                              <Trash2Icon />
                            </Button>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
                {rows.length ? (
                  <tfoot>
                    <tr className="border-t font-semibold">
                      <td className="h-11 px-3">סה״כ</td>
                      <td className="px-3 tabular-nums">{formatCurrency(rows.reduce((s, e) => s + e.planned_amount, 0))}</td>
                      <td className="px-3 tabular-nums">{formatCurrency(rows.reduce((s, e) => s + e.actual_amount, 0))}</td>
                      <td className="px-3 tabular-nums">{formatCurrency(rows.reduce((s, e) => s + e.paid_amount, 0))}</td>
                      <td colSpan={canManage ? 2 : 1} />
                    </tr>
                  </tfoot>
                ) : null}
              </table>
              {!rows.length ? <p className="py-10 text-center text-sm text-muted-foreground">אין תוצאות</p> : null}
            </div>
          )}
        </div>
      </div>

      {canManage ? (
        <>
          <ExpenseDialog
            open={dialog.open}
            onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
            formKey={dialog.key}
            eventId={eventId}
            expense={dialog.expense}
          />
          <BudgetTotalDialog open={budgetOpen} onOpenChange={setBudgetOpen} eventId={eventId} current={budgetTotal} />
        </>
      ) : null}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק את ההוצאה?</AlertDialogTitle>
            <AlertDialogDescription>{toDelete ? `${label(toDelete)} · ${formatCurrency(cost(toDelete))}` : ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const e = toDelete!;
                setToDelete(null);
                start(async () => {
                  const r = await deleteExpense(eventId, e.id);
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
