import { Hono } from "hono";

export function createApp() {
  const app = new Hono().basePath("/api");

  app.get("/health", (c) => c.json({ status: "ok" }));

  return app;
}

export type App = ReturnType<typeof createApp>;
