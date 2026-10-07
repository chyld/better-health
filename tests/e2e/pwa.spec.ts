import { expect, test } from "./fixtures";

test("a new version of the app takes over without waiting for every tab to close", async ({
  request,
}) => {
  const sw = await (await request.get("/sw.js")).text();
  // Activates as soon as it installs, not only when a page asks it to, and takes over open pages.
  expect(sw).toContain("self.skipWaiting()");
  expect(sw).not.toContain("SKIP_WAITING");
  expect(sw).toContain("clientsClaim()");
});
