import { cell, expect, isDesktop, login, openDay, test } from "./fixtures";

test("phones and tablets open days in a sheet; desktop uses a side panel", async ({ page }) => {
  await login(page);
  if (isDesktop(page)) {
    const panel = page.getByRole("complementary", { name: "Day details" });
    await expect(panel.getByRole("heading", { name: "Friday, October 2" })).toBeVisible();
    await openDay(page, "2026-10-05");
    await expect(panel.getByRole("heading", { name: "Monday, October 5" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  } else {
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const sheet = await openDay(page, "2026-10-05");
    await expect(sheet.getByRole("heading", { name: "Monday, October 5" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
  }
});

test("the log-today button opens today on phones and tablets", async ({ page }) => {
  await login(page);
  test.skip(isDesktop(page), "desktop shows today in the side panel");
  await page.getByRole("link", { name: "Next month" }).click();
  await page.getByRole("button", { name: "Log today" }).click();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "Friday, October 2" }),
  ).toBeVisible();
});

test("desktop keyboard: arrows move days, [ ] change month, e adds exercise", async ({ page }) => {
  await login(page);
  test.skip(!isDesktop(page), "keyboard shortcuts are for desktop");
  await cell(page, "2026-10-02").focus();
  await page.keyboard.press("ArrowRight");
  await expect(cell(page, "2026-10-03")).toBeFocused();
  await expect(page).toHaveURL(/day=2026-10-03/);
  await page.keyboard.press("ArrowDown");
  await expect(cell(page, "2026-10-10")).toBeFocused();

  await page.keyboard.press("e");
  await expect(page.getByText("No exercise labels yet.")).toBeVisible();

  await page.keyboard.press("Escape");
  await cell(page, "2026-10-10").focus();
  await page.keyboard.press("]");
  await expect(page.getByRole("heading", { name: "November 2026" })).toBeVisible();
  await page.keyboard.press("t");
  await expect(page.getByRole("heading", { name: "October 2026" })).toBeVisible();
});

test("no horizontal scrolling at this viewport", async ({ page }) => {
  await login(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
