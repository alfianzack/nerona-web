import { prisma } from "@/lib/prisma";

export const MAX_ATTEMPTS = 3;

export interface AgentJobRecord {
  id: string;
  profileId: string;
  waMessageId: string;
  payload: string;
  status: string;
  attempts: number;
  lastError: string | null;
}

export async function createJob(params: {
  profileId: string;
  waMessageId: string;
  payload: string;
}): Promise<AgentJobRecord> {
  return prisma.agentJob.create({
    data: {
      profileId: params.profileId,
      waMessageId: params.waMessageId,
      payload: params.payload,
    },
  });
}

export async function beginProcessing(jobId: string): Promise<AgentJobRecord> {
  return prisma.agentJob.update({
    where: { id: jobId },
    data: { status: "processing", attempts: { increment: 1 } },
  });
}

export async function completeJob(jobId: string): Promise<void> {
  await prisma.agentJob.update({ where: { id: jobId }, data: { status: "done" } });
}

export async function failJob(
  jobId: string,
  attempts: number,
  error: string
): Promise<{ permanentlyFailed: boolean }> {
  const permanentlyFailed = attempts >= MAX_ATTEMPTS;
  await prisma.agentJob.update({
    where: { id: jobId },
    data: { status: permanentlyFailed ? "failed" : "pending", lastError: error },
  });
  return { permanentlyFailed };
}

export async function findStuckJobs(cutoff: Date): Promise<AgentJobRecord[]> {
  return prisma.agentJob.findMany({
    where: {
      status: { in: ["pending", "processing"] },
      updatedAt: { lt: cutoff },
    },
  });
}
