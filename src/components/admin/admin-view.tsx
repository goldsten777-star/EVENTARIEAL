"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CheckIcon, MailWarningIcon, SearchIcon, ShieldCheckIcon, ShieldOffIcon } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { setPlatformAdmin } from "@/features/admin/actions";
import { matches, type AdminEvent, type AdminUser } from "@/lib/admin/overview";
import { formatDate } from "@/lib/format";
import { EVENT_STATUS_LABELS, EVENT_TYPE_LABELS } from "@/lib/labels";

const short = (iso: string | null) => (iso ? formatDate(iso, { month: "numeric", year: "2-digit" }) : "–");
const shortTime = (iso: string) =>
  formatDate(iso, { month: "numeric", year: "2-digit", hour: "2-digit", minute: "2-digit" });

export function AdminView({ users, events, currentUserId }: { users: AdminUser[]; events: AdminEvent[]; currentUserId: string }) {
  const [query, setQuery] = useState("");
  const [toChange, setToChange] = useState<AdminUser | null>(null);
  const [pending, start] = useTransition();

  const shownUsers = useMemo(() => users.filter((u) => matches(query, u.fullName, u.email)), [users, query]);
  const shownEvents = useMemo(
    () => events.filter((e) => matches(query, e.name, e.ownerName, e.ownerEmail)),
    [events, query],
  );

  const confirmChange = () => {
    const u = toChange!;
    setToChange(null);
    start(async () => {
      const r = await setPlatformAdmin(u.id, !u.isPlatformAdmin);
      if (r.ok) toast.success(`${r.message}: ${u.fullName || u.email}`);
      else toast.error(r.message);
    });
  };

  return (
    <Tabs defaultValue="users" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="users">משתמשים ({users.length})</TabsTrigger>
          <TabsTrigger value="events">אירועים ({events.length})</TabsTrigger>
        </TabsList>
        <div className="relative w-full sm:w-72">
          <SearchIcon className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="חיפוש משתמש או אירוע"
            placeholder="חיפוש לפי שם או אימייל…"
            className="ps-9"
          />
        </div>
      </div>

      <TabsContent value="users" className="min-w-0">
        <div className="relative overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <caption className="sr-only">משתמשים רשומים</caption>
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="px-4 py-3 text-start font-medium">משתמש</th>
                <th className="px-4 py-3 text-start font-medium">נרשם</th>
                <th className="px-4 py-3 text-start font-medium">כניסה אחרונה</th>
                <th className="px-4 py-3 text-start font-medium">אימייל</th>
                <th className="px-4 py-3 text-end font-medium">בעלים</th>
                <th className="px-4 py-3 text-end font-medium">חבר צוות</th>
                <th className="px-4 py-3 text-start font-medium">הרשאה</th>
                <th className="px-4 py-3">
                  <span className="sr-only">פעולות</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shownUsers.map((u) => {
                const self = u.id === currentUserId;
                return (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {u.fullName || "ללא שם"}
                          {self ? <span className="text-muted-foreground"> (את/ה)</span> : null}
                        </span>
                        <span className="text-xs text-muted-foreground" dir="ltr">
                          {u.email}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">{short(u.createdAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                      {u.lastSignInAt ? shortTime(u.lastSignInAt) : <span className="text-muted-foreground">מעולם לא</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {u.emailConfirmed ? (
                        <span className="inline-flex items-center gap-1 text-success">
                          <CheckIcon className="size-3.5" aria-hidden="true" />
                          אושר
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-warning">
                          <MailWarningIcon className="size-3.5" aria-hidden="true" />
                          לא אושר
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums">{u.eventsOwned}</td>
                    <td className="px-4 py-3 text-end tabular-nums">{u.eventsJoined}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {u.isPlatformAdmin ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                          <ShieldCheckIcon className="size-3.5" aria-hidden="true" />
                          מנהל מערכת
                        </span>
                      ) : (
                        <span className="text-muted-foreground">משתמש</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-end">
                      {self ? null : (
                        <Button
                          size="sm"
                          variant={u.isPlatformAdmin ? "destructive" : "outline"}
                          disabled={pending}
                          onClick={() => setToChange(u)}
                          aria-label={`${u.isPlatformAdmin ? "הסרת הרשאת מנהל" : "הענקת הרשאת מנהל"} ל${u.fullName || u.email}`}
                        >
                          {u.isPlatformAdmin ? "הסרת הרשאה" : "הפיכה למנהל"}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {shownUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                    לא נמצאו משתמשים
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </TabsContent>

      <TabsContent value="events" className="min-w-0">
        <div className="relative overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <caption className="sr-only">כל האירועים במערכת</caption>
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="px-4 py-3 text-start font-medium">אירוע</th>
                <th className="px-4 py-3 text-start font-medium">תאריך</th>
                <th className="px-4 py-3 text-start font-medium">בעלים</th>
                <th className="px-4 py-3 text-end font-medium">מוזמנים</th>
                <th className="px-4 py-3 text-end font-medium">צוות</th>
                <th className="px-4 py-3 text-start font-medium">סטטוס</th>
                <th className="px-4 py-3 text-start font-medium">נוצר</th>
              </tr>
            </thead>
            <tbody>
              {shownEvents.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <Link href={`/events/${e.id}/dashboard`} className="font-medium hover:underline">
                        {e.name}
                      </Link>
                      <span className="text-xs text-muted-foreground">{EVENT_TYPE_LABELS[e.eventType]}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">{e.eventDate ? formatDate(e.eventDate) : "–"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span>{e.ownerName || "ללא שם"}</span>
                      <span className="text-xs text-muted-foreground" dir="ltr">
                        {e.ownerEmail}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums">{e.guests}</td>
                  <td className="px-4 py-3 text-end tabular-nums">{e.members}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{EVENT_STATUS_LABELS[e.status]}</td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">{short(e.createdAt)}</td>
                </tr>
              ))}
              {shownEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    לא נמצאו אירועים
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </TabsContent>

      <AlertDialog open={!!toChange} onOpenChange={(o) => !o && setToChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toChange?.isPlatformAdmin ? "להסיר את הרשאת מנהל המערכת?" : "להעניק הרשאת מנהל מערכת?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toChange
                ? toChange.isPlatformAdmin
                  ? `${toChange.fullName || toChange.email} לא יוכל/תוכל יותר לראות את כל האירועים במערכת ואת מסך הניהול.`
                  : `${toChange.fullName || toChange.email} יוכל/תוכל לראות ולנהל את כל האירועים של כל המשתמשים, ולשנות הרשאות מערכת.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction variant={toChange?.isPlatformAdmin ? "destructive" : "default"} onClick={confirmChange}>
              {toChange?.isPlatformAdmin ? (
                <>
                  <ShieldOffIcon data-icon="inline-start" />
                  הסרת ההרשאה
                </>
              ) : (
                <>
                  <ShieldCheckIcon data-icon="inline-start" />
                  הענקת ההרשאה
                </>
              )}
            </AlertDialogAction>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Tabs>
  );
}
