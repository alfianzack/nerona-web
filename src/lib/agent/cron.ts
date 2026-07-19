import { findStuckJobs } from "./jobs";
import { processJob } from "./process-job";

const STUCK_THRESHOLD_MS = 2 * 60 * 1000;

export async function runStuckJobSweep(now: Date = new Date()): Promise<{ swept: number }> {
  const cutoff = new Date(now.getTime() - STUCK_THRESHOLD_MS);
  const stuckJobs = await findStuckJobs(cutoff);

  for (const job of stuckJobs) {
    await processJob(job.id);
  }

  return { swept: stuckJobs.length };
}
