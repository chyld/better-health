import type { Page } from "@playwright/test";
import { cell, expect, login, openDay, test } from "./fixtures";

async function createLabels(page: Page, names: string[]) {
  await page.getByRole("link", { name: "Labels" }).click();
  const input = page.getByRole("textbox", { name: "New label" });
  for (const name of names) {
    await input.fill(name);
    await input.press("Enter");
    await expect(page.getByRole("list", { name: "Active" }).getByText(name)).toBeVisible();
  }
  await page.getByRole("link", { name: "Back to calendar" }).click();
  await expect(page.getByRole("grid", { name: "Month" })).toBeVisible();
}

async function addExercise(page: Page, date: string, label: string, note: string) {
  const day = await openDay(page, date);
  await day.getByRole("button", { name: "Add exercise" }).click();
  const form = day.getByRole("form", { name: "Add exercise" });
  await form.getByRole("radio", { name: label }).click();
  await form.getByLabel("Note").fill(note);
  await form.getByRole("button", { name: "Add" }).click();
  await expect(day.getByText(`– ${note}`)).toBeVisible();
  return day;
}

test("logs exercises with notes, edits and deletes them", async ({ page }) => {
  await login(page);
  await createLabels(page, ["Walking", "Jumping jacks"]);

  await addExercise(page, "2026-10-01", "Walking", "3 miles");
  const day = await addExercise(page, "2026-10-01", "Jumping jacks", "5 sets");
  await expect(cell(page, "2026-10-01")).toHaveAttribute("aria-label", /2 exercises/);

  await day.getByRole("button", { name: "Edit Walking" }).click();
  const edit = day.getByRole("form", { name: "Edit Walking" });
  await edit.getByLabel("Note").fill("4 miles");
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(day.getByText("– 4 miles")).toBeVisible();

  await day.getByRole("button", { name: "Delete Jumping jacks – 5 sets" }).click();
  await expect(day.getByText("– 5 sets")).toBeHidden();
  await expect(cell(page, "2026-10-01")).toHaveAttribute("aria-label", /1 exercise\b/);
});

test("an archived label disappears from the picker but stays on past entries", async ({ page }) => {
  await login(page);
  await createLabels(page, ["Yoga", "Running"]);
  await addExercise(page, "2026-10-01", "Yoga", "1 hour");

  await page.goto("/labels");
  await page.getByRole("button", { name: "Archive Yoga" }).click();
  await expect(page.getByRole("list", { name: "Archived" }).getByText("Yoga")).toBeVisible();

  await page.goto("/calendar/2026-10");
  const day = await openDay(page, "2026-10-01");
  await expect(day.getByText("(archived)")).toBeVisible();
  await day.getByRole("button", { name: "Add exercise" }).click();
  const form = day.getByRole("form", { name: "Add exercise" });
  await expect(form.getByRole("radio", { name: "Running" })).toBeVisible();
  await expect(form.getByRole("radio", { name: "Yoga" })).toHaveCount(0);
});

test("labels can be renamed and reordered", async ({ page }) => {
  await login(page);
  await createLabels(page, ["A", "B", "Walk"]);
  await page.goto("/labels");
  await page.getByRole("button", { name: "Rename Walk" }).click();
  await page.getByRole("textbox", { name: "Label name" }).fill("Walking");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Move Walking up" }).click();
  await page.getByRole("button", { name: "Move Walking up" }).click();
  await expect(page.getByRole("list", { name: "Active" }).getByRole("listitem")).toHaveText([
    /Walking/,
    /A/,
    /B/,
  ]);
  await page.reload();
  await expect(page.getByRole("list", { name: "Active" }).getByRole("listitem").first()).toHaveText(
    /Walking/,
  );
});
