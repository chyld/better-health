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
    const walking = fake.addType("Walking", { category: "cardio" });
    const yoga = fake.addType("Yoga", { category: "stretch" });
    fake.setDay("2026-10-02", {
      caloriesIn: 1850,
      caloriesActive: 2600,
      weightLbs: 182.4,
      steps: 12345,
      distanceMiles: 5.25,
    });
    fake.setDay("2026-09-15", { note: "line one\nline two" });
    fake.addEntry("2026-10-01", walking.id, [
      { unit: "miles", amount: 3.5 },
      { unit: "minutes", amount: 50 },
    ]);
    fake.addEntry("2026-10-01", yoga.id);
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
      ["Steps", "12,345"],
      ["Distance", "5.25 mi"],
    ]) {
      const dt = within(today as HTMLElement).getByText(term as string, { selector: "dt" });
      expect(dt.nextElementSibling?.textContent).toBe(value);
    }

    // No base burn set: "Out" is what was entered, with no breakdown.
    expect(within(today as HTMLElement).queryByText("Base", { selector: "dt" })).toBeNull();

    const exercises = within(yesterday as HTMLElement).getByRole("list", { name: "Exercises" });
    expect(
      within(exercises)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["Walkingcardio – 3.5 miles, 50 minutes", "Yogastretch"]);

    const note = within(older as HTMLElement).getByText(/line one/);
    expect(note.textContent).toBe("line one\nline two");
  });

  test("breaks the burn into active and base once a base is set", async () => {
    fake.setBaseCalories(2000, "2026-10-01");
    fake.setDay("2026-10-02", { caloriesIn: 2500, caloriesActive: 1000 });
    fake.setDay("2026-10-01", { caloriesIn: 2400 });
    fake.setDay("2026-09-30", { caloriesIn: 1800, caloriesActive: 2400 });
    renderApp("/log");

    const list = await screen.findByRole("list", { name: "Log, newest first" });
    const terms = (article: HTMLElement) =>
      within(article)
        .getAllByRole("definition")
        .map((dd) => `${dd.previousElementSibling?.textContent} ${dd.textContent}`);
    const [today, yesterday, before] = within(list).getAllByRole("article") as HTMLElement[];
    expect(terms(today as HTMLElement)).toEqual([
      "In 2,500 cal",
      "Active 1,000 cal",
      "Base 2,000 cal",
      "Out 3,000 cal",
      "Net −500 cal",
    ]);
    expect(terms(yesterday as HTMLElement)).toEqual([
      "In 2,400 cal",
      "Active 0 cal",
      "Base 2,000 cal",
      "Out 2,000 cal",
      "Net +400 cal",
    ]);
    // Before the base started, the day reads as it always did.
    expect(terms(before as HTMLElement)).toEqual(["In 1,800 cal", "Out 2,400 cal", "Net −600 cal"]);
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
