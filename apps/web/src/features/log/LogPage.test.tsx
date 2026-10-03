import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import { fake } from "../../../tests/fake-api";
import { renderApp } from "../../../tests/render";
import { setDesktop } from "../../../tests/viewport";

beforeEach(() => fake.signIn());

const headings = (list: HTMLElement) =>
  within(list)
    .getAllByRole("article")
    .map((a) => within(a).getByRole("heading").textContent);

describe("log page", () => {
  test("is reachable from the header", async () => {
    const { user, history } = renderApp("/");
    await user.click(await screen.findByRole("link", { name: "Log" }));
    expect(await screen.findByRole("heading", { name: "Log", level: 1 })).toBeInTheDocument();
    expect(history.location.pathname).toBe("/log");
  });

  test("shows today at the top even with nothing logged", async () => {
    renderApp("/log");
    const list = await screen.findByRole("list", { name: "Log, newest first" });
    expect(headings(list)).toEqual(["Friday, October 2, 2026Today"]);
    expect(within(list).getByText(/Nothing logged yet/)).toBeInTheDocument();
    expect(within(list).getByRole("link", { name: "Log today" })).toBeInTheDocument();
  });

  test("lists every day with activity, newest first, today on top", async () => {
    const walking = fake.addType("Walking", "miles", false, "cardio");
    fake.setDay("2026-10-02", { caloriesIn: 1850, caloriesOut: 2600, weightLbs: 182.4 });
    fake.setDay("2026-09-15", { note: "line one\nline two" });
    fake.addEntry("2026-10-01", walking.id, 3.5);
    renderApp("/log");

    const list = await screen.findByRole("list", { name: "Log, newest first" });
    expect(headings(list)).toEqual([
      "Friday, October 2, 2026Today",
      "Thursday, October 1, 2026",
      "Tuesday, September 15, 2026",
    ]);
    const [today, yesterday, older] = within(list).getAllByRole("article") as HTMLElement[];

    expect(within(today as HTMLElement).queryByText(/Nothing logged yet/)).toBeNull();
    for (const [term, value] of [
      ["In", "1,850 cal"],
      ["Out", "2,600 cal"],
      ["Net", "−750 cal"],
      ["Weight", "182.4 lbs"],
    ]) {
      const dt = within(today as HTMLElement).getByText(term as string, { selector: "dt" });
      expect(dt.nextElementSibling?.textContent).toBe(value);
    }

    const exercises = within(yesterday as HTMLElement).getByRole("list", { name: "Exercises" });
    expect(within(exercises).getByRole("listitem").textContent).toBe("Walkingcardio – 3.5 miles");

    const note = within(older as HTMLElement).getByText(/line one/);
    expect(note.textContent).toBe("line one\nline two");
  });

  test("is read only", async () => {
    fake.setDay("2026-10-02", { note: "hello", caloriesIn: 100 });
    renderApp("/log");
    await screen.findByText("hello");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /edit|delete|save/i })).toBeNull();
  });

  test("each date links to that day on the calendar", async () => {
    setDesktop(true);
    fake.setDay("2026-09-15", { caloriesIn: 100 });
    const { user, history } = renderApp("/log");
    await user.click(await screen.findByRole("link", { name: "Tuesday, September 15, 2026" }));
    await waitFor(() => expect(history.location.pathname).toBe("/calendar/2026-09"));
    expect(history.location.search).toContain("day=2026-09-15");
  });

  test("something logged in the day panel shows up", async () => {
    setDesktop(true);
    const { user } = renderApp("/");
    const panel = await screen.findByRole("complementary", { name: "Day details" });
    await user.type(await within(panel).findByLabelText("Notes"), "new note");
    await user.tab();
    await waitFor(() => expect(fake.state.days.get("2026-10-02")?.note).toBe("new note"));
    await user.click(screen.getByRole("link", { name: "Log" }));
    expect(await screen.findByText("new note")).toBeInTheDocument();
  });
});
