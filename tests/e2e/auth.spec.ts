import { cell, expect, login, PASSWORD, test } from "./fixtures";

test("signs in, stays signed in across reloads, and signs out", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/calendar\/2026-10/);
  await expect(page.getByRole("heading", { name: "October 2026" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("grid", { name: "Month" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});

test("a wrong password shows an error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("alice");
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toHaveText("Invalid username or password");
});

test("a deep link survives signing in", async ({ page }) => {
  await page.goto("/calendar/2026-08");
  await expect(page).toHaveURL(/\/login\?redirect=/);
  await page.getByLabel("Username").fill("alice");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "August 2026" })).toBeVisible();
});

test("today is marked on the calendar", async ({ page }) => {
  await login(page);
  await expect(cell(page, "2026-10-02")).toHaveAttribute("aria-current", "date");
});
