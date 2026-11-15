import type { Metadata } from "next";
import { BudgetView } from "@/components/budget/budget-view";
import { getBudgetPageData } from "@/features/budget/queries";
import { requireEventSection } from "@/lib/auth/access";
import { can } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "תקציב" };

export default async function BudgetPage({ params }: PageProps<"/events/[eventId]/budget">) {
  const { eventId } = await params;
  const access = await requireEventSection(eventId, "budget");
  const data = await getBudgetPageData(eventId);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
  return <BudgetView eventId={eventId} eventName={access.event.name} data={data} canManage={can(access.role, "manage")} today={today} />;
}
