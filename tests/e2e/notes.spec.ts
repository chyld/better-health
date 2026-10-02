import { closeDay, expect, expectNoA11yViolations, login, openDay, test } from "./fixtures";

test("notes written on days appear on the Notes page, newest first", async ({ page }) => {
  await login(page);
  for (const [date, note] of [
    ["2026-10-01", "First day.\nFelt tired."],
    ["2026-10-02", "Second day."],
  ] as const) {
    const day = await openDay(page, date);
    await day.getByLabel("Notes").fill(note);
    await day.getByLabel("Notes").blur();
    await expect(day.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    await closeDay(page);
  }

  await page.getByRole("link", { name: "Notes" }).click();
  const list = page.getByRole("list", { name: "Notes, newest first" });
  await expect(list.getByRole("heading")).toHaveText([
    "Friday, October 2, 2026",
    "Thursday, October 1, 2026",
  ]);
  await expect(list.getByText("First day.")).toHaveText("First day.\nFelt tired.");
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expectNoA11yViolations(page);

  await list.getByRole("link", { name: "Thursday, October 1, 2026" }).click();
  await expect(page).toHaveURL(/\/calendar\/2026-10\?day=2026-10-01/);
});
