import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import { fake } from "../../../tests/fake-api";
import { renderApp } from "../../../tests/render";
import { setDesktop } from "../../../tests/viewport";

const cell = (date: string) =>
  document.querySelector(`button[data-date="${date}"]`) as HTMLButtonElement;

beforeEach(() => fake.signIn());

describe("keyboard on desktop", () => {
  beforeEach(() => setDesktop(true));

  test("arrow keys move the selection and focus between days", async () => {
    const { user, history } = renderApp("/");
    await screen.findByRole("grid");
    cell("2026-10-02").focus();

    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(cell("2026-10-03")).toHaveFocus());
    expect(history.location.search).toContain("day=2026-10-03");

    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(cell("2026-10-10")).toHaveFocus());
    await user.keyboard("{ArrowLeft}{ArrowUp}");
    await waitFor(() => expect(cell("2026-10-02")).toHaveFocus());
  });

  test("Home and End jump to the start and end of the week", async () => {
    const { user } = renderApp("/");
    await screen.findByRole("grid");
    cell("2026-10-14").focus();
    await user.keyboard("{Home}");
    await waitFor(() => expect(cell("2026-10-11")).toHaveFocus());
    await user.keyboard("{End}");
    await waitFor(() => expect(cell("2026-10-17")).toHaveFocus());
  });

  test("moving past the edge of the month opens the next month", async () => {
    const { user, history } = renderApp("/calendar/2026-10?day=2026-10-31");
    await screen.findByRole("grid");
    cell("2026-10-31").focus();
    await user.keyboard("{ArrowRight}");
    expect(await screen.findByRole("heading", { name: "November 2026" })).toBeInTheDocument();
    await waitFor(() => expect(cell("2026-11-01")).toHaveFocus());
    expect(history.location.pathname).toBe("/calendar/2026-11");
  });

  test("[ and ] change month, t returns to today", async () => {
    const { user, history } = renderApp("/");
    await screen.findByRole("grid");
    await user.keyboard("]");
    expect(await screen.findByRole("heading", { name: "November 2026" })).toBeInTheDocument();
    // "[[" is how user-event types one literal "[".
    await user.keyboard("[[[[");
    expect(await screen.findByRole("heading", { name: "September 2026" })).toBeInTheDocument();
    await user.keyboard("t");
    expect(await screen.findByRole("heading", { name: "October 2026" })).toBeInTheDocument();
    expect(history.location.search).toContain("day=2026-10-02");
  });

  test("e moves focus to the exercise stickers", async () => {
    fake.addType("Walking");
    const { user } = renderApp("/calendar/2026-10?day=2026-10-02");
    const panel = await screen.findByRole("complementary", { name: "Day details" });
    const sticker = await within(panel).findByRole("button", { name: "Log Walking" });
    await user.keyboard("e");
    expect(sticker).toHaveFocus();
  });

  test("e with no day open opens today at its stickers", async () => {
    fake.addType("Walking");
    const { user, history } = renderApp("/");
    await screen.findByRole("grid");
    expect(screen.queryByRole("complementary", { name: "Day details" })).toBeNull();
    await user.keyboard("e");
    const panel = await screen.findByRole("complementary", { name: "Day details" });
    await waitFor(() =>
      expect(within(panel).getByRole("button", { name: "Log Walking" })).toHaveFocus(),
    );
    expect(history.location.search).toContain("day=2026-10-02");
  });

  test("shortcuts are ignored while typing", async () => {
    const { user } = renderApp("/calendar/2026-10?day=2026-10-02");
    const panel = await screen.findByRole("complementary", { name: "Day details" });
    await user.type(await within(panel).findByLabelText("Notes"), "t]e");
    expect(screen.getByRole("heading", { name: "October 2026" })).toBeInTheDocument();
    expect(within(panel).queryByRole("form", { name: "Add exercise" })).toBeNull();
  });
});

describe("phone", () => {
  test("swiping left and right changes month", async () => {
    renderApp("/");
    await screen.findByRole("grid");
    const area = screen.getByTestId("swipe-area");
    fireEvent.touchStart(area, { touches: [{ clientX: 300, clientY: 200 }] });
    fireEvent.touchEnd(area, { changedTouches: [{ clientX: 100, clientY: 210 }] });
    expect(await screen.findByRole("heading", { name: "November 2026" })).toBeInTheDocument();

    const area2 = screen.getByTestId("swipe-area");
    fireEvent.touchStart(area2, { touches: [{ clientX: 100, clientY: 200 }] });
    fireEvent.touchEnd(area2, { changedTouches: [{ clientX: 300, clientY: 200 }] });
    expect(await screen.findByRole("heading", { name: "October 2026" })).toBeInTheDocument();
  });

  test("a mostly vertical drag is not a swipe", async () => {
    renderApp("/");
    await screen.findByRole("grid");
    const area = screen.getByTestId("swipe-area");
    fireEvent.touchStart(area, { touches: [{ clientX: 300, clientY: 100 }] });
    fireEvent.touchEnd(area, { changedTouches: [{ clientX: 200, clientY: 400 }] });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByRole("heading", { name: "October 2026" })).toBeInTheDocument();
  });

  test("the floating button opens today", async () => {
    const { user } = renderApp("/calendar/2026-07");
    await screen.findByRole("grid");
    await user.click(screen.getByRole("button", { name: "Log today" }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByRole("heading", { name: "Friday, October 2" })).toBeInTheDocument();
  });

  test("single-key shortcuts are off on phones", async () => {
    const { user } = renderApp("/");
    await screen.findByRole("grid");
    await user.keyboard("]");
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByRole("heading", { name: "October 2026" })).toBeInTheDocument();
  });

  test("the desktop shortcut hint is hidden", async () => {
    renderApp("/");
    await screen.findByRole("grid");
    expect(screen.queryByText(/Shortcuts:/)).toBeNull();
  });
});
