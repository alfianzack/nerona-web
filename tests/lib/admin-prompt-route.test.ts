import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.fn();
const getViewMock = vi.fn();
const updateMock = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/extension/prompt-settings", () => ({
  getPromptSettingsView: () => getViewMock(),
  updatePromptSettings: (...a: unknown[]) => updateMock(...(a as [])),
}));

import { GET, POST } from "@/app/api/admin/prompts/route";

function post(body: unknown): Request {
  return new Request("http://localhost/api/admin/prompts", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: "owner_admin" } });
  getViewMock.mockResolvedValue({
    advanced: "A",
    contract: "C",
    advancedOverridden: false,
    contractOverridden: false,
  });
});

describe("GET /api/admin/prompts", () => {
  it("gives the owner the prompts and their override flags", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.settings.advanced).toBe("A");
    expect(json.settings.advancedOverridden).toBe(false);
  });

  it("refuses a support admin — the prompt is the product, not a support tool", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: "support" } });
    const res = await GET();
    expect(res.status).toBe(403);
    expect(getViewMock).not.toHaveBeenCalled();
  });

  it("refuses a caller with no admin role at all", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: null } });
    const res = await GET();
    expect(res.status).toBe(401);
  });
});

describe("POST /api/admin/prompts", () => {
  it("saves what the owner typed", async () => {
    const res = await POST(post({ advanced: "Prompt baru", contract: "Ekor baru" }));
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith({ advanced: "Prompt baru", contract: "Ekor baru" });
  });

  it("treats a blank field as 'back to the built-in default'", async () => {
    await POST(post({ advanced: "" }));
    expect(updateMock).toHaveBeenCalledWith({ advanced: "" });
  });

  it("leaves an absent field alone", async () => {
    await POST(post({ advanced: "Prompt baru" }));
    expect(updateMock).toHaveBeenCalledWith({ advanced: "Prompt baru" });
  });

  it("refuses a support admin", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: "support" } });
    const res = await POST(post({ advanced: "Prompt baru" }));
    expect(res.status).toBe(403);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
