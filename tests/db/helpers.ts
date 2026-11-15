import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type Db = SupabaseClient<Database>;

/** Fixed IDs created by supabase/seed.sql */
export const USERS = {
  admin: { id: "00000000-0000-4000-a000-000000000001", email: "admin@example.com" },
  manager: { id: "00000000-0000-4000-a000-000000000002", email: "manager@example.com" },
  viewer: { id: "00000000-0000-4000-a000-000000000003", email: "viewer@example.com" },
  checkin: { id: "00000000-0000-4000-a000-000000000004", email: "checkin@example.com" },
  outsider: { id: "00000000-0000-4000-a000-000000000005", email: "outsider@example.com" },
} as const;

export const EVENTS = {
  wedding: "00000000-0000-4000-b000-000000000001", // manager owns; viewer + checkin are staff
  barMitzvah: "00000000-0000-4000-b000-000000000002", // manager owns, nobody else
  conference: "00000000-0000-4000-b000-000000000003", // outsider owns
} as const;

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing (see .env.example)`);
  return value;
}

export function anonClient(): Db {
  return createClient<Database>(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function signIn(user: keyof typeof USERS): Promise<Db> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({
    email: USERS[user].email,
    password: env("E2E_PASSWORD"),
  });
  if (error) throw new Error(`sign-in failed for ${user}: ${error.message}`);
  return client;
}

/** A unique, valid Israeli mobile number for test rows. */
export function testPhone() {
  const n = Math.floor(Math.random() * 9_000_000) + 1_000_000;
  return `+97258${n}`;
}
