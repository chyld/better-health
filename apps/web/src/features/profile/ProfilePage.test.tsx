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
        operator: "<=",
        target: 199.5,
        color: "blue",
        sortOrder: 0,
      },
    ]);
    expect(within(form).getByLabelText("Amount")).toHaveValue("");
  });

  test("offers exercise labels as metrics and accepts negative amounts", async () => {
    const walking = fake.addType("Walking", "miles", false, "cardio");
    fake.addType("Old", "reps", true);
    const { user } = renderApp("/profile");
    const form = await screen.findByRole("form", { name: "Add highlight" });
    const metric = within(form).getByLabelText("Metric");
    await within(metric).findByRole("option", { name: "Walking · cardio · miles" });
    // Archived labels are not offered.
    expect(within(metric).queryByRole("option", { name: /Old/ })).toBeNull();

    await user.selectOptions(metric, "Walking · cardio · miles");
    await user.selectOptions(within(form).getByLabelText("Condition"), "≥");
    await user.type(within(form).getByLabelText("Amount"), "3");
    await user.click(within(form).getByRole("button", { name: "Add highlight" }));
    await waitFor(() =>
      expect(fake.state.highlights[0]).toMatchObject({
        metric: "exercise",
        exerciseTypeId: walking.id,
        operator: ">=",
        target: 3,
        color: "green",
      }),
    );
    expect(await screen.findByText("Walking (miles) ≥ 3 miles")).toBeInTheDocument();

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
      operator: "<",
      target: 200,
      color: "green",
    });
    fake.addHighlight({
      metric: "in",
      exerciseTypeId: null,
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
      operator: ">",
      target: 2500,
      color: "red",
    });
    fake.addHighlight({
      metric: "weight",
      exerciseTypeId: null,
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

  test("exercise rules add up the day's entries for that label", async () => {
    const walking = fake.addType("Walking", "miles");
    const yoga = fake.addType("Yoga", "minutes");
    fake.addEntry("2026-10-01", walking.id, 2);
    fake.addEntry("2026-10-01", walking.id, 1.5);
    fake.addEntry("2026-10-02", walking.id, 2);
    fake.addEntry("2026-10-02", yoga.id, 60);
    fake.addHighlight({
      metric: "exercise",
      exerciseTypeId: walking.id,
      operator: ">=",
      target: 3,
      color: "blue",
    });
    renderApp("/");
    await screen.findByRole("grid");

    await waitFor(() => expect(cell("2026-10-01")).toHaveAttribute("data-highlight", "blue"));
    await waitFor(() =>
      expect(cell("2026-10-01")).toHaveAccessibleName(/highlighted: Walking \(miles\) ≥ 3 miles$/),
    );
    expect(cell("2026-10-02")).not.toHaveAttribute("data-highlight");
  });
});
