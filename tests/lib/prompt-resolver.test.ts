import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    promptPreset: { findFirst: vi.fn() },
    setting: { findMany: vi.fn() },
  },
}));

import { resolveMetadataPrompt } from "@/lib/extension/prompt-resolver";
import { buildMetadataPrompt } from "@/lib/extension/prompts";
import { prisma } from "@/lib/prisma";

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.promptPreset.findFirst as any).mockResolvedValue(null);
  (prisma.setting.findMany as any).mockResolvedValue([]);
});

function activePreset(body: string, name = "Wedding") {
  (prisma.promptPreset.findFirst as any).mockResolvedValue({
    id: "preset-1",
    userId: "user-1",
    name,
    body,
    isActive: true,
  });
}

function settings(map: Record<string, string>) {
  (prisma.setting.findMany as any).mockResolvedValue(
    Object.entries(map).map(([key, value]) => ({ key, value }))
  );
}

describe("resolveMetadataPrompt without an active preset", () => {
  it("produces the exact prompt the builder produces today", async () => {
    const resolved = await resolveMetadataPrompt({
      userId: "user-1",
      marketplace: "Adobe Stock",
      promptMode: "advanced",
    });
    const today = buildMetadataPrompt({ marketplace: "Adobe Stock", promptMode: "advanced" });
    expect(resolved.prompt).toBe(today.prompt);
    expect(resolved.maxTokens).toBe(today.maxTokens);
  });

  it("falls back to the default when the user's only preset is inactive", async () => {
    (prisma.promptPreset.findFirst as any).mockResolvedValue(null); // findFirst filters on isActive
    const resolved = await resolveMetadataPrompt({
      userId: "user-1",
      marketplace: "Adobe Stock",
      promptMode: "advanced",
    });
    expect(resolved.prompt).toBe(
      buildMetadataPrompt({ marketplace: "Adobe Stock", promptMode: "advanced" }).prompt
    );
  });

  it("only ever looks for an active preset belonging to this user", async () => {
    await resolveMetadataPrompt({ userId: "user-9", marketplace: "Adobe Stock" });
    const where = (prisma.promptPreset.findFirst as any).mock.calls[0][0].where;
    expect(where).toEqual({ userId: "user-9", isActive: true });
  });

  it("prefers the Setting override over the code constant", async () => {
    settings({ prompt_metadata_advanced: "Prompt Nerona versi baru." });
    const resolved = await resolveMetadataPrompt({
      userId: "user-1",
      marketplace: "Adobe Stock",
    });
    expect(resolved.prompt).toContain("Prompt Nerona versi baru.");
    expect(resolved.prompt).not.toContain("You are an expert AI Microstock Metadata Generator");
  });
});

describe("resolveMetadataPrompt with an active preset", () => {
  it("uses the tenant body and never a word of the Nerona prompt", async () => {
    activePreset("Kamu penulis metadata untuk niche wedding Indonesia.");
    const resolved = await resolveMetadataPrompt({
      userId: "user-1",
      marketplace: "Adobe Stock",
    });
    expect(resolved.prompt).toContain("Kamu penulis metadata untuk niche wedding Indonesia.");
    expect(resolved.prompt).not.toContain("You are an expert AI Microstock Metadata Generator");
    expect(resolved.prompt).not.toContain("You are an AI Microstock Metadata Generator");
  });

  it("appends the locked contract tail", async () => {
    activePreset("Prompt saya sendiri.");
    const resolved = await resolveMetadataPrompt({
      userId: "user-1",
      marketplace: "Adobe Stock",
    });
    expect(resolved.prompt).toContain('{"title":"","description":"","keywords":[]');
    expect(resolved.prompt).toContain("Return JSON only");
  });

  it("prefers the Setting override for the tail", async () => {
    activePreset("Prompt saya sendiri.");
    settings({ prompt_metadata_contract: "EKOR BARU: kembalikan JSON saja." });
    const resolved = await resolveMetadataPrompt({
      userId: "user-1",
      marketplace: "Adobe Stock",
    });
    expect(resolved.prompt).toContain("EKOR BARU: kembalikan JSON saja.");
    expect(resolved.prompt).not.toContain("Return JSON only (no markdown fences), exactly this shape");
  });

  it("keeps the marketplace context line", async () => {
    activePreset("Prompt saya sendiri.");
    const resolved = await resolveMetadataPrompt({
      userId: "user-1",
      marketplace: "Adobe Stock",
    });
    expect(resolved.prompt).toContain("Context marketplace: Adobe Stock.");
  });

  it("keeps the Vecteezy rules the tenant cannot be expected to know", async () => {
    activePreset("Prompt saya sendiri.");
    const resolved = await resolveMetadataPrompt({
      userId: "user-1",
      marketplace: "Vecteezy",
    });
    expect(resolved.prompt).toContain("Vecteezy: title must be a detailed descriptive phrase");
  });

  it("keeps the per-image uniqueness hint during a batch", async () => {
    activePreset("Prompt saya sendiri.");
    const resolved = await resolveMetadataPrompt({
      userId: "user-1",
      marketplace: "Adobe Stock",
      batchIndex: 3,
    });
    expect(resolved.prompt).toContain("Batch item 4");
  });

  it("puts the tenant body before the tail, so the contract has the last word", async () => {
    activePreset("Prompt saya sendiri.");
    const resolved = await resolveMetadataPrompt({
      userId: "user-1",
      marketplace: "Adobe Stock",
    });
    expect(resolved.prompt.indexOf("Prompt saya sendiri.")).toBeLessThan(
      resolved.prompt.indexOf("Return JSON only")
    );
  });

  it("bills against the advanced cap", async () => {
    activePreset("Prompt saya sendiri.");
    const resolved = await resolveMetadataPrompt({
      userId: "user-1",
      marketplace: "Adobe Stock",
      promptMode: "quick",
    });
    expect(resolved.maxTokens).toBe(
      buildMetadataPrompt({ marketplace: "Adobe Stock", promptMode: "advanced" }).maxTokens
    );
  });
});
