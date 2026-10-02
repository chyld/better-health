import {
  type DayDetail,
  type DaySummary,
  datesInMonth,
  type ExerciseType,
  netCalories,
} from "@better-health/shared";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";

/** A small in-memory stand-in for the API, enough for component tests. */
interface DayRow {
  caloriesIn: number | null;
  caloriesOut: number | null;
  weightLbs: number | null;
  note: string | null;
}
interface EntryRow {
  id: number;
  date: string;
  exerciseTypeId: number;
  note: string;
  createdAt: string;
}
interface TypeRow {
  id: number;
  name: string;
  sortOrder: number;
  archived: boolean;
}

const PASSWORD = "password123";

function createFake() {
  const state = {
    user: null as { id: number; username: string } | null,
    days: new Map<string, DayRow>(),
    entries: [] as EntryRow[],
    types: [] as TypeRow[],
    nextId: 1,
    /** Every mutating request, for assertions. */
    requests: [] as { method: string; path: string; body: unknown }[],
  };

  const emptyDay = (): DayRow => ({
    caloriesIn: null,
    caloriesOut: null,
    weightLbs: null,
    note: null,
  });

  function dayDetail(date: string): DayDetail {
    const d = state.days.get(date) ?? emptyDay();
    return {
      date,
      ...d,
      net: netCalories(d.caloriesIn, d.caloriesOut),
      exercises: state.entries
        .filter((e) => e.date === date)
        .map((e) => {
          const t = state.types.find((x) => x.id === e.exerciseTypeId);
          return {
            id: e.id,
            exerciseTypeId: e.exerciseTypeId,
            name: t?.name ?? "?",
            archived: t?.archived ?? false,
            note: e.note,
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
      caloriesOut: d.caloriesOut,
      net: d.net,
      weightLbs: d.weightLbs,
      exerciseCount: d.exercises.length,
      hasNote: Boolean(d.note),
    };
  }

  function typeList(includeArchived: boolean): ExerciseType[] {
    return [...state.types]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
      .filter((t) => includeArchived || !t.archived)
      .map((t) => ({
        ...t,
        lastUsedOn:
          state.entries
            .filter((e) => e.exerciseTypeId === t.id)
            .map((e) => e.date)
            .sort()
            .at(-1) ?? null,
      }));
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
    http.post("*/api/auth/login", async ({ request }) => {
      const body = (await request.json()) as { username: string; password: string };
      if (body.password !== PASSWORD) {
        return HttpResponse.json(
          { error: { code: "invalid_credentials", message: "Invalid username or password" } },
          { status: 401 },
        );
      }
      state.user = { id: 1, username: body.username };
      return HttpResponse.json({ user: state.user });
    }),
    http.post("*/api/auth/logout", () => {
      state.user = null;
      return new HttpResponse(null, { status: 204 });
    }),
    http.get("*/api/auth/me", () =>
      state.user ? HttpResponse.json({ user: state.user }) : unauthorized(),
    ),
    http.get("*/api/months/:month", ({ params }) => {
      if (!state.user) return unauthorized();
      const month = String(params.month);
      return HttpResponse.json({ month, days: datesInMonth(month).map(daySummary) });
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
        note?: string;
      };
      if (!state.types.some((t) => t.id === body.exerciseTypeId)) return notFound();
      state.entries.push({
        id: state.nextId++,
        date,
        exerciseTypeId: body.exerciseTypeId,
        note: body.note?.trim() ?? "",
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
    http.get("*/api/exercise-types", ({ request }) => {
      if (!state.user) return unauthorized();
      const include = new URL(request.url).searchParams.get("include") === "archived";
      return HttpResponse.json(typeList(include));
    }),
    http.post("*/api/exercise-types", async ({ request }) => {
      if (!state.user) return unauthorized();
      const body = (await record(request, "/api/exercise-types")) as { name: string };
      const name = body.name.trim();
      if (state.types.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
        return HttpResponse.json(
          { error: { code: "conflict", message: `"${name}" already exists` } },
          { status: 409 },
        );
      }
      const row = { id: state.nextId++, name, sortOrder: state.types.length, archived: false };
      state.types.push(row);
      return HttpResponse.json({ ...row, lastUsedOn: null }, { status: 201 });
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
    signIn(username = "alice") {
      state.user = { id: 1, username };
    },
    setDay(date: string, values: Partial<DayRow>) {
      state.days.set(date, { ...(state.days.get(date) ?? emptyDay()), ...values });
    },
    addType(name: string, archived = false) {
      const row = { id: state.nextId++, name, sortOrder: state.types.length, archived };
      state.types.push(row);
      return row;
    },
    addEntry(date: string, exerciseTypeId: number, note = "") {
      const row = {
        id: state.nextId++,
        date,
        exerciseTypeId,
        note,
        createdAt: "2026-10-02T12:00:00Z",
      };
      state.entries.push(row);
      return row;
    },
    reset() {
      state.user = null;
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
