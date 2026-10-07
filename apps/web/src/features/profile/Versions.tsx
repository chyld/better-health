import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api";
import { cn } from "@/lib/utils";

export const CLIENT_VERSION = __APP_VERSION__;

/**
 * The web app's and the server's versions. They differ when the page is an old copy (e.g.
 * from the offline cache) talking to a newer server; a reload fixes that.
 */
export function Versions() {
  const server = useQuery({
    queryKey: ["server-version"],
    queryFn: async () => (await unwrap(api.health.$get())).version,
    staleTime: 60_000,
  });
  const mismatch = server.isSuccess && server.data !== CLIENT_VERSION;
  return (
    <section
      aria-label="Versions"
      className={cn(
        "flex flex-wrap items-center justify-end gap-2 pt-2 text-xs text-muted-foreground",
        mismatch && "text-amber-800",
      )}
    >
      <span>
        client <span className="font-mono">{CLIENT_VERSION}</span>
        {" · "}server{" "}
        <span className="font-mono">
          {server.isSuccess ? server.data : server.isError ? "unreachable" : "…"}
        </span>
      </span>
      {mismatch && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900 hover:bg-amber-200"
        >
          Reload to update
        </button>
      )}
    </section>
  );
}
