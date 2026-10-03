import { screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fake, server } from "../../../tests/fake-api";
import { renderApp } from "../../../tests/render";

describe("as an admin", () => {
  let clicked: { href: string; download: string }[];

  beforeEach(() => {
    fake.signIn("alice", { admin: true });
    clicked = [];
    // jsdom has no blob URLs or downloads; record what would have been saved.
    URL.createObjectURL = vi.fn(() => "blob:backup");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push({ href: this.href, download: this.download });
    });
  });
  afterEach(() => vi.restoreAllMocks());

  test("the header links to the admin page", async () => {
    const { user, history } = renderApp("/");
    await user.click(await screen.findByRole("link", { name: "Admin" }));
    expect(await screen.findByRole("heading", { name: "Admin", level: 1 })).toBeInTheDocument();
    expect(history.location.pathname).toBe("/admin");
  });

  test("the button downloads the database under the server's filename", async () => {
    const { user } = renderApp("/admin");
    await user.click(await screen.findByRole("button", { name: "Download database" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Downloaded better-health-2026-10-02T12-00-00.db (2 KB).",
    );
    expect(clicked).toEqual([
      { href: "blob:backup", download: "better-health-2026-10-02T12-00-00.db" },
    ]);
  });

  test("shows the server's error when the download fails", async () => {
    server.use(
      http.get("*/api/admin/backup", () =>
        HttpResponse.json({ error: { code: "x", message: "Disk full" } }, { status: 500 }),
      ),
    );
    const { user } = renderApp("/admin");
    await user.click(await screen.findByRole("button", { name: "Download database" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Disk full");
    expect(clicked).toEqual([]);
  });
});

describe("as a regular user", () => {
  beforeEach(() => fake.signIn("bob"));

  test("there is no admin link", async () => {
    renderApp("/");
    await screen.findByRole("link", { name: "Notes" });
    expect(screen.queryByRole("link", { name: "Admin" })).toBeNull();
  });

  test("the admin page redirects to the calendar", async () => {
    const { history } = renderApp("/admin");
    expect(await screen.findByRole("grid")).toBeInTheDocument();
    expect(history.location.pathname).toBe("/calendar/2026-10");
    expect(screen.queryByRole("button", { name: "Download database" })).toBeNull();
  });
});
