import { beforeEach, describe, expect, it, vi } from "vitest";

const { waitUntilMock } = vi.hoisted(() => ({
  waitUntilMock: vi.fn(),
}));

vi.mock("@vercel/functions", () => ({
  waitUntil: waitUntilMock,
}));

import { runInBackground } from "@/lib/agent/wait-until";

describe("runInBackground", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes a guarded promise to @vercel/functions' waitUntil", () => {
    const task = Promise.resolve("done");

    runInBackground(task);

    expect(waitUntilMock).toHaveBeenCalledTimes(1);
    expect(waitUntilMock.mock.calls[0][0]).toBeInstanceOf(Promise);
  });

  it("still lets the task run when waitUntil throws (no Vercel request context)", async () => {
    waitUntilMock.mockImplementation(() => {
      throw new Error("no request context");
    });
    let ran = false;

    runInBackground(
      new Promise<void>((resolve) => {
        ran = true;
        resolve();
      })
    );

    expect(ran).toBe(true);
  });

  it("swallows a rejection instead of causing an unhandled rejection", async () => {
    const task = Promise.reject(new Error("boom"));

    expect(() => runInBackground(task)).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
