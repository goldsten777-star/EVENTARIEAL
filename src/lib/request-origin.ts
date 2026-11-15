import "server-only";
import { headers } from "next/headers";
import { env } from "@/lib/env";

/** Public origin of the current request (works on localhost, previews and production). */
export async function requestOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) return `${h.get("x-forwarded-proto") ?? "https"}://${host}`;
  return env.siteUrl;
}
