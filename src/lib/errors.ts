type AuthLikeError = { code?: string; message?: string; status?: number };
type DbLikeError = { code?: string; message?: string; hint?: string | null };

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: "אימייל או סיסמה שגויים",
  email_not_confirmed: "עדיין לא אישרת את כתובת האימייל. בדקו את תיבת הדואר (וגם את תיקיית הספאם).",
  user_already_exists: "כבר קיים חשבון עם האימייל הזה",
  email_exists: "כבר קיים חשבון עם האימייל הזה",
  weak_password: "הסיסמה חלשה מדי. בחרו סיסמה ארוכה ומגוונת יותר.",
  same_password: "הסיסמה החדשה זהה לסיסמה הנוכחית",
  over_email_send_rate_limit: "נשלחו יותר מדי מיילים. נסו שוב בעוד כמה דקות.",
  over_request_rate_limit: "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.",
  signup_disabled: "ההרשמה סגורה כרגע",
  session_not_found: "פג תוקף ההתחברות. התחברו מחדש.",
  otp_expired: "הקישור פג תוקף. בקשו קישור חדש.",
};

export function authErrorMessage(error: AuthLikeError): string {
  if (error.code && AUTH_MESSAGES[error.code]) return AUTH_MESSAGES[error.code];
  if (error.status === 429) return AUTH_MESSAGES.over_request_rate_limit;
  return "אירעה שגיאה. נסו שוב בעוד רגע.";
}

/**
 * Turns a PostgREST/Postgres error into a message for the user.
 * Our database functions raise Hebrew messages (errcode P0001), shown as-is.
 */
export function dbErrorMessage(error: DbLikeError): string {
  switch (error.code) {
    case "P0001":
      return error.message ?? "הפעולה נדחתה";
    case "23505":
      return "רשומה עם פרטים זהים כבר קיימת";
    case "23503":
      return "הרשומה קשורה לנתון שאינו קיים יותר. רעננו את הדף ונסו שוב.";
    case "23514":
      return "אחד הערכים אינו תקין";
    case "42501":
      return "אין לך הרשאה לבצע פעולה זו";
    case "PGRST116":
      return "הרשומה לא נמצאה";
    default:
      return "אירעה שגיאה בשמירת הנתונים. נסו שוב.";
  }
}
