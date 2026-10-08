import { createMemoryHistory } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App, createQueryClient } from "@/App";

export const TODAY = "2026-10-02";

/** Renders the whole app at a path, with a fixed "today" (noon UTC, the fake user's zone). */
export function renderApp(path = "/", { today = TODAY } = {}) {
  const history = createMemoryHistory({ initialEntries: [path] });
  const queryClient = createQueryClient();
  const user = userEvent.setup();
  const utils = render(
    <App queryClient={queryClient} history={history} now={() => new Date(`${today}T12:00:00Z`)} />,
  );
  return { ...utils, user, history, queryClient, screen };
}
