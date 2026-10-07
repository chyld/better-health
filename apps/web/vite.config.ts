import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";
import { resolveVersion } from "../api/src/lib/version";

export default defineConfig({
  // Baked into the bundle, so the page can show which version it is running.
  define: {
    __APP_VERSION__: JSON.stringify(
      resolveVersion(fileURLToPath(new URL("../..", import.meta.url))),
    ),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // Registered from main.tsx, which reloads open pages onto a new version.
      injectRegister: false,
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Better Health",
        short_name: "Health",
        description: "Daily calories, weight and exercise on a monthly calendar",
        start_url: "/",
        display: "standalone",
        background_color: "#faf7ff",
        theme_color: "#7c3aed",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // A new version takes over as soon as it installs, and main.tsx then reloads the page.
        // The plugin only sets these when it injects the registration itself; without them the
        // new version waits until every tab is closed, and a refresh keeps the old one.
        skipWaiting: true,
        clientsClaim: true,
        // The API is never cached: data must always be live.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [],
      },
    }),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    proxy: { "/api": "http://127.0.0.1:3000" },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    css: false,
  },
});
