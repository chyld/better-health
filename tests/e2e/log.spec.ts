import {
  closeDay,
  expect,
  expectNoA11yViolations,
  fillAndSave,
  login,
  openDay,
  test,
} from "./fixtures";

test("the Log page lists every day's activity, today first", async ({ page }) => {
  await login(page);

  await page.getByRole("link", { name: "Log", exact: true }).click();
  const list = page.getByRole("list", { name: "Log, newest first" });
  await expect(list.getByRole("heading")).toHaveText(["Friday, October 2, 2026Today"]);
  await expect(list.getByText("Nothing logged yet.")).toBeVisible();
  await expectNoA11yViolations(page);

  await page.getByRole("link", { name: "Back to calendar" }).click();
  const day = await openDay(page, "2026-10-01");
  await fillAndSave(day, "Calories in", "1850");
  await fillAndSave(day, "Weight", "182.4");
  await day.getByLabel("Notes").fill("Long walk.");
  await day.getByLabel("Notes").blur();
  await expect(day.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  await closeDay(page);

  await page.getByRole("link", { name: "Log", exact: true }).click();
  await expect(list.getByRole("heading")).toHaveText([
    "Friday, October 2, 2026Today",
    "Thursday, October 1, 2026",
  ]);
  const older = list.getByRole("article").nth(1);
  await expect(older).toContainText("1,850 cal");
  await expect(older).toContainText("182.4 lbs");
  await expect(older).toContainText("Long walk.");
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expectNoA11yViolations(page);

  await list.getByRole("link", { name: "Thursday, October 1, 2026" }).click();
  await expect(page).toHaveURL(/\/calendar\/2026-10\?day=2026-10-01/);
});
