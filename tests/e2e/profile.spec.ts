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

test("a highlight rule on the Profile page colors matching days", async ({ page }) => {
  await login(page);
  for (const [date, weight] of [
    ["2026-10-01", "182.4"],
    ["2026-10-02", "205"],
  ] as const) {
    const day = await openDay(page, date);
    await fillAndSave(day, "Weight", weight);
    await closeDay(page);
  }
  await expect(cell(page, "2026-10-01")).not.toHaveAttribute("data-highlight");

  await page.getByRole("link", { name: "Profile, alice" }).click();
  await expect(page.getByRole("heading", { name: "Profile", level: 1 })).toBeVisible();
  // The server and this build agree (e2e runs pin APP_VERSION).
  await expect(page.getByRole("region", { name: "Versions" })).toHaveText(
    "client e2e · server e2e",
  );
  const form = page.getByRole("form", { name: "Add highlight" });
  await form.getByLabel("Metric").selectOption({ label: "Weight" });
  await form.getByLabel("Condition").selectOption({ label: "<" });
  await form.getByLabel("Amount").fill("200");
  await form.getByTitle("Teal").click();
  await expect(form.getByRole("radio", { name: "Teal" })).toBeChecked();
  await form.getByRole("button", { name: "Add highlight" }).click();
  const list = page.getByRole("list", { name: "Highlights, first match wins" });
  await expect(list.getByRole("listitem")).toHaveText(["Weight < 200.0 lbs · Teal"]);
  await expectNoA11yViolations(page);

  await page.getByRole("link", { name: "Back to calendar" }).click();
  await expect(cell(page, "2026-10-01")).toHaveAttribute("data-highlight", "teal");
  await expect(cell(page, "2026-10-01")).toHaveAccessibleName(/highlighted: Weight < 200\.0 lbs$/);
  await expect(cell(page, "2026-10-02")).not.toHaveAttribute("data-highlight");
  await expect(cell(page, "2026-10-03")).not.toHaveAttribute("data-highlight");
  await expectNoA11yViolations(page);

  // The rule survives a reload: it is stored on the server.
  await page.reload();
  await expect(cell(page, "2026-10-01")).toHaveAttribute("data-highlight", "teal");
});

test("calendar cells show the values chosen on the Profile page", async ({ page }) => {
  await login(page);
  const day = await openDay(page, "2026-10-01");
  await fillAndSave(day, "Calories in", "1850");
  await fillAndSave(day, "Weight", "182.4");
  await fillAndSave(day, "Steps", "9000");
  await closeDay(page);
  const values = cell(page, "2026-10-01").locator("[data-value]");
  await expect(values).toHaveCount(2);

  await page.goto("/profile");
  const form = page.getByRole("form", { name: "Add a calendar cell value" });
  await form.getByLabel("Value").selectOption({ label: "Calories in" });
  await expect(form.getByLabel("Caption")).toHaveValue("In");
  await form.getByLabel("Caption").fill("Ate");
  await form.getByRole("button", { name: "Add to cells" }).click();
  const list = page.getByRole("list", { name: "Calendar cell values, in order" });
  await list.getByRole("button", { name: "Remove Net calories" }).click();
  await list.getByRole("button", { name: "Remove Exercises logged (all)" }).click();
  await expect(list.getByRole("listitem")).toHaveCount(3);
  await expectNoA11yViolations(page);

  await page.getByRole("link", { name: "Back to calendar" }).click();
  await expect(values).toHaveCount(3);
  await expect(values.nth(0)).toHaveAttribute("data-value", "weight");
  await expect(values.nth(1)).toHaveAttribute("data-value", "steps");
  await expect(values.nth(2)).toHaveAttribute("data-value", "in");
  await expect(values.nth(2)).toContainText("Ate");
});
