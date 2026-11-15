import { requireUser } from "@/lib/auth/session";

/** Every page in this group requires a signed-in user (the proxy also enforces it). */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <>{children}</>;
}
