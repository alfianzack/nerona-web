import { afterAll, beforeAll, describe, expect, it } from "vitest";

/** Rute prompt bertoken untuk Hub, terhadap Postgres sungguhan. DILEWATI tanpa NERONA_TEST_DATABASE_URL. */
const url = process.env.NERONA_TEST_DATABASE_URL;

describe.skipIf(!url)("rute prompt untuk Hub", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let daftar: typeof import("@/app/api/extension/prompts/route");
  let satu: typeof import("@/app/api/extension/prompts/[id]/route");
  let model: typeof import("@/app/api/extension/model/route");
  let coba: typeof import("@/app/api/extension/prompts/coba/route");
  const userId = "uji-hub-prompt", lain = "uji-hub-prompt-lain", TOKEN = "nrx_uji_hub_prompt", TOKEN_LAIN = "nrx_uji_hub_prompt_lain";
  const req = (url: string, method: string, token?: string, body?: unknown) =>
    new Request(`http://localhost${url}`, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });

  beforeAll(async () => {
    process.env.DATABASE_URL = url; process.env.DIRECT_URL = url;
    ({ prisma } = await import("@/lib/prisma"));
    daftar = await import("@/app/api/extension/prompts/route");
    satu = await import("@/app/api/extension/prompts/[id]/route");
    model = await import("@/app/api/extension/model/route");
    coba = await import("@/app/api/extension/prompts/coba/route");
    await prisma.user.deleteMany({ where: { id: { in: [userId, lain] } } });
    await prisma.user.createMany({ data: [{ id: userId, email: "uji-hub-prompt@contoh.invalid" }, { id: lain, email: "uji-hub-prompt-lain@contoh.invalid" }] });
    await prisma.extensionToken.createMany({ data: [{ userId, token: TOKEN }, { userId: lain, token: TOKEN_LAIN }] });
  });
  afterAll(async () => { await prisma.user.deleteMany({ where: { id: { in: [userId, lain] } } }); });

  it("tanpa token: 401 di semua rute", async () => {
    expect((await daftar.GET(req("/api/extension/prompts", "GET"))).status).toBe(401);
    expect((await daftar.POST(req("/api/extension/prompts", "POST", undefined, { name: "a", body: "b" }))).status).toBe(401);
    expect((await satu.DELETE(req("/api/extension/prompts/x", "DELETE"), { params: { id: "x" } })).status).toBe(401);
  });

  it("tanpa token: 401 di PATCH [id], PATCH model, dan POST coba", async () => {
    expect((await satu.PATCH(req("/api/extension/prompts/x", "PATCH", undefined, { isActive: true }), { params: { id: "x" } })).status).toBe(401);
    expect((await model.PATCH(req("/api/extension/model", "PATCH", undefined, { modelId: "x" }))).status).toBe(401);
    expect((await coba.POST(req("/api/extension/prompts/coba", "POST", undefined, {}))).status).toBe(401);
  });

  it("buat, aktifkan, kembali ke Nerona, hapus", async () => {
    const dibuat = await (await daftar.POST(req("/api/extension/prompts", "POST", TOKEN, { name: "Wedding", body: "Fokus wedding." }))).json();
    expect(dibuat.preset.isActive).toBe(false);
    const id = dibuat.preset.id;

    await satu.PATCH(req(`/api/extension/prompts/${id}`, "PATCH", TOKEN, { isActive: true }), { params: { id } });
    let layar = await (await daftar.GET(req("/api/extension/prompts", "GET", TOKEN))).json();
    expect(layar.presets[0]).toMatchObject({ id, isActive: true });
    // Spec: updatedAt ikut, sebagai string ISO (sama dengan GET /api/prompts web).
    expect(new Date(layar.presets[0].updatedAt).toISOString()).toBe(layar.presets[0].updatedAt);
    expect(layar.batas).toEqual({ maxPresets: 20, maxNameChars: 60, maxBodyChars: 6000 });
    expect(Array.isArray(layar.models)).toBe(true);
    expect(layar.marketplaces.length).toBeGreaterThan(0);

    await satu.PATCH(req(`/api/extension/prompts/${id}`, "PATCH", TOKEN, { isActive: false }), { params: { id } });
    layar = await (await daftar.GET(req("/api/extension/prompts", "GET", TOKEN))).json();
    expect(layar.presets[0].isActive).toBe(false);

    expect((await satu.DELETE(req(`/api/extension/prompts/${id}`, "DELETE", TOKEN), { params: { id } })).status).toBe(200);
  });

  it("galat preset membawa pesan server", async () => {
    const res = await daftar.POST(req("/api/extension/prompts", "POST", TOKEN, { name: "x".repeat(61), body: "b" }));
    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/maksimal 60/);
  });

  it("preset milik orang lain tidak bisa disentuh", async () => {
    const id = (await (await daftar.POST(req("/api/extension/prompts", "POST", TOKEN, { name: "Punyaku", body: "b" }))).json()).preset.id;
    const res = await satu.DELETE(req(`/api/extension/prompts/${id}`, "DELETE", TOKEN_LAIN), { params: { id } });
    expect(res.status).toBe(404);
  });

  it("PATCH oleh pemilik lain: 404 untuk aktifkan dan ubah", async () => {
    const id = (await (await daftar.POST(req("/api/extension/prompts", "POST", TOKEN, { name: "Milikku", body: "b" }))).json()).preset.id;
    const aktif = await satu.PATCH(req(`/api/extension/prompts/${id}`, "PATCH", TOKEN_LAIN, { isActive: true }), { params: { id } });
    expect(aktif.status).toBe(404);
    const ubah = await satu.PATCH(req(`/api/extension/prompts/${id}`, "PATCH", TOKEN_LAIN, { name: "Curian", body: "x" }), { params: { id } });
    expect(ubah.status).toBe(404);
    const layar = await (await daftar.GET(req("/api/extension/prompts", "GET", TOKEN))).json();
    expect(layar.presets.find((p: { id: string }) => p.id === id)).toMatchObject({ name: "Milikku", isActive: false });
  });
});
