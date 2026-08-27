import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.fn();
const listPresetsMock = vi.fn();
const createPresetMock = vi.fn();
const updatePresetMock = vi.fn();
const activatePresetMock = vi.fn();
const useNeronaPromptMock = vi.fn();
const deletePresetMock = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prompt-presets", async () => {
  const actual = await vi.importActual<typeof import("@/lib/prompt-presets")>(
    "@/lib/prompt-presets"
  );
  return {
    ...actual,
    listPresets: (...a: unknown[]) => listPresetsMock(...(a as [])),
    createPreset: (...a: unknown[]) => createPresetMock(...(a as [])),
    updatePreset: (...a: unknown[]) => updatePresetMock(...(a as [])),
    activatePreset: (...a: unknown[]) => activatePresetMock(...(a as [])),
    useNeronaPrompt: (...a: unknown[]) => useNeronaPromptMock(...(a as [])),
    deletePreset: (...a: unknown[]) => deletePresetMock(...(a as [])),
  };
});

import { GET, POST } from "@/app/api/prompts/route";
import { DELETE, PATCH } from "@/app/api/prompts/[id]/route";
import { PromptPresetError } from "@/lib/prompt-presets";

function req(body: unknown, method = "POST"): Request {
  return new Request("http://localhost/api/prompts", {
    method,
    body: JSON.stringify(body),
  });
}

const ctx = { params: { id: "p1" } };

beforeEach(() => {
  vi.clearAllMocks();
  getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
  listPresetsMock.mockResolvedValue([]);
  createPresetMock.mockResolvedValue({ id: "p1", name: "Wedding", body: "isi", isActive: false });
});

describe("GET /api/prompts", () => {
  it("refuses an anonymous caller", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(listPresetsMock).not.toHaveBeenCalled();
  });

  it("lists only the caller's presets", async () => {
    await GET();
    expect(listPresetsMock).toHaveBeenCalledWith("user-1");
  });
});

describe("POST /api/prompts", () => {
  it("creates a preset for the caller", async () => {
    const res = await POST(req({ name: "Wedding", body: "isi" }));
    expect(res.status).toBe(200);
    expect(createPresetMock).toHaveBeenCalledWith("user-1", { name: "Wedding", body: "isi" });
  });

  it("turns a limit breach into a 400 the form can show", async () => {
    createPresetMock.mockRejectedValue(new PromptPresetError("too_many"));
    const res = await POST(req({ name: "Wedding", body: "isi" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.message).toMatch(/20/);
  });

  it("never trusts a userId sent by the client", async () => {
    await POST(req({ name: "Wedding", body: "isi", userId: "user-999" }));
    expect(createPresetMock).toHaveBeenCalledWith("user-1", { name: "Wedding", body: "isi" });
  });
});

describe("PATCH /api/prompts/[id]", () => {
  it("activates when isActive is true", async () => {
    const res = await PATCH(req({ isActive: true }, "PATCH"), ctx);
    expect(res.status).toBe(200);
    expect(activatePresetMock).toHaveBeenCalledWith("user-1", "p1");
  });

  it("goes back to the Nerona prompt when isActive is false", async () => {
    const res = await PATCH(req({ isActive: false }, "PATCH"), ctx);
    expect(res.status).toBe(200);
    expect(useNeronaPromptMock).toHaveBeenCalledWith("user-1");
    expect(deletePresetMock).not.toHaveBeenCalled();
  });

  it("edits name and body when they are sent", async () => {
    updatePresetMock.mockResolvedValue({ id: "p1", name: "Baru", body: "isi baru" });
    const res = await PATCH(req({ name: "Baru", body: "isi baru" }, "PATCH"), ctx);
    expect(res.status).toBe(200);
    expect(updatePresetMock).toHaveBeenCalledWith("user-1", "p1", { name: "Baru", body: "isi baru" });
  });

  it("answers 404 for someone else's preset", async () => {
    updatePresetMock.mockRejectedValue(new PromptPresetError("not_found"));
    const res = await PATCH(req({ name: "Baru", body: "isi" }, "PATCH"), ctx);
    expect(res.status).toBe(404);
  });

  it("refuses an anonymous caller", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const res = await PATCH(req({ isActive: true }, "PATCH"), ctx);
    expect(res.status).toBe(401);
    expect(activatePresetMock).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/prompts/[id]", () => {
  it("deletes as the caller", async () => {
    const res = await DELETE(req({}, "DELETE"), ctx);
    expect(res.status).toBe(200);
    expect(deletePresetMock).toHaveBeenCalledWith("user-1", "p1");
  });

  it("answers 404 for someone else's preset", async () => {
    deletePresetMock.mockRejectedValue(new PromptPresetError("not_found"));
    const res = await DELETE(req({}, "DELETE"), ctx);
    expect(res.status).toBe(404);
  });
});
