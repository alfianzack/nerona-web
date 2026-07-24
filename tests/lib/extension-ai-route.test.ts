import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/extension-auth", () => ({ resolveExtensionToken: vi.fn() }));
vi.mock("@/lib/extension-sync", () => ({ getExtensionAccountState: vi.fn() }));
vi.mock("@/lib/ai-settings", () => ({ getAiSettings: vi.fn() }));
vi.mock("@/lib/agent/claude-client", () => ({ chatCompletion: vi.fn() }));
vi.mock("@/lib/agent/pricing", () => ({ costForUsage: vi.fn(() => 5) }));
vi.mock("@/lib/points", () => ({ spendPoints: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ hit: vi.fn(() => ({ ok: true, remaining: 29, retryAfterSeconds: 0 })) }));

import { POST } from "@/app/api/extension/ai/route";
import { resolveExtensionToken } from "@/lib/extension-auth";
import { getExtensionAccountState } from "@/lib/extension-sync";
import { getAiSettings } from "@/lib/ai-settings";
import { chatCompletion } from "@/lib/agent/claude-client";
import { spendPoints } from "@/lib/points";
import { hit } from "@/lib/rate-limit";

function req(body: unknown, auth = "Bearer nrx_ok") {
  return new Request("http://test/api/extension/ai", {
    method: "POST",
    headers: auth ? { authorization: auth, "content-type": "application/json" } : {},
    body: JSON.stringify(body),
  });
}
const okMessages = [{ role: "user", content: "hi" }];

beforeEach(() => {
  vi.clearAllMocks();
  (resolveExtensionToken as any).mockResolvedValue({ userId: "u1" });
  (hit as any).mockReturnValue({ ok: true, remaining: 29, retryAfterSeconds: 0 });
  (getExtensionAccountState as any).mockResolvedValue({ active: true, pointsBalance: 100 });
  (getAiSettings as any).mockResolvedValue({ model: "gemini-2.0-flash", apiKey: "adminkey" });
  (chatCompletion as any).mockResolvedValue({ text: "meta", model: "gemini-2.0-flash", usage: { promptTokens: 1200, completionTokens: 150 } });
  (spendPoints as any).mockResolvedValue(95);
});

describe("POST /api/extension/ai", () => {
  it("401 without/with invalid token", async () => {
    (resolveExtensionToken as any).mockResolvedValue(null);
    expect((await POST(req(okMessages, ""))).status).toBe(401);
    expect((await POST(req(okMessages))).status).toBe(401);
  });
  it("429 when rate-limited", async () => {
    (hit as any).mockReturnValue({ ok: false, remaining: 0, retryAfterSeconds: 30 });
    expect((await POST(req({ messages: okMessages }))).status).toBe(429);
  });
  it("403 when license inactive", async () => {
    (getExtensionAccountState as any).mockResolvedValue({ active: false, pointsBalance: 100 });
    expect((await POST(req({ messages: okMessages }))).status).toBe(403);
  });
  it("402 when no points", async () => {
    (getExtensionAccountState as any).mockResolvedValue({ active: true, pointsBalance: 0 });
    expect((await POST(req({ messages: okMessages }))).status).toBe(402);
  });
  it("400 on a bad body", async () => {
    expect((await POST(req({ messages: [] }))).status).toBe(400);
    expect((await POST(req({ messages: "nope" }))).status).toBe(400);
  });
  it("200 happy path: calls chatCompletion + spendPoints, returns content/usage/balance", async () => {
    const res = await POST(req({ messages: okMessages }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, content: "meta", usage: { promptTokens: 1200, completionTokens: 150 }, pointsBalance: 95 });
    expect(chatCompletion).toHaveBeenCalledWith(expect.objectContaining({ messages: okMessages, model: "gemini-2.0-flash", apiKey: "adminkey" }));
    expect(spendPoints).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1", cost: 5 }));
  });
  it("502 and no spend when the AI call throws", async () => {
    (chatCompletion as any).mockRejectedValue(new Error("upstream"));
    const res = await POST(req({ messages: okMessages }));
    expect(res.status).toBe(502);
    expect(spendPoints).not.toHaveBeenCalled();
  });
  it("503 when the admin key is not configured", async () => {
    (getAiSettings as any).mockResolvedValue({ model: "m", apiKey: "" });
    expect((await POST(req({ messages: okMessages }))).status).toBe(503);
  });
});
