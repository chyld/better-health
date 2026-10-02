import { cell, expect, fillAndSave, login, openDay, test } from "./fixtures";

test("two users never see each other's data", async ({ page, browser }) => {
  await login(page, "alice");
  const day = await openDay(page, "2026-10-01");
  await fillAndSave(day, "Calories in", "1850");
  await day.getByLabel("Notes").fill("alice's private note");
  await expect(day.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();

  const bobContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const bob = await bobContext.newPage();
  await bob.clock.setFixedTime(new Date("2026-10-02T12:00:00"));
  await login(bob, "bob");
  await expect(cell(bob, "2026-10-01")).toHaveAccessibleName("Thursday, October 1");
  const bobDay = await openDay(bob, "2026-10-01");
  await expect(bobDay.getByLabel("Notes")).toHaveValue("");
  await fillAndSave(bobDay, "Calories in", "999");
  await bobContext.close();

  await page.reload();
  await expect(cell(page, "2026-10-01")).toHaveAccessibleName(/in 1850/);
});
