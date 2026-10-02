import type { App } from "@better-health/api/app";
import { type ClientResponse, hc } from "hono/client";

export const api = hc<App>(globalThis.location?.origin ?? "http://localhost").api;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** The body type of the 2xx members of a typed client response union. */
type SuccessBody<R> =
  R extends ClientResponse<infer T, infer S, infer _F>
    ? `${S}` extends `2${string}`
      ? T
      : never
    : never;

/** Returns the parsed body of a successful response, or throws an ApiError. */
export async function unwrap<R extends ClientResponse<unknown, number, string>>(
  response: Promise<R>,
): Promise<SuccessBody<R>> {
  const res = await response;
  if (res.ok) return (await res.json()) as SuccessBody<R>;
  let code = "unknown";
  let message = `Request failed (${res.status})`;
  try {
    const body = (await res.json()) as unknown as { error?: { code?: string; message?: string } };
    code = body.error?.code ?? code;
    message = body.error?.message ?? message;
  } catch {
    // Not JSON; keep the generic message.
  }
  throw new ApiError(res.status, code, message);
}
