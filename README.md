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
