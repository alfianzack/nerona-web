import { AiModelError, type AiModelInput } from "@/lib/ai-models";

/**
 * Membaca badan permintaan admin jadi AiModelInput.
 *
 * Tarif diperiksa DI SINI, bukan cuma di lapisan bawah: sebuah tarif yang lolos
 * sebagai NaN akan membuat setiap panggilan berikutnya ditagih 1 poin — lantai
 * costForUsage — tanpa galat di mana pun.
 */
export function parseModelInput(body: any): AiModelInput {
  const rate = (raw: unknown): number => {
    const n = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
    if (!Number.isFinite(n) || n < 0) throw new AiModelError("rate_invalid");
    return n;
  };

  return {
    label: typeof body?.label === "string" ? body.label : "",
    modelId: typeof body?.modelId === "string" ? body.modelId : "",
    note: typeof body?.note === "string" ? body.note : null,
    inPerMTok: rate(body?.inPerMTok),
    outPerMTok: rate(body?.outPerMTok),
    vision: body?.vision !== false,
    // Absen berarti terlihat: kolom paket baru tidak boleh diam-diam
    // menyembunyikan model dari siapa pun.
    planFree: body?.planFree !== false,
    planPro: body?.planPro !== false,
    planBusiness: body?.planBusiness !== false,
    active: body?.active !== false,
    providerId: typeof body?.providerId === "string" ? body.providerId : "",
    sortOrder: Number.isFinite(Number(body?.sortOrder)) ? Number(body.sortOrder) : 0,
    // Jenisnya diteruskan apa adanya; yang memutuskan "image" atau jatuh ke
    // "chat" adalah cleanInput, supaya aturannya cuma hidup di satu tempat.
    kind: typeof body?.kind === "string" ? body.kind : "chat",
    // Sengaja TIDAK lewat rate(): 0 sah untuk tarif token tapi tidak sah untuk
    // tarif per gambar, dan yang tahu bedanya cuma cleanInput yang melihat kind.
    usdPerImage:
      body?.usdPerImage === "" || body?.usdPerImage === null || body?.usdPerImage === undefined
        ? null
        : Number(body.usdPerImage),
  };
}
