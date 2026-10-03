import { readFileSync } from "node:fs";
import { expect, expectNoA11yViolations, login, test } from "./fixtures";

test("an admin downloads the database from the admin page", async ({ page, request, baseURL }) => {
  const res = await request.post("/api/test/admin", {
    data: { username: "alice" },
    headers: { origin: baseURL ?? "" },
  });
  expect(res.status()).toBe(204);
  await login(page);
  await page.getByRole("link", { name: "Admin" }).click();
  await expect(page.getByRole("heading", { name: "Admin", level: 1 })).toBeVisible();
  await expectNoA11yViolations(page);

  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download database" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^better-health-\d{4}-\d\d-\d\dT[\d-]+\.db$/);
  const bytes = readFileSync(await download.path());
  expect(bytes.subarray(0, 16).toString("latin1")).toBe("SQLite format 3\0");
  await expect(page.getByRole("status")).toContainText("Downloaded better-health-");
});

test("a regular user has no admin page", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("link", { name: "Notes" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
  await page.goto("/admin");
  await expect(page.getByRole("grid", { name: "Month" })).toBeVisible();
  expect(new URL(page.url()).pathname).toMatch(/^\/calendar\//);
});
