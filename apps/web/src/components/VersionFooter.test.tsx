import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import { fake } from "../../tests/fake-api";
import { renderApp } from "../../tests/render";
import { CLIENT_VERSION } from "./VersionFooter";

beforeEach(() => fake.signIn());

describe("version footer", () => {
  test("shows the client's and the server's versions", async () => {
    renderApp("/");
    const footer = await screen.findByRole("contentinfo", { name: "Versions" });
    await waitFor(() =>
      expect(footer).toHaveTextContent(`client ${CLIENT_VERSION} · server ${CLIENT_VERSION}`),
    );
    expect(within(footer).queryByRole("button")).toBeNull();
  });

  test("offers a reload when the page is older or newer than the server", async () => {
    fake.state.serverVersion = "fffffff";
    renderApp("/log");
    const footer = await screen.findByRole("contentinfo", { name: "Versions" });
    expect(
      await within(footer).findByRole("button", { name: "Reload to update" }),
    ).toBeInTheDocument();
    expect(footer).toHaveTextContent(`client ${CLIENT_VERSION} · server fffffff`);
  });
});
