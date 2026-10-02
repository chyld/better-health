import type { Page } from "@playwright/test";
import { cell, expect, login, openDay, test } from "./fixtures";

async function createLabels(page: Page, labels: [name: string, unit: string][]) {
  await page.getByRole("link", { name: "Labels" }).click();
  const form = page.getByRole("form", { name: "Add label" });
  for (const [name, unit] of labels) {
    await form.getByLabel("Exercise").fill(name);
    await form.getByLabel("Unit").fill(unit);
    await form.getByRole("button", { name: "Add" }).click();
    await expect(
      page
        .getByRole("list", { name: "Active" })
        .getByRole("listitem")
        .filter({ hasText: `${name} · ${unit}` }),
    ).toBeVisible();
  }
  await page.getByRole("link", { name: "Back to calendar" }).click();
  await expect(page.getByRole("grid", { name: "Month" })).toBeVisible();
}

async function addExercise(page: Page, date: string, label: string, amount: string) {
  const day = await openDay(page, date);
  await day.getByRole("button", { name: "Add exercise" }).click();
  const form = day.getByRole("form", { name: "Add exercise" });
  await form.getByRole("radio", { name: label }).click();
  await form.getByLabel("Amount").fill(amount);
  await form.getByRole("button", { name: "Add" }).click();
  await expect(form).toBeHidden();
  return day;
}

test("logs amounts of name+unit labels, edits and deletes them", async ({ page }) => {
  await login(page);
  await createLabels(page, [
    ["Walking", "miles"],
    ["Jumping jacks", "sets"],
  ]);

  await addExercise(page, "2026-10-01", "Walking (miles)", "3");
  const day = await addExercise(page, "2026-10-01", "Jumping jacks (sets)", "5");
  await expect(day.getByRole("button", { name: "Delete Walking – 3 miles" })).toBeVisible();
  await expect(day.getByRole("button", { name: "Delete Jumping jacks – 5 sets" })).toBeVisible();
  await expect(cell(page, "2026-10-01")).toHaveAttribute("aria-label", /2 exercises/);

  await day.getByRole("button", { name: "Edit Walking – 3 miles" }).click();
  const edit = day.getByRole("form", { name: "Edit Walking – 3 miles" });
  await edit.getByLabel("Amount").fill("4.5");
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(day.getByRole("button", { name: "Delete Walking – 4.5 miles" })).toBeVisible();

  await day.getByRole("button", { name: "Delete Jumping jacks – 5 sets" }).click();
  await expect(day.getByRole("button", { name: "Delete Jumping jacks – 5 sets" })).toBeHidden();
  await expect(cell(page, "2026-10-01")).toHaveAttribute("aria-label", /1 exercise\b/);
});

test("the same exercise can be tracked in two units", async ({ page }) => {
  await login(page);
  await createLabels(page, [
    ["Walking", "miles"],
    ["Walking", "minutes"],
  ]);
  await addExercise(page, "2026-10-01", "Walking (miles)", "3");
  const day = await addExercise(page, "2026-10-01", "Walking (minutes)", "45");
  await expect(day.getByRole("button", { name: "Delete Walking – 3 miles" })).toBeVisible();
  await expect(day.getByRole("button", { name: "Delete Walking – 45 minutes" })).toBeVisible();
});

test("an archived label disappears from the picker but stays on past entries", async ({ page }) => {
  await login(page);
  await createLabels(page, [
    ["Yoga", "minutes"],
    ["Running", "miles"],
  ]);
  await addExercise(page, "2026-10-01", "Yoga (minutes)", "60");

  await page.goto("/labels");
  await page.getByRole("button", { name: "Archive Yoga (minutes)" }).click();
  await expect(page.getByRole("list", { name: "Archived" }).getByText("Yoga")).toBeVisible();

  await page.goto("/calendar/2026-10");
  const day = await openDay(page, "2026-10-01");
  await expect(day.getByText("(archived)")).toBeVisible();
  await day.getByRole("button", { name: "Add exercise" }).click();
  const form = day.getByRole("form", { name: "Add exercise" });
  await expect(form.getByRole("radio", { name: "Running (miles)" })).toBeVisible();
  await expect(form.getByRole("radio", { name: "Yoga (minutes)" })).toHaveCount(0);
});

test("labels can be edited and reordered", async ({ page }) => {
  await login(page);
  await createLabels(page, [
    ["A", "reps"],
    ["B", "reps"],
    ["Walk", "mi"],
  ]);
  await page.goto("/labels");
  await page.getByRole("button", { name: "Edit Walk (mi)" }).click();
  const form = page.getByRole("form", { name: "Edit Walk (mi)" });
  await form.getByLabel("Exercise").fill("Walking");
  await form.getByLabel("Unit").fill("miles");
  await form.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Move Walking (miles) up" }).click();
  await page.getByRole("button", { name: "Move Walking (miles) up" }).click();
  await expect(page.getByRole("list", { name: "Active" }).getByRole("listitem")).toHaveText([
    /Walking · miles/,
    /A · reps/,
    /B · reps/,
  ]);
  await page.reload();
  await expect(page.getByRole("list", { name: "Active" }).getByRole("listitem").first()).toHaveText(
    /Walking · miles/,
  );
});
