# Event Manager

מערכת SaaS לניהול אירועים ואורחים: מוזמנים, אישורי הגעה (RSVP), סידורי ישיבה, מתנות, תקציב, Check-in ודוחות. עברית ו-RTL מלאים, מצב כהה ובהיר.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui · Supabase (Postgres, Auth, RLS, Realtime) · Vercel.

תוכנית הארכיטקטורה והפיתוח: [`docs/PLAN.md`](docs/PLAN.md).

## הרצה מקומית

```bash
npm install
cp .env.example .env.local   # ממלאים את פרטי פרויקט ה-Supabase
npm run dev
```

## בדיקות

| פקודה | מה נבדק |
|---|---|
| `npm run check` | ESLint + TypeScript + בדיקות יחידה |
| `npm run test:db` | הרשאות RLS, טריגרים ו-RPC מול מסד הנתונים, בתור כל תפקיד (דורש `E2E_PASSWORD` ונתוני seed) |
| `npm run build && npm run test:e2e` | בדיקות דפדפן (Playwright) בדסקטופ ובמובייל |

## מסד הנתונים

- מיגרציות: `supabase/migrations/` (מקור האמת). כל טבלה עסקית מכילה `event_id`, וכל הגישה נאכפת ב-RLS.
- תפקידים: מנהל מערכת, מנהל אירוע, צפייה בלבד, Check-in (גישה דרך פונקציות RPC בלבד).
- טיפוסים: `src/types/database.ts` נוצר מהסכמה. יש לחולל מחדש אחרי כל מיגרציה.
- נתוני בדיקה: `supabase/seed.sql` יוצר משתמש בדיקה לכל תפקיד ושלושה אירועים. **לבדיקות בלבד**. יש להסיר את משתמשי הבדיקה לפני עלייה לאוויר.

## הגדרות Supabase Auth (חד-פעמי, בלוח הבקרה של Supabase)

ב-**Authentication → URL Configuration**:
- **Site URL**: כתובת האתר בפרודקשן (למשל `https://event-manager.vercel.app`).
- **Redirect URLs**: להוסיף `http://localhost:3000/**` ואת כתובת הפרודקשן עם `/**`. קישורי אישור ההרשמה ואיפוס הסיסמה חוזרים אל `/auth/callback`.

ב-**Authentication → SMTP Settings**: לפני פתיחה למשתמשים אמיתיים יש לחבר ספק SMTP (למשל Resend). שירות המייל המובנה של Supabase מוגבל לכמה מיילים בשעה.

## פריסה (Vercel)

- פרויקט Vercel: `eventarial` (צוות hanoh), כתובת ייצור: https://eventarial.vercel.app
- משתני סביבה מוגדרים ב-Vercel (Production, Preview, Development): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`. אין צורך במפתח סודי של Supabase.
- הפונקציות רצות ב-`fra1` (פרנקפורט), קרוב למסד הנתונים ב-`eu-central-1`.
- Vercel Authentication מוגבל ל-Preview בלבד: אתר הייצור ציבורי, כדי שאורחים יוכלו לפתוח קישורי אישור הגעה.
- ענף הייצור ב-Vercel הוא `main`. כל עוד הקוד לא מוזג ל-`main`, פריסת ייצור מתבצעת ידנית מהענף שבעבודה.
