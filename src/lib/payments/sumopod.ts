import { createHmac, timingSafeEqual } from "crypto";

/**
 * Klien SumoPod Managed Payment — hanya QRIS.
 *
 * Berkas ini tidak menyentuh prisma dan tidak tahu apa-apa soal order Nerona.
 * Yang tinggal di sini cuma bentuk kontrak SumoPod dan aturan tanda tangannya,
 * supaya bagian yang paling mudah salah — verifikasi HMAC — bisa dites tanpa
 * basis data dan tanpa HTTP.
 */

/**
 * `payment_method_type_code` untuk QRIS.
 *
 * **`QRIS` huruf besar** — mengikuti contoh permintaan di dokumentasi, yang
 * menuliskannya begitu. Sempat saya ubah jadi `qris` karena daftar Supported
 * Payment Methods menampilkan chip `qris` dan payload webhook memakai
 * `"payment_method": "qris"`; itu keliru. Contoh PERMINTAAN adalah tempat yang
 * berwenang soal field permintaan, dan dua tempat lain itu bicara soal hal yang
 * berbeda (kode metode di daftar, dan nama metode di balasan webhook).
 *
 * Tetap bisa ditimpa `SUMOPOD_PAY_METHOD_CODE`, supaya bacaan yang salah di
 * sini tidak pernah lagi menuntut deploy kode untuk membetulkannya.
 */
export function qrisMethodCode(): string {
  return bersihkan(process.env.SUMOPOD_PAY_METHOD_CODE) || "QRIS";
}

/** Batas maksimal yang diterima SumoPod. Lebih dari ini ditolak di sisi mereka. */
export const MAX_EXPIRES_IN_HOURS = 24;

/**
 * Permintaan yang timestamp-nya di luar jendela ini ditolak walau tanda
 * tangannya cocok.
 *
 * **24 jam, bukan 5 menit seperti rancangan awal.** Satu-satunya jalan
 * pemulihan yang SumoPod sediakan saat webhook gagal adalah kirim ulang manual
 * dari dashboard, dan kiriman ulang membawa timestamp aslinya. Jendela 5 menit
 * berarti setiap pemulihan yang dilakukan lebih dari lima menit setelah
 * kejadian — yaitu hampir semuanya, karena manusia harus menyadarinya dulu —
 * ditolak diam-diam sebagai "stale". Penjagaan yang mematikan satu-satunya
 * jalan pemulihan bukan penjagaan.
 *
 * Yang hilang karena melebarkannya kecil: penjaga sesungguhnya terhadap
 * pemutaran ulang adalah idempotensi di `handlePaymentEvent`, bukan jam ini.
 * Memutar ulang `payment.completed` yang sah cuma menghasilkan
 * `{ ok: true, note: "already" }` tanpa menyentuh apa pun.
 */
export const SIGNATURE_TOLERANCE_MS = 24 * 60 * 60 * 1000;

/**
 * Membuang spasi dan tanda kutip yang ikut tersalin.
 *
 * Berkas `.env` menyimpan nilai di antara tanda kutip dan dotenv membuangnya
 * saat membaca — tapi dashboard Vercel menyimpan apa adanya. Nilai yang
 * ditempel lengkap dengan kutipnya menghasilkan rahasia yang salah tanpa satu
 * pun gejala selain 401 yang tidak bisa dibedakan dari tanda tangan palsu.
 */
function bersihkan(nilai: string | undefined): string {
  const teks = (nilai || "").trim();
  const berkutip =
    teks.length >= 2 &&
    ((teks.startsWith('"') && teks.endsWith('"')) || (teks.startsWith("'") && teks.endsWith("'")));
  return berkutip ? teks.slice(1, -1).trim() : teks;
}

export { bersihkan as bersihkanNilaiEnv };

export interface SumoPodConfig {
  baseUrl: string;
  apiKey: string;
}

/**
 * Kunci hidup di env, bukan `Setting`: keduanya rahasia, dan `Setting` terbaca
 * dari panel admin. `null` berarti belum dikonfigurasi — pemanggil yang
 * memutuskan itu berarti "tombol QRIS mati", bukan "galat".
 *
 * Awalan `SUMOPOD_PAY_`, bukan `SUMOPOD_`: `SUMOPOD_API_KEY` dan
 * `SUMOPOD_BASE_URL` SUDAH dipakai layanan AI SumoPod (`ai-settings.ts`,
 * `agent/claude-client.ts`). Dua produk berbeda dari vendor yang sama, dengan
 * kunci yang berbeda — memakai nama yang sama berarti kunci AI dikirim ke
 * endpoint pembayaran, dan gagalnya berupa 401 yang menyesatkan.
 */
export function sumopodConfig(): SumoPodConfig | null {
  const baseUrl = bersihkan(process.env.SUMOPOD_PAY_API_BASE).replace(/\/+$/, "");
  const apiKey = bersihkan(process.env.SUMOPOD_PAY_API_KEY);
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
}

export interface CreatePaymentInput {
  /** `order_id` di sisi SumoPod — referensi milik kita, unik per upaya bayar. */
  reference: string;
  amount: number;
  expiresInHours?: number;
  successUrl?: string;
  cancelUrl?: string;
}

export interface CreatedPayment {
  paymentId: string;
  linkUrl: string;
  amount: number;
  fee: number | null;
  netAmount: number | null;
  status: string;
  expiresAt: Date;
  /** `payment_code` — muatan QRIS untuk QRIS, nomor rekening untuk VA. */
  paymentCode: string | null;
  paymentCodeType: string | null;
}

/**
 * Apakah sebuah `payment_code` benar-benar muatan QRIS yang bisa digambar.
 *
 * Muatan EMVCo selalu dimulai `000201` (tag 00 "Payload Format Indicator",
 * panjang 02, nilai 01). Diperiksa dari BENTUK isinya, bukan dari
 * `payment_code_type` yang namanya bisa apa saja dan tidak terdokumentasi untuk
 * QRIS — menggambar QR dari nomor rekening menghasilkan kode yang terpindai
 * rapi lalu gagal di aplikasi bank, kegagalan yang jauh lebih membingungkan
 * daripada tidak ada QR sama sekali.
 */
export function tampakMuatanQris(kode: string | null | undefined): boolean {
  const teks = (kode || "").trim();
  return teks.startsWith("000201") && teks.length >= 30;
}

export type CreatePaymentResult =
  | { ok: true; payment: CreatedPayment }
  | { ok: false; reason: "network" | "rejected" | "malformed"; detail: string };

export async function createPayment(
  cfg: SumoPodConfig,
  input: CreatePaymentInput
): Promise<CreatePaymentResult> {
  const jam = Math.min(Math.max(1, Math.floor(input.expiresInHours ?? MAX_EXPIRES_IN_HOURS)), MAX_EXPIRES_IN_HOURS);

  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}/api/v1/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": cfg.apiKey },
      body: JSON.stringify({
        order_id: input.reference,
        amount: input.amount,
        currency: "IDR",
        expires_in_hours: jam,
        payment_method_type_code: qrisMethodCode(),
        ...(input.successUrl ? { success_return_url: input.successUrl } : {}),
        ...(input.cancelUrl ? { cancel_return_url: input.cancelUrl } : {}),
      }),
    });
  } catch (err) {
    return { ok: false, reason: "network", detail: String((err as Error)?.message ?? err) };
  }

  const teks = await res.text().catch(() => "");
  if (!res.ok) {
    return { ok: false, reason: "rejected", detail: `${res.status} ${teks}`.trim() };
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(teks);
  } catch {
    return { ok: false, reason: "malformed", detail: teks.slice(0, 200) };
  }

  const paymentId = typeof body.payment_id === "string" ? body.payment_id : "";
  const linkUrl = typeof body.payment_link_url === "string" ? body.payment_link_url : "";
  const expiresAt = typeof body.expires_at === "string" ? new Date(body.expires_at) : null;

  // Ketiganya syarat minimum untuk bisa menagih: tanpa tautan tidak ada yang
  // bisa dibayar, tanpa payment_id kita tidak bisa mencocokkan apa pun, dan
  // tanpa expires_at halaman tidak bisa berkata kapan tautannya mati. Balasan
  // 200 yang tidak lengkap lebih berbahaya daripada galat — ia terlihat sukses.
  if (!paymentId || !linkUrl || !expiresAt || Number.isNaN(expiresAt.getTime())) {
    return { ok: false, reason: "malformed", detail: teks.slice(0, 200) };
  }

  return {
    ok: true,
    payment: {
      paymentId,
      linkUrl,
      amount: angka(body.amount) ?? input.amount,
      fee: angka(body.fee),
      netAmount: angka(body.net_amount),
      status: typeof body.status === "string" ? body.status : "pending",
      expiresAt,
      paymentCode: typeof body.payment_code === "string" ? body.payment_code : null,
      paymentCodeType:
        typeof body.payment_code_type === "string" ? body.payment_code_type : null,
    },
  };
}

function angka(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export interface VerifyInput {
  /** Rahasia proyek, berawalan `whsec_`. */
  secret: string;
  svixId: string | null;
  svixTimestamp: string | null;
  svixSignature: string | null;
  /** Badan MENTAH. Hasil parse-lalu-stringify tidak akan pernah cocok. */
  rawBody: string;
  now?: Date;
}

/**
 * Nama header tanda tangan, dua ejaan, dicoba berurutan.
 *
 * Spesifikasi Standard Webhooks (yang lahir dari Svix) memakai `webhook-*`,
 * sementara Svix yang dihosting memakai `svix-*` — dan pustaka resmi Svix
 * menerima keduanya. Contoh kode SumoPod menulis `svix-*`, tapi pengirimnya
 * ternyata tidak selalu memakai ejaan yang sama dengan contohnya. Menerima
 * keduanya bukan pelonggaran keamanan: yang diverifikasi tetap HMAC yang sama
 * atas isi yang sama.
 */
export const HEADER_ID = ["svix-id", "webhook-id"] as const;
export const HEADER_TIMESTAMP = ["svix-timestamp", "webhook-timestamp"] as const;
export const HEADER_SIGNATURE = ["svix-signature", "webhook-signature"] as const;

/** Nilai header pertama yang ada, dari daftar ejaan yang setara. */
export function headerPertama(
  ambil: (nama: string) => string | null,
  namaBerurutan: readonly string[]
): string | null {
  for (const nama of namaBerurutan) {
    const nilai = ambil(nama);
    if (nilai) return nilai;
  }
  return null;
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "missing_headers" | "bad_timestamp" | "stale" | "mismatch" };

/**
 * Verifikasi tanda tangan gaya Svix.
 *
 * Dipakai alih-alih `X-Webhook-Token` yang jauh lebih sederhana: token itu
 * string tetap yang sama di setiap permintaan, jadi sekali bocor (log, proxy,
 * riwayat) siapa pun bisa mengulang permintaan palsu selamanya dan tidak ada
 * apa pun di permintaan itu yang bisa kita tolak.
 */
export function verifyWebhookSignature(input: VerifyInput): VerifyResult {
  const { svixId, svixTimestamp, svixSignature, rawBody } = input;
  const secret = bersihkan(input.secret);
  if (!secret || !svixId || !svixTimestamp || !svixSignature) {
    return { ok: false, reason: "missing_headers" };
  }

  const detik = Number(svixTimestamp);
  if (!Number.isFinite(detik)) return { ok: false, reason: "bad_timestamp" };

  const sekarang = (input.now ?? new Date()).getTime();
  // Dua arah, bukan cuma masa lalu: timestamp jauh di masa depan berarti jam
  // pengirim salah atau permintaannya dikarang, dan keduanya bukan sesuatu
  // yang boleh kita proses.
  if (Math.abs(sekarang - detik * 1000) > SIGNATURE_TOLERANCE_MS) {
    return { ok: false, reason: "stale" };
  }

  const kunci = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const konten = `${svixId}.${svixTimestamp}.${rawBody}`;
  const diharapkan = createHmac("sha256", kunci).update(konten).digest("base64");

  // Header bisa berisi beberapa tanda tangan dipisah spasi (`v1,<sig> v1,<sig>`)
  // — itu yang terjadi selama ±24 jam setelah rahasia dirotasi. Cocok dengan
  // salah satunya sudah cukup.
  const daftar = svixSignature
    .split(" ")
    .map((bagian) => bagian.split(",")[1] ?? "")
    .filter(Boolean);

  for (const kandidat of daftar) {
    if (samaAman(kandidat, diharapkan)) return { ok: true };
  }
  return { ok: false, reason: "mismatch" };
}

/**
 * Verifikasi lewat `X-Webhook-Token` — cadangan untuk pengirim yang tidak
 * menandatangani permintaannya.
 *
 * **Lebih lemah daripada tanda tangan, dan itu bukan pendapat**: tokennya
 * string tetap yang sama di setiap permintaan, tanpa timestamp dan tanpa
 * kaitan apa pun dengan isi badan. Siapa pun yang memilikinya bisa mengarang
 * `payment.completed` untuk order mana pun, kapan pun.
 *
 * Karena itu ia hanya hidup kalau `SUMOPOD_PAY_WEBHOOK_TOKEN` diisi dengan
 * sengaja. Tidak ada pelemahan yang terjadi diam-diam: server yang tidak
 * mengisinya tetap menolak semua permintaan tanpa tanda tangan.
 */
export function verifyWebhookToken(diterima: string | null, diharapkan: string): boolean {
  const a = bersihkan(diterima ?? "");
  const b = bersihkan(diharapkan);
  if (!a || !b) return false;
  return samaAman(a, b);
}

/** Panjang dibandingkan lebih dulu karena `timingSafeEqual` melempar kalau beda. */
function samaAman(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export interface PaymentEvent {
  eventType: string;
  paymentId: string;
  /** `order_id` yang kita kirim — kolom `reference` di tabel `payments`. */
  reference: string;
  amount: number | null;
  fee: number | null;
  netAmount: number | null;
  status: string;
  completedAt: Date | null;
}

/** `null` = bentuknya tidak dikenali. Pemanggil membalas 400, bukan 500. */
export function parsePaymentEvent(rawBody: string): PaymentEvent | null {
  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return null;
  }
  const eventType = typeof body?.event_type === "string" ? body.event_type : "";
  const data = body?.data;
  if (!eventType || !data || typeof data !== "object") return null;

  const reference = typeof data.order_id === "string" ? data.order_id : "";
  const paymentId = typeof data.payment_id === "string" ? data.payment_id : "";
  // `payment.test` datang tanpa order sungguhan; pemanggil menanganinya
  // sebelum menyentuh apa pun, jadi di sini ia tetap sah walau referensinya
  // kosong.
  if (!reference && eventType !== "payment.test") return null;

  const selesai = typeof data.completed_at === "string" ? new Date(data.completed_at) : null;
  return {
    eventType,
    paymentId,
    reference,
    amount: angka(data.amount),
    fee: angka(data.fee),
    netAmount: angka(data.net_amount),
    status: typeof data.status === "string" ? data.status : "",
    completedAt: selesai && !Number.isNaN(selesai.getTime()) ? selesai : null,
  };
}
