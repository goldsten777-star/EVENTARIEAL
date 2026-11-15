import { describe, expect, it } from "vitest";
import { buildInvitationMessage, rsvpUrl, whatsappUrl } from "@/lib/rsvp/links";

describe("RSVP links", () => {
  it("builds the personal link", () => {
    expect(rsvpUrl("https://app.example.com/", "abc-_123")).toBe("https://app.example.com/r/abc-_123");
  });

  it("fills the event template", () => {
    const msg = buildInvitationMessage("שלום {שם}, לאישור: {קישור}", { name: "דנה", link: "https://x/r/1", event: "חתונה" });
    expect(msg).toBe("שלום דנה, לאישור: https://x/r/1");
  });

  it("appends the link when the template has no placeholder", () => {
    const msg = buildInvitationMessage("נשמח לראותכם!", { name: "דנה", link: "https://x/r/1", event: "חתונה" });
    expect(msg).toBe("נשמח לראותכם!\nhttps://x/r/1");
  });

  it("falls back to a default text", () => {
    expect(buildInvitationMessage(null, { name: "דנה", link: "L", event: "החתונה" })).toBe(
      "שלום דנה, נשמח לראותכם בהחתונה! לאישור הגעה: L",
    );
  });

  it("builds a wa.me URL with an encoded Hebrew message", () => {
    const url = whatsappUrl("+972501234567", "שלום דנה");
    expect(url).toBe(`https://wa.me/972501234567?text=${encodeURIComponent("שלום דנה")}`);
    expect(whatsappUrl(null, "x")).toBe("https://wa.me/?text=x");
  });
});
