import { waitUntil } from "@vercel/functions";

export function runInBackground(promise: Promise<unknown>): void {
  const guarded = promise.catch((err) => {
    console.error("[agent] background task failed", err);
  });

  try {
    waitUntil(guarded);
  } catch {
    // waitUntil requires a Vercel request context; outside one (local dev,
    // tests) the guarded promise above still runs, just fire-and-forget.
  }
}
