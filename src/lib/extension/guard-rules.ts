import { prisma } from "@/lib/prisma";

/**
 * Aturan penjaga unggahan yang bisa disunting owner.
 *
 * Rantainya DB → konstanta di kode, tanpa lapisan env, sama seperti prompt:
 * ini bukan rahasia lingkungan dan tidak ada gunanya berbeda antar-deploy.
 *
 * Alasan aturan ini tinggal di server, bukan di dalam ekstensi: batas
 * marketplace berubah tanpa memberi tahu siapa pun. Kalau tertanam di ekstensi,
 * satu-satunya jalan memperbaikinya adalah rilis baru, lalu menunggu semua
 * kontributor memperbarui. Di sini, owner mengubahnya sekali dan semua browser
 * ikut pada pengambilan berikutnya.
 *
 * Angka bawaan di bawah TIDAK dikarang: disalin dari batas yang sudah hidup di
 * prompt produksi (lihat `prompts.ts`, bagian "MARKETPLACE LIMITS", serta
 * penambah Vecteezy dan Miricanvas di `buildMetadataPrompt`). Salinan kembarnya
 * ada di `nerona_medata/guard/aturan.js` sebagai jaring pengaman waktu server
 * tak terjangkau; tanpa bundler keduanya tidak bisa disatukan, jadi yang
 * menjaganya dua berkas uji yang memaku angka yang sama.
 */
export const KEY_GUARD_RULES = "extension_guard_rules";

export interface ProfilMarketplace {
  judulMaks: number;
  keywordMaks: number;
  keywordTarget: number;
  kataMaksPerKeyword: number;
  kataTerlarang: string[];
}

export interface BobotSkor {
  relevansi: number;
  keunikan: number;
  bentuk: number;
  kepatuhan: number;
}

export interface GuardRules {
  versi: string;
  umum: ProfilMarketplace;
  perMarketplace: Record<string, Partial<ProfilMarketplace>>;
  bobot: BobotSkor;
  /** Jarak Hamming maksimal (dari 64 bit) yang masih disebut duplikat. */
  duplikatAmbang: number;
  /**
   * Sisa poin yang membuat pemeriksaan risiko otomatis menjeda diri.
   *
   * USULAN, belum dikalibrasi. Angka yang benar baru bisa dihitung setelah
   * ongkos nyata satu panggilan prompt `risiko` terukur di tagihan. Sampai itu
   * ada, 200 dipilih supaya kontributor masih punya sisa untuk beberapa kali
   * Generate Metadata, yang memang pekerjaan utamanya.
   */
  ambangPoinJeda: number;
}

const PROFIL_UMUM: ProfilMarketplace = {
  judulMaks: 120,
  keywordMaks: 40,
  keywordTarget: 5,
  kataMaksPerKeyword: 4,
  kataTerlarang: [],
};

export const DEFAULT_GUARD_RULES: GuardRules = {
  versi: "bawaan",
  umum: PROFIL_UMUM,
  perMarketplace: {
    adobe: {},
    shutterstock: {},
    magnific: {},
    dreamstime: {},
    designbundle: {},
    canva: { judulMaks: 64, keywordMaks: 20, kataMaksPerKeyword: 3, kataTerlarang: ["canva"] },
    vecteezy: { judulMaks: 200, keywordMaks: 50, kataMaksPerKeyword: 1 },
    miricanvas: { judulMaks: 100, keywordMaks: 25 },
  },
  bobot: { relevansi: 40, keunikan: 20, bentuk: 20, kepatuhan: 20 },
  duplikatAmbang: 10,
  ambangPoinJeda: 200,
};

function angkaSah(nilai: unknown): nilai is number {
  return typeof nilai === "number" && Number.isFinite(nilai) && nilai > 0;
}

function bersihkanTerlarang(nilai: unknown): string[] | null {
  if (!Array.isArray(nilai)) return null;
  return nilai
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((x) => x.trim().toLowerCase());
}

/** Serap hanya bidang yang dikenal dan nilainya masuk akal; sisanya dibiarkan. */
function serap(target: Partial<ProfilMarketplace>, sumber: unknown): void {
  if (!sumber || typeof sumber !== "object" || Array.isArray(sumber)) return;
  const src = sumber as Record<string, unknown>;
  for (const bidang of ["judulMaks", "keywordMaks", "keywordTarget", "kataMaksPerKeyword"] as const) {
    if (angkaSah(src[bidang])) target[bidang] = src[bidang];
  }
  const terlarang = bersihkanTerlarang(src.kataTerlarang);
  if (terlarang) target.kataTerlarang = terlarang;
}

function bacaBobot(nilai: unknown): BobotSkor | null {
  if (!nilai || typeof nilai !== "object" || Array.isArray(nilai)) return null;
  const src = nilai as Record<string, unknown>;
  const out: BobotSkor = { relevansi: 0, keunikan: 0, bentuk: 0, kepatuhan: 0 };
  for (const bidang of ["relevansi", "keunikan", "bentuk", "kepatuhan"] as const) {
    const v = src[bidang];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return null;
    out[bidang] = v;
  }
  // Bobot yang semuanya nol akan membuat setiap skor jadi nol, dan skor nol
  // terbaca sebagai "keywordmu jelek", bukan "bobotnya salah".
  if (out.relevansi + out.keunikan + out.bentuk + out.kepatuhan <= 0) return null;
  return out;
}

function salinBawaan(): GuardRules {
  return {
    versi: DEFAULT_GUARD_RULES.versi,
    umum: { ...PROFIL_UMUM, kataTerlarang: [...PROFIL_UMUM.kataTerlarang] },
    perMarketplace: Object.fromEntries(
      Object.entries(DEFAULT_GUARD_RULES.perMarketplace).map(([k, v]) => [
        k,
        { ...v, ...(v.kataTerlarang ? { kataTerlarang: [...v.kataTerlarang] } : {}) },
      ])
    ),
    bobot: { ...DEFAULT_GUARD_RULES.bobot },
    duplikatAmbang: DEFAULT_GUARD_RULES.duplikatAmbang,
    ambangPoinJeda: DEFAULT_GUARD_RULES.ambangPoinJeda,
  };
}

/**
 * Tidak pernah melempar. Baris Setting bisa disunting tangan, dan JSON rusak di
 * sana tidak boleh mematikan Generate Metadata; yang benar adalah kembali ke
 * bawaan dan tetap jalan.
 */
export function parseGuardRules(raw: string | null | undefined): GuardRules {
  const hasil = salinBawaan();
  if (!raw) return hasil;

  let muatan: unknown;
  try {
    muatan = JSON.parse(raw);
  } catch {
    return hasil;
  }
  if (!muatan || typeof muatan !== "object" || Array.isArray(muatan)) return hasil;

  const src = muatan as Record<string, unknown>;
  if (typeof src.versi === "string" && src.versi.trim()) hasil.versi = src.versi.trim();

  serap(hasil.umum, src.umum);

  if (src.perMarketplace && typeof src.perMarketplace === "object" && !Array.isArray(src.perMarketplace)) {
    for (const [kunci, nilai] of Object.entries(src.perMarketplace as Record<string, unknown>)) {
      const k = kunci.trim().toLowerCase();
      if (!k) continue;
      const profil: Partial<ProfilMarketplace> = { ...(hasil.perMarketplace[k] ?? {}) };
      serap(profil, nilai);
      hasil.perMarketplace[k] = profil;
    }
  }

  const bobot = bacaBobot(src.bobot);
  if (bobot) hasil.bobot = bobot;

  const ambang = src.duplikatAmbang;
  if (typeof ambang === "number" && Number.isFinite(ambang) && ambang >= 0 && ambang <= 64) {
    hasil.duplikatAmbang = ambang;
  }

  if (angkaSah(src.ambangPoinJeda)) hasil.ambangPoinJeda = src.ambangPoinJeda;

  return hasil;
}

export async function getGuardRules(): Promise<GuardRules> {
  const row = await prisma.setting.findUnique({ where: { key: KEY_GUARD_RULES } });
  return parseGuardRules(row?.value);
}
