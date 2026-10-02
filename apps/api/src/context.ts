import type { Db } from "./db/client";
import type { Clock } from "./lib/clock";
import type { FailureLimiter } from "./lib/rate-limit";
import type { PublicUser } from "./services/users";

export interface Deps {
  db: Db;
  clock: Clock;
  loginLimiter: FailureLimiter;
  cookieSecure: boolean;
}

export interface AppEnv {
  Variables: { user: PublicUser };
}

export const SESSION_COOKIE = "bh_session";
