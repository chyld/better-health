import { join } from "node:path";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";

/** Serves the built web app, falling back to index.html for client-side routes. */
export function staticRoutes(distDir: string) {
  const index = Bun.file(join(distDir, "index.html"));
  return new Hono()
    .use(
      "/assets/*",
      serveStatic({
        root: distDir,
        onFound: (_path, c) => {
          // Vite fingerprints asset names, so they can be cached forever.
          c.header("Cache-Control", "public, max-age=31536000, immutable");
        },
      }),
    )
    .use("*", serveStatic({ root: distDir }))
    .get("*", async (c) => {
      if (!(await index.exists())) return c.text("Web app not built. Run: bun run build", 503);
      c.header("Cache-Control", "no-cache");
      return c.html(await index.text());
    });
}
