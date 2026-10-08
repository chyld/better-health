import { screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, test } from "vitest";
import { fake, server } from "../../../tests/fake-api";
import { renderApp } from "../../../tests/render";
import { setDesktop } from "../../../tests/viewport";

const patches = () => fake.state.requests.filter((r) => r.method === "PATCH");
const cell = (date: string) => document.querySelector(`button[data-date="${date}"]`) as HTMLElement;

async function openDesktop(path = "/") {
  setDesktop(true);
  const r = renderApp(path);
  const panel = await screen.findByRole("complementary", { name: "Day details" });
  await within(panel).findByLabelText("Calories in");
  return { ...r, panel };
}

beforeEach(() => fake.signIn());

describe("calorie, weight, steps and distance fields", () => {
  test("show the saved values and net", async () => {
    fake.setDay("2026-10-02", {
      caloriesIn: 1850,
      caloriesActive: 2600,
      weightLbs: 182,
      steps: 12345,
      distanceMiles: 5.5,
    });
    const { panel } = await openDesktop();
    expect(within(panel).getByLabelText("Calories in")).toHaveValue("1850");
    expect(within(panel).getByLabelText("Active calories")).toHaveValue("2600");
    expect(within(panel).getByLabelText("Weight")).toHaveValue("182.0");
    expect(within(panel).getByLabelText("Steps")).toHaveValue("12345");
    expect(within(panel).getByLabelText("Distance")).toHaveValue("5.5");
    expect(within(panel).getByRole("status", { name: "Net" })).toHaveTextContent("−750");
  });

  test("net shows a dash until both values exist", async () => {
    fake.setDay("2026-10-02", { caloriesIn: 1850 });
    const { panel } = await openDesktop();
    expect(within(panel).getByRole("status", { name: "Net" })).toHaveTextContent("—");
  });

  test("typing saves once, shortly after typing stops", async () => {
    const { user, panel } = await openDesktop();
    await user.type(within(panel).getByLabelText("Calories in"), "1850");
    expect(patches()).toHaveLength(0);
    await waitFor(() => expect(patches()).toHaveLength(1), { timeout: 2000 });
    expect(patches()[0]).toEqual({
      method: "PATCH",
      path: "/api/days/2026-10-02",
      body: { caloriesIn: 1850 },
    });
    expect(await within(panel).findByText("Saved")).toBeInTheDocument();
  });

  test("leaving the field saves immediately", async () => {
    const { user, panel } = await openDesktop();
    await user.type(within(panel).getByLabelText("Active calories"), "2600");
    await user.tab();
    await waitFor(() => expect(patches()).toHaveLength(1), { timeout: 300 });
    expect(patches()[0]?.body).toEqual({ caloriesActive: 2600 });
  });

  test("the base burn is added to active calories, with a line showing how", async () => {
    fake.setBaseCalories(2000, "2026-10-01");
    fake.setDay("2026-10-02", { caloriesIn: 2500 });
    const { user, panel } = await openDesktop();
    const active = within(panel).getByLabelText("Active calories");
    expect(active).toHaveAccessibleDescription("+ 2,000 base = 2,000 out");
    expect(within(panel).getByRole("status", { name: "Net" })).toHaveTextContent("+500");

    await user.type(active, "1000");
    await waitFor(() => expect(active).toHaveAccessibleDescription("+ 2,000 base = 3,000 out"));
    expect(within(panel).getByRole("status", { name: "Net" })).toHaveTextContent("−500");
    await user.tab();
    await waitFor(() => expect(patches()[0]?.body).toEqual({ caloriesActive: 1000 }));
    await waitFor(() => expect(cell("2026-10-02")).toHaveAccessibleName(/out 3000, net minus 500/));
  });

  test("without a base, active calories have no extra line", async () => {
    const { panel } = await openDesktop();
    expect(within(panel).getByLabelText("Active calories")).not.toHaveAccessibleDescription();
  });

  test("the calendar cell and net update as values are saved", async () => {
    const { user, panel } = await openDesktop();
    await user.type(within(panel).getByLabelText("Calories in"), "1850");
    await user.type(within(panel).getByLabelText("Active calories"), "2600");
    await user.tab();
    await waitFor(() =>
      expect(within(panel).getByRole("status", { name: "Net" })).toHaveTextContent("−750"),
    );
    await waitFor(() => expect(cell("2026-10-02")).toHaveAccessibleName(/net minus 750/));
  });

  test("clearing a field saves null", async () => {
    fake.setDay("2026-10-02", { weightLbs: 182.4 });
    const { user, panel } = await openDesktop();
    await user.clear(within(panel).getByLabelText("Weight"));
    await user.tab();
    await waitFor(() => expect(patches()[0]?.body).toEqual({ weightLbs: null }));
  });

  test("weight accepts one decimal place", async () => {
    const { user, panel } = await openDesktop();
    await user.type(within(panel).getByLabelText("Weight"), "182.4");
    await user.tab();
    await waitFor(() => expect(patches()[0]?.body).toEqual({ weightLbs: 182.4 }));
  });

  test("steps and distance save, and show on the calendar cell", async () => {
    const { user, panel } = await openDesktop();
    await user.type(within(panel).getByLabelText("Steps"), "12345");
    await user.type(within(panel).getByLabelText("Distance"), "5.25");
    await user.tab();
    await waitFor(() =>
      expect(patches().map((p) => p.body)).toEqual([{ steps: 12345 }, { distanceMiles: 5.25 }]),
    );
    await waitFor(() =>
      expect(cell("2026-10-02")).toHaveAccessibleName(/12345 steps, 5\.25 miles/),
    );
    expect(cell("2026-10-02").querySelector('[data-value="steps"]')).toHaveTextContent("12,345");
  });

  test.each([
    ["Calories in", "abc", "Enter a number"],
    ["Calories in", "-5", "Enter a number"],
    ["Calories in", "12.5", "Calories must be a whole number"],
    ["Calories in", "25000", "Calories must be at most 20000"],
    ["Weight", "182.45", "Weight allows one decimal place"],
    ["Weight", "20", "Weight must be at least 50 lbs"],
    ["Steps", "1.5", "Steps must be a whole number"],
    ["Steps", "250000", "Steps must be at most 200000"],
    ["Distance", "3.125", "Distance allows two decimal places"],
    ["Distance", "250", "Distance must be at most 200 miles"],
  ])("%s %p is rejected with %p and not saved", async (label, input, message) => {
    const { user, panel } = await openDesktop();
    const field = within(panel).getByLabelText(label);
    await user.type(field, input);
    await user.tab();
    expect(await within(panel).findByText(message)).toBeInTheDocument();
    expect(field).toHaveAttribute("aria-invalid", "true");
    await new Promise((r) => setTimeout(r, 900));
    expect(patches()).toHaveLength(0);
  });

  test("a failed save says so and restores the calendar cell", async () => {
    fake.setDay("2026-10-02", { caloriesIn: 1000 });
    server.use(
      http.patch("*/api/days/:date", () =>
        HttpResponse.json({ error: { code: "x", message: "disk full" } }, { status: 500 }),
      ),
    );
    const { user, panel } = await openDesktop();
    const field = within(panel).getByLabelText("Calories in");
    await user.clear(field);
    await user.type(field, "2000");
    await user.tab();
    expect(await within(panel).findByRole("alert")).toHaveTextContent("Not saved: disk full");
    await waitFor(() => expect(cell("2026-10-02")).toHaveAccessibleName(/in 1000/));
  });
});

describe("phone sheet", () => {
  test("closing the sheet right after typing still saves", async () => {
    const { user } = renderApp("/calendar/2026-10?day=2026-10-02");
    const sheet = await screen.findByRole("dialog");
    await user.type(await within(sheet).findByLabelText("Calories in"), "1500");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(patches()[0]?.body).toEqual({ caloriesIn: 1500 }), {
      timeout: 300,
    });
  });
});

describe("note", () => {
  test("auto-saves and shows the note marker on the calendar", async () => {
    const { user, panel } = await openDesktop();
    await user.type(within(panel).getByLabelText("Notes"), "slept 7h");
    await waitFor(() => expect(patches().at(-1)?.body).toEqual({ note: "slept 7h" }), {
      timeout: 2000,
    });
    await waitFor(() => expect(cell("2026-10-02")).toHaveAccessibleName(/has a note/));
  });

  test("an emptied note is saved as null", async () => {
    fake.setDay("2026-10-02", { note: "old" });
    const { user, panel } = await openDesktop();
    await user.clear(within(panel).getByLabelText("Notes"));
    await user.tab();
    await waitFor(() => expect(patches()[0]?.body).toEqual({ note: null }));
  });
});

describe("exercise", () => {
  const stickers = (panel: HTMLElement) =>
    within(within(panel).getByRole("group", { name: "Tap to log" }))
      .getAllByRole("button")
      .map((b) => b.textContent);

  async function measure(r: Awaited<ReturnType<typeof openDesktop>>, name: string) {
    await r.user.click(await within(r.panel).findByRole("button", { name: `Measure ${name}` }));
    return within(r.panel).getByRole("form", { name: `Measure ${name}` });
  }

  test("with no labels, points to the labels page", async () => {
    const { panel } = await openDesktop();
    expect(await within(panel).findByText("No exercise labels yet.")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Create labels" })).toHaveAttribute(
      "href",
      "/labels",
    );
  });

  test("one tap on a sticker logs the exercise, with no amount needed", async () => {
    fake.addType("Pushups");
    fake.addType("Running");
    const { user, panel } = await openDesktop();
    expect(within(panel).getByText("No exercise logged.")).toBeInTheDocument();
    await user.click(await within(panel).findByRole("button", { name: "Log Running" }));

    expect(
      await within(panel).findByRole("button", { name: "Delete Running" }),
    ).toBeInTheDocument();
    expect(fake.state.requests.at(-1)?.body).toEqual({ exerciseTypeId: 2 });
    await waitFor(() => expect(cell("2026-10-02")).toHaveAccessibleName(/1 exercise/));
    // Tapping again logs it a second time.
    await user.click(within(panel).getByRole("button", { name: "Log Running" }));
    await waitFor(() =>
      expect(within(panel).getAllByRole("button", { name: "Delete Running" })).toHaveLength(2),
    );
  });

  test("an entry can be measured in a unit typed once", async () => {
    const run = fake.addType("Running");
    fake.addEntry("2026-10-02", run.id);
    const r = await openDesktop();
    const form = await measure(r, "Running");
    expect(within(form).getByLabelText("Amount")).toHaveFocus();
    const save = within(form).getByRole("button", { name: "Save" });
    await r.user.type(within(form).getByLabelText("Amount"), "3.5");
    expect(save).toBeDisabled();
    await r.user.type(within(form).getByLabelText("Unit"), "Miles");
    await r.user.click(save);

    expect(
      await within(r.panel).findByRole("button", { name: "Delete Running – 3.5 miles" }),
    ).toBeInTheDocument();
    expect(fake.state.requests.at(-1)?.body).toEqual({
      measurements: [{ unit: "miles", amount: 3.5 }],
    });
    expect(within(r.panel).queryByRole("form", { name: "Measure Running" })).toBeNull();
  });

  test("units used before with the label are offered, the latest preselected", async () => {
    const run = fake.addType("Running");
    fake.addEntry("2026-09-01", run.id, [{ unit: "minutes", amount: 30 }]);
    fake.addEntry("2026-09-20", run.id, [{ unit: "miles", amount: 3 }]);
    fake.addEntry("2026-10-02", run.id);
    const r = await openDesktop();
    const form = await measure(r, "Running");
    const units = within(form).getByRole("group", { name: "Units used before" });
    await waitFor(() =>
      expect(
        within(units)
          .getAllByRole("button")
          .map((b) => b.textContent),
      ).toEqual(["miles", "minutes"]),
    );
    expect(within(form).getByLabelText("Unit")).toHaveValue("miles");
    await r.user.click(within(units).getByRole("button", { name: "minutes" }));
    expect(within(form).getByLabelText("Unit")).toHaveValue("minutes");
    await r.user.type(within(form).getByLabelText("Amount"), "45");
    await r.user.click(within(form).getByRole("button", { name: "Save" }));
    expect(
      await within(r.panel).findByRole("button", { name: "Delete Running – 45 minutes" }),
    ).toBeInTheDocument();
  });

  test("several units can be measured; the same unit again replaces it", async () => {
    const run = fake.addType("Running");
    fake.addEntry("2026-10-02", run.id, [{ unit: "miles", amount: 3 }]);
    const r = await openDesktop();
    let form = await measure(r, "Running");
    // A unit already on the entry is not suggested again.
    expect(within(form).queryByRole("group", { name: "Units used before" })).toBeNull();
    await r.user.type(within(form).getByLabelText("Amount"), "30");
    await r.user.type(within(form).getByLabelText("Unit"), "minutes");
    await r.user.click(within(form).getByRole("button", { name: "Save" }));
    expect(
      await within(r.panel).findByRole("button", { name: "Delete Running – 3 miles, 30 minutes" }),
    ).toBeInTheDocument();

    form = await measure(r, "Running");
    await r.user.type(within(form).getByLabelText("Amount"), "4");
    await r.user.clear(within(form).getByLabelText("Unit"));
    await r.user.type(within(form).getByLabelText("Unit"), "miles");
    await r.user.click(within(form).getByRole("button", { name: "Save" }));
    expect(
      await within(r.panel).findByRole("button", { name: "Delete Running – 30 minutes, 4 miles" }),
    ).toBeInTheDocument();
  });

  test("a measurement can be removed", async () => {
    const run = fake.addType("Running");
    fake.addEntry("2026-10-02", run.id, [
      { unit: "miles", amount: 3 },
      { unit: "minutes", amount: 30 },
    ]);
    const { user, panel } = await openDesktop();
    await user.click(
      await within(panel).findByRole("button", { name: "Remove 3 miles from Running" }),
    );
    expect(
      await within(panel).findByRole("button", { name: "Delete Running – 30 minutes" }),
    ).toBeInTheDocument();
    expect(fake.state.requests.at(-1)?.body).toEqual({
      measurements: [{ unit: "minutes", amount: 30 }],
    });
  });

  test.each([
    ["abc", "Enter a number"],
    ["0", "Amount must be more than 0"],
    ["3.125", "Amount allows two decimal places"],
    ["200000", "Amount must be at most 100000"],
  ])("amount %p is rejected with %p", async (input, message) => {
    const run = fake.addType("Running");
    fake.addEntry("2026-10-02", run.id);
    const r = await openDesktop();
    const form = await measure(r, "Running");
    await r.user.type(within(form).getByLabelText("Unit"), "miles");
    await r.user.type(within(form).getByLabelText("Amount"), input);
    expect(within(form).getByText(message)).toBeInTheDocument();
    expect(within(form).getByRole("button", { name: "Save" })).toBeDisabled();
  });

  test("Escape or Cancel closes the measure form without saving", async () => {
    const run = fake.addType("Running");
    fake.addEntry("2026-10-02", run.id);
    const r = await openDesktop();
    let form = await measure(r, "Running");
    await r.user.click(within(form).getByRole("button", { name: "Cancel" }));
    expect(within(r.panel).queryByRole("form", { name: "Measure Running" })).toBeNull();
    form = await measure(r, "Running");
    await r.user.type(within(form).getByLabelText("Amount"), "3{Escape}");
    expect(within(r.panel).queryByRole("form", { name: "Measure Running" })).toBeNull();
    expect(fake.state.requests).toHaveLength(0);
  });

  test("Enter in a number field moves to the next field", async () => {
    const { user, panel } = await openDesktop();
    await user.type(within(panel).getByLabelText("Calories in"), "1850{Enter}");
    expect(within(panel).getByLabelText("Active calories")).toHaveFocus();
  });

  test("stickers list recently used labels first", async () => {
    const a = fake.addType("Pushups");
    const b = fake.addType("Situps");
    fake.addType("Yoga");
    fake.addEntry("2026-09-01", a.id);
    fake.addEntry("2026-09-20", b.id);
    const { panel } = await openDesktop();
    await within(panel).findByRole("button", { name: "Log Yoga" });
    expect(stickers(panel)).toEqual(["Situps", "Pushups", "Yoga"]);
  });

  test("stickers are grouped under their category, recency order kept", async () => {
    fake.addType("Squats", { category: "strength" });
    const walk = fake.addType("Walking", { category: "cardio" });
    fake.addType("Steps", { category: "" });
    fake.addType("Rowing", { category: "Cardio" });
    fake.addEntry("2026-09-20", walk.id);
    const { panel } = await openDesktop();
    const group = await within(panel).findByRole("group", { name: "Tap to log" });
    await within(group).findByRole("button", { name: "Log Steps" });
    expect(group.textContent).toBe("cardioWalkingRowingstrengthSquatsNo categorySteps");
    // Headings are visual only; the buttons keep their plain names.
    expect(stickers(panel)).toEqual(["Walking", "Rowing", "Squats", "Steps"]);
  });

  test("without any categories there are no headings", async () => {
    fake.addType("Steps", { category: "" });
    const { panel } = await openDesktop();
    const group = await within(panel).findByRole("group", { name: "Tap to log" });
    await within(group).findByRole("button", { name: "Log Steps" });
    expect(group.textContent).toBe("Steps");
  });

  test("a logged exercise shows its category and measurements", async () => {
    const walk = fake.addType("Walking", { category: "cardio" });
    fake.addEntry("2026-10-02", walk.id, [{ unit: "miles", amount: 3 }]);
    const { panel } = await openDesktop();
    const list = await within(panel).findByRole("list", { name: "Logged exercises" });
    expect(list).toHaveTextContent(/^Walkingcardio.*3miles/);
  });

  test("archived labels have no sticker", async () => {
    fake.addType("Yoga", { archived: true });
    fake.addType("Running");
    const { panel } = await openDesktop();
    await within(panel).findByRole("button", { name: "Log Running" });
    expect(stickers(panel)).toEqual(["Running"]);
  });

  test("deletes an entry", async () => {
    const walk = fake.addType("Walking");
    fake.addEntry("2026-10-02", walk.id, [{ unit: "miles", amount: 3 }]);
    const { user, panel } = await openDesktop();
    await user.click(
      await within(panel).findByRole("button", { name: "Delete Walking – 3 miles" }),
    );
    expect(await within(panel).findByText("No exercise logged.")).toBeInTheDocument();
  });

  test("an entry with an archived label is marked and can still be measured", async () => {
    const yoga = fake.addType("Yoga", { archived: true });
    fake.addEntry("2026-10-02", yoga.id, [{ unit: "minutes", amount: 60 }]);
    const r = await openDesktop();
    expect(await within(r.panel).findByText("(archived)")).toBeInTheDocument();
    const form = await measure(r, "Yoga");
    await waitFor(() => expect(within(form).getByLabelText("Unit")).toHaveValue(""));
  });
});
