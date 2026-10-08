import { isEditableDate, isoDateIn, isValidIsoDate } from "@better-health/shared";
import { createMiddleware } from "hono/factory";
import type { AppEnv, Deps } from "../context";

/**
 * After requireAuth, on /days/:date routes: changes are only allowed to today and the two days
 * before it, by the date in the user's time zone. Reading any day is still allowed.
 */
export function requireEditableDay(deps: Deps) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const date = c.req.param("date");
    // An invalid date is left for the route's validation to reject.
    if (c.req.method !== "GET" && date && isValidIsoDate(date)) {
      const today = isoDateIn(deps.clock.now(), c.get("user").timeZone);
      if (!isEditableDate(date, today)) {
        return c.json(
          {
            error: {
              code: "day_locked",
              message: "Only today and the 2 days before it can be changed",
            },
          },
          403,
        );
      }
    }
    await next();
  });
}
