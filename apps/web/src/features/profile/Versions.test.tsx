import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import { fake } from "../../../tests/fake-api";
import { renderApp } from "../../../tests/render";
import { CLIENT_VERSION } from "./Versions";

beforeEach(() => fake.signIn());

describe("versions on the profile page", () => {
  test("are only on the profile page", async () => {
    renderApp("/");
    await screen.findByRole("grid");
    expect(screen.queryByRole("region", { name: "Versions" })).toBeNull();
  });

  test("shows the client's and the server's versions at the bottom", async () => {
    renderApp("/profile");
    const versions = await screen.findByRole("region", { name: "Versions" });
    await waitFor(() =>
      expect(versions).toHaveTextContent(`client ${CLIENT_VERSION} · server ${CLIENT_VERSION}`),
    );
    expect(within(versions).queryByRole("button")).toBeNull();
    // Last on the page.
    expect(screen.getByRole("main").lastElementChild).toBe(versions);
  });

  test("offers a reload when the page is older or newer than the server", async () => {
    fake.state.serverVersion = "fffffff";
    renderApp("/profile");
    const versions = await screen.findByRole("region", { name: "Versions" });
    expect(
      await within(versions).findByRole("button", { name: "Reload to update" }),
    ).toBeInTheDocument();
    expect(versions).toHaveTextContent(`client ${CLIENT_VERSION} · server fffffff`);
  });
});
