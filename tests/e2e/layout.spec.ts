import { cell, expect, isDesktop, login, openDay, test } from "./fixtures";

test("phones and tablets open days in a sheet; desktop uses a side panel", async ({ page }) => {
  await login(page);
  if (isDesktop(page)) {
    // The whole calendar until a day is opened.
    const panel = page.getByRole("complementary", { name: "Day details" });
    await expect(panel).toHaveCount(0);
    await openDay(page, "2026-10-05");
    await expect(panel.getByRole("heading", { name: "Monday, October 5" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await panel.getByRole("button", { name: "Close day details" }).click();
    await expect(panel).toHaveCount(0);
    await expect(cell(page, "2026-10-05")).toBeFocused();
    await openDay(page, "2026-10-05");
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
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

test("desktop keyboard: arrows move days, [ ] change month, e logs exercise", async ({ page }) => {
  await login(page);
  test.skip(!isDesktop(page), "keyboard shortcuts are for desktop");
  await page.request.post("/api/exercise-types", {
    data: { name: "Walking", category: "cardio" },
    headers: { origin: new URL(page.url()).origin },
  });
  await page.reload();
  await cell(page, "2026-10-02").focus();
  await page.keyboard.press("ArrowRight");
  await expect(cell(page, "2026-10-03")).toBeFocused();
  await expect(page).toHaveURL(/day=2026-10-03/);
  await page.keyboard.press("ArrowDown");
  await expect(cell(page, "2026-10-10")).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(cell(page, "2026-10-01")).toBeFocused();

  // Oct 1 can still be changed (future days cannot), so e reaches its stickers.
  await page.keyboard.press("e");
  await expect(page.getByRole("button", { name: "Log Walking" })).toBeFocused();

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
