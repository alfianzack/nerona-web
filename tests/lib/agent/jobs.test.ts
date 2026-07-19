import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentJob: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import {
  MAX_ATTEMPTS,
  beginProcessing,
  completeJob,
  createJob,
  failJob,
  findStuckJobs,
} from "@/lib/agent/jobs";
import { prisma } from "@/lib/prisma";

describe("createJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a pending job", async () => {
    (prisma.agentJob.create as any).mockResolvedValue({ id: "job-1" });

    const result = await createJob({
      profileId: "profile-1",
      waMessageId: "wamid.1",
      payload: "{}",
    });

    expect(result).toEqual({ id: "job-1" });
    expect(prisma.agentJob.create).toHaveBeenCalledWith({
      data: { profileId: "profile-1", waMessageId: "wamid.1", payload: "{}" },
    });
  });
});

describe("beginProcessing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets status to processing and increments attempts", async () => {
    (prisma.agentJob.update as any).mockResolvedValue({ id: "job-1", attempts: 1 });

    const result = await beginProcessing("job-1");

    expect(result).toEqual({ id: "job-1", attempts: 1 });
    expect(prisma.agentJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { status: "processing", attempts: { increment: 1 } },
    });
  });
});

describe("completeJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets status to done", async () => {
    await completeJob("job-1");

    expect(prisma.agentJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { status: "done" },
    });
  });
});

describe("failJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets status back to pending when attempts is below MAX_ATTEMPTS", async () => {
    const result = await failJob("job-1", MAX_ATTEMPTS - 1, "boom");

    expect(result).toEqual({ permanentlyFailed: false });
    expect(prisma.agentJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { status: "pending", lastError: "boom" },
    });
  });

  it("sets status to failed when attempts has reached MAX_ATTEMPTS", async () => {
    const result = await failJob("job-1", MAX_ATTEMPTS, "boom");

    expect(result).toEqual({ permanentlyFailed: true });
    expect(prisma.agentJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { status: "failed", lastError: "boom" },
    });
  });
});

describe("findStuckJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries pending/processing jobs older than the cutoff", async () => {
    const cutoff = new Date("2026-07-19T00:00:00Z");
    (prisma.agentJob.findMany as any).mockResolvedValue([{ id: "job-1" }]);

    const result = await findStuckJobs(cutoff);

    expect(result).toEqual([{ id: "job-1" }]);
    expect(prisma.agentJob.findMany).toHaveBeenCalledWith({
      where: {
        status: { in: ["pending", "processing"] },
        updatedAt: { lt: cutoff },
      },
    });
  });
});
