import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import { fake } from "../../../tests/fake-api";
import { renderApp } from "../../../tests/render";

beforeEach(() => fake.signIn());

const activeNames = () =>
  within(screen.getByRole("list", { name: "Active" }))
    .getAllByRole("listitem")
    .map((li) => li.textContent);

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

  test("adds labels", async () => {
    const { user } = renderApp("/labels");
    const input = await screen.findByRole("textbox", { name: "New label" });
    await user.type(input, "  Pushups ");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(activeNames()).toEqual(["Pushups"]));
    expect(input).toHaveValue("");
    await user.type(input, "Situps{Enter}");
    await waitFor(() => expect(activeNames()).toEqual(["Pushups", "Situps"]));
  });

  test("shows the server's message for a duplicate", async () => {
    fake.addType("Yoga");
    const { user } = renderApp("/labels");
    await user.type(await screen.findByRole("textbox", { name: "New label" }), "yoga{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent('"yoga" already exists');
  });

  test("Add is disabled for a blank name", async () => {
    const { user } = renderApp("/labels");
    await user.type(await screen.findByRole("textbox", { name: "New label" }), "   ");
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });

  test("renames a label", async () => {
    fake.addType("Walk");
    const { user } = renderApp("/labels");
    await user.click(await screen.findByRole("button", { name: "Rename Walk" }));
    const input = screen.getByRole("textbox", { name: "Label name" });
    await user.clear(input);
    await user.type(input, "Walking{Enter}");
    await waitFor(() => expect(activeNames()).toEqual(["Walking"]));
  });

  test("Escape cancels a rename", async () => {
    fake.addType("Walk");
    const { user } = renderApp("/labels");
    await user.click(await screen.findByRole("button", { name: "Rename Walk" }));
    await user.type(screen.getByRole("textbox", { name: "Label name" }), "xyz{Escape}");
    expect(activeNames()).toEqual(["Walk"]);
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
    await waitFor(() => expect(activeNames()).toEqual(["A", "C", "B"]));
    await user.click(screen.getByRole("button", { name: "Move A down" }));
    await waitFor(() => expect(activeNames()).toEqual(["C", "A", "B"]));
  });

  test("archives and unarchives", async () => {
    fake.addType("Yoga");
    fake.addType("Running");
    const { user } = renderApp("/labels");
    await user.click(await screen.findByRole("button", { name: "Archive Yoga" }));
    await waitFor(() => expect(activeNames()).toEqual(["Running"]));
    const archived = screen.getByRole("list", { name: "Archived" });
    expect(within(archived).getByText("Yoga")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Unarchive Yoga" }));
    await waitFor(() => expect(screen.queryByRole("list", { name: "Archived" })).toBeNull());
    expect(activeNames()).toEqual(["Yoga", "Running"]);
  });

  test("there is no delete", async () => {
    fake.addType("Yoga");
    renderApp("/labels");
    await screen.findByText("Yoga");
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
  });
});
