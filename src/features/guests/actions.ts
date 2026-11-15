"use server";

import { revalidatePath } from "next/cache";
import { getEventAccess } from "@/lib/auth/access";
import { can } from "@/lib/auth/permissions";
import { dbErrorMessage } from "@/lib/errors";
import { formValues, validationError, type FormState } from "@/lib/form-state";
import { parseImportRow, type RawImportRow } from "@/lib/guests/import";
import { formatPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import {
  bulkActionSchema,
  GUEST_FIELDS,
  guestFormInput,
  guestIdsSchema,
  guestSchema,
  guestToRow,
  type BulkAction,
} from "@/lib/validation/guest";

const FORBIDDEN: FormState = { ok: false, message: "אין לך הרשאה לערוך מוזמנים באירוע זה" };

async function canManage(eventId: string) {
  const access = await getEventAccess(eventId);
  return can(access.role, "manage");
}

function refresh(eventId: string) {
  revalidatePath(`/events/${eventId}`, "layout");
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function duplicatePhoneMessage(supabase: Supabase, eventId: string, phone: string | null) {
  if (!phone) return null;
  const { data } = await supabase
    .from("guests")
    .select("first_name, last_name")
    .eq("event_id", eventId)
    .eq("phone", phone)
    .maybeSingle();
  return data
    ? `המספר ${formatPhone(phone)} כבר שייך ל${data.first_name} ${data.last_name}`.trim()
    : "מספר הטלפון כבר קיים באירוע";
}

export async function saveGuest(
  eventId: string,
  guestId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!(await canManage(eventId))) return FORBIDDEN;
  // React resets uncontrolled fields after each submit: echo what was typed
  const values = formValues(formData, [...GUEST_FIELDS]);
  const parsed = guestSchema.safeParse(guestFormInput(formData));
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const row = guestToRow(parsed.data);
  const { error } = guestId
    ? await supabase.from("guests").update(row).eq("id", guestId).eq("event_id", eventId)
    : await supabase.from("guests").insert({ ...row, event_id: eventId });

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        message: "יש לתקן את השדות המסומנים",
        fieldErrors: { phone: [(await duplicatePhoneMessage(supabase, eventId, row.phone))!] },
        values,
      };
    }
    if (error.hint === "table_capacity_exceeded") {
      return { ok: false, message: error.message, fieldErrors: { tableId: [error.message] }, values };
    }
    return { ok: false, message: dbErrorMessage(error), values };
  }

  refresh(eventId);
  const name = `${row.first_name} ${row.last_name}`.trim();
  return { ok: true, message: guestId ? `${name} עודכנ/ה` : `${name} נוספ/ה לרשימה` };
}

export async function bulkGuests(eventId: string, ids: string[], action: BulkAction): Promise<FormState> {
  if (!(await canManage(eventId))) return FORBIDDEN;
  const parsedIds = guestIdsSchema.safeParse(ids);
  const parsedAction = bulkActionSchema.safeParse(action);
  if (!parsedIds.success || !parsedAction.success) return { ok: false, message: "בקשה לא תקינה" };

  const supabase = await createClient();
  const base = () => supabase.from("guests");
  let result;
  switch (parsedAction.data.type) {
    case "delete":
      result = await base().delete().eq("event_id", eventId).in("id", parsedIds.data).select("id");
      break;
    case "group":
      result = await base()
        .update({ group_id: parsedAction.data.groupId })
        .eq("event_id", eventId)
        .in("id", parsedIds.data)
        .select("id");
      break;
    case "invitation":
      result = await base()
        .update({
          invitation_status: parsedAction.data.status,
          ...(parsedAction.data.status === "not_sent" ? { invitation_sent_at: null } : {}),
        })
        .eq("event_id", eventId)
        .in("id", parsedIds.data)
        .select("id");
      break;
  }
  if (result.error) return { ok: false, message: dbErrorMessage(result.error) };

  refresh(eventId);
  const n = result.data?.length ?? 0;
  const verb = parsedAction.data.type === "delete" ? "נמחקו" : "עודכנו";
  return { ok: true, message: `${n} הזמנות ${verb}` };
}

export type ImportBatchResult = {
  ok: boolean;
  message?: string;
  inserted: number;
  updated: number;
  skipped: number;
  errors: Array<{ line: number; message: string }>;
};

/**
 * Imports one batch of spreadsheet rows. Every row is validated again here;
 * group names are matched (and missing groups created) and table numbers are
 * resolved. Rows whose phone already exists are skipped or updated.
 */
export async function importGuestsBatch(
  eventId: string,
  rows: Array<{ line: number; raw: RawImportRow }>,
  onDuplicate: "skip" | "update",
): Promise<ImportBatchResult> {
  const empty = { inserted: 0, updated: 0, skipped: 0, errors: [] };
  if (!(await canManage(eventId))) return { ok: false, message: FORBIDDEN.message, ...empty };
  if (!Array.isArray(rows) || rows.length > 500) return { ok: false, message: "יותר מדי שורות בבקשה אחת", ...empty };

  const supabase = await createClient();
  const [{ data: groups }, { data: tables }, { data: existing }] = await Promise.all([
    supabase.from("guest_groups").select("id, name").eq("event_id", eventId),
    supabase.from("seating_tables").select("id, number").eq("event_id", eventId),
    supabase.from("guests").select("id, phone").eq("event_id", eventId).not("phone", "is", null),
  ]);
  const groupByName = new Map((groups ?? []).map((g) => [g.name.trim(), g.id]));
  const tableByNumber = new Map((tables ?? []).map((t) => [t.number, t.id]));
  const guestByPhone = new Map((existing ?? []).map((g) => [g.phone!, g.id]));

  const result: ImportBatchResult = { ok: true, ...empty, errors: [] };
  const inserts = [];
  const seenPhones = new Set<string>();

  for (const { line, raw } of rows) {
    const parsed = parseImportRow(raw, line);
    if (!parsed.data) {
      result.errors.push({ line, message: parsed.errors.join(" · ") });
      continue;
    }
    const d = parsed.data;

    let groupId: string | null = null;
    if (d.groupName) {
      groupId = groupByName.get(d.groupName) ?? null;
      if (!groupId) {
        const { data: created, error } = await supabase
          .from("guest_groups")
          .insert({ event_id: eventId, name: d.groupName, sort_order: groupByName.size + 1 })
          .select("id")
          .single();
        if (error) {
          result.errors.push({ line, message: `לא ניתן ליצור את הקבוצה "${d.groupName}"` });
          continue;
        }
        groupId = created.id;
        groupByName.set(d.groupName, groupId);
      }
    }

    let tableId: string | null = null;
    if (d.tableNumber !== null) {
      tableId = tableByNumber.get(d.tableNumber) ?? null;
      if (!tableId) {
        result.errors.push({ line, message: `שולחן ${d.tableNumber} לא קיים באירוע` });
        continue;
      }
    }

    const row = guestToRow({ ...d, groupId, tableId });

    if (row.phone && seenPhones.has(row.phone)) {
      result.skipped++;
      continue;
    }
    if (row.phone) seenPhones.add(row.phone);

    const existingId = row.phone ? guestByPhone.get(row.phone) : undefined;
    if (existingId) {
      if (onDuplicate === "skip") {
        result.skipped++;
        continue;
      }
      const { error } = await supabase.from("guests").update(row).eq("id", existingId).eq("event_id", eventId);
      if (error) result.errors.push({ line, message: error.hint === "table_capacity_exceeded" ? error.message : dbErrorMessage(error) });
      else result.updated++;
      continue;
    }
    inserts.push({ line, row: { ...row, event_id: eventId } });
  }

  if (inserts.length) {
    const { error } = await supabase.from("guests").insert(inserts.map((i) => i.row));
    if (!error) {
      result.inserted += inserts.length;
    } else {
      // fall back to row-by-row so one bad row does not sink the batch
      for (const { line, row } of inserts) {
        const { error: rowError } = await supabase.from("guests").insert(row);
        if (rowError) {
          result.errors.push({
            line,
            message:
              rowError.hint === "table_capacity_exceeded"
                ? rowError.message
                : rowError.code === "23505"
                  ? "מספר הטלפון כבר קיים באירוע"
                  : dbErrorMessage(rowError),
          });
        } else result.inserted++;
      }
    }
  }

  refresh(eventId);
  return result;
}
