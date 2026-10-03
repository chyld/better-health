import { screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, test } from "vitest";
import { fake, server } from "../../../tests/fake-api";
import { renderApp } from "../../../tests/render";

beforeEach(() => {
  fake.signIn();
  fake.setDay("2026-09-15", { caloriesIn: 1800, caloriesOut: 2400, weightLbs: 184.2 });
  fake.setDay("2026-10-02", { caloriesIn: 2500, caloriesOut: 2100 });
  fake.setDay("2026-10-01", { weightLbs: 182.4, note: "x" });
  fake.setDay("2026-09-30", { note: "only a note" });
});

/** [date, value] per row of the visible list. */
const rows = (name: string) =>
  within(screen.getByRole("list", { name }))
    .getAllByRole("listitem")
    .map((li) => [
      li.querySelector("time")?.getAttribute("datetime"),
      li.querySelector("[data-value]")?.textContent,
    ]);

describe("history page", () => {
  test("is reachable from the header", async () => {
    const { user, history } = renderApp("/");
    await user.click(await screen.findByRole("link", { name: "History" }));
    expect(await screen.findByRole("heading", { name: "History", level: 1 })).toBeInTheDocument();
    expect(history.location.pathname).toBe("/history");
  });

  test("starts on calories in: every day that has it, newest first", async () => {
    renderApp("/history");
    await screen.findByRole("list", { name: "Calories in, newest first" });
    expect(screen.getByLabelText("Show")).toHaveValue("in");
    expect(rows("Calories in, newest first")).toEqual([
      ["2026-10-02", "2,500 cal"],
      ["2026-09-15", "1,800 cal"],
    ]);
    expect(screen.getByText(/2 days · average/)).toHaveTextContent("2 days · average 2,150 cal");
  });

  test("the drop-down switches metric and remembers it in the URL", async () => {
    const { user, history } = renderApp("/history");
    const select = await screen.findByLabelText("Show");
    await screen.findByRole("list", { name: "Calories in, newest first" });

    await user.selectOptions(select, "Net calories");
    expect(rows("Net calories, newest first")).toEqual([
      ["2026-10-02", "+400 cal"],
      ["2026-09-15", "−600 cal"],
    ]);
    expect(history.location.search).toContain("metric=net");

    await user.selectOptions(select, "Weight");
    expect(rows("Weight, newest first")).toEqual([
      ["2026-10-01", "182.4 lbs"],
      ["2026-09-15", "184.2 lbs"],
    ]);
    expect(screen.getByText(/average/)).toHaveTextContent("2 days · average 183.3 lbs");

    await user.selectOptions(select, "Calories out");
    expect(rows("Calories out, newest first")).toEqual([
      ["2026-10-02", "2,100 cal"],
      ["2026-09-15", "2,400 cal"],
    ]);
  });

  test("opens on the metric in the URL", async () => {
    renderApp("/history?metric=weight");
    expect(await screen.findByRole("list", { name: "Weight, newest first" })).toBeInTheDocument();
    expect(screen.getByLabelText("Show")).toHaveValue("weight");
  });

  test("each date links to that day on the calendar", async () => {
    const { user, history } = renderApp("/history");
    await screen.findByRole("list", { name: "Calories in, newest first" });
    await user.click(screen.getByRole("link", { name: "Tue, Sep 15, 2026" }));
    await waitFor(() => expect(history.location.pathname).toBe("/calendar/2026-09"));
    expect(history.location.search).toContain("day=2026-09-15");
  });

  test("says when a metric has nothing logged", async () => {
    fake.reset();
    fake.signIn();
    renderApp("/history?metric=weight");
    expect(await screen.findByText(/No weight logged yet/)).toBeInTheDocument();
  });

  test("shows an error with a retry", async () => {
    let fail = true;
    server.use(
      http.get("*/api/history", () =>
        fail
          ? HttpResponse.json({ error: { code: "x", message: "x" } }, { status: 500 })
          : undefined,
      ),
    );
    const { user } = renderApp("/history");
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load history.");
    fail = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(
      await screen.findByRole("list", { name: "Calories in, newest first" }),
    ).toBeInTheDocument();
  });
});
