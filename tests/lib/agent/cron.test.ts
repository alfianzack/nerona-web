import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/agent/jobs", () => ({
  findStuckJobs: vi.fn(),
}));
vi.mock("@/lib/agent/process-job", () => ({
  processJob: vi.fn(),
}));

import { runStuckJobSweep } from "@/lib/agent/cron";
import { findStuckJobs } from "@/lib/agent/jobs";
import { processJob } from "@/lib/agent/process-job";

describe("runStuckJobSweep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries with a cutoff 2 minutes before now and processes each stuck job", async () => {
    const now = new Date("2026-07-19T12:00:00Z");
    (findStuckJobs as any).mockResolvedValue([{ id: "job-1" }, { id: "job-2" }]);

    const result = await runStuckJobSweep(now);

    expect(findStuckJobs).toHaveBeenCalledWith(new Date("2026-07-19T11:58:00Z"));
    expect(processJob).toHaveBeenNthCalledWith(1, "job-1");
    expect(processJob).toHaveBeenNthCalledWith(2, "job-2");
    expect(result).toEqual({ swept: 2 });
  });

  it("returns swept: 0 when there is nothing stuck", async () => {
    (findStuckJobs as any).mockResolvedValue([]);

    const result = await runStuckJobSweep(new Date("2026-07-19T12:00:00Z"));

    expect(result).toEqual({ swept: 0 });
    expect(processJob).not.toHaveBeenCalled();
  });
});
