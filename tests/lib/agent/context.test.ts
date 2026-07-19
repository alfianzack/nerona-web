import { describe, expect, it } from "vitest";
import { buildSystemPrompt, toClaudeHistory } from "@/lib/agent/context";

describe("toClaudeHistory", () => {
  it("maps inbound messages to the user role and outbound to assistant", () => {
    const result = toClaudeHistory([
      { direction: "in", body: "halo" },
      { direction: "out", body: "hai, ada yang bisa dibantu?" },
    ]);

    expect(result).toEqual([
      { role: "user", content: "halo" },
      { role: "assistant", content: "hai, ada yang bisa dibantu?" },
    ]);
  });
});

describe("buildSystemPrompt", () => {
  const fixedNow = new Date("2026-07-19T09:30:00Z");

  it("includes the business name and formatted date/time", () => {
    const prompt = buildSystemPrompt({
      businessName: "Toko Keripik Bu Sari",
      timezone: "Asia/Jakarta",
      facts: [],
      now: fixedNow,
    });

    expect(prompt).toContain("Toko Keripik Bu Sari");
    expect(prompt).toContain("2026");
  });

  it("falls back to a generic label when businessName is null", () => {
    const prompt = buildSystemPrompt({
      businessName: null,
      timezone: "Asia/Jakarta",
      facts: [],
      now: fixedNow,
    });

    expect(prompt).toContain("bisnis Anda");
  });

  it("lists each fact on its own bullet line", () => {
    const prompt = buildSystemPrompt({
      businessName: "Toko A",
      timezone: "Asia/Jakarta",
      facts: ["Supplier utama: Pak Budi", "Toko tutup jam 9 malam"],
      now: fixedNow,
    });

    expect(prompt).toContain("- Supplier utama: Pak Budi");
    expect(prompt).toContain("- Toko tutup jam 9 malam");
  });

  it("shows a placeholder when there are no facts yet", () => {
    const prompt = buildSystemPrompt({
      businessName: "Toko A",
      timezone: "Asia/Jakarta",
      facts: [],
      now: fixedNow,
    });

    expect(prompt).toContain("belum ada catatan yang diingat");
  });
});
