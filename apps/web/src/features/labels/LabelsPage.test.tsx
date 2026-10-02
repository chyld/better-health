import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import { fake } from "../../../tests/fake-api";
import { renderApp } from "../../../tests/render";

beforeEach(() => fake.signIn());

const activeNames = () =>
  within(screen.getByRole("list", { name: "Active" }))
    .getAllByRole("listitem")
    .map((li) => li.textContent);

async function addForm() {
  const form = await screen.findByRole("form", { name: "Add label" });
  return {
    form,
    name: within(form).getByLabelText("Exercise"),
    unit: within(form).getByLabelText("Unit"),
    add: within(form).getByRole("button", { name: "Add" }),
  };
}

describe("labels page", () => {
  test("is reachable from the header", async () => {
    const { user, history } = renderApp("/");
    await user.click(await screen.findByRole("link", { name: "Labels" }));
    expect(await screen.findByRole("heading", { name: "Exercise labels" })).toBeInTheDocument();
    expect(history.location.pathname).toBe("/labels");
  });

  test("starts empty", async () => {
    renderApp("/labels");
    expect(await screen.findByText("No labels yet. Add one above.")).toBeInTheDocument();
  });

  test("adds a label with its unit", async () => {
    const { user } = renderApp("/labels");
    const f = await addForm();
    await user.type(f.name, "  Walking ");
    await user.type(f.unit, " miles ");
    await user.click(f.add);
    await waitFor(() => expect(activeNames()).toEqual(["Walking · miles"]));
    expect(fake.state.requests.at(-1)?.body).toEqual({ name: "Walking", unit: "miles" });
    expect(f.name).toHaveValue("");
    expect(f.unit).toHaveValue("");

    await user.type(f.name, "Walking");
    await user.type(f.unit, "minutes{Enter}");
    await waitFor(() => expect(activeNames()).toEqual(["Walking · miles", "Walking · minutes"]));
  });

  test("Add needs both a name and a unit", async () => {
    const { user } = renderApp("/labels");
    const f = await addForm();
    await user.type(f.name, "Walking");
    expect(f.add).toBeDisabled();
    await user.type(f.unit, "   ");
    expect(f.add).toBeDisabled();
    await user.type(f.unit, "miles");
    expect(f.add).toBeEnabled();
  });

  test("shows the server's message for a duplicate", async () => {
    fake.addType("Walking", "miles");
    const { user } = renderApp("/labels");
    const f = await addForm();
    await user.type(f.name, "walking");
    await user.type(f.unit, "miles{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent('"walking (miles)" already exists');
  });

  test("edits a label's name and unit", async () => {
    fake.addType("Walk", "mi");
    const { user } = renderApp("/labels");
    await user.click(await screen.findByRole("button", { name: "Edit Walk (mi)" }));
    const form = screen.getByRole("form", { name: "Edit Walk (mi)" });
    const name = within(form).getByLabelText("Exercise");
    const unit = within(form).getByLabelText("Unit");
    await user.clear(name);
    await user.type(name, "Walking");
    await user.clear(unit);
    await user.type(unit, "miles{Enter}");
    await waitFor(() => expect(activeNames()).toEqual(["Walking · miles"]));
  });

  test("a label from before units asks for one", async () => {
    fake.addType("Pushups", "");
    renderApp("/labels");
    expect(await screen.findByText(/no unit, edit to add one/)).toBeInTheDocument();
  });

  test("Escape cancels an edit", async () => {
    fake.addType("Walk", "mi");
    const { user } = renderApp("/labels");
    await user.click(await screen.findByRole("button", { name: "Edit Walk (mi)" }));
    const form = screen.getByRole("form", { name: "Edit Walk (mi)" });
    await user.type(within(form).getByLabelText("Unit"), "xyz{Escape}");
    expect(activeNames()).toEqual(["Walk · mi"]);
    expect(fake.state.requests).toHaveLength(0);
  });

  test("reorders with up and down", async () => {
    fake.addType("A");
    fake.addType("B");
    fake.addType("C");
    const { user } = renderApp("/labels");
    expect(await screen.findByRole("button", { name: "Move A (reps) up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move C (reps) down" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Move C (reps) up" }));
    await waitFor(() => expect(activeNames()).toEqual(["A · reps", "C · reps", "B · reps"]));
    await user.click(screen.getByRole("button", { name: "Move A (reps) down" }));
    await waitFor(() => expect(activeNames()).toEqual(["C · reps", "A · reps", "B · reps"]));
  });

  test("archives and unarchives", async () => {
    fake.addType("Yoga", "minutes");
    fake.addType("Running", "miles");
    const { user } = renderApp("/labels");
    await user.click(await screen.findByRole("button", { name: "Archive Yoga (minutes)" }));
    await waitFor(() => expect(activeNames()).toEqual(["Running · miles"]));
    const archived = screen.getByRole("list", { name: "Archived" });
    expect(within(archived).getByText("Yoga")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Unarchive Yoga (minutes)" }));
    await waitFor(() => expect(screen.queryByRole("list", { name: "Archived" })).toBeNull());
    expect(activeNames()).toEqual(["Yoga · minutes", "Running · miles"]);
  });

  test("there is no delete", async () => {
    fake.addType("Yoga");
    renderApp("/labels");
    await screen.findByText("Yoga");
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
  });
});
