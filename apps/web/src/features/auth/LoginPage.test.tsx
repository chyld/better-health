import { screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { fake } from "../../../tests/fake-api";
import { renderApp } from "../../../tests/render";

describe("signing in", () => {
  test("signed-out visitors are sent to the login page", async () => {
    const { history } = renderApp("/");
    expect(await screen.findByRole("form", { name: "Sign in" })).toBeInTheDocument();
    expect(history.location.pathname).toBe("/login");
  });

  test("a deep link is remembered and restored after signing in", async () => {
    const { user, history } = renderApp("/labels");
    await screen.findByRole("form", { name: "Sign in" });
    expect(history.location.search).toContain("redirect");

    await user.type(screen.getByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Password"), fake.PASSWORD);
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(history.location.pathname).toBe("/labels"));
  });

  test("a successful sign-in lands on the current month", async () => {
    const { user, history } = renderApp("/login");
    await user.type(await screen.findByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Password"), fake.PASSWORD);
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(history.location.pathname).toBe("/calendar/2026-10"));
    expect(await screen.findByText("alice")).toBeInTheDocument();
  });

  test("a wrong password shows the server's message", async () => {
    const { user, history } = renderApp("/login");
    await user.type(await screen.findByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid username or password");
    expect(history.location.pathname).toBe("/login");
  });

  test("signed-in users skip the login page", async () => {
    fake.signIn();
    const { history } = renderApp("/login");
    await waitFor(() => expect(history.location.pathname).toBe("/calendar/2026-10"));
  });

  test("an invalid month in the URL falls back to the current month", async () => {
    fake.signIn();
    const { history } = renderApp("/calendar/2026-13");
    await waitFor(() => expect(history.location.pathname).toBe("/calendar/2026-10"));
  });
});

describe("signing out", () => {
  test("returns to the login page", async () => {
    fake.signIn();
    const { user, history } = renderApp("/");
    await user.click(await screen.findByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(history.location.pathname).toBe("/login"));
    expect(fake.state.user).toBeNull();
  });
});
