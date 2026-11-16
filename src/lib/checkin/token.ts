/** Invitation tokens are 24 base64url characters (see private.generate_token). */
const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;

/**
 * Extracts an invitation token from what a QR code or barcode scanner
 * produced: a full RSVP link (https://host/r/<token>), a path, or the bare token.
 */
export function parseScannedToken(text: string): string | null {
  const value = text.trim();
  if (!value) return null;
  const match = value.match(/(?:^|\/)r\/([^/?#\s]+)/);
  if (match) {
    let token: string;
    try {
      token = decodeURIComponent(match[1]);
    } catch {
      return null;
    }
    return TOKEN.test(token) ? token : null;
  }
  return TOKEN.test(value) ? value : null;
}

/** True when the text looks like an RSVP link rather than a name or phone. */
export function looksLikeInviteLink(text: string) {
  return /(?:^|\/)r\/[A-Za-z0-9_%-]{16,}/.test(text.trim());
}

export type CheckinStats = {
  expectedParties: number;
  expectedPeople: number;
  arrivedParties: number;
  arrivedPeople: number;
  lastCheckInAt: string | null;
};

export function parseCheckinStats(json: unknown): CheckinStats {
  const o = (json ?? {}) as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0) || 0);
  return {
    expectedParties: n(o.expected_parties),
    expectedPeople: n(o.expected_people),
    arrivedParties: n(o.arrived_parties),
    arrivedPeople: n(o.arrived_people),
    lastCheckInAt: typeof o.last_check_in_at === "string" ? o.last_check_in_at : null,
  };
}
