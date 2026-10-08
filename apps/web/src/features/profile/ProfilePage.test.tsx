import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import { fake } from "../../../tests/fake-api";
import { renderApp } from "../../../tests/render";

beforeEach(() => fake.signIn());

const cell = (date: string) => document.querySelector(`[data-date="${date}"]`) as HTMLElement;

describe("profile page", () => {
  test("is reachable from the header and shows the user", async () => {
    const { user, history } = renderApp("/");
    await user.click(await screen.findByRole("link", { name: "Profile, alice" }));
    expect(await screen.findByRole("heading", { name: "Profile", level: 1 })).toBeInTheDocument();
    expect(history.location.pathname).toBe("/profile");
    expect(screen.getByRole("region", { name: "Account" })).toHaveTextContent("alice");
    expect(await screen.findByText(/No highlights yet/)).toBeInTheDocument();
  });

  test("sets the base burn from today on, keeping earlier changes", async () => {
    fake.setBaseCalories(2100, "2026-09-01");
    const { user } = renderApp("/profile");
    const form = await screen.findByRole("form", { name: "Base calorie burn" });
    const input = within(form).getByLabelText("Calories a day");
    const save = within(form).getByRole("button", { name: "Save" });
    await waitFor(() => expect(input).toHaveValue("2100"));
    expect(save).toBeDisabled();

    await user.clear(input);
    await user.type(input, "2000");
    await user.click(save);

    await waitFor(() =>
      expect(fake.state.baseCalories).toEqual([
        { startsOn: "2026-10-02", calories: 2000 },
        { startsOn: "2026-09-01", calories: 2100 },
      ]),
    );
    const changes = within(form).getByRole("list", { name: "Base burn changes" });
    expect(
      within(changes)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["2,000 cal from October 2, 2026", "2,100 cal from September 1, 2026"]);
    expect(input).toHaveValue("2000");
    expect(save).toBeDisabled();
  });

  test("explains a base burn that is not a whole number", async () => {
    const { user } = renderApp("/profile");
    const form = await screen.findByRole("form", { name: "Base calorie burn" });
    const input = within(form).getByLabelText("Calories a day");
    expect(input).toHaveValue("");
    await user.type(input, "2000.5");
    expect(input).toHaveAccessibleDescription("Enter a whole number, like 2000");
    expect(within(form).getByRole("button", { name: "Save" })).toBeDisabled();
    await user.clear(input);
    await user.type(input, "20000");
    expect(input).toHaveAccessibleDescription("Calories must be at most 10000");
  });

  test("adds a rule from metric, condition, amount and color", async () => {
    const { user } = renderApp("/profile");
    const form = await screen.findByRole("form", { name: "Add highlight" });
    const add = within(form).getByRole("button", { name: "Add highlight" });
    expect(add).toBeDisabled();

    await user.selectOptions(within(form).getByLabelText("Metric"), "Weight");
    await user.selectOptions(within(form).getByLabelText("Condition"), "≤");
    await user.type(within(form).getByLabelText("Amount"), "199.5");
    await user.click(within(form).getByRole("radio", { name: "Blue" }));
    await user.click(add);

    const list = await screen.findByRole("list", { name: "Highlights, first match wins" });
    expect(within(list).getByRole("listitem")).toHaveTextContent("Weight ≤ 199.5 lbs · Blue");
    expect(fake.state.highlights).toEqual([
      {
        id: expect.any(Number),
        metric: "weight",
        exerciseTypeId: null,
        unit: null,
        operator: "<=",
        target: 199.5,
        color: "blue",
        sortOrder: 0,
      },
    ]);
    expect(within(form).getByLabelText("Amount")).toHaveValue("");
  });

  test("steps and distance can be highlighted", async () => {
    const { user } = renderApp("/profile");
    const form = await screen.findByRole("form", { name: "Add highlight" });
    for (const [metric, amount] of [
      ["Steps", "10000"],
      ["Distance", "3.5"],
    ]) {
      await user.selectOptions(within(form).getByLabelText("Metric"), metric as string);
      await user.selectOptions(within(form).getByLabelText("Condition"), "≥");
      await user.clear(within(form).getByLabelText("Amount"));
      await user.type(within(form).getByLabelText("Amount"), amount as string);
      await user.click(within(form).getByRole("button", { name: "Add highlight" }));
      await waitFor(() => expect(within(form).getByLabelText("Amount")).toHaveValue(""));
    }
    const list = await screen.findByRole("list", { name: "Highlights, first match wins" });
    await waitFor(() =>
      expect(
        within(list)
          .getAllByRole("listitem")
          .map((li) => li.textContent),
      ).toEqual([
        expect.stringContaining("Steps ≥ 10,000 · Green"),
        expect.stringContaining("Distance ≥ 3.5 mi · Green"),
      ]),
    );
  });

  test("offers each label's count and measured units as metrics", async () => {
    const walking = fake.addType("Walking", { category: "cardio" });
    fake.addType("Old", { archived: true });
    fake.addEntry("2026-09-01", walking.id, [
      { unit: "miles", amount: 3 },
      { unit: "minutes", amount: 50 },
    ]);
    const { user } = renderApp("/profile");
    const form = await screen.findByRole("form", { name: "Add highlight" });
    const metric = within(form).getByLabelText("Metric");
    const group = await within(metric).findByRole("group", { name: "Walking · cardio" });
    expect(
      within(group)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Walking · times logged", "Walking · minutes", "Walking · miles"]);
    // Archived labels are not offered.
    expect(within(metric).queryByRole("option", { name: /Old/ })).toBeNull();

    await user.selectOptions(metric, "Walking · miles");
    await user.selectOptions(within(form).getByLabelText("Condition"), "≥");
    await user.type(within(form).getByLabelText("Amount"), "3");
    await user.click(within(form).getByRole("button", { name: "Add highlight" }));
    await waitFor(() =>
      expect(fake.state.highlights[0]).toMatchObject({
        metric: "exercise",
        exerciseTypeId: walking.id,
        unit: "miles",
        operator: ">=",
        target: 3,
        color: "green",
      }),
    );
    expect(await screen.findByText("Walking ≥ 3 miles")).toBeInTheDocument();

    await user.selectOptions(metric, "Walking · times logged");
    await user.type(within(form).getByLabelText("Amount"), "1");
    await user.click(within(form).getByRole("button", { name: "Add highlight" }));
    expect(await screen.findByText("Walking ≥ 1 time")).toBeInTheDocument();
    expect(fake.state.highlights[1]).toMatchObject({ exerciseTypeId: walking.id, unit: null });

    await user.selectOptions(metric, "Net calories");
    await user.type(within(form).getByLabelText("Amount"), "-500");
    await user.click(within(form).getByRole("button", { name: "Add highlight" }));
    expect(await screen.findByText("Net calories ≥ −500 cal")).toBeInTheDocument();
  });

  test("explains an amount that is not a number", async () => {
    const { user } = renderApp("/profile");
    const form = await screen.findByRole("form", { name: "Add highlight" });
    const amount = within(form).getByLabelText("Amount");
    await user.type(amount, "abc");
    expect(amount).toHaveAccessibleDescription("Enter a number, like 200 or -500");
    expect(within(form).getByRole("button", { name: "Add highlight" })).toBeDisabled();
    await user.clear(amount);
    await user.type(amount, "1.234");
    expect(amount).toHaveAccessibleDescription("Amount allows two decimal places");
  });

  test("reorders and deletes rules", async () => {
    fake.addHighlight({
      metric: "weight",
      exerciseTypeId: null,
      unit: null,
      operator: "<",
      target: 200,
      color: "green",
    });
    fake.addHighlight({
      metric: "in",
      exerciseTypeId: null,
      unit: null,
      operator: ">",
      target: 2500,
      color: "red",
    });
    const { user } = renderApp("/profile");
    const list = await screen.findByRole("list", { name: "Highlights, first match wins" });
    const texts = () =>
      within(list)
        .getAllByRole("listitem")
        .map((li) => li.textContent);
    expect(texts()).toEqual(["Weight < 200.0 lbs · Green", "Calories in > 2,500 cal · Red"]);
    expect(within(list).getByRole("button", { name: "Move Weight < 200.0 lbs up" })).toBeDisabled();

    await user.click(within(list).getByRole("button", { name: "Move Calories in > 2,500 cal up" }));
    await waitFor(() =>
      expect(texts()).toEqual(["Calories in > 2,500 cal · Red", "Weight < 200.0 lbs · Green"]),
    );

    await user.click(within(list).getByRole("button", { name: "Delete Calories in > 2,500 cal" }));
    await waitFor(() => expect(texts()).toEqual(["Weight < 200.0 lbs · Green"]));
  });
});

describe("calendar highlights", () => {
  test("colors days that meet a rule, first match wins", async () => {
    fake.setDay("2026-10-01", { weightLbs: 195 });
    fake.setDay("2026-10-02", { weightLbs: 182.4, caloriesIn: 3000 });
    fake.setDay("2026-10-03", { weightLbs: 205 });
    fake.setDay("2026-10-04", { caloriesIn: 1500 });
    fake.addHighlight({
      metric: "in",
      exerciseTypeId: null,
      unit: null,
      operator: ">",
      target: 2500,
      color: "red",
    });
    fake.addHighlight({
      metric: "weight",
      exerciseTypeId: null,
      unit: null,
      operator: "<",
      target: 200,
      color: "green",
    });
    renderApp("/");
    await screen.findByRole("grid");

    await waitFor(() => expect(cell("2026-10-01")).toHaveAttribute("data-highlight", "green"));
    expect(cell("2026-10-01").className).toContain("bg-green-200");
    expect(cell("2026-10-01")).toHaveAccessibleName(
      "Thursday, October 1, weight 195.0 pounds, highlighted: Weight < 200.0 lbs",
    );
    expect(cell("2026-10-02")).toHaveAttribute("data-highlight", "red");
    expect(cell("2026-10-03")).not.toHaveAttribute("data-highlight");
    // Nothing logged for weight: not "under 200".
    expect(cell("2026-10-04")).not.toHaveAttribute("data-highlight");
    expect(cell("2026-10-05")).not.toHaveAttribute("data-highlight");
  });

  test("exercise rules add up a unit, or count entries, for that label", async () => {
    const walking = fake.addType("Walking");
    const yoga = fake.addType("Yoga");
    fake.addEntry("2026-10-01", walking.id, [{ unit: "miles", amount: 2 }]);
    fake.addEntry("2026-10-01", walking.id, [{ unit: "miles", amount: 1.5 }]);
    fake.addEntry("2026-10-02", walking.id, [{ unit: "miles", amount: 2 }]);
    fake.addEntry("2026-10-02", yoga.id, [{ unit: "minutes", amount: 60 }]);
    fake.addEntry("2026-10-03", walking.id);
    fake.addHighlight({
      metric: "exercise",
      exerciseTypeId: walking.id,
      unit: "miles",
      operator: ">=",
      target: 3,
      color: "blue",
    });
    fake.addHighlight({
      metric: "exercise",
      exerciseTypeId: walking.id,
      unit: null,
      operator: ">=",
      target: 1,
      color: "green",
    });
    renderApp("/");
    await screen.findByRole("grid");

    await waitFor(() => expect(cell("2026-10-01")).toHaveAttribute("data-highlight", "blue"));
    await waitFor(() =>
      expect(cell("2026-10-01")).toHaveAccessibleName(/highlighted: Walking ≥ 3 miles$/),
    );
    // Not 3 miles, but walked: the count rule matches.
    expect(cell("2026-10-02")).toHaveAttribute("data-highlight", "green");
    expect(cell("2026-10-03")).toHaveAccessibleName(/highlighted: Walking ≥ 1 time$/);
    expect(cell("2026-10-04")).not.toHaveAttribute("data-highlight");
  });
});
