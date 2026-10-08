import { cell, closeDay, expect, fillAndSave, login, openDay, test } from "./fixtures";

test("logs calories and weight; the cell shows them and they persist", async ({ page }) => {
  await login(page);
  const day = await openDay(page, "2026-10-01");
  await fillAndSave(day, "Calories in", "1850");
  await fillAndSave(day, "Active calories", "2600");
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

test("logs steps and distance; the cell shows steps and they persist", async ({ page }) => {
  await login(page);
  const day = await openDay(page, "2026-10-01");
  await fillAndSave(day, "Steps", "12345");
  await fillAndSave(day, "Distance", "5.25");
  await closeDay(page);

  const c = cell(page, "2026-10-01");
  await expect(c).toHaveAccessibleName("Thursday, October 1, 12345 steps, 5.25 miles");
  await expect(c.locator('[data-value="steps"]')).toBeVisible();

  await page.reload();
  const again = await openDay(page, "2026-10-01");
  await expect(again.getByLabel("Steps")).toHaveValue("12345");
  await expect(again.getByLabel("Distance")).toHaveValue("5.25");
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

test("days older than two days are read only, and the server refuses changes", async ({ page }) => {
  await login(page);
  await page.goto("/calendar/2026-09");
  const day = await openDay(page, "2026-09-29");
  await expect(day.getByText("Only today and the 2 days before it can be changed.")).toBeVisible();
  await expect(day.getByLabel("Calories in")).toHaveAttribute("readonly", "");
  await expect(day.getByRole("group", { name: "Tap to log" })).toHaveCount(0);

  const res = await page.request.patch("/api/days/2026-09-29", {
    data: { caloriesIn: 1800 },
    headers: { origin: new URL(page.url()).origin },
  });
  expect(res.status()).toBe(403);
});
