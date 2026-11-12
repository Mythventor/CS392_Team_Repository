import { test, expect } from "@playwright/test";

const APP = "http://127.0.0.1:5173/";
const at = (h, m) => new Date(2026, 9, 28, h, m); // Wed Oct 28, 2026

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => { window.__QRISE_CHECKIN_BACKEND__ = "memory"; });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:5173" });
  await context.clock.setFixedTime(at(8, 50));
});

async function copied(page, buttonName) {
  await page.getByRole("button", { name: buttonName }).click();
  await expect(page.getByRole("button", { name: "Copied!" })).toBeVisible();
  return page.evaluate(() => navigator.clipboard.readText());
}

test("organizer runs attendance: invite, scan-in with time stamps, walk-ins, late, absent, and schedule changes", async ({ context, page: organizer }) => {
  await organizer.goto(APP);
  await expect(organizer.getByText("Take attendance with one QR code")).toBeVisible();
  await organizer.getByRole("button", { name: "Open check-in" }).click();
  await organizer.getByLabel("Your name (shown to organizers)").fill("Prof. Liao");
  await organizer.getByRole("button", { name: "New event" }).click();
  const editor = organizer.getByRole("dialog", { name: "New event" });
  await editor.getByLabel("Event name").fill("CS392 lecture");
  await editor.getByLabel("Location").fill("Sanders 212");
  await editor.getByLabel("Date").fill("2026-10-28");
  await editor.getByLabel("Start time").fill("09:00");
  await editor.getByRole("button", { name: "Mon" }).click();
  await editor.getByRole("button", { name: "Wed" }).click();
  await editor.getByRole("button", { name: "Create event" }).click();

  await expect(organizer.getByRole("heading", { name: "CS392 lecture" })).toBeVisible();
  await expect(organizer.getByRole("img", { name: "Check-in QR code for CS392 lecture" })).toBeVisible();
  await expect(organizer.getByText("Check-in is open until 10:00 AM")).toBeVisible();
  await organizer.getByLabel("Add people").fill("Ana Lee, Ben, Cara");
  await organizer.getByRole("button", { name: "Add", exact: true }).click();
  const absent = organizer.getByRole("region", { name: /Absent/ });
  const here = organizer.getByRole("region", { name: /Here/ });
  await expect(absent.getByRole("listitem")).toHaveCount(3);

  const invite = await copied(organizer, "Copy invite link");
  const checkin = await copied(organizer, "Copy check-in link");
  expect(invite).toMatch(/\?event=/);
  expect(checkin).toMatch(/\?checkin=.+&code=/);

  // An invited person joins through the link; they show as expected but absent.
  const dev = await context.newPage();
  await dev.goto(invite);
  await expect(dev.getByRole("heading", { name: "CS392 lecture" })).toBeVisible();
  await expect(dev.getByText("Organized by Prof. Liao")).toBeVisible();
  await dev.getByLabel("Your name").fill("Dev");
  await dev.getByRole("button", { name: "Join event" }).click();
  await expect(dev.getByText("You're on the list")).toBeVisible();
  await expect(absent.getByRole("listitem").filter({ hasText: "Dev" })).toContainText("Joined by invite");

  // A rostered person scans the code before the start: on time, with a time stamp.
  const ana = await context.newPage();
  await ana.goto(checkin);
  await ana.getByLabel("Your name").fill("ana lee");
  await ana.getByRole("button", { name: "Check in now" }).click();
  await expect(ana.getByText("You're checked in")).toBeVisible();
  await expect(ana.getByText(/Recorded at 8:50:00\s?AM · On time/)).toBeVisible();
  await expect(here.getByRole("listitem").filter({ hasText: "ana lee" })).toContainText("On time");
  // The organizer's page updates on its own and announces the arrival.
  await expect(here.getByText("Live")).toBeVisible();
  await expect(organizer.getByText("ana lee just checked in · 8:50 AM")).toBeVisible();
  await expect(here.locator("li.ci-new")).toContainText("ana lee");
  await ana.reload();
  await expect(ana.getByText("You're checked in")).toBeVisible();

  // Someone not on the list scans in after the late cutoff and is added automatically.
  await context.clock.setFixedTime(at(9, 15));
  const eli = await context.newPage();
  await eli.goto(checkin);
  await eli.getByLabel("Your name").fill("Eli");
  await eli.getByRole("button", { name: "Check in now" }).click();
  await expect(eli.getByText(/Late/)).toBeVisible();
  const eliRow = here.getByRole("listitem").filter({ hasText: "Eli" });
  await expect(eliRow).toContainText("Late");
  await expect(eliRow).toContainText("Added at check-in");

  // The organizer marks someone present by hand.
  await absent.getByRole("listitem").filter({ hasText: "Ben" }).getByRole("button", { name: "Mark present" }).click();
  await expect(here.getByRole("listitem").filter({ hasText: "Ben" })).toContainText("Marked by organizer");
  await expect(here.getByRole("heading")).toContainText("3");
  await expect(absent.getByRole("listitem")).toHaveText([/Cara/, /Dev/]);

  // Replacing the code stops the old printed code from working.
  organizer.once("dialog", (dialog) => dialog.accept());
  await organizer.getByRole("button", { name: "Replace code" }).click();
  const late = await context.newPage();
  await late.goto(checkin);
  await late.getByLabel("Your name").fill("Fay");
  await late.getByRole("button", { name: "Check in now" }).click();
  await expect(late.getByRole("alert")).toContainText("isn't valid anymore");

  // Changing the time reschedules today's check-in window.
  await organizer.getByRole("button", { name: "Edit event" }).click();
  const edit = organizer.getByRole("dialog", { name: "Edit event" });
  await edit.getByLabel("Start time").fill("11:00");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(organizer.getByText(/Check-in opens .* at 10:30 AM/)).toBeVisible();
  await expect(organizer.getByText(/11:00 AM · Mon, Wed/)).toBeVisible();

  // Past dates stay available: pick the next Monday to see its (empty) list ahead of time.
  await organizer.getByRole("combobox").selectOption({ label: "Mon, Nov 2" });
  await expect(organizer.getByText(/Check-in opens Mon, Nov 2/)).toBeVisible();
  await expect(organizer.getByRole("region", { name: /Expected/ }).getByRole("listitem")).toHaveCount(5);

  // Refreshing keeps the organizer on the event page; Back returns to where they were.
  await organizer.reload();
  await expect(organizer.getByRole("heading", { name: "CS392 lecture" })).toBeVisible();
  await expect(organizer).toHaveURL(/\?manage=/);
  await organizer.goBack();
  await expect(organizer.getByRole("heading", { name: "Check-in", exact: true })).toBeVisible();
  await organizer.goForward();
  await expect(organizer.getByRole("heading", { name: "CS392 lecture" })).toBeVisible();

  // The event list shows the organizer's events.
  await organizer.getByRole("button", { name: "← All events" }).click();
  await expect(organizer.getByRole("region", { name: "Events you organize" })).toContainText("CS392 lecture");
});

test("check-in waits until the window opens for events scheduled ahead", async ({ context, page }) => {
  await page.goto(APP);
  await page.getByRole("button", { name: "Check-in", exact: true }).first().click();
  await page.getByRole("button", { name: "New event" }).click();
  const editor = page.getByRole("dialog", { name: "New event" });
  await editor.getByLabel("Event name").fill("Club meeting");
  await editor.getByLabel("Date").fill("2026-11-05");
  await editor.getByLabel("Start time").fill("18:00");
  await editor.getByRole("button", { name: "Create event" }).click();
  await expect(page.getByText(/Check-in opens Thu, Nov 5 at 5:30 PM/)).toBeVisible();
  const link = await copied(page, "Copy check-in link");
  const guest = await context.newPage();
  await guest.goto(link);
  await expect(guest.getByText(/Check-in opens Thu, Nov 5 at 5:30 PM/)).toBeVisible();
  await expect(guest.getByRole("button", { name: "Check in now" })).toHaveCount(0);
});

test("organizers import expected people from a spreadsheet or CSV, with names detected automatically", async ({ page }) => {
  await page.goto(APP);
  await page.getByRole("button", { name: "Check-in", exact: true }).first().click();
  await page.getByRole("button", { name: "New event" }).click();
  const editor = page.getByRole("dialog", { name: "New event" });
  await editor.getByLabel("Event name").fill("Lab section");
  await editor.getByLabel("Date").fill("2026-10-28");
  await editor.getByLabel("Start time").fill("09:00");
  await editor.getByRole("button", { name: "Create event" }).click();
  await expect(page.getByRole("heading", { name: "Lab section" })).toBeVisible();

  await page.getByLabel("Import a list of names").setInputFiles(new URL("./fixtures/roster.xlsx", import.meta.url).pathname);
  const dialog = page.getByRole("dialog", { name: "Import people" });
  await expect(dialog.getByLabel("Names are in")).toHaveValue("1+2");
  await expect(dialog.getByRole("status")).toHaveText("4 new names found");
  await dialog.getByLabel("Dev Patel").uncheck();
  await dialog.getByRole("button", { name: "Add 3 people" }).click();
  await expect(dialog).toHaveCount(0);

  await page.getByLabel("Import a list of names").setInputFiles(new URL("./fixtures/roster.csv", import.meta.url).pathname);
  await expect(dialog.getByRole("status")).toHaveText("2 new names found · 1 already on the list will be skipped");
  await expect(dialog.getByRole("listitem")).toHaveText(["Eli Moreno", "Fay Chen"]);
  await dialog.getByRole("button", { name: "Add 2 people" }).click();

  const absent = page.getByRole("region", { name: /Absent/ });
  await expect(absent.getByRole("listitem")).toHaveText([/Ana Lee/, /Ben Ortiz/, /Cara Wu/, /Eli Moreno/, /Fay Chen/]);

  await page.getByLabel("Import a list of names").setInputFiles({ name: "old.xls", mimeType: "application/vnd.ms-excel", buffer: Buffer.from("x") });
  await expect(page.getByRole("alert")).toContainText("Old .xls files aren't supported");
});
