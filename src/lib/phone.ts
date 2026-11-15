import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/**
 * Normalizes a phone number to E.164 (+972501234567).
 * Local Israeli formats (050-123-4567, 0501234567) are accepted.
 * Returns null when the input is not a valid phone number.
 */
export function normalizePhone(input: string | null | undefined, defaultCountry: CountryCode = "IL") {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  const cleaned = raw.replace(/^00/, "+");
  const parsed = parsePhoneNumberFromString(cleaned, defaultCountry);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}

/** Formats an E.164 number for display: Israeli numbers in local form. */
export function formatPhone(e164: string | null | undefined) {
  if (!e164) return "";
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed) return e164;
  return parsed.country === "IL" ? parsed.formatNational() : parsed.formatInternational();
}

/** Digits for a wa.me link (no plus sign). */
export function whatsappNumber(e164: string) {
  return e164.replace(/\D/g, "");
}
