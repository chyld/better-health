import { createMemoryHistory } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App, createQueryClient } from "@/App";

export const TODAY = "2026-10-02";

/** Renders the whole app at a path, with a fixed "today". */
export function renderApp(path = "/", { today = TODAY } = {}) {
  const history = createMemoryHistory({ initialEntries: [path] });
  const queryClient = createQueryClient();
  const user = userEvent.setup();
  const utils = render(<App queryClient={queryClient} history={history} today={() => today} />);
  return { ...utils, user, history, queryClient, screen };
}
