import "server-only";
import { adminTotals, parseAdminOverview } from "@/lib/admin/overview";
import { createClient } from "@/lib/supabase/server";

export async function getAdminOverview() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_overview");
  if (error) throw new Error(error.message);
  const { users, events } = parseAdminOverview(data);
  const fetchedAt = Date.now();
  return { users, events, totals: adminTotals(users, events, fetchedAt), fetchedAt };
}
