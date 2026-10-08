import {
  type BaseCaloriesChange,
  baseCaloriesOn,
  type DayDetail,
  type DaySummary,
  datesInMonth,
  dayCalories,
  type ExerciseType,
  type HighlightRule,
  type Measurement,
} from "@better-health/shared";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { exerciseTotals } from "@/features/day/queries";

/** A small in-memory stand-in for the API, enough for component tests. */
interface DayRow {
  caloriesIn: number | null;
  caloriesActive: number | null;
  weightLbs: number | null;
  steps: number | null;
  distanceMiles: number | null;
  note: string | null;
}
interface EntryRow {
  id: number;
  date: string;
  exerciseTypeId: number;
  measurements: Measurement[];
  createdAt: string;
}
interface TypeRow {
  id: number;
  name: string;
  category: string;
  sortOrder: number;
  archived: boolean;
}

const PASSWORD = "password123";

function createFake() {
  const state = {
    user: null as { id: number; username: string; isAdmin: boolean } | null,
    days: new Map<string, DayRow>(),
    entries: [] as EntryRow[],
    types: [] as TypeRow[],
    highlights: [] as HighlightRule[],
    /** Newest first, as the API lists them. */
    baseCalories: [] as BaseCaloriesChange[],
    /** What /api/health reports; the same as the client unless a test changes it. */
    serverVersion: __APP_VERSION__,
    nextId: 1,
    /** Every mutating request, for assertions. */
    requests: [] as { method: string; path: string; body: unknown }[],
  };

  const emptyDay = (): DayRow => ({
    caloriesIn: null,
    caloriesActive: null,
    weightLbs: null,
    steps: null,
    distanceMiles: null,
    note: null,
  });

  /** What was entered, plus the base in effect on the date, the total burn and net. */
  function calories(date: string, d: DayRow) {
    const caloriesBase = baseCaloriesOn(state.baseCalories, date);
    return {
      caloriesBase,
      ...dayCalories(d.caloriesIn, d.caloriesActive, caloriesBase),
    };
  }

  function dayDetail(date: string): DayDetail {
    const d = state.days.get(date) ?? emptyDay();
    return {
      date,
      ...d,
      ...calories(date, d),
      exercises: state.entries
        .filter((e) => e.date === date)
        .map((e) => {
          const t = state.types.find((x) => x.id === e.exerciseTypeId);
          return {
            id: e.id,
            exerciseTypeId: e.exerciseTypeId,
            name: t?.name ?? "?",
            category: t?.category ?? "",
            archived: t?.archived ?? false,
            measurements: e.measurements,
            createdAt: e.createdAt,
          };
        }),
    };
  }

  function daySummary(date: string): DaySummary {
    const d = dayDetail(date);
    return {
      date,
      caloriesIn: d.caloriesIn,
      caloriesActive: d.caloriesActive,
      caloriesBase: d.caloriesBase,
      caloriesOut: d.caloriesOut,
      net: d.net,
      weightLbs: d.weightLbs,
      steps: d.steps,
      distanceMiles: d.distanceMiles,
      exerciseCount: d.exercises.length,
      exerciseTotals: exerciseTotals(d),
      hasNote: Boolean(d.note),
    };
  }

  function typeList(includeArchived: boolean): ExerciseType[] {
    return [...state.types]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
      .filter((t) => includeArchived || !t.archived)
      .map((t) => {
        // Newest first, as the API orders them.
        const used = state.entries
          .filter((e) => e.exerciseTypeId === t.id)
          .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
        return {
          ...t,
          lastUsedOn: used[0]?.date ?? null,
          units: [...new Set(used.flatMap((e) => e.measurements.map((m) => m.unit).reverse()))],
        };
      });
  }

  const unauthorized = () =>
    HttpResponse.json(
      { error: { code: "unauthorized", message: "Not signed in" } },
      { status: 401 },
    );
  const notFound = () =>
    HttpResponse.json({ error: { code: "not_found", message: "Not found" } }, { status: 404 });

  async function record(request: Request, path: string) {
    const body =
      request.method === "DELETE"
        ? undefined
        : await request
            .clone()
            .json()
            .catch(() => undefined);
    state.requests.push({ method: request.method, path, body });
    return body;
  }

  const handlers = [
    http.get("*/api/health", () =>
      HttpResponse.json({ status: "ok", version: state.serverVersion }),
    ),
    http.post("*/api/auth/login", async ({ request }) => {
      const body = (await request.json()) as { username: string; password: string };
      if (body.password !== PASSWORD) {
        return HttpResponse.json(
          { error: { code: "invalid_credentials", message: "Invalid username or password" } },
          { status: 401 },
        );
      }
      state.user = { id: 1, username: body.username, isAdmin: false };
      return HttpResponse.json({ user: state.user });
    }),
    http.post("*/api/auth/logout", () => {
      state.user = null;
      return new HttpResponse(null, { status: 204 });
    }),
    http.get("*/api/auth/me", () =>
      state.user ? HttpResponse.json({ user: state.user }) : unauthorized(),
    ),
    http.get("*/api/admin/backup", () => {
      if (!state.user) return unauthorized();
      if (!state.user.isAdmin) {
        return HttpResponse.json(
          { error: { code: "forbidden", message: "Admins only" } },
          { status: 403 },
        );
      }
      return new HttpResponse(new Uint8Array(2048), {
        headers: {
          "content-type": "application/vnd.sqlite3",
          "content-disposition": 'attachment; filename="better-health-2026-10-02T12-00-00.db"',
        },
      });
    }),
    http.get("*/api/months/:month", ({ params }) => {
      if (!state.user) return unauthorized();
      const month = String(params.month);
      return HttpResponse.json({ month, days: datesInMonth(month).map(daySummary) });
    }),
    http.get("*/api/history", () => {
      if (!state.user) return unauthorized();
      const days = [...state.days.entries()]
        .filter(
          ([, d]) =>
            d.caloriesIn !== null ||
            d.caloriesActive !== null ||
            d.weightLbs !== null ||
            d.steps !== null ||
            d.distanceMiles !== null,
        )
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, d]) => ({
          date,
          caloriesIn: d.caloriesIn,
          caloriesActive: d.caloriesActive,
          ...calories(date, d),
          weightLbs: d.weightLbs,
          steps: d.steps,
          distanceMiles: d.distanceMiles,
        }));
      return HttpResponse.json(days);
    }),
    http.get("*/api/notes", () => {
      if (!state.user) return unauthorized();
      return HttpResponse.json(
        [...state.days.entries()]
          .filter(([, d]) => d.note?.trim())
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([date, d]) => ({ date, note: d.note })),
      );
    }),
    http.get("*/api/log", () => {
      if (!state.user) return unauthorized();
      const dates = new Set([...state.days.keys(), ...state.entries.map((e) => e.date)]);
      return HttpResponse.json(
        [...dates]
          .sort((a, b) => b.localeCompare(a))
          .map(dayDetail)
          .filter(
            (d) =>
              d.caloriesIn !== null ||
              d.caloriesActive !== null ||
              d.weightLbs !== null ||
              d.steps !== null ||
              d.distanceMiles !== null ||
              Boolean(d.note) ||
              d.exercises.length > 0,
          ),
      );
    }),
    http.get("*/api/days/:date", ({ params }) => {
      if (!state.user) return unauthorized();
      return HttpResponse.json(dayDetail(String(params.date)));
    }),
    http.patch("*/api/days/:date", async ({ request, params }) => {
      if (!state.user) return unauthorized();
      const date = String(params.date);
      const body = (await record(request, `/api/days/${date}`)) as Partial<DayRow>;
      const next = { ...(state.days.get(date) ?? emptyDay()), ...body };
      if (next.note !== undefined && next.note !== null && !next.note.trim()) next.note = null;
      state.days.set(date, next);
      return HttpResponse.json(dayDetail(date));
    }),
    http.post("*/api/days/:date/exercises", async ({ request, params }) => {
      if (!state.user) return unauthorized();
      const date = String(params.date);
      const body = (await record(request, `/api/days/${date}/exercises`)) as {
        exerciseTypeId: number;
        measurements?: Measurement[];
      };
      if (!state.types.some((t) => t.id === body.exerciseTypeId)) return notFound();
      state.entries.push({
        id: state.nextId++,
        date,
        exerciseTypeId: body.exerciseTypeId,
        measurements: body.measurements ?? [],
        createdAt: new Date().toISOString(),
      });
      return HttpResponse.json(dayDetail(date), { status: 201 });
    }),
    http.patch("*/api/days/:date/exercises/:id", async ({ request, params }) => {
      if (!state.user) return unauthorized();
      const date = String(params.date);
      const id = Number(params.id);
      const body = (await record(
        request,
        `/api/days/${date}/exercises/${id}`,
      )) as Partial<EntryRow>;
      const entry = state.entries.find((e) => e.id === id && e.date === date);
      if (!entry) return notFound();
      Object.assign(entry, body);
      return HttpResponse.json(dayDetail(date));
    }),
    http.delete("*/api/days/:date/exercises/:id", async ({ request, params }) => {
      if (!state.user) return unauthorized();
      const date = String(params.date);
      const id = Number(params.id);
      await record(request, `/api/days/${date}/exercises/${id}`);
      const before = state.entries.length;
      state.entries = state.entries.filter((e) => !(e.id === id && e.date === date));
      if (state.entries.length === before) return notFound();
      return HttpResponse.json(dayDetail(date));
    }),
    http.get("*/api/base-calories", () => {
      if (!state.user) return unauthorized();
      return HttpResponse.json(state.baseCalories);
    }),
    http.put("*/api/base-calories", async ({ request }) => {
      if (!state.user) return unauthorized();
      const body = (await record(request, "/api/base-calories")) as BaseCaloriesChange;
      state.baseCalories = [
        ...state.baseCalories.filter((c) => c.startsOn !== body.startsOn),
        body,
      ].sort((a, b) => b.startsOn.localeCompare(a.startsOn));
      return HttpResponse.json(state.baseCalories);
    }),
    http.get("*/api/highlights", () => {
      if (!state.user) return unauthorized();
      return HttpResponse.json(state.highlights);
    }),
    http.post("*/api/highlights", async ({ request }) => {
      if (!state.user) return unauthorized();
      const body = (await record(request, "/api/highlights")) as Omit<
        HighlightRule,
        "id" | "sortOrder"
      >;
      const rule = { id: state.nextId++, ...body, sortOrder: state.highlights.length };
      state.highlights.push(rule);
      return HttpResponse.json(rule, { status: 201 });
    }),
    http.put("*/api/highlights/order", async ({ request }) => {
      if (!state.user) return unauthorized();
      const { ids } = (await record(request, "/api/highlights/order")) as { ids: number[] };
      const rest = state.highlights.filter((r) => !ids.includes(r.id)).map((r) => r.id);
      state.highlights = [...ids, ...rest].flatMap((id, sortOrder) => {
        const r = state.highlights.find((x) => x.id === id);
        return r ? [{ ...r, sortOrder }] : [];
      });
      return HttpResponse.json(state.highlights);
    }),
    http.delete("*/api/highlights/:id", async ({ request, params }) => {
      if (!state.user) return unauthorized();
      const id = Number(params.id);
      await record(request, `/api/highlights/${id}`);
      if (!state.highlights.some((r) => r.id === id)) return notFound();
      state.highlights = state.highlights.filter((r) => r.id !== id);
      return HttpResponse.json(state.highlights);
    }),
    http.get("*/api/exercise-types", ({ request }) => {
      if (!state.user) return unauthorized();
      const include = new URL(request.url).searchParams.get("include") === "archived";
      return HttpResponse.json(typeList(include));
    }),
    http.post("*/api/exercise-types", async ({ request }) => {
      if (!state.user) return unauthorized();
      const body = (await record(request, "/api/exercise-types")) as {
        name: string;
        category: string;
      };
      const name = body.name.trim();
      const category = body.category.trim();
      if (state.types.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
        return HttpResponse.json(
          { error: { code: "conflict", message: `"${name}" already exists` } },
          { status: 409 },
        );
      }
      const row = {
        id: state.nextId++,
        name,
        category,
        sortOrder: state.types.length,
        archived: false,
      };
      state.types.push(row);
      return HttpResponse.json({ ...row, lastUsedOn: null, units: [] }, { status: 201 });
    }),
    http.put("*/api/exercise-types/order", async ({ request }) => {
      if (!state.user) return unauthorized();
      const { ids } = (await record(request, "/api/exercise-types/order")) as { ids: number[] };
      const rest = typeList(true)
        .filter((t) => !ids.includes(t.id))
        .map((t) => t.id);
      for (const [i, id] of [...ids, ...rest].entries()) {
        const t = state.types.find((x) => x.id === id);
        if (t) t.sortOrder = i;
      }
      return HttpResponse.json(typeList(true));
    }),
    http.patch("*/api/exercise-types/:id", async ({ request, params }) => {
      if (!state.user) return unauthorized();
      const id = Number(params.id);
      const body = (await record(request, `/api/exercise-types/${id}`)) as Partial<TypeRow>;
      const t = state.types.find((x) => x.id === id);
      if (!t) return notFound();
      Object.assign(t, body);
      return HttpResponse.json(typeList(true).find((x) => x.id === id));
    }),
  ];

  return {
    state,
    handlers,
    PASSWORD,
    signIn(username = "alice", { admin = false } = {}) {
      state.user = { id: 1, username, isAdmin: admin };
    },
    setDay(date: string, values: Partial<DayRow>) {
      state.days.set(date, { ...(state.days.get(date) ?? emptyDay()), ...values });
    },
    addType(name: string, { archived = false, category = "cardio" } = {}) {
      const row = {
        id: state.nextId++,
        name,
        category,
        sortOrder: state.types.length,
        archived,
      };
      state.types.push(row);
      return row;
    },
    addEntry(date: string, exerciseTypeId: number, measurements: Measurement[] = []) {
      const row = {
        id: state.nextId++,
        date,
        exerciseTypeId,
        measurements,
        createdAt: "2026-10-02T12:00:00Z",
      };
      state.entries.push(row);
      return row;
    },
    setBaseCalories(calories: number, startsOn: string) {
      state.baseCalories = [
        ...state.baseCalories.filter((c) => c.startsOn !== startsOn),
        { startsOn, calories },
      ].sort((a, b) => b.startsOn.localeCompare(a.startsOn));
    },
    addHighlight(rule: Omit<HighlightRule, "id" | "sortOrder">) {
      const row = { id: state.nextId++, ...rule, sortOrder: state.highlights.length };
      state.highlights.push(row);
      return row;
    },
    reset() {
      state.serverVersion = __APP_VERSION__;
      state.user = null;
      state.highlights = [];
      state.baseCalories = [];
      state.days.clear();
      state.entries = [];
      state.types = [];
      state.nextId = 1;
      state.requests = [];
    },
  };
}

export const fake = createFake();
export const server = setupServer(...fake.handlers);
