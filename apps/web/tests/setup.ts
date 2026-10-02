import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { fake, server } from "./fake-api";

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  fake.reset();
});
afterAll(() => server.close());

// jsdom does not implement scrolling; the router calls it on navigation.
window.scrollTo = () => {};
