import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Service-role client that BYPASSES RLS. Use only in server code that has
 * already verified the caller is a platform admin.
 */
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) {
    throw new Error("SUPABASE_SECRET_KEY is not configured");
  }
  return createClient<Database>(env.supabaseUrl, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
