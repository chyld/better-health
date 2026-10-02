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

describe("calorie and weight fields", () => {
  test("show the saved values and net", async () => {
    fake.setDay("2026-10-02", { caloriesIn: 1850, caloriesOut: 2600, weightLbs: 182 });
    const { panel } = await openDesktop();
    expect(within(panel).getByLabelText("Calories in")).toHaveValue("1850");
    expect(within(panel).getByLabelText("Calories out")).toHaveValue("2600");
    expect(within(panel).getByLabelText("Weight")).toHaveValue("182.0");
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
    await user.type(within(panel).getByLabelText("Calories out"), "2600");
    await user.tab();
    await waitFor(() => expect(patches()).toHaveLength(1), { timeout: 300 });
    expect(patches()[0]?.body).toEqual({ caloriesOut: 2600 });
  });

  test("the calendar cell and net update as values are saved", async () => {
    const { user, panel } = await openDesktop();
    await user.type(within(panel).getByLabelText("Calories in"), "1850");
    await user.type(within(panel).getByLabelText("Calories out"), "2600");
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

  test.each([
    ["Calories in", "abc", "Enter a number"],
    ["Calories in", "-5", "Enter a number"],
    ["Calories in", "12.5", "Calories must be a whole number"],
    ["Calories in", "25000", "Calories must be at most 20000"],
    ["Weight", "182.45", "Weight allows one decimal place"],
    ["Weight", "20", "Weight must be at least 50 lbs"],
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
  async function openAddForm() {
    const r = await openDesktop();
    await r.user.click(within(r.panel).getByRole("button", { name: "Add exercise" }));
    const form = await within(r.panel).findByRole("form", { name: "Add exercise" });
    return { ...r, form };
  }

  test("with no labels, points to the labels page", async () => {
    const { user, panel } = await openDesktop();
    await user.click(within(panel).getByRole("button", { name: "Add exercise" }));
    expect(await within(panel).findByText("No exercise labels yet.")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Create labels" })).toHaveAttribute(
      "href",
      "/labels",
    );
  });

  test("pick a label, enter an amount: the unit comes from the label", async () => {
    fake.addType("Pushups", "reps");
    fake.addType("Walking", "miles");
    const { user, panel, form } = await openAddForm();

    const add = within(form).getByRole("button", { name: "Add" });
    expect(add).toBeDisabled();
    await user.click(within(form).getByRole("radio", { name: "Walking (miles)" }));
    expect(within(form).getByText("miles")).toBeInTheDocument();
    await user.type(within(form).getByLabelText("Amount"), "3");
    await user.click(add);

    expect(
      await within(panel).findByRole("button", { name: "Delete Walking – 3 miles" }),
    ).toBeInTheDocument();
    expect(fake.state.requests.at(-1)?.body).toEqual({ exerciseTypeId: 2, amount: 3 });
    expect(within(panel).queryByRole("form", { name: "Add exercise" })).toBeNull();
    await waitFor(() => expect(cell("2026-10-02")).toHaveAccessibleName(/1 exercise/));
  });

  test("picking a label jumps to the amount field", async () => {
    fake.addType("Walking", "miles");
    const { user, form } = await openAddForm();
    await user.click(within(form).getByRole("radio", { name: "Walking (miles)" }));
    expect(within(form).getByLabelText("Amount")).toHaveFocus();
  });

  test("Enter in a number field moves to the next field", async () => {
    const { user, panel } = await openDesktop();
    await user.type(within(panel).getByLabelText("Calories in"), "1850{Enter}");
    expect(within(panel).getByLabelText("Calories out")).toHaveFocus();
  });

  test("decimal amounts are allowed", async () => {
    fake.addType("Running", "km");
    const { user, panel, form } = await openAddForm();
    await user.click(within(form).getByRole("radio", { name: "Running (km)" }));
    await user.type(within(form).getByLabelText("Amount"), "5.25");
    await user.click(within(form).getByRole("button", { name: "Add" }));
    expect(
      await within(panel).findByRole("button", { name: "Delete Running – 5.25 km" }),
    ).toBeInTheDocument();
  });

  test.each([
    ["abc", "Enter a number"],
    ["0", "Amount must be more than 0"],
    ["3.125", "Amount allows two decimal places"],
    ["200000", "Amount must be at most 100000"],
  ])("amount %p is rejected with %p", async (input, message) => {
    fake.addType("Walking", "miles");
    const { user, form } = await openAddForm();
    await user.click(within(form).getByRole("radio", { name: "Walking (miles)" }));
    await user.type(within(form).getByLabelText("Amount"), input);
    expect(within(form).getByText(message)).toBeInTheDocument();
    expect(within(form).getByRole("button", { name: "Add" })).toBeDisabled();
  });

  test("Add needs both a label and an amount", async () => {
    fake.addType("Walking", "miles");
    const { user, form } = await openAddForm();
    await user.type(within(form).getByLabelText("Amount"), "3");
    expect(within(form).getByRole("button", { name: "Add" })).toBeDisabled();
    await user.click(within(form).getByRole("radio", { name: "Walking (miles)" }));
    expect(within(form).getByRole("button", { name: "Add" })).toBeEnabled();
  });

  test("the picker lists recently used labels first", async () => {
    const a = fake.addType("Pushups");
    const b = fake.addType("Situps");
    fake.addType("Yoga", "minutes");
    fake.addEntry("2026-09-01", a.id);
    fake.addEntry("2026-09-20", b.id);
    const { form } = await openAddForm();
    expect(
      within(form)
        .getAllByRole("radio")
        .map((r) => r.textContent),
    ).toEqual(["Situps (reps)", "Pushups (reps)", "Yoga (minutes)"]);
  });

  test("the same exercise with different units appears as separate choices", async () => {
    fake.addType("Walking", "miles");
    fake.addType("Walking", "minutes");
    const { form } = await openAddForm();
    expect(
      within(form)
        .getAllByRole("radio")
        .map((r) => r.textContent),
    ).toEqual(["Walking (miles)", "Walking (minutes)"]);
  });

  test("archived labels are not offered", async () => {
    fake.addType("Yoga", "minutes", true);
    fake.addType("Running", "miles");
    const { form } = await openAddForm();
    expect(
      within(form)
        .getAllByRole("radio")
        .map((r) => r.textContent),
    ).toEqual(["Running (miles)"]);
  });

  test("edits an entry's label and amount", async () => {
    const walk = fake.addType("Walking", "miles");
    fake.addType("Running", "miles");
    fake.addEntry("2026-10-02", walk.id, 3);
    const { user, panel } = await openDesktop();
    await user.click(await within(panel).findByRole("button", { name: "Edit Walking – 3 miles" }));
    const form = within(panel).getByRole("form", { name: "Edit Walking – 3 miles" });
    expect(within(form).getByRole("radio", { name: "Walking (miles)" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(within(form).getByLabelText("Amount")).toHaveValue("3");
    await user.click(within(form).getByRole("radio", { name: "Running (miles)" }));
    const amount = within(form).getByLabelText("Amount");
    await user.clear(amount);
    await user.type(amount, "2.5");
    await user.click(within(form).getByRole("button", { name: "Save" }));
    expect(
      await within(panel).findByRole("button", { name: "Delete Running – 2.5 miles" }),
    ).toBeInTheDocument();
  });

  test("deletes an entry", async () => {
    const walk = fake.addType("Walking", "miles");
    fake.addEntry("2026-10-02", walk.id, 3);
    const { user, panel } = await openDesktop();
    await user.click(
      await within(panel).findByRole("button", { name: "Delete Walking – 3 miles" }),
    );
    expect(await within(panel).findByText("No exercise logged.")).toBeInTheDocument();
  });

  test("an entry with an archived label is marked and still editable", async () => {
    const yoga = fake.addType("Yoga", "minutes", true);
    fake.addEntry("2026-10-02", yoga.id, 60);
    const { user, panel } = await openDesktop();
    expect(await within(panel).findByText("(archived)")).toBeInTheDocument();
    await user.click(within(panel).getByRole("button", { name: "Edit Yoga – 60 minutes" }));
    expect(within(panel).getByRole("radio", { name: "Yoga (minutes)" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("cancel closes the form without saving", async () => {
    fake.addType("Walking", "miles");
    const { user, panel, form } = await openAddForm();
    await user.click(within(form).getByRole("button", { name: "Cancel" }));
    expect(within(panel).queryByRole("form", { name: "Add exercise" })).toBeNull();
    expect(fake.state.requests).toHaveLength(0);
  });
});
