import {
  cell,
  closeDay,
  expect,
  expectNoA11yViolations,
  fillAndSave,
  login,
  openDay,
  test,
} from "./fixtures";

test("login page is accessible", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expectNoA11yViolations(page);
});

test("calendar with data: accessible and matches the snapshot", async ({ page }) => {
  await login(page);
  for (const [date, values] of [
    ["2026-10-01", { in: "1850", out: "2600", weight: "182.4" }],
    ["2026-10-02", { in: "2400", out: "2100", weight: "182.0" }],
  ] as const) {
    const day = await openDay(page, date);
    await fillAndSave(day, "Calories in", values.in);
    await fillAndSave(day, "Calories out", values.out);
    await fillAndSave(day, "Weight", values.weight);
    await closeDay(page);
  }
  await expect(cell(page, "2026-10-02")).toHaveAccessibleName(/net 300/);
  await page.mouse.move(0, 0);
  await expectNoA11yViolations(page);
  await expect(page).toHaveScreenshot("calendar.png", { fullPage: true });
});

test("open day is accessible", async ({ page }) => {
  await login(page);
  await openDay(page, "2026-10-02");
  await expectNoA11yViolations(page);
});

test("labels page is accessible", async ({ page }) => {
  await login(page);
  await page.goto("/labels");
  await page.getByRole("textbox", { name: "New label" }).fill("Yoga");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("list", { name: "Active" })).toBeVisible();
  await expectNoA11yViolations(page);
});
