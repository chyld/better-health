import { expect, test } from "bun:test";
import { createApp } from "../../src/app";

test("GET /api/health returns ok", async () => {
  const res = await createApp().request("/api/health");
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ status: "ok" });
});
