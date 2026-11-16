import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import QRCode from "qrcode";
import { expect, test, type Page } from "@playwright/test";
import { EVENTS, password, storageState } from "./fixtures";

const CHECKIN = `/events/${EVENTS.wedding}/checkin`;
const TAG = "E2E כניסה";
const CAMERA_FILE = join(tmpdir(), `e2e-checkin-qr-${process.pid}.y4m`);

test.describe.configure({ mode: "serial" }); // tests share the arrival counter

// Chromium's fake camera plays CAMERA_FILE, written by the QR test below
test.use({
  permissions: ["camera"],
  launchOptions: {
    env: { ...process.env, LANG: "C.UTF-8", LC_ALL: "C.UTF-8" },
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${CAMERA_FILE}`,
    ],
  },
});

let manager: SupabaseClient;
test.beforeAll(async () => {
  manager = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
  await manager.auth.signInWithPassword({ email: "manager@example.com", password: password() });
});
test.afterAll(async () => {
  await manager.from("guests").delete().eq("event_id", EVENTS.wedding).like("last_name", `${TAG}%`);
});

type DoorGuest = { id: string; name: string; token: string };

/** An attending party of `adults` that has not arrived yet. */
async function createGuest(label: string, adults = 2): Promise<DoorGuest> {
  const last = `${TAG} ${label} ${Date.now()}`;
  const phone = `+97258${Math.floor(Math.random() * 9_000_000) + 1_000_000}`;
  const { data, error } = await manager
    .from("guests")
    .insert({
      event_id: EVENTS.wedding,
      first_name: "אורח",
      last_name: last,
      phone,
      invited_adults: adults,
      rsvp_status: "attending",
      confirmed_adults: adults,
    })
    .select("id, invite_token")
    .single();
  expect(error).toBeNull();
  return { id: data!.id, name: `אורח ${last}`, token: data!.invite_token };
}

const arrivedPeople = async (page: Page) =>
  Number((await page.locator("[data-slot=arrived-people]").textContent())!.replace(/\D/g, ""));
const card = (page: Page) => page.getByRole("dialog");
const search = (page: Page) => page.getByRole("searchbox", { name: "חיפוש אורח" });

test.describe("check-in staff", () => {
  test.use({ storageState: storageState("checkin") });

  test("finds a guest by name, checks them in once and updates the counter", async ({ page }) => {
    const guest = await createGuest("שם");
    await page.goto(CHECKIN);
    await expect(page.getByRole("heading", { name: "Check-in", level: 1 })).toBeVisible();
    const before = await arrivedPeople(page);

    await search(page).fill(guest.name.split(" ").slice(1).join(" "));
    const result = page.getByRole("list", { name: "תוצאות חיפוש" }).getByRole("button", { name: new RegExp(guest.name) });
    await expect(result).toHaveCount(1);
    await expect(result).toContainText("מגיעים");
    await result.click();

    await expect(card(page).getByRole("heading", { name: guest.name })).toBeVisible();
    await expect(card(page).getByRole("group", { name: "צפויים להגיע" })).toContainText("2");
    const count = card(page).getByRole("spinbutton", { name: "כמה הגיעו?" });
    await expect(count).toHaveValue("2");
    await card(page).getByRole("button", { name: "יותר" }).click();
    await expect(count).toHaveValue("3");
    await expect(card(page).getByText("מגיעים יותר אנשים ממה שאושר (2)")).toBeVisible();
    await card(page).getByRole("button", { name: "סימון הגעה" }).click();

    await expect(card(page)).toBeHidden();
    await expect(page.getByText(`נרשמה כניסה: ${guest.name} (3)`)).toBeVisible();
    await expect(search(page)).toHaveValue("");
    await expect(page.locator("[data-slot=arrived-people]")).toHaveText(String(before + 3));

    // second time: red notice, no way to check in again, no undo for door staff
    await search(page).fill(guest.name.split(" ").slice(1).join(" "));
    await expect(result).toContainText("נכנסו");
    await result.click();
    await expect(card(page).getByRole("alert")).toContainText("כבר נכנסו לאירוע");
    await expect(card(page).getByRole("alert")).toContainText("(3 אנשים)");
    await expect(card(page).getByRole("button", { name: "סימון הגעה" })).toHaveCount(0);
    await expect(card(page).getByRole("button", { name: "ביטול הכניסה" })).toHaveCount(0);
  });

  test("two doors on the same guest: only the first check-in counts", async ({ page, browser }) => {
    const guest = await createGuest("כפול");
    const other = await browser.newContext({ storageState: storageState("checkin") });
    const second = await other.newPage();

    for (const p of [page, second]) {
      await p.goto(CHECKIN);
      await search(p).fill(guest.name.split(" ").slice(1).join(" "));
      await p.getByRole("list", { name: "תוצאות חיפוש" }).getByRole("button", { name: new RegExp(guest.name) }).click();
      await expect(card(p).getByRole("button", { name: "סימון הגעה" })).toBeVisible();
    }

    await card(page).getByRole("button", { name: "סימון הגעה" }).click();
    await expect(page.getByText(`נרשמה כניסה: ${guest.name} (2)`)).toBeVisible();

    // the second door still shows the stale card
    await card(second).getByRole("button", { name: "פחות" }).click();
    await card(second).getByRole("button", { name: "סימון הגעה" }).click();
    await expect(second.getByText(`${guest.name} כבר נכנסו`)).toBeVisible();
    await expect(card(second).getByRole("alert")).toContainText("(2 אנשים)");

    const { data } = await manager.from("guests").select("arrived_count").eq("id", guest.id).single();
    expect(data!.arrived_count).toBe(2);
    await other.close();
  });

  test("a scanner that types the invitation link opens the guest card", async ({ page }) => {
    const guest = await createGuest("סורק");
    await page.goto(CHECKIN);
    await search(page).fill(`https://eventarial.vercel.app/r/${guest.token}`);
    await expect(card(page).getByRole("heading", { name: guest.name })).toBeVisible();
    await expect(card(page).getByRole("button", { name: "סימון הגעה" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(card(page)).toBeHidden();
    await expect(search(page)).toHaveValue("");
    await expect(search(page)).toBeFocused();
  });

  test("manual code entry explains bad and unknown codes", async ({ page }) => {
    await page.goto(CHECKIN);
    await page.getByRole("button", { name: "סריקת QR" }).click();
    const scan = page.getByRole("dialog", { name: "סריקת קוד QR" });
    const field = scan.getByRole("textbox", { name: "קוד או קישור הזמנה" });

    await field.fill("https://example.com/hello");
    await scan.getByRole("button", { name: "איתור" }).click();
    await expect(scan.getByRole("alert")).toHaveText("הקוד אינו קישור הזמנה של המערכת");

    await field.fill("https://eventarial.vercel.app/r/AAAAAAAAAAAAAAAAAAAAAAAA");
    await scan.getByRole("button", { name: "איתור" }).click();
    await expect(scan.getByRole("alert")).toHaveText("לא נמצא אורח עם הקוד הזה באירוע");
  });
});

test.describe("QR camera", () => {
  test.use({ storageState: storageState("checkin") });

  test("scanning the guest's QR code opens their card", async ({ page }) => {
    const guest = await createGuest("מצלמה", 1);
    writeQrVideo(CAMERA_FILE, `https://eventarial.vercel.app/r/${guest.token}`);

    await page.goto(CHECKIN);
    await page.getByRole("button", { name: "סריקת QR" }).click();
    await expect(card(page).getByRole("heading", { name: guest.name })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("dialog", { name: "סריקת קוד QR" })).toHaveCount(0);
    await card(page).getByRole("button", { name: "סימון הגעה" }).click();
    await expect(page.getByText(`נרשמה כניסה: ${guest.name} (1)`)).toBeVisible();
  });
});

test.describe("event manager", () => {
  test.use({ storageState: storageState("manager") });

  test("can undo a check-in", async ({ page }) => {
    const guest = await createGuest("ביטול");
    await manager.rpc("check_in_guest", { p_event_id: EVENTS.wedding, p_guest_id: guest.id, p_arrived_count: 2 });
    await page.goto(CHECKIN);
    const before = await arrivedPeople(page);

    await search(page).fill(guest.name.split(" ").slice(1).join(" "));
    await page.getByRole("list", { name: "תוצאות חיפוש" }).getByRole("button", { name: new RegExp(guest.name) }).click();
    await card(page).getByRole("button", { name: "ביטול הכניסה" }).click();
    await expect(page.getByText("הכניסה בוטלה")).toBeVisible();
    await expect(card(page).getByRole("button", { name: "סימון הגעה" })).toBeVisible();
    await expect(page.locator("[data-slot=arrived-people]")).toHaveText(String(before - 2));
  });
});

test.describe("viewer", () => {
  test.use({ storageState: storageState("viewer") });

  test("is sent back to the dashboard", async ({ page }) => {
    await page.goto(CHECKIN);
    await expect(page).toHaveURL(`/events/${EVENTS.wedding}/dashboard`);
  });
});

/** A short Y4M clip of a QR code: Chromium's fake camera loops it. */
function writeQrVideo(path: string, text: string) {
  const W = 640;
  const H = 480;
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const scale = Math.floor(360 / (n + 8));
  const size = (n + 8) * scale;
  const x0 = Math.floor((W - size) / 2);
  const y0 = Math.floor((H - size) / 2);
  const y = Buffer.alloc(W * H, 120); // grey "room"
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const mx = Math.floor(px / scale) - 4;
      const my = Math.floor(py / scale) - 4;
      const dark = mx >= 0 && my >= 0 && mx < n && my < n && qr.modules.get(my, mx);
      y[(y0 + py) * W + x0 + px] = dark ? 16 : 235;
    }
  }
  const chroma = Buffer.alloc((W / 2) * (H / 2), 128);
  const frame = Buffer.concat([Buffer.from("FRAME\n"), y, chroma, chroma]);
  writeFileSync(
    path,
    Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`), frame, frame, frame]),
  );
}
