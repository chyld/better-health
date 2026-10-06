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
    category: within(form).getByLabelText("Category"),
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

  test("adds a label with its category, and no unit", async () => {
    const { user } = renderApp("/labels");
    const f = await addForm();
    expect(within(f.form).queryByLabelText("Unit")).toBeNull();
    await user.type(f.name, "  Running ");
    await user.type(f.category, " cardio ");
    await user.click(f.add);
    await waitFor(() => expect(activeNames()).toEqual(["Running · cardio"]));
    expect(fake.state.requests.at(-1)?.body).toEqual({ name: "Running", category: "cardio" });
    expect(f.name).toHaveValue("");
    expect(f.category).toHaveValue("");

    await user.type(f.name, "Squats");
    await user.type(f.category, "strength{Enter}");
    await waitFor(() => expect(activeNames()).toEqual(["Running · cardio", "Squats · strength"]));
  });

  test("Add needs a name and a category", async () => {
    const { user } = renderApp("/labels");
    const f = await addForm();
    await user.type(f.name, "Walking");
    expect(f.add).toBeDisabled();
    await user.type(f.category, "   ");
    expect(f.add).toBeDisabled();
    await user.type(f.category, "cardio");
    expect(f.add).toBeEnabled();
  });

  test("suggests the categories already in use", async () => {
    fake.addType("Walking", { category: "cardio" });
    fake.addType("Squats", { category: "strength" });
    fake.addType("Running", { category: "Cardio" });
    renderApp("/labels");
    const f = await addForm();
    await screen.findByText("Squats");
    const list = document.getElementById(f.category.getAttribute("list") ?? "");
    expect([...(list?.querySelectorAll("option") ?? [])].map((o) => o.value)).toEqual([
      "cardio",
      "strength",
    ]);
  });

  test("a label from before categories asks for one", async () => {
    fake.addType("Steps", { category: "" });
    renderApp("/labels");
    expect(await screen.findByText(/no category, edit to add one/)).toBeInTheDocument();
  });

  test("edits a label's category", async () => {
    fake.addType("Steps", { category: "" });
    const { user } = renderApp("/labels");
    await user.click(await screen.findByRole("button", { name: "Edit Steps" }));
    const form = screen.getByRole("form", { name: "Edit Steps" });
    expect(within(form).getByRole("button", { name: "Save" })).toBeDisabled();
    await user.type(within(form).getByLabelText("Category"), "cardio{Enter}");
    await waitFor(() => expect(activeNames()).toEqual(["Steps · cardio"]));
    expect(fake.state.requests.at(-1)?.body).toEqual({ name: "Steps", category: "cardio" });
  });

  test("shows the server's message for a duplicate", async () => {
    fake.addType("Walking");
    const { user } = renderApp("/labels");
    const f = await addForm();
    await user.type(f.name, "walking");
    await user.type(f.category, "cardio{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent('"walking" already exists');
  });

  test("edits a label's name", async () => {
    fake.addType("Walk");
    const { user } = renderApp("/labels");
    await user.click(await screen.findByRole("button", { name: "Edit Walk" }));
    const form = screen.getByRole("form", { name: "Edit Walk" });
    const name = within(form).getByLabelText("Exercise");
    await user.clear(name);
    await user.type(name, "Walking{Enter}");
    await waitFor(() => expect(activeNames()).toEqual(["Walking · cardio"]));
  });

  test("Escape cancels an edit", async () => {
    fake.addType("Walk");
    const { user } = renderApp("/labels");
    await user.click(await screen.findByRole("button", { name: "Edit Walk" }));
    const form = screen.getByRole("form", { name: "Edit Walk" });
    await user.type(within(form).getByLabelText("Exercise"), "xyz{Escape}");
    expect(activeNames()).toEqual(["Walk · cardio"]);
    expect(fake.state.requests).toHaveLength(0);
  });

  test("reorders with up and down", async () => {
    fake.addType("A");
    fake.addType("B");
    fake.addType("C");
    const { user } = renderApp("/labels");
    expect(await screen.findByRole("button", { name: "Move A up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move C down" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Move C up" }));
    await waitFor(() => expect(activeNames()).toEqual(["A · cardio", "C · cardio", "B · cardio"]));
    await user.click(screen.getByRole("button", { name: "Move A down" }));
    await waitFor(() => expect(activeNames()).toEqual(["C · cardio", "A · cardio", "B · cardio"]));
  });

  test("archives and unarchives", async () => {
    fake.addType("Yoga");
    fake.addType("Running");
    const { user } = renderApp("/labels");
    await user.click(await screen.findByRole("button", { name: "Archive Yoga" }));
    await waitFor(() => expect(activeNames()).toEqual(["Running · cardio"]));
    const archived = screen.getByRole("list", { name: "Archived" });
    expect(within(archived).getByText("Yoga")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Unarchive Yoga" }));
    await waitFor(() => expect(screen.queryByRole("list", { name: "Archived" })).toBeNull());
    expect(activeNames()).toEqual(["Yoga · cardio", "Running · cardio"]);
  });

  test("there is no delete", async () => {
    fake.addType("Yoga");
    renderApp("/labels");
    await screen.findByText("Yoga");
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
  });
});
