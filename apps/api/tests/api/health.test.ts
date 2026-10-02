import { expect, test } from "bun:test";
import { createTestApp } from "../helpers/app";

test("GET /api/health returns ok without signing in", async () => {
  const res = await createTestApp().request("/api/health");
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ status: "ok" });
});

test("unknown routes return a JSON 404", async () => {
  const res = await createTestApp().request("/api/nope");
  expect(res.status).toBe(404);
  expect(await res.json()).toEqual({ error: { code: "not_found", message: "Not found" } });
});
