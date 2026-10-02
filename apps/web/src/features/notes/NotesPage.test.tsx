import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import { fake } from "../../../tests/fake-api";
import { renderApp } from "../../../tests/render";
import { setDesktop } from "../../../tests/viewport";

beforeEach(() => fake.signIn());

describe("notes page", () => {
  test("is reachable from the header", async () => {
    const { user, history } = renderApp("/");
    await user.click(await screen.findByRole("link", { name: "Notes" }));
    expect(await screen.findByRole("heading", { name: "Notes", level: 1 })).toBeInTheDocument();
    expect(history.location.pathname).toBe("/notes");
  });

  test("says when there are no notes", async () => {
    renderApp("/notes");
    expect(await screen.findByText(/No notes yet/)).toBeInTheDocument();
  });

  test("lists notes newest first with full dates, keeping line breaks", async () => {
    fake.setDay("2026-09-15", { note: "older" });
    fake.setDay("2026-10-02", { note: "line one\nline two" });
    fake.setDay("2026-10-01", { caloriesIn: 1800 });
    fake.setDay("2025-12-31", { note: "last year" });
    renderApp("/notes");

    const list = await screen.findByRole("list", { name: "Notes, newest first" });
    const items = within(list).getAllByRole("article");
    expect(items.map((a) => within(a).getByRole("heading").textContent)).toEqual([
      "Friday, October 2, 2026",
      "Tuesday, September 15, 2026",
      "Wednesday, December 31, 2025",
    ]);
    const text = within(items[0] as HTMLElement).getByText(/line one/);
    expect(text.textContent).toBe("line one\nline two");
    expect(text.className).toContain("whitespace-pre-wrap");
  });

  test("is read only", async () => {
    fake.setDay("2026-10-02", { note: "hello" });
    renderApp("/notes");
    await screen.findByText("hello");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /edit|delete|save/i })).toBeNull();
  });

  test("each date links to that day on the calendar", async () => {
    setDesktop(true);
    fake.setDay("2026-09-15", { note: "older" });
    const { user, history } = renderApp("/notes");
    await user.click(await screen.findByRole("link", { name: "Tuesday, September 15, 2026" }));
    await waitFor(() => expect(history.location.pathname).toBe("/calendar/2026-09"));
    expect(history.location.search).toContain("day=2026-09-15");
  });

  test("a note written in the day panel shows up", async () => {
    setDesktop(true);
    const { user } = renderApp("/");
    const panel = await screen.findByRole("complementary", { name: "Day details" });
    await user.type(await within(panel).findByLabelText("Notes"), "new note");
    await user.tab();
    await waitFor(() => expect(fake.state.days.get("2026-10-02")?.note).toBe("new note"));
    await user.click(screen.getByRole("link", { name: "Notes" }));
    expect(await screen.findByText("new note")).toBeInTheDocument();
  });
});
