"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { dbErrorMessage } from "@/lib/errors";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Grants or removes platform-admin rights; the database re-checks everything. */
export async function setPlatformAdmin(userId: string, isAdmin: boolean): Promise<FormState> {
  const me = await getCurrentUser();
  if (!me?.isPlatformAdmin) return { ok: false, message: "רק מנהל מערכת יכול לשנות הרשאות מערכת" };
  if (!UUID.test(userId)) return { ok: false, message: "משתמש לא תקין" };
  if (userId === me.id && !isAdmin) return { ok: false, message: "לא ניתן להסיר את הרשאת המנהל מעצמך" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_platform_admin", { p_user_id: userId, p_is_admin: isAdmin });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath("/admin");
  return { ok: true, message: isAdmin ? "הרשאת מנהל המערכת הוענקה" : "הרשאת מנהל המערכת הוסרה" };
}
