# Event Manager – תוכנית ארכיטקטורה ופיתוח

## Context
הריפו `EVENTARIEAL` ריק (רק README). המטרה: לבנות מאפס מערכת SaaS לניהול אירועים ואורחים בעברית/RTL — מוזמנים, RSVP, שולחנות, מתנות, תקציב, Check-in, הרשאות ודוחות — על Next.js + Supabase + Vercel, עם נתונים אמיתיים, RLS ותמיכה באירועים רבים במקביל. לפי בקשת המשתמש: קודם תכנון (ארכיטקטורה, DB, מסכים, תוכנית), ואחרי אישור — פיתוח מודול-מודול עם בדיקה לפני מעבר.

תשתית קיימת בחשבון: ארגון Supabase "Habitflow" (2 פרויקטים במצב INACTIVE), צוות Vercel "hanoh". אין קוד לשימוש חוזר.

**החלטות שאושרו**
- Supabase: פרויקט **חדש** `event-manager` בארגון Habitflow, אזור eu-central-1.
- מודל SaaS: **הרשמה פתוחה** — כל משתמש נרשם ויוצר אירועים משלו ומזמין צוות; מנהל מערכת רואה הכל.
- שליחת הזמנות בגרסה 1: **WhatsApp (`wa.me`) + העתקת קישור** בלבד (ללא מייל/SMS בשלב זה; הארכיטקטורה משאירה מקום ל-provider עתידי).
- **מוקאפ ויזואלי קודם**: לפני מודול 0 — מוקאפ HTML לחיץ של המסכים המרכזיים (Dashboard, מוזמנים, הושבה, RSVP במובייל, Check-in) בבהיר/כהה, לאישור העיצוב.

---

## 1. ארכיטקטורה

**Stack**
- Next.js (App Router, גרסה יציבה אחרונה) + TypeScript strict
- Tailwind CSS + shadcn/ui (RTL: `<html dir="rtl" lang="he">`, logical classes `ms-/me-/ps-/pe-`), גופן Heebo דרך `next/font`, `next-themes` למצב כהה/בהיר
- Supabase: Postgres, Auth (`@supabase/ssr` – סשן בעוגיות + middleware לרענון), Realtime, Storage (תמונת אירוע)
- ספריות: `zod` + `react-hook-form` (אותן סכמות בקליינט ובשרת), TanStack Table (טבלאות), Recharts דרך shadcn charts, `@dnd-kit` (גרירה בשולחנות), `exceljs` (ייבוא/ייצוא Excel – לא SheetJS מ-npm בגלל פגיעות ידועה), `libphonenumber-js` (נרמול טלפון ישראלי ל-E.164), `qrcode` (יצירה) + `@zxing/browser` (סריקה במצלמה), `sonner` (הודעות)
- Hosting: Vercel, משתני סביבה `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (+ `SUPABASE_SERVICE_ROLE_KEY` רק בשרת, לפעולות אדמין)

**עקרונות**
- כל קריאה/כתיבה עוברת דרך Supabase עם הסשן של המשתמש → RLS הוא שכבת האבטחה הראשית; הקליינט לא סומך על עצמו.
- מוטציות דרך Server Actions: ולידציית zod → קריאה ל-Supabase → `revalidatePath` → תוצאה טיפוסית `{ ok, data } | { ok:false, error, fieldErrors }` → toast בעברית.
- לוגיקה רגישה/אטומית ב-Postgres (פונקציות RPC + טריגרים): RSVP ציבורי, Check-in, מניעת שיבוץ יתר, סטטיסטיקות.
- Multi-tenant לפי `event_id`: כל טבלה עסקית מכילה `event_id`, וכל מדיניות RLS בודקת חברות באירוע.
- טיפוסים נוצרים אוטומטית מה-DB (`supabase gen types`) ל-`src/types/database.ts`.
- מיגרציות SQL בתיקיית `supabase/migrations/` (מקור אמת בריפו), מיושמות דרך Supabase MCP / CLI.

**מבנה תיקיות**
```
src/
  app/
    (auth)/login, signup, forgot-password, reset-password
    (app)/events                      ← רשימת אירועים + יצירה
    (app)/events/[eventId]/
        dashboard, guests, invitations, seating, gifts, budget,
        checkin, reports, settings (פרטי אירוע + צוות והרשאות)
    (app)/admin                       ← מנהל מערכת בלבד
    r/[token]                         ← דף RSVP ציבורי (מובייל-first)
    auth/callback                     ← החלפת קוד OAuth/מייל
  components/ui (shadcn), components/layout (sidebar, header, event-switcher, theme-toggle)
  features/<module>/ {actions.ts, queries.ts, schema.ts, components/}
  lib/supabase/{server,client,middleware,admin}.ts, lib/auth/permissions.ts, lib/phone.ts, lib/excel.ts
  middleware.ts
supabase/migrations/*.sql, supabase/seed.sql
tests/ unit (vitest), e2e (playwright), db (בדיקות RLS ב-SQL)
```

---

## 2. מבנה מסד הנתונים

**Enums**: `member_role` (event_manager, viewer, checkin) · `event_type` (wedding, bar_mitzvah, bat_mitzvah, brit, birthday, corporate, other) · `invitation_status` (not_sent, sent, viewed) · `rsvp_status` (pending, attending, declined, maybe) · `payment_method` (cash, check, bit, paybox, bank_transfer, credit_card, gift_item, other) · `expense_category` (venue, catering, photography, music, design, attractions, other) · `table_shape` (round, rectangle, knight)

| טבלה | עמודות עיקריות |
|---|---|
| `profiles` | id (=auth.users.id), full_name, phone, is_platform_admin, created_at — נוצר בטריגר על הרשמה |
| `events` | id, owner_id, name, event_type, event_date, venue_name, venue_address, rsvp_deadline, invitation_message, cover_image_path, budget_total, status, timestamps |
| `event_members` | event_id, user_id, role, unique(event_id,user_id) — יוצר האירוע מתווסף אוטומטית כ-event_manager |
| `event_member_invites` | event_id, email, role, token, accepted_at — הוספת צוות לפני שנרשם; מתקבל אוטומטית בהרשמה/כניסה |
| `guest_groups` | event_id, name, color, sort_order — נזרעות אוטומטית 4 ברירות מחדל (משפחה, חברים, עבודה, אחרים), ניתנות להרחבה |
| `guests` | יחידת הזמנה (אדם/משפחה): event_id, first_name, last_name, phone (E.164), email, group_id, inviter_name, invited_adults, invited_children, reserved_seats, invitation_status, invitation_sent_at, rsvp_status, confirmed_adults, confirmed_children, rsvp_note, rsvp_responded_at, notes, dietary_tags text[], dietary_notes, table_id, invite_token (אקראי 128bit, unique), checked_in_at, checked_in_by, arrived_count, timestamps · **unique(event_id, phone)** |
| `seating_tables` | event_id, number, name, capacity, shape, pos_x, pos_y, notes · unique(event_id, number) |
| `gifts` | event_id, guest_id, amount, payment_method, received_at, notes, created_by |
| `expenses` | event_id, category, vendor_name, description, planned_amount, actual_amount, paid_amount, due_date, notes |
| `activity_log` | event_id, actor_id, guest_id, action (rsvp_submitted, checked_in, check_in_undone, imported…), payload jsonb, created_at |

**לוגיקה ב-DB**
- `seats_needed(guest)` = אם attending → confirmed_adults+confirmed_children, אחרת reserved_seats; declined → 0.
- טריגר `enforce_table_capacity` על guests (שינוי table_id/מספרים): נועל את השולחן (`FOR UPDATE`) ומונע חריגה מקיבולת → שגיאה ברורה בעברית.
- טריגר `updated_at`, טריגר נרמול/ברירת מחדל `reserved_seats = adults+children`.
- RPC ציבוריות (SECURITY DEFINER, `grant execute to anon`, ללא גישת anon לטבלאות): `get_rsvp(token)` מחזיר רק שם אורח+פרטי אירוע; `submit_rsvp(token, status, adults, children, note)` — ולידציה (לא יותר מ-reserved_seats, לפני deadline), מעדכן guest + activity_log, מסמן viewed.
- RPC Check-in (מותר ל-checkin/event_manager): `checkin_search(event_id, q)` מחזיר שדות מצומצמים בלבד; `check_in_guest(event_id, guest_id|token, arrived_count)` — `UPDATE … WHERE checked_in_at IS NULL` אטומי, מחזיר `already_checked_in` עם השעה במקרה כפול; `undo_check_in` למנהל בלבד.
- `event_stats(event_id)` — כל מספרי הדשבורד בשאילתה אחת.

**RLS**
- פונקציות עזר SECURITY DEFINER: `is_platform_admin()`, `event_role(event_id)`, `has_event_role(event_id, roles[])`.
- טבלת הרשאות:

| | מנהל מערכת | מנהל אירוע | צפייה | Check-in |
|---|---|---|---|---|
| אירועים: יצירה | ✓ | כל משתמש מחובר יוצר אירועים משלו והופך למנהל שלהם | | |
| אירוע: עריכה/מחיקה, ניהול צוות | ✓ | ✓ | – | – |
| מוזמנים/שולחנות/מתנות/תקציב: קריאה | ✓ | ✓ | ✓ | – |
| מוזמנים/שולחנות/מתנות/תקציב: כתיבה | ✓ | ✓ | – | – |
| Check-in (חיפוש+סימון) | ✓ | ✓ | – | ✓ (רק דרך RPC) |
| פאנל אדמין (כל המשתמשים והאירועים) | ✓ | – | – | – |

- בצד הלקוח: `lib/auth/permissions.ts` מסתיר ניווט/כפתורים לפי תפקיד, ו-layout של האירוע מפנה משתמש Check-in ישירות למסך Check-in. האכיפה האמיתית היא RLS.

**Seed** (`supabase/seed.sql`, לבדיקות בלבד): משתמשי בדיקה לכל תפקיד, 2 אירועים, ~150 מוזמנים מגוונים, 15 שולחנות, מתנות והוצאות.

---

## 3. מסכי המערכת

1. **התחברות / הרשמה / שחזור סיסמה** — מייל+סיסמה (Supabase Auth), עיצוב מפוצל עם תמונה.
2. **האירועים שלי** — כרטיסים (שם, תאריך, ספירה לאחור, % אישורים), יצירת אירוע בדיאלוג.
3. **Layout** — Sidebar ימני מתקפל (מגירה במובייל), בורר אירוע, מתג כהה/בהיר, תפריט משתמש.
4. **Dashboard** — כרטיסי KPI: סה״כ מוזמנים/אנשים, אישרו, סירבו, ממתינים, הגיעו בפועל, % אישור, שולחנות ותפוסה, תקציב מול בפועל. גרפים: donut סטטוסי RSVP, עמודות לפי קבוצה, קו אישורים לאורך זמן, תפוסת שולחנות, תקציב לפי קטגוריה. עדכון בזמן אמת (Realtime).
5. **מוזמנים** — טבלה חכמה: חיפוש מהיר, פילטרים (קבוצה, סטטוס הזמנה, RSVP, שולחן, ללא שולחן), מיון, בחירה מרובה ופעולות גורפות (שיוך קבוצה/שולחן, מחיקה, סימון נשלח), Sheet צדדי להוספה/עריכה (כולל "משפחה" עם מבוגרים/ילדים), אזהרת כפילות טלפון בזמן הקלדה, ייבוא Excel באשף (העלאה → מיפוי עמודות → תצוגה מקדימה עם שגיאות/כפילויות → אישור), ייצוא Excel לפי הפילטר הנוכחי, הורדת תבנית.
6. **הזמנות ו-RSVP** — מעקב סטטוס לכל אורח, העתקת קישור אישי, שליחה ב-WhatsApp (`wa.me` עם הודעה מותאמת), שליחה גורפת, עריכת נוסח הזמנה עם משתנים (`{שם}`, `{קישור}`), QR אישי להורדה.
7. **דף RSVP ציבורי** `/r/[token]` — מובייל-first: פרטי אירוע, "מגיע/ה" / "לא אגיע", בוחרי מספר מבוגרים/ילדים (מוגבל למקומות השמורים), הערות, מסך תודה + הוספה ליומן + QR לכניסה. אפשר לעדכן תשובה עד ה-deadline.
8. **סידורי ישיבה** — קנבס עם שולחנות (עיגול/מלבן) גרירים, כל שולחן מציג X/קיבולת וצבע תפוסה; רשימת "ללא שולחן" צדדית עם חיפוש ופילטר קבוצה; גרירת אורח לשולחן/בין שולחנות; חסימה ויזואלית + שגיאת שרת בשיבוץ יתר; "שבץ קבוצה לשולחן"; תצוגת רשימה חלופית למובייל.
9. **מתנות** — טבלה לפי אורח (סכום, אמצעי, תאריך, הערות), כרטיסי סיכום (סה״כ, ממוצע לאורח, לפי אמצעי תשלום), השוואה מול הוצאות.
10. **תקציב** — תקציב כולל, הוצאות לפי קטגוריה (מתוכנן/בפועל/שולם), progress bars, גרף מתוכנן מול בפועל, יתרה, מאזן מול מתנות.
11. **Check-in** — מסך מותאם טאבלט/טלפון: שדה חיפוש גדול (שם/טלפון), כפתור סריקת QR, כרטיס אורח עם מספר מאושרים ושולחן בגדול, כפתור "סמן הגעה" + עדכון כמות שהגיעה, התראה אדומה על כניסה כפולה, מונה הגעות חי.
12. **דוחות** — רשימות להדפסה/ייצוא Excel: אורחים לפי שולחן, רגישויות מזון לקייטרינג, סטטוס RSVP, מתנות, תקציב, נוכחות בפועל.
13. **הגדרות אירוע** — פרטי אירוע, קבוצות, צוות והרשאות (הזמנה במייל + תפקיד), מחיקת אירוע.
14. **פאנל מנהל מערכת** — משתמשים, אירועים, מתן/הסרת אדמין.

(שלב ראשון אחרי אישור: מוקאפ HTML לחיץ של מסכים 4, 5, 7, 8, 11 — לאישור העיצוב לפני כתיבת הקוד.)

---

## 4. תוכנית פיתוח (מודול אחר מודול, כל אחד נבדק לפני הבא)

| # | מודול | תוצר | בדיקות |
|---|---|---|---|
| M | מוקאפ עיצוב | Artifact HTML לחיץ (RTL, בהיר/כהה, דסקטופ+מובייל) | אישור המשתמש על השפה העיצובית |
| 0 | תשתית | Next.js+TS, Tailwind, shadcn, RTL, Heebo, ערכת נושא כהה/בהירה, ESLint/Prettier, Vitest, Playwright, פרויקט Supabase, חיבור Vercel | build + lint + עמוד בית עולה |
| 1 | מסד נתונים | כל המיגרציות: טבלאות, enums, אינדקסים, טריגרים, RPC, RLS, seed; יצירת טיפוסים | בדיקות RLS ב-SQL לכל תפקיד (התחזות דרך `request.jwt.claims`), Supabase advisors (security+performance) נקיים |
| 2 | Auth + Shell | התחברות/הרשמה/שחזור, middleware, Sidebar, בורר אירוע, הסתרה לפי תפקיד | E2E: הרשמה→כניסה→יציאה, הפניה ללא סשן |
| 3 | אירועים וצוות | CRUD אירועים, הגדרות, הזמנת צוות ותפקידים | E2E: יצירת אירוע, viewer לא יכול לערוך |
| 4 | מוזמנים | טבלה, CRUD, משפחות, חיפוש/סינון, כפילויות, ייבוא/ייצוא Excel | unit: נרמול טלפון, סכמות, parser Excel; E2E: הוספה/עריכה/ייבוא 100 שורות |
| 5 | הזמנות ו-RSVP | טוקנים, דף ציבורי, WhatsApp/העתקה, QR | E2E במובייל viewport: אישור/סירוב, חריגה מהמקומות נחסמת, טוקן שגוי → 404 |
| 6 | Dashboard | `event_stats`, KPI, גרפים, Realtime | שינוי RSVP מתעדכן בדשבורד בלי רענון |
| 7 | סידורי ישיבה | קנבס, dnd, קיבולת, שיבוץ קבוצה | E2E גרירה; שיבוץ יתר נחסם גם בשרת |
| 8 | מתנות | CRUD + סיכומים | E2E + בדיקת סכומים |
| 9 | תקציב | הוצאות, מתוכנן מול בפועל | E2E + בדיקת חישובים |
| 10 | Check-in | חיפוש, QR, מניעת כפילות, מונה חי | E2E: משתמש checkin רואה רק את המסך; סימון כפול נחסם |
| 11 | דוחות | דוחות + ייצוא + הדפסה | ייצוא נפתח ותקין |
| 12 | אדמין, הקשחה ופריסה | פאנל אדמין, error boundaries, not-found, loading skeletons, נגישות, ביצועים, פריסה ל-Vercel | Lighthouse, הרצת כל ה-E2E מול הפריסה |

אחרי כל מודול: commit + push לענף `claude/happy-lovelace-ft4ajj`, וסיכום קצר למשתמש לאישור לפני המודול הבא.

---

## 5. אימות (End-to-end)
- `npm run lint && npm run typecheck && npm run test` (Vitest) בכל מודול.
- `npx playwright test --trace off` מול שרת dev מחובר לפרויקט Supabase של הבדיקות, עם משתמשי ה-seed לכל תפקיד.
- בדיקות RLS: סקריפט SQL שמריץ שאילתות בתור כל תפקיד ומוודא גישה/חסימה צפויים; `get_advisors` של Supabase אחרי כל מיגרציה.
- צילומי מסך (Playwright) של כל מסך בבהיר/כהה ובמובייל/דסקטופ לבדיקה ויזואלית של RTL.
- בסוף: פריסה ל-Vercel והרצת smoke tests על ה-URL.
