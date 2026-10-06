import type { Locator, Page } from "@playwright/test";
import { cell, expect, login, openDay, test } from "./fixtures";

async function createLabels(page: Page, labels: [name: string, category: string][]) {
  await page.getByRole("link", { name: "Labels", exact: true }).click();
  const form = page.getByRole("form", { name: "Add label" });
  for (const [name, category] of labels) {
    await form.getByLabel("Exercise").fill(name);
    await form.getByLabel("Category").fill(category);
    await form.getByRole("button", { name: "Add" }).click();
    await expect(
      page
        .getByRole("list", { name: "Active" })
        .getByRole("listitem")
        .filter({ hasText: `${name} · ${category}` }),
    ).toBeVisible();
  }
  await page.getByRole("link", { name: "Back to calendar" }).click();
  await expect(page.getByRole("grid", { name: "Month" })).toBeVisible();
}

async function measure(day: Locator, name: string, amount: string, unit?: string) {
  await day.getByRole("button", { name: `Measure ${name}` }).click();
  const form = day.getByRole("form", { name: `Measure ${name}` });
  await form.getByLabel("Amount").fill(amount);
  if (unit !== undefined) await form.getByLabel("Unit", { exact: true }).fill(unit);
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form).toBeHidden();
}

test("one tap logs an exercise; measurements are optional and added after", async ({ page }) => {
  await login(page);
  await createLabels(page, [
    ["Running", "cardio"],
    ["Pushups", "strength"],
  ]);

  const day = await openDay(page, "2026-10-01");
  await day.getByRole("button", { name: "Log Running" }).click();
  await day.getByRole("button", { name: "Log Pushups" }).click();
  await expect(day.getByRole("button", { name: "Delete Running" })).toBeVisible();
  await expect(day.getByRole("button", { name: "Delete Pushups" })).toBeVisible();
  await expect(cell(page, "2026-10-01")).toHaveAttribute("aria-label", /2 exercises/);

  await measure(day, "Running", "3.5", "miles");
  await measure(day, "Running", "30", "Minutes");
  await expect(
    day.getByRole("button", { name: "Delete Running – 3.5 miles, 30 minutes" }),
  ).toBeVisible();

  await day.getByRole("button", { name: "Remove 30 minutes from Running" }).click();
  await expect(day.getByRole("button", { name: "Delete Running – 3.5 miles" })).toBeVisible();

  await day.getByRole("button", { name: "Delete Pushups" }).click();
  await expect(day.getByRole("button", { name: "Delete Pushups" })).toBeHidden();
  await expect(cell(page, "2026-10-01")).toHaveAttribute("aria-label", /1 exercise\b/);

  // Another day: the unit used before is offered and preselected.
  const next = await openDay(page, "2026-10-02");
  await next.getByRole("button", { name: "Log Running" }).click();
  await next.getByRole("button", { name: "Measure Running" }).click();
  const form = next.getByRole("form", { name: "Measure Running" });
  await expect(form.getByLabel("Unit", { exact: true })).toHaveValue("miles");
  await form.getByLabel("Amount").fill("5");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(next.getByRole("button", { name: "Delete Running – 5 miles" })).toBeVisible();
});

test("an archived label loses its sticker but stays on past entries", async ({ page }) => {
  await login(page);
  await createLabels(page, [
    ["Yoga", "stretch"],
    ["Running", "cardio"],
  ]);
  let day = await openDay(page, "2026-10-01");
  await day.getByRole("button", { name: "Log Yoga" }).click();
  await measure(day, "Yoga", "60", "minutes");

  await page.goto("/labels");
  await page.getByRole("button", { name: "Archive Yoga" }).click();
  await expect(page.getByRole("list", { name: "Archived" }).getByText("Yoga")).toBeVisible();

  await page.goto("/calendar/2026-10");
  day = await openDay(page, "2026-10-01");
  await expect(day.getByText("(archived)")).toBeVisible();
  await expect(day.getByRole("button", { name: "Delete Yoga – 60 minutes" })).toBeVisible();
  await expect(day.getByRole("button", { name: "Log Running" })).toBeVisible();
  await expect(day.getByRole("button", { name: "Log Yoga" })).toHaveCount(0);
});

test("labels can be edited and reordered", async ({ page }) => {
  await login(page);
  await createLabels(page, [
    ["A", "cardio"],
    ["B", "cardio"],
    ["Walk", "cardio"],
  ]);
  await page.goto("/labels");
  await page.getByRole("button", { name: "Edit Walk" }).click();
  const form = page.getByRole("form", { name: "Edit Walk" });
  await form.getByLabel("Exercise").fill("Walking");
  await form.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Move Walking up" }).click();
  await page.getByRole("button", { name: "Move Walking up" }).click();
  await expect(page.getByRole("list", { name: "Active" }).getByRole("listitem")).toHaveText([
    /Walking · cardio/,
    /A · cardio/,
    /B · cardio/,
  ]);
  await page.reload();
  await expect(page.getByRole("list", { name: "Active" }).getByRole("listitem").first()).toHaveText(
    /Walking · cardio/,
  );
});
