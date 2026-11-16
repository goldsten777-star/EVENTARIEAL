import jsQR from "jsqr";
import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import { looksLikeInviteLink, parseCheckinStats, parseScannedToken } from "@/lib/checkin/token";

const TOKEN = "Ab3_dE-fGh1JkLmNoPqRsTuV"; // 24 base64url chars, like private.generate_token()

describe("parseScannedToken", () => {
  it("reads full links, paths and bare tokens", () => {
    expect(parseScannedToken(`https://eventarial.vercel.app/r/${TOKEN}`)).toBe(TOKEN);
    expect(parseScannedToken(`https://eventarial.vercel.app/r/${TOKEN}?utm=wa#x`)).toBe(TOKEN);
    expect(parseScannedToken(`  /r/${TOKEN}\n`)).toBe(TOKEN);
    expect(parseScannedToken(TOKEN)).toBe(TOKEN);
  });

  it("rejects anything that is not an invitation", () => {
    expect(parseScannedToken("")).toBeNull();
    expect(parseScannedToken("https://example.com/events/123")).toBeNull();
    expect(parseScannedToken("https://eventarial.vercel.app/r/short")).toBeNull();
    expect(parseScannedToken("דני כהן")).toBeNull();
    expect(parseScannedToken("0521234567")).toBeNull();
    expect(parseScannedToken("https://x/r/%E0%A4%A")).toBeNull();
  });

  it("tells links apart from names and phone numbers", () => {
    expect(looksLikeInviteLink(`https://eventarial.vercel.app/r/${TOKEN}`)).toBe(true);
    expect(looksLikeInviteLink("משפחת כהן")).toBe(false);
    expect(looksLikeInviteLink("052-123-4567")).toBe(false);
  });
});

describe("QR round trip", () => {
  it("decodes the RSVP link the guest's QR code carries", () => {
    const url = `https://eventarial.vercel.app/r/${TOKEN}`;
    const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
    const scale = 6;
    const margin = 4;
    const size = (qr.modules.size + margin * 2) * scale;
    const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const mx = Math.floor(x / scale) - margin;
        const my = Math.floor(y / scale) - margin;
        const dark = mx >= 0 && my >= 0 && mx < qr.modules.size && my < qr.modules.size && qr.modules.get(my, mx);
        if (dark) pixels.fill(0, (y * size + x) * 4, (y * size + x) * 4 + 3);
      }
    }
    const code = jsQR(pixels, size, size);
    expect(code?.data).toBe(url);
    expect(parseScannedToken(code!.data)).toBe(TOKEN);
  });
});

describe("parseCheckinStats", () => {
  it("maps the RPC json and tolerates missing values", () => {
    expect(
      parseCheckinStats({ expected_parties: 90, expected_people: 195, arrived_parties: 3, arrived_people: 7, last_check_in_at: "2027-03-12T18:00:00Z" }),
    ).toEqual({ expectedParties: 90, expectedPeople: 195, arrivedParties: 3, arrivedPeople: 7, lastCheckInAt: "2027-03-12T18:00:00Z" });
    expect(parseCheckinStats(null)).toEqual({ expectedParties: 0, expectedPeople: 0, arrivedParties: 0, arrivedPeople: 0, lastCheckInAt: null });
  });
});
