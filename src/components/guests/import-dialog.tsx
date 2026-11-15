"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CircleAlertIcon,
  CircleCheckIcon,
  CopyIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  Loader2Icon,
  UploadIcon,
} from "lucide-react";
import { toast } from "sonner";
import { importGuestsBatch } from "@/features/guests/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downloadImportTemplate, readXlsx, type SheetRow } from "@/lib/guests/excel";
import {
  applyMapping,
  autoMapHeaders,
  IMPORT_FIELDS,
  markDuplicates,
  parseCsv,
  parseImportRow,
  type ColumnMapping,
  type ImportFieldKey,
} from "@/lib/guests/import";
import { RSVP_LABELS } from "@/lib/labels-guests";
import { formatPhone } from "@/lib/phone";

const BATCH = 200;
const MAX_ROWS = 5000;
const NONE = "__none__";

type Step = "upload" | "map" | "review" | "running" | "done";
type Summary = { inserted: number; updated: number; skipped: number; errors: Array<{ line: number; message: string }> };

export function ImportDialog({ eventId, existingPhones }: { eventId: string; existingPhones: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [onDuplicate, setOnDuplicate] = useState<"skip" | "update">("skip");
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileError, setFileError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("upload");
    setFileName("");
    setHeaders([]);
    setRows([]);
    setMapping({});
    setProgress(0);
    setSummary(null);
    setFileError("");
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setFileError("");
    if (file.size > 10 * 1024 * 1024) return setFileError("הקובץ גדול מדי (עד 10MB)");
    setLoading(true);
    try {
      let sheet: SheetRow[];
      if (/\.csv$/i.test(file.name)) {
        sheet = parseCsv(await file.text()).map((cells, i) => ({ line: i + 1, cells }));
      } else if (/\.xlsx$/i.test(file.name)) {
        sheet = await readXlsx(file);
      } else {
        setFileError("יש לבחור קובץ Excel (‎.xlsx) או CSV. קבצי ‎.xls ישנים יש לשמור קודם בפורמט ‎.xlsx.");
        return;
      }
      if (sheet.length < 2) return setFileError("לא נמצאו שורות נתונים בקובץ");
      if (sheet.length - 1 > MAX_ROWS) return setFileError(`אפשר לייבא עד ${MAX_ROWS} שורות בכל פעם`);
      const [head, ...data] = sheet;
      setFileName(file.name);
      setHeaders(head.cells);
      setRows(data);
      setMapping(autoMapHeaders(head.cells));
      setStep("map");
    } catch {
      setFileError("לא הצלחנו לקרוא את הקובץ. ודאו שזה קובץ Excel תקין.");
    } finally {
      setLoading(false);
    }
  }

  const parsed = useMemo(() => {
    if (step !== "review" && step !== "running" && step !== "done") return [];
    return markDuplicates(
      rows.map((r) => parseImportRow(applyMapping(r.cells, mapping), r.line)),
      existingPhones,
    );
  }, [rows, mapping, existingPhones, step]);

  const valid = parsed.filter((r) => r.data);
  const invalid = parsed.filter((r) => !r.data);
  const duplicatesExisting = valid.filter((r) => r.duplicate === "existing").length;
  const duplicatesFile = valid.filter((r) => r.duplicate === "file").length;

  async function runImport() {
    setStep("running");
    const toSend = valid.map((r) => ({ line: r.line, raw: r.raw }));
    const total: Summary = { inserted: 0, updated: 0, skipped: 0, errors: [] };
    for (let i = 0; i < toSend.length; i += BATCH) {
      const res = await importGuestsBatch(eventId, toSend.slice(i, i + BATCH), onDuplicate);
      if (!res.ok) {
        total.errors.push({ line: 0, message: res.message ?? "שגיאה בייבוא" });
        break;
      }
      total.inserted += res.inserted;
      total.updated += res.updated;
      total.skipped += res.skipped;
      total.errors.push(...res.errors);
      setProgress(Math.round(((i + BATCH) / toSend.length) * 100));
    }
    total.errors.push(...invalid.map((r) => ({ line: r.line, message: r.errors.join(" · ") })));
    total.errors.sort((a, b) => a.line - b.line);
    setSummary(total);
    setStep("done");
    router.refresh();
    if (total.inserted || total.updated) toast.success(`יובאו ${total.inserted} הזמנות חדשות`);
  }

  const mappedFirstName = mapping.firstName !== undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (step === "running") return;
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="lg">
          <UploadIcon aria-hidden="true" /> ייבוא מ-Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>ייבוא מוזמנים מ-Excel</DialogTitle>
          <DialogDescription>
            {step === "upload" && "בחרו קובץ Excel או CSV. השורה הראשונה צריכה להכיל את כותרות העמודות."}
            {step === "map" && `${fileName} · ${rows.length} שורות. בדקו שכל עמודה מקושרת לשדה הנכון.`}
            {step === "review" && "בדקו את התוצאה לפני הייבוא."}
            {step === "running" && "מייבאים… נא לא לסגור את החלון."}
            {step === "done" && "הייבוא הסתיים."}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" ? (
          <div className="flex flex-col gap-4">
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void handleFile(e.dataTransfer.files[0]);
              }}
              className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center hover:bg-muted/50 focus-within:ring-3 focus-within:ring-ring/50"
            >
              {loading ? (
                <Loader2Icon className="size-8 animate-spin text-muted-foreground" aria-hidden="true" />
              ) : (
                <FileSpreadsheetIcon className="size-8 text-muted-foreground" aria-hidden="true" />
              )}
              <span className="font-medium">גררו לכאן קובץ או לחצו לבחירה</span>
              <span className="text-sm text-muted-foreground">‎.xlsx או ‎.csv, עד {MAX_ROWS} שורות</span>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                className="sr-only"
                aria-label="בחירת קובץ לייבוא"
                onChange={(e) => void handleFile(e.target.files?.[0])}
              />
            </label>
            {fileError ? (
              <p role="alert" className="rounded-lg bg-destructive-soft px-3 py-2 text-sm text-destructive">
                {fileError}
              </p>
            ) : null}
            <Button variant="link" className="self-start px-0" onClick={() => void downloadImportTemplate()}>
              <DownloadIcon aria-hidden="true" /> הורדת תבנית לדוגמה
            </Button>
          </div>
        ) : null}

        {step === "map" ? (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {IMPORT_FIELDS.map((field) => {
                const value = mapping[field.key];
                return (
                  <div key={field.key} className="flex items-center gap-3">
                    <Label className="w-32 shrink-0" htmlFor={`map-${field.key}`}>
                      {field.label}
                      {"required" in field ? <span className="text-destructive"> *</span> : null}
                    </Label>
                    <Select
                      value={value === undefined ? NONE : String(value)}
                      onValueChange={(v) =>
                        setMapping((m) => {
                          const next = { ...m };
                          if (v === NONE) delete next[field.key as ImportFieldKey];
                          else next[field.key as ImportFieldKey] = Number(v);
                          return next;
                        })
                      }
                    >
                      <SelectTrigger id={`map-${field.key}`} className="h-9 flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>— לא לייבא —</SelectItem>
                        {headers.map((h, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {h || `עמודה ${i + 1}`}
                            {rows[0]?.cells[i] ? ` (למשל: ${rows[0].cells[i].slice(0, 20)})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
            {!mappedFirstName ? (
              <p role="alert" className="text-sm text-destructive">
                יש לקשר עמודה לשדה &quot;שם פרטי&quot;
              </p>
            ) : null}
            <DialogFooter className="gap-2 sm:justify-start">
              <Button size="lg" disabled={!mappedFirstName} onClick={() => setStep("review")}>
                המשך לבדיקה
              </Button>
              <Button size="lg" variant="outline" onClick={reset}>
                קובץ אחר
              </Button>
            </DialogFooter>
          </div>
        ) : null}

        {step === "review" ? (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="שורות תקינות" value={valid.length} tone="text-success" />
              <Stat label="שורות עם שגיאות" value={invalid.length} tone={invalid.length ? "text-destructive" : ""} />
              <Stat label="קיימים כבר באירוע" value={duplicatesExisting} tone={duplicatesExisting ? "text-warning" : ""} />
              <Stat label="כפולים בקובץ" value={duplicatesFile} tone={duplicatesFile ? "text-warning" : ""} />
            </div>

            {duplicatesExisting ? (
              <fieldset className="flex flex-col gap-2 rounded-xl border p-4">
                <legend className="px-1 text-sm font-semibold">מה לעשות עם מוזמנים שהטלפון שלהם כבר קיים?</legend>
                <RadioGroup value={onDuplicate} onValueChange={(v) => setOnDuplicate(v as "skip" | "update")}>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="skip" id="dup-skip" />
                    <Label htmlFor="dup-skip">לדלג עליהם (מומלץ)</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="update" id="dup-update" />
                    <Label htmlFor="dup-update">לעדכן את הפרטים הקיימים לפי הקובץ</Label>
                  </div>
                </RadioGroup>
                {duplicatesFile ? (
                  <p className="text-xs text-muted-foreground">מספרים שמופיעים יותר מפעם אחת בקובץ ייובאו פעם אחת בלבד.</p>
                ) : null}
              </fieldset>
            ) : null}

            <div className="max-h-72 overflow-auto rounded-xl border">
              <table className="w-full text-sm">
                <caption className="sr-only">תצוגה מקדימה של השורות</caption>
                <thead className="sticky top-0 bg-muted text-start text-xs text-muted-foreground">
                  <tr>
                    <th className="p-2 text-start font-medium">שורה</th>
                    <th className="p-2 text-start font-medium">שם</th>
                    <th className="p-2 text-start font-medium">טלפון</th>
                    <th className="p-2 text-start font-medium">מוזמנים</th>
                    <th className="p-2 text-start font-medium">סטטוס</th>
                    <th className="p-2 text-start font-medium">בדיקה</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[...invalid, ...valid].slice(0, 200).map((r) => (
                    <tr key={r.line} className={r.data ? "" : "bg-destructive-soft/50"}>
                      <td className="p-2 tabular-nums text-muted-foreground">{r.line}</td>
                      <td className="p-2">
                        {r.raw.firstName} {r.raw.lastName}
                      </td>
                      <td className="p-2" dir="ltr">
                        {r.data?.phone ? formatPhone(r.data.phone) : r.raw.phone}
                      </td>
                      <td className="p-2">{r.data ? r.data.invitedAdults! + r.data.invitedChildren! : "—"}</td>
                      <td className="p-2">{r.data ? RSVP_LABELS[r.data.rsvpStatus] : "—"}</td>
                      <td className="p-2">
                        {r.data ? (
                          r.duplicate === "existing" ? (
                            <span className="text-warning">קיים באירוע</span>
                          ) : r.duplicate === "file" ? (
                            <span className="text-warning">כפול בקובץ</span>
                          ) : (
                            <span className="text-success">תקין</span>
                          )
                        ) : (
                          <span className="text-destructive">{r.errors.join(" · ")}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsed.length > 200 ? (
              <p className="text-xs text-muted-foreground">מוצגות 200 שורות ראשונות (שגיאות קודם).</p>
            ) : null}
            {invalid.length ? (
              <p className="text-sm text-muted-foreground">
                שורות עם שגיאות לא ייובאו. אפשר לתקן אותן בקובץ ולייבא שוב — מוזמנים שכבר יובאו יזוהו לפי הטלפון.
              </p>
            ) : null}

            <DialogFooter className="gap-2 sm:justify-start">
              <Button size="lg" disabled={!valid.length} onClick={() => void runImport()}>
                ייבוא {valid.length} שורות
              </Button>
              <Button size="lg" variant="outline" onClick={() => setStep("map")}>
                חזרה למיפוי
              </Button>
            </DialogFooter>
          </div>
        ) : null}

        {step === "running" ? (
          <div className="flex flex-col gap-3 py-6" aria-live="polite">
            <Progress value={Math.min(progress, 100)} aria-label="התקדמות הייבוא" />
            <p className="text-center text-sm text-muted-foreground">{Math.min(progress, 100)}%</p>
          </div>
        ) : null}

        {step === "done" && summary ? (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="נוספו" value={summary.inserted} tone="text-success" />
              <Stat label="עודכנו" value={summary.updated} />
              <Stat label="דולגו (כפולים)" value={summary.skipped} />
              <Stat label="שגיאות" value={summary.errors.length} tone={summary.errors.length ? "text-destructive" : ""} />
            </div>
            {summary.errors.length ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-semibold text-destructive">
                    <CircleAlertIcon className="size-4" aria-hidden="true" /> שורות שלא יובאו
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(summary.errors.map((e) => `שורה ${e.line}: ${e.message}`).join("\n"))
                        .then(() => toast.success("הועתק"))
                    }
                  >
                    <CopyIcon aria-hidden="true" /> העתקת הרשימה
                  </Button>
                </div>
                <ul className="max-h-48 overflow-auto rounded-xl border text-sm">
                  {summary.errors.map((e, i) => (
                    <li key={i} className="border-b px-3 py-2 last:border-0">
                      {e.line ? <span className="font-medium">שורה {e.line}: </span> : null}
                      {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-success">
                <CircleCheckIcon className="size-5" aria-hidden="true" /> כל השורות יובאו בהצלחה
              </p>
            )}
            <DialogFooter className="sm:justify-start">
              <Button
                size="lg"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
              >
                סיום
              </Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, tone = "" }: { label: string; value: number; tone?: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1 rounded-xl border p-3">
      <span className="text-xs text-muted-foreground" aria-hidden="true">
        {label}
      </span>
      <span className={`text-2xl font-bold tabular-nums ${tone}`}>{value}</span>
    </div>
  );
}
