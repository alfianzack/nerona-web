import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    promptPreset: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import {
  MAX_BODY_CHARS,
  MAX_NAME_CHARS,
  MAX_PRESETS_PER_USER,
  PromptPresetError,
  activatePreset,
  createPreset,
  deletePreset,
  useNeronaPrompt,
  updatePreset,
} from "@/lib/prompt-presets";
import { prisma } from "@/lib/prisma";

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.$transaction as any).mockImplementation((ops: unknown[]) => Promise.resolve(ops));
  (prisma.promptPreset.count as any).mockResolvedValue(0);
  (prisma.promptPreset.create as any).mockImplementation(({ data }: any) =>
    Promise.resolve({ id: "new", ...data })
  );
  (prisma.promptPreset.findFirst as any).mockResolvedValue({
    id: "p1",
    userId: "user-1",
    name: "Wedding",
    body: "Prompt saya.",
    isActive: false,
  });
});

async function codeOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (err) {
    if (err instanceof PromptPresetError) return err.code;
    throw err;
  }
  return "no_error";
}

describe("createPreset", () => {
  it("stores the tenant body under the given name", async () => {
    const preset = await createPreset("user-1", { name: "Wedding", body: "Prompt saya." });
    expect(preset.name).toBe("Wedding");
    expect(preset.body).toBe("Prompt saya.");
  });

  it("creates it switched off, so nothing changes until the tenant picks it", async () => {
    await createPreset("user-1", { name: "Wedding", body: "Prompt saya." });
    expect((prisma.promptPreset.create as any).mock.calls[0][0].data.isActive).toBe(false);
  });

  it("rejects a blank name", async () => {
    expect(await codeOf(() => createPreset("user-1", { name: "  ", body: "isi" }))).toBe(
      "name_required"
    );
  });

  it("rejects a name past the limit", async () => {
    const name = "x".repeat(MAX_NAME_CHARS + 1);
    expect(await codeOf(() => createPreset("user-1", { name, body: "isi" }))).toBe("name_too_long");
  });

  it("rejects a blank body", async () => {
    expect(await codeOf(() => createPreset("user-1", { name: "Wedding", body: "   " }))).toBe(
      "body_required"
    );
  });

  it("rejects a body past the limit, because it is billed on every call", async () => {
    const body = "x".repeat(MAX_BODY_CHARS + 1);
    expect(await codeOf(() => createPreset("user-1", { name: "Wedding", body }))).toBe(
      "body_too_long"
    );
  });

  it("rejects the twenty-first preset", async () => {
    (prisma.promptPreset.count as any).mockResolvedValue(MAX_PRESETS_PER_USER);
    expect(await codeOf(() => createPreset("user-1", { name: "Wedding", body: "isi" }))).toBe(
      "too_many"
    );
  });

  it("counts only this user's presets", async () => {
    await createPreset("user-1", { name: "Wedding", body: "isi" });
    expect((prisma.promptPreset.count as any).mock.calls[0][0].where).toEqual({ userId: "user-1" });
  });
});

describe("updatePreset", () => {
  it("refuses a preset that is not the caller's", async () => {
    (prisma.promptPreset.findFirst as any).mockResolvedValue(null);
    expect(
      await codeOf(() => updatePreset("user-2", "p1", { name: "Curi", body: "isi" }))
    ).toBe("not_found");
    expect(prisma.promptPreset.update).not.toHaveBeenCalled();
  });

  it("applies the same length limits as creating one", async () => {
    const body = "x".repeat(MAX_BODY_CHARS + 1);
    expect(await codeOf(() => updatePreset("user-1", "p1", { name: "Wedding", body }))).toBe(
      "body_too_long"
    );
  });
});

describe("activatePreset", () => {
  it("switches off the tenant's other presets in the same transaction", async () => {
    await activatePreset("user-1", "p1");
    const ops = (prisma.$transaction as any).mock.calls[0][0];
    expect(ops).toHaveLength(2);
    expect((prisma.promptPreset.updateMany as any).mock.calls[0][0]).toEqual({
      where: { userId: "user-1" },
      data: { isActive: false },
    });
    expect((prisma.promptPreset.update as any).mock.calls[0][0]).toEqual({
      where: { id: "p1" },
      data: { isActive: true },
    });
  });

  it("never touches another tenant's presets", async () => {
    await activatePreset("user-1", "p1");
    expect((prisma.promptPreset.updateMany as any).mock.calls[0][0].where.userId).toBe("user-1");
  });

  it("refuses a preset that is not the caller's", async () => {
    (prisma.promptPreset.findFirst as any).mockResolvedValue(null);
    expect(await codeOf(() => activatePreset("user-2", "p1"))).toBe("not_found");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("useNeronaPrompt", () => {
  it("switches every preset off without deleting anything", async () => {
    await useNeronaPrompt("user-1");
    expect((prisma.promptPreset.updateMany as any).mock.calls[0][0]).toEqual({
      where: { userId: "user-1" },
      data: { isActive: false },
    });
    expect(prisma.promptPreset.deleteMany).not.toHaveBeenCalled();
  });
});

describe("deletePreset", () => {
  it("scopes the delete to the caller, not just the id", async () => {
    (prisma.promptPreset.deleteMany as any).mockResolvedValue({ count: 1 });
    await deletePreset("user-1", "p1");
    expect((prisma.promptPreset.deleteMany as any).mock.calls[0][0].where).toEqual({
      id: "p1",
      userId: "user-1",
    });
  });

  it("reports not_found when nothing matched", async () => {
    (prisma.promptPreset.deleteMany as any).mockResolvedValue({ count: 0 });
    expect(await codeOf(() => deletePreset("user-2", "p1"))).toBe("not_found");
  });
});
