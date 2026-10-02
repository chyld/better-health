import { cell, closeDay, expect, fillAndSave, login, openDay, test } from "./fixtures";

test("logs calories and weight; the cell shows them and they persist", async ({ page }) => {
  await login(page);
  const day = await openDay(page, "2026-10-01");
  await fillAndSave(day, "Calories in", "1850");
  await fillAndSave(day, "Calories out", "2600");
  await fillAndSave(day, "Weight", "182.4");
  await expect(day.getByRole("status", { name: "Net" })).toHaveText("−750");
  await closeDay(page);

  const c = cell(page, "2026-10-01");
  await expect(c).toHaveAccessibleName(
    "Thursday, October 1, in 1850, out 2600, net minus 750, weight 182.4 pounds",
  );
  await expect(c.locator('[data-value="weight"]')).toContainText("182.4");

  await page.reload();
  await expect(cell(page, "2026-10-01")).toHaveAccessibleName(/net minus 750/);
});

test("a note auto-saves without leaving the field", async ({ page }) => {
  await login(page);
  const day = await openDay(page, "2026-10-02");
  await day.getByLabel("Notes").fill("Slept 7 hours.\nFelt good.");
  await expect(day.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  await page.reload();
  const again = await openDay(page, "2026-10-02");
  await expect(again.getByLabel("Notes")).toHaveValue("Slept 7 hours.\nFelt good.");
  // An open sheet hides the page from assistive tech, so check the label itself.
  await expect(cell(page, "2026-10-02")).toHaveAttribute("aria-label", /has a note/);
});

test("clearing values empties the day", async ({ page }) => {
  await login(page);
  const day = await openDay(page, "2026-10-01");
  await fillAndSave(day, "Calories in", "1200");
  await fillAndSave(day, "Calories in", "");
  await closeDay(page);
  await expect(cell(page, "2026-10-01")).toHaveAccessibleName("Thursday, October 1");
});

test("invalid input is explained and not saved", async ({ page }) => {
  await login(page);
  const day = await openDay(page, "2026-10-01");
  await day.getByLabel("Weight").fill("182.45");
  await day.getByLabel("Weight").blur();
  await expect(day.getByText("Weight allows one decimal place")).toBeVisible();
  await page.reload();
  await expect(cell(page, "2026-10-01")).toHaveAccessibleName("Thursday, October 1");
});

test("moves between months", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Next month" }).click();
  await expect(page.getByRole("heading", { name: "November 2026" })).toBeVisible();
  await page.getByRole("link", { name: "Previous month" }).click();
  await page.getByRole("link", { name: "Previous month" }).click();
  await expect(page.getByRole("heading", { name: "September 2026" })).toBeVisible();
  await page.getByRole("link", { name: "Today" }).click();
  await expect(page.getByRole("heading", { name: "October 2026" })).toBeVisible();
});
