import { screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, test } from "vitest";
import { fake, server } from "../../../tests/fake-api";
import { renderApp } from "../../../tests/render";
import { setDesktop } from "../../../tests/viewport";

const cell = (date: string) => {
  const el = document.querySelector<HTMLButtonElement>(`button[data-date="${date}"]`);
  if (!el) throw new Error(`no cell for ${date}`);
  return el;
};

beforeEach(() => fake.signIn());

describe("month view", () => {
  test("shows the current month with Sunday first and every day", async () => {
    renderApp("/");
    expect(await screen.findByRole("heading", { name: "October 2026" })).toBeInTheDocument();
    await screen.findByRole("grid");
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers[0]).toContain("S");
    expect(within(screen.getByRole("grid")).getAllByRole("button")).toHaveLength(31);
    // Oct 1 2026 is a Thursday: four blank cells come first.
    const firstRow = screen.getAllByRole("row")[1];
    expect(firstRow?.querySelectorAll("button")).toHaveLength(3);
  });

  test("marks today", async () => {
    renderApp("/");
    await screen.findByRole("grid");
    expect(cell("2026-10-02")).toHaveAttribute("aria-current", "date");
    expect(cell("2026-10-03")).not.toHaveAttribute("aria-current");
  });

  test("dims future days only", async () => {
    renderApp("/");
    await screen.findByRole("grid");
    expect(cell("2026-10-03")).toHaveAttribute("data-future");
    expect(cell("2026-10-02")).not.toHaveAttribute("data-future");
    expect(cell("2026-10-01")).not.toHaveAttribute("data-future");
  });

  test("by default each cell shows net, weight, number of exercises and steps", async () => {
    fake.setDay("2026-10-02", {
      caloriesIn: 1850,
      caloriesActive: 2600,
      weightLbs: 182.4,
      note: "x",
    });
    const yoga = fake.addType("Yoga");
    fake.addEntry("2026-10-02", yoga.id, [{ unit: "minutes", amount: 60 }]);
    fake.addEntry("2026-10-02", yoga.id);
    renderApp("/");
    await screen.findByRole("grid");

    const c = cell("2026-10-02");
    expect(c).toHaveAccessibleName(
      "Friday, October 2, today, in 1850, out 2600, net minus 750, weight 182.4 pounds, 2 exercises, has a note",
    );
    expect(
      [...c.querySelectorAll("[data-value]")].map((e) => e.getAttribute("data-value")),
    ).toEqual(["net", "weight", "exercises"]);
    expect(c.querySelector('[data-value="net"]')).toHaveTextContent("N\u2212750");
    expect(c.querySelector('[data-value="exercises"]')).toHaveTextContent("Ex2");
    expect(c.querySelector('[data-value="weight"]')).toHaveTextContent("182.4");
    expect(c.querySelector('[data-value="in"]')).toBeNull();
    expect(c.querySelector('[data-value="out"]')).toBeNull();
    expect(c.querySelector('[title="Note"]')).not.toBeNull();
  });

  test("each cell shows the values chosen on Profile, in order, with their captions", async () => {
    const walk = fake.addType("Walking");
    fake.state.cellFields = [
      {
        id: 1,
        metric: "exercise",
        exerciseTypeId: walk.id,
        unit: "miles",
        caption: "Walk",
        color: null,
        sortOrder: 0,
      },
      {
        id: 2,
        metric: "in",
        exerciseTypeId: null,
        unit: null,
        caption: "Ate",
        color: null,
        sortOrder: 1,
      },
      {
        id: 3,
        metric: "distance",
        exerciseTypeId: null,
        unit: null,
        caption: "mi",
        color: null,
        sortOrder: 2,
      },
      {
        id: 4,
        metric: "weight",
        exerciseTypeId: null,
        unit: null,
        caption: "lb",
        color: null,
        sortOrder: 3,
      },
    ];
    fake.setDay("2026-10-02", { caloriesIn: 1850, weightLbs: 182.4 });
    fake.addEntry("2026-10-02", walk.id, [{ unit: "miles", amount: 3.5 }]);
    fake.addEntry("2026-10-02", walk.id, [{ unit: "miles", amount: 1 }]);
    renderApp("/");
    await screen.findByRole("grid");

    const values = [...cell("2026-10-02").querySelectorAll("[data-value]")];
    // No distance logged: that value is skipped.
    expect(values.map((e) => e.getAttribute("data-value"))).toEqual([
      `exercise:${walk.id}:miles`,
      "in",
      "weight",
    ]);
    expect(values.map((e) => e.textContent)).toEqual([
      "Walk4.54.5",
      "Ate1.9k1,850",
      "lb182.4182.4",
    ]);
  });

  test("with no values chosen, cells show only the date", async () => {
    fake.state.cellFields = [];
    fake.setDay("2026-10-02", { caloriesIn: 1850, weightLbs: 182.4 });
    renderApp("/");
    await screen.findByRole("grid");
    expect(cell("2026-10-02").querySelectorAll("[data-value]")).toHaveLength(0);
    expect(cell("2026-10-02")).toHaveAccessibleName(/in 1850/);
  });

  test("large nets are shortened on small screens", async () => {
    fake.setDay("2026-10-01", { caloriesIn: 3500, caloriesActive: 2000 });
    renderApp("/");
    await screen.findByRole("grid");
    const net = cell("2026-10-01").querySelector('[data-value="net"]');
    expect(net).toHaveTextContent("+1.5k");
    expect(net).toHaveTextContent("+1,500");
  });

  test("an empty day shows no values or markers", async () => {
    renderApp("/");
    await screen.findByRole("grid");
    expect(cell("2026-10-05").querySelectorAll("[data-value]")).toHaveLength(0);
    expect(cell("2026-10-05").querySelector('[title="Note"]')).toBeNull();
  });

  test("net only appears when both in and out are logged", async () => {
    fake.setDay("2026-10-01", { caloriesIn: 1800 });
    renderApp("/");
    await screen.findByRole("grid");
    expect(cell("2026-10-01").querySelector('[data-value="net"]')).toBeNull();
    expect(cell("2026-10-01")).toHaveAccessibleName(/in 1800/);
  });

  test("only one day is in the tab order", async () => {
    renderApp("/");
    await screen.findByRole("grid");
    const tabbable = within(screen.getByRole("grid"))
      .getAllByRole("button")
      .filter((b) => b.tabIndex === 0);
    expect(tabbable).toEqual([cell("2026-10-02")]);
  });

  test("shows an error with a retry when the month fails to load", async () => {
    let fail = true;
    server.use(
      http.get("*/api/months/:month", () =>
        fail
          ? HttpResponse.json({ error: { code: "x", message: "boom" } }, { status: 500 })
          : undefined,
      ),
    );
    const { user } = renderApp("/");
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load this month.");
    fail = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("grid")).toBeInTheDocument();
  });
});

describe("navigation", () => {
  test("previous and next change the month and URL", async () => {
    const { user, history } = renderApp("/");
    await screen.findByRole("heading", { name: "October 2026" });

    await user.click(screen.getByRole("link", { name: "Next month" }));
    expect(await screen.findByRole("heading", { name: "November 2026" })).toBeInTheDocument();
    expect(history.location.pathname).toBe("/calendar/2026-11");

    await user.click(screen.getByRole("link", { name: "Previous month" }));
    await user.click(screen.getByRole("link", { name: "Previous month" }));
    expect(await screen.findByRole("heading", { name: "September 2026" })).toBeInTheDocument();
  });

  test("crosses year boundaries", async () => {
    const { user } = renderApp("/calendar/2026-12");
    await screen.findByRole("heading", { name: "December 2026" });
    await user.click(screen.getByRole("link", { name: "Next month" }));
    expect(await screen.findByRole("heading", { name: "January 2027" })).toBeInTheDocument();
  });

  test("Today returns to the current month and selects today", async () => {
    const { user, history } = renderApp("/calendar/2025-03");
    await screen.findByRole("heading", { name: "March 2025" });
    await user.click(screen.getByRole("link", { name: "Today" }));
    expect(await screen.findByRole("heading", { name: "October 2026" })).toBeInTheDocument();
    expect(history.location.search).toContain("day=2026-10-02");
  });

  test("a past month has no today marker or dimmed days", async () => {
    renderApp("/calendar/2026-09");
    await screen.findByRole("grid");
    expect(document.querySelector('[aria-current="date"]')).toBeNull();
    expect(cell("2026-09-30")).not.toHaveAttribute("data-future");
  });
});

describe("phone layout", () => {
  test("tapping a day opens it in a bottom sheet; closing clears the selection", async () => {
    const { user, history } = renderApp("/");
    await screen.findByRole("grid");
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(cell("2026-10-01"));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByRole("heading", { name: "Thursday, October 1" })).toBeInTheDocument();
    expect(history.location.search).toContain("day=2026-10-01");
    expect(cell("2026-10-01").closest('[role="gridcell"]')).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await user.click(within(sheet).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(history.location.search).not.toContain("day=");
  });

  test("a day in the URL opens on load", async () => {
    renderApp("/calendar/2026-10?day=2026-10-15");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  test("a day from another month in the URL is ignored", async () => {
    renderApp("/calendar/2026-10?day=2026-11-15");
    await screen.findByRole("grid");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("desktop layout", () => {
  beforeEach(() => setDesktop(true));

  test("shows the whole calendar, with no panel, until a day is clicked", async () => {
    const { user } = renderApp("/");
    await screen.findByRole("grid");
    expect(screen.queryByRole("complementary", { name: "Day details" })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(cell("2026-10-20"));
    const panel = screen.getByRole("complementary", { name: "Day details" });
    expect(
      await within(panel).findByRole("heading", { name: "Tuesday, October 20" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("clicking another day switches the panel", async () => {
    const { user } = renderApp("/calendar/2026-10?day=2026-10-02");
    const panel = await screen.findByRole("complementary", { name: "Day details" });
    expect(within(panel).getByRole("heading", { name: "Friday, October 2" })).toBeInTheDocument();
    await screen.findByRole("grid");
    await user.click(cell("2026-10-20"));
    expect(
      await within(panel).findByRole("heading", { name: "Tuesday, October 20" }),
    ).toBeInTheDocument();
  });

  test("the close button hides the panel and returns focus to the day", async () => {
    const { user, history } = renderApp("/");
    await screen.findByRole("grid");
    await user.click(cell("2026-10-20"));
    const panel = screen.getByRole("complementary", { name: "Day details" });
    await user.click(within(panel).getByRole("button", { name: "Close day details" }));
    expect(screen.queryByRole("complementary", { name: "Day details" })).toBeNull();
    expect(history.location.search).not.toContain("day=");
    await waitFor(() => expect(cell("2026-10-20")).toHaveFocus());
  });

  test("Escape closes the panel", async () => {
    const { user } = renderApp("/calendar/2026-10?day=2026-10-02");
    await screen.findByRole("complementary", { name: "Day details" });
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("complementary", { name: "Day details" })).toBeNull();
    await waitFor(() => expect(cell("2026-10-02")).toHaveFocus());
  });
});
