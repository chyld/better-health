import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Database, Download, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError, api, unwrap } from "@/lib/api";

const FALLBACK_FILENAME = "better-health.db";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Fetches a fresh copy of the database and hands it to the browser as a file download. */
async function downloadDatabase(): Promise<{ filename: string; size: number }> {
  const res = await api.admin.backup.$get();
  // Throws an ApiError carrying the server's message.
  if (!res.ok) await unwrap(Promise.resolve(res));
  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") ?? "";
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? FALLBACK_FILENAME;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Give the browser a moment to start the download before freeing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { filename, size: blob.size };
}

/** Admin only (the route redirects everyone else): download a copy of the database. */
export function AdminPage() {
  const download = useMutation({ mutationFn: downloadDatabase });
  const error =
    download.error instanceof ApiError
      ? download.error.message
      : download.error
        ? "Could not download the database"
        : null;

  return (
    <main className="mx-auto w-full max-w-xl space-y-6 p-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="rounded-full" asChild>
          <Link to="/" aria-label="Back to calendar">
            <ArrowLeft />
          </Link>
        </Button>
        <span className="grid size-9 place-items-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-500/30">
          <ShieldCheck className="size-5" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight">Admin</h1>
      </div>

      <section
        aria-labelledby="backup-heading"
        className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-violet-100"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-100 text-sky-700">
            <Database className="size-5" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <h2 id="backup-heading" className="text-lg font-bold">
              Database backup
            </h2>
            <p className="text-sm text-muted-foreground">
              A complete copy of the database as it is right now: every user's days, exercises,
              labels and notes, and their password hashes. Keep it somewhere safe.
            </p>
          </div>
        </div>

        <Button
          size="lg"
          className="h-12 w-full text-base sm:w-auto"
          disabled={download.isPending}
          onClick={() => download.mutate()}
        >
          <Download />
          {download.isPending ? "Preparing…" : "Download database"}
        </Button>

        {download.isSuccess && (
          <p role="status" className="text-sm font-medium text-emerald-800">
            Downloaded {download.data.filename} ({formatSize(download.data.size)}).
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <p className="border-t border-violet-100 pt-4 text-xs text-muted-foreground">
          To restore: stop the app, replace <code>data/better-health.db</code> with the downloaded
          file, delete <code>better-health.db-wal</code> and <code>-shm</code> next to it, then
          start the app again.
        </p>
      </section>
    </main>
  );
}
