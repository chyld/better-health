/** jsdom has no layout; tests choose which media queries match. */
let desktop = false;
const listeners = new Set<() => void>();

export function setDesktop(value: boolean) {
  desktop = value;
  for (const l of listeners) l();
}

export function installMatchMedia() {
  window.matchMedia = (query: string) =>
    ({
      get matches() {
        return query.includes("min-width: 1024px") ? desktop : false;
      },
      media: query,
      onchange: null,
      addEventListener: (_: string, l: () => void) => listeners.add(l),
      removeEventListener: (_: string, l: () => void) => listeners.delete(l),
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
