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
  // Two exercises on the 1st, added through the API with the page's session.
  const origin = new URL(page.url()).origin;
  const label = await (
    await page.request.post("/api/exercise-types", {
      data: { name: "Walking", category: "cardio" },
      headers: { origin },
    })
  ).json();
  for (const measurements of [[{ unit: "miles", amount: 3 }], []]) {
    await page.request.post("/api/days/2026-10-01/exercises", {
      data: { exerciseTypeId: label.id, measurements },
      headers: { origin },
    });
  }
  await page.reload();
  await expect(cell(page, "2026-10-01")).toHaveAccessibleName(/2 exercises/);
  await expect(cell(page, "2026-10-02")).toHaveAccessibleName(/net 300/);
  await page.mouse.move(0, 0);
  await expectNoA11yViolations(page);
  await expect(page).toHaveScreenshot("calendar.png", { fullPage: true });
});

test("open day is accessible, with stickers and a measured exercise", async ({ page }) => {
  await login(page);
  const origin = new URL(page.url()).origin;
  for (const [name, category] of [
    ["Running", "cardio"],
    ["Squats", "strength"],
  ]) {
    await page.request.post("/api/exercise-types", {
      data: { name, category },
      headers: { origin },
    });
  }
  await page.reload();
  const day = await openDay(page, "2026-10-02");
  await day.getByRole("button", { name: "Log Running" }).click();
  await day.getByRole("button", { name: "Measure Running" }).click();
  const form = day.getByRole("form", { name: "Measure Running" });
  await form.getByLabel("Amount").fill("3");
  await form.getByLabel("Unit", { exact: true }).fill("miles");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(day.getByRole("button", { name: "Delete Running – 3 miles" })).toBeVisible();
  await day.getByRole("button", { name: "Measure Running" }).click();
  await expectNoA11yViolations(page);
});

test("labels page is accessible", async ({ page }) => {
  await login(page);
  await page.goto("/labels");
  const form = page.getByRole("form", { name: "Add label" });
  await form.getByLabel("Exercise").fill("Yoga");
  await form.getByLabel("Category").fill("flexibility");
  await form.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("list", { name: "Active" })).toBeVisible();
  await expectNoA11yViolations(page);
});

test("history page is accessible", async ({ page }) => {
  await login(page);
  const day = await openDay(page, "2026-10-01");
  await fillAndSave(day, "Calories in", "1850");
  await fillAndSave(day, "Weight", "182.4");
  await closeDay(page);
  await page.getByRole("link", { name: "History" }).click();
  const list = page.getByRole("list", { name: "Calories in, newest first" });
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expectNoA11yViolations(page);
  await page.getByLabel("Show").selectOption({ label: "Weight" });
  await expect(page.getByRole("list", { name: "Weight, newest first" })).toContainText("182.4");
  await expect(page).toHaveURL(/metric=weight/);
  await expectNoA11yViolations(page);
});
