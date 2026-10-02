import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Locator, type Page } from "@playwright/test";

export const PASSWORD = "password123";
export const TODAY = "2026-10-02";

export function isDesktop(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) >= 1024;
}

export const cell = (page: Page, date: string) => page.locator(`button[data-date="${date}"]`);

export async function login(page: Page, username = "alice") {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("grid", { name: "Month" })).toBeVisible();
}

/** Opens a day: the side panel on desktop, the bottom sheet elsewhere. */
export async function openDay(page: Page, date: string): Promise<Locator> {
  // A sheet may already be open (e.g. restored from ?day= after a reload).
  if (!isDesktop(page) && (await page.getByRole("dialog").isVisible())) await closeDay(page);
  await cell(page, date).click();
  const container = isDesktop(page)
    ? page.getByRole("complementary", { name: "Day details" })
    : page.getByRole("dialog");
  await expect(container.getByLabel("Calories in")).toBeVisible();
  return container;
}

export async function closeDay(page: Page) {
  if (!isDesktop(page)) {
    await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
  }
}

/** Fills a number field and leaves it, which saves immediately. */
export async function fillAndSave(container: Locator, label: string, value: string) {
  const field = container.getByLabel(label, { exact: true });
  await field.fill(value);
  await field.blur();
  await expect(container.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
}

export async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const summary = results.violations.map(
    (v) =>
      `${v.id}: ${v.help} — ${v.nodes
        .slice(0, 5)
        .map((n) => `${n.target.join(" ")} ${n.any[0]?.message ?? ""}`)
        .join(" | ")}`,
  );
  expect(summary).toEqual([]);
}

export const test = base.extend<{ fresh: void }>({
  fresh: [
    async ({ page, request, baseURL }, use) => {
      const res = await request.post("/api/test/reset", { headers: { origin: baseURL ?? "" } });
      expect(res.status()).toBe(204);
      // Freeze the browser's "today"; timers still run so auto-save works.
      await page.clock.setFixedTime(new Date(`${TODAY}T12:00:00`));
      await use();
    },
    { auto: true },
  ],
});

export { expect };
