import { beforeEach, describe, expect, it, vi } from "vitest";

const { createMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: createMock },
  })),
}));

import { generateReply } from "@/lib/agent/claude-client";

describe("generateReply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the text block from Claude's response", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "text", text: "Halo! Ada yang bisa saya bantu?" }],
    });

    const reply = await generateReply({
      systemPrompt: "You are a helpful assistant.",
      history: [{ role: "user", content: "halo" }],
    });

    expect(reply).toBe("Halo! Ada yang bisa saya bantu?");
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        system: "You are a helpful assistant.",
        messages: [{ role: "user", content: "halo" }],
      })
    );
  });

  it("returns an empty string when the response has no text block", async () => {
    createMock.mockResolvedValue({ content: [] });

    const reply = await generateReply({
      systemPrompt: "You are a helpful assistant.",
      history: [{ role: "user", content: "halo" }],
    });

    expect(reply).toBe("");
  });
});
