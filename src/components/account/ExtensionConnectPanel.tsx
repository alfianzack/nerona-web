"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface TokenRow {
  id: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

/**
 * Awalan label token yang dibuat tombol "Hubungkan extension" (label lengkapnya
 * `Extension · Chrome`). Dipakai untuk MENEMUKAN kembali baris tokennya setelah
 * halaman dimuat ulang — keadaan tersambung tidak boleh bergantung pada pesan
 * postMessage yang cuma hidup selama satu sesi halaman.
 */
const AWALAN_LABEL_EXT = "Extension";

/**
 * Extension mengumumkan dirinya lewat postMessage saat halaman ini dimuat.
 * Sebelum ini dasbor cuma bisa MENEBAK apakah extension terpasang, jadi
 * panduan pemasangan selalu tampil penuh bahkan untuk yang sudah terpasang —
 * dan token yang dibuat tapi tak pernah ditempel tidak terdeteksi siapa pun.
 */
export function ExtensionConnectPanel() {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [extVersion, setExtVersion] = useState<string | null>(null);
  // Apakah browser INI memegang token, seperti dilaporkan HADIR. `null` berarti
  // extension-nya build lama yang belum melaporkannya sama sekali — dibedakan
  // dari `false` supaya build lama jatuh ke bukti daftar token saja, bukan
  // dinyatakan "tidak tersambung" atas dasar field yang memang tidak ada.
  const [extPunyaToken, setExtPunyaToken] = useState<boolean | null>(null);
  const [emailTersambung, setEmailTersambung] = useState("");
  // `null` = belum tahu (mis. sesudah muat ulang). Hanya `false` yang perlu
  // dikatakan, dan hanya di detik penyambungan; kartu lisensi di atas panel ini
  // yang jadi sumber tetapnya.
  const [lisensiAktif, setLisensiAktif] = useState<boolean | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [created, setCreated] = useState("");
  const [error, setError] = useState("");
  // Token TOKEN dikirim ke extension lewat postMessage tanpa jaminan balasan —
  // content script bisa gagal diam-diam. Timer ini yang memutus kebisuan itu,
  // jadi tombol tidak macet selamanya di "Menghubungkan...". Disimpan di ref
  // (bukan state) karena effect pendengar message dan handler klik tombol
  // sama-sama perlu membacanya untuk membatalkannya.
  const batasRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // `disabled` baru berlaku setelah React me-render ulang; dua klik dalam satu
  // frame masih lolos berdua. Ref ini menutup jendela itu karena berubah
  // seketika — dan setiap POST yang lolos mencetak kredensial penuh permanen,
  // jadi taruhannya bukan sekadar permintaan ganda.
  const kirimRef = useRef(false);
  // Id token yang baru dibuat, disimpan supaya jalur batas-waktu bisa
  // mencabutnya lagi: tokennya sudah terlanjur ada di server sebelum extension
  // sempat diam.
  const idBaruRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/extension/tokens");
    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok) setTokens(data.tokens);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== window) return;
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (data?.source !== "nerona-ext") return;

      if (data.type === "HADIR") {
        setExtVersion(String(data.version || "?"));
        setExtPunyaToken(typeof data.tersambung === "boolean" ? data.tersambung : null);
      }
      if (data.type === "TERSAMBUNG") {
        // Balasan datang — batas waktu tidak boleh menyusul dan menimpa
        // keadaan sukses ini dengan galat basi, dan tokennya jelas TIDAK boleh
        // ikut dicabut jalur batas waktu itu.
        if (batasRef.current) clearTimeout(batasRef.current);
        batasRef.current = null;
        idBaruRef.current = null;
        kirimRef.current = false;
        setEmailTersambung(String(data.email || ""));
        setExtPunyaToken(true);
        // Extension memberi tahu keadaan lisensinya terpisah dari keberhasilan
        // penyambungan. Keduanya fakta yang berbeda: tokennya sah sekarang juga,
        // paketnya mungkin belum aktif.
        setLisensiAktif(data.lisensiAktif !== false);
        setSibuk(false);
        setError("");
        load();
      }
      if (data.type === "GAGAL") {
        if (batasRef.current) clearTimeout(batasRef.current);
        batasRef.current = null;
        // Tokennya sengaja TIDAK dicabut di sini: extension sudah menyimpannya
        // sebelum gagal (mis. jaringan putus saat memverifikasi), jadi
        // mencabutnya justru mematikan token yang benar-benar dipegang.
        idBaruRef.current = null;
        kirimRef.current = false;
        setSibuk(false);
        setError(String(data.pesan || "Extension menolak token."));
      }
    }
    window.addEventListener("message", onMessage);
    // Extension mungkin sudah mengumumkan diri sebelum React memasang
    // pendengarnya. Satu sapaan balik memaksanya mengumumkan ulang.
    window.postMessage({ source: "nerona-web", type: "HALO" }, window.location.origin);
    return () => {
      window.removeEventListener("message", onMessage);
      // Halaman bisa ditutup/dipindah sebelum extension membalas — jangan
      // tinggalkan timer yang men-setState komponen yang sudah lenyap.
      if (batasRef.current) clearTimeout(batasRef.current);
    };
  }, [load]);

  /** Mencabut token yang terlanjur dibuat, tanpa menambah galat kedua di layar. */
  const cabutDiamDiam = useCallback(
    async (id: string) => {
      await fetch(`/api/extension/tokens/${id}`, { method: "DELETE" }).catch(() => null);
      load();
    },
    [load]
  );

  async function hubungkanExtension() {
    if (kirimRef.current) return;
    kirimRef.current = true;
    setError("");
    setSibuk(true);
    let data: { ok?: boolean; id?: string; token?: string } | null = null;
    try {
      const res = await fetch("/api/extension/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // `replace` mencabut token lama berlabel sama: extension cuma menyimpan
        // SATU token, jadi tanpa ini setiap klik meninggalkan kredensial penuh
        // yang tidak dipegang siapa pun dan tidak bisa dikenali pengguna.
        body: JSON.stringify({ label: `Extension · ${namaBrowser()}`, replace: true }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.ok) data = body;
    } catch {
      /* jaringan putus — ditangani sama seperti balasan yang tidak ok */
    }
    if (!data?.token) {
      kirimRef.current = false;
      setSibuk(false);
      setError("Gagal membuat token. Muat ulang halaman lalu coba lagi.");
      return;
    }
    idBaruRef.current = data.id ?? null;
    // Extension membalas TERSAMBUNG / GAGAL; `sibuk` dimatikan di sana.
    window.postMessage(
      { source: "nerona-web", type: "TOKEN", token: data.token },
      window.location.origin
    );
    // Token sudah dibuat di server di atas — kalau extension diam saja
    // (pesan tak sampai, content script error), token itu nganggur tak
    // terlihat dan tombol ini macet selamanya. Batas waktu ini yang
    // memutus kebisuannya.
    if (batasRef.current) clearTimeout(batasRef.current);
    batasRef.current = setTimeout(() => {
      batasRef.current = null;
      kirimRef.current = false;
      setSibuk(false);
      setError(
        "Extension tidak membalas. Muat ulang halaman, atau pakai token manual di bawah."
      );
      // Tidak ada balasan sama sekali berarti extension tidak pernah menerima
      // tokennya. Membiarkannya hidup meninggalkan kredensial penuh yang tidak
      // dipegang siapa pun — persis kelas token yang `lastUsedAt` dibuat untuk
      // menemukan, dan yang tidak bisa dibedakan pengguna dari yang sah.
      const id = idBaruRef.current;
      idBaruRef.current = null;
      if (id) void cabutDiamDiam(id);
    }, 10_000);
  }

  async function createToken() {
    setError("");
    const res = await fetch("/api/extension/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "Token manual" }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setError("Gagal membuat token.");
      return;
    }
    setCreated(data.token);
    load();
  }

  async function revoke(id: string) {
    setError("");
    const res = await fetch(`/api/extension/tokens/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Gagal memutuskan perangkat. Muat ulang halaman lalu coba lagi.");
      return;
    }
    setTokens((prev) => prev.filter((t) => t.id !== id));
  }

  // Dua sumber yang sama-sama selamat dari muat ulang halaman, dan masing-masing
  // menutup lubang yang satunya tinggalkan:
  //  - `barisExtension` tahu apakah tokennya masih hidup di server, yang tidak
  //    bisa diketahui extension setelah pengguna menekan Putuskan di sini;
  //  - `extPunyaToken` (dari HADIR) tahu apakah BROWSER INI yang memegangnya,
  //    yang tidak bisa disimpulkan dari daftar token milik akun.
  // Dulu keadaan ini datang dari pesan TERSAMBUNG yang cuma hidup satu sesi
  // halaman, jadi muat ulang mengembalikan tombol "Hubungkan" untuk extension
  // yang sudah tersambung — dan setiap klik berikutnya mencetak token permanen.
  const barisExtension = tokens.find((t) => (t.label ?? "").startsWith(AWALAN_LABEL_EXT));
  const sudahTersambung = Boolean(barisExtension) && extPunyaToken !== false;

  return (
    <div className="mt-6 rounded-3xl bg-gradient-to-b from-surface to-surface2 p-6 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
      <h2 className="text-lg font-semibold text-ink">Perangkat terhubung</h2>

      {/*
        Extension Nerona Metadata tidak ada di Chrome Web Store, jadi
        pemasangannya lewat "Muat yang belum dikemas" dan TIDAK ADA pembaruan
        otomatis. ZIP di /public dibangun dari repo nerona_medata lewat
        scripts/build-extension.ps1 dan ikut ter-commit — kalau extension
        berubah tanpa skrip itu dijalankan, user mengunduh versi lama tanpa
        tanda apa pun.
      */}
      {!extVersion && (
        <div className="mt-4 rounded-2xl bg-navy-900/[0.03] p-4 ring-1 ring-navy-900/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">1. Unduh extension</p>
              <p className="mt-0.5 text-xs text-muted">
                Simpan lalu ekstrak — foldernya jangan dihapus, Chrome memuatnya langsung dari situ.
              </p>
            </div>
            <a
              href="/nerona-metadata.zip"
              download
              className="whitespace-nowrap rounded-full bg-navy-900/5 px-4 py-2 text-sm font-semibold text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10"
            >
              Unduh ZIP
            </a>
          </div>
          <p className="mt-4 text-sm font-semibold text-ink">2. Pasang di Chrome</p>
          <ol className="mt-1 list-inside list-decimal space-y-1 text-xs text-muted">
            <li>
              Ekstrak ZIP-nya. Isinya satu folder bernama <code>nerona-metadata</code> — taruh di
              tempat yang tidak akan dipindah, misalnya <code>Documents</code>.
            </li>
            <li>
              Buka <code>chrome://extensions</code>, lalu nyalakan <b>Developer mode</b> di kanan atas.
            </li>
            <li>
              Klik <b>Load unpacked</b> / <b>Muat yang belum dikemas</b>, lalu pilih folder{" "}
              <code>nerona-metadata</code> itu.
            </li>
            <li>Kembali ke halaman ini lalu muat ulang — tombol Hubungkan akan menyala.</li>
          </ol>
          {/*
            Blok ini hanya tampil saat extension TIDAK terdeteksi — dan penyebab
            paling sering keadaan itu bukan "belum pernah dipasang", melainkan
            build lama yang masih terpasang (extension ini tidak punya pembaruan
            otomatis sama sekali). Untuk pengguna itu, "Load unpacked" menyuruh
            memuat folder yang sudah dimuat Chrome: pemulihan yang salah. Yang
            benar adalah menimpa isinya lalu menekan Reload.
          */}
          <p className="mt-4 text-sm font-semibold text-ink">
            Sudah pernah dipasang tapi tetap tidak terdeteksi?
          </p>
          <ol className="mt-1 list-inside list-decimal space-y-1 text-xs text-muted">
            <li>
              Berarti yang terpasang versi lama — unduh lagi ZIP di atas, lalu{" "}
              <b>timpa isi folder</b> <code>nerona-metadata</code> yang sudah ada (jangan pilih
              Load unpacked lagi, Chrome sudah memuatnya).
            </li>
            <li>
              Buka <code>chrome://extensions</code>, klik ikon <b>⟳ Reload</b> di kartu{" "}
              <b>Nerona Metadata</b>.
            </li>
            <li>Muat ulang halaman ini.</li>
          </ol>
        </div>
      )}

      {extVersion && !sudahTersambung && (
        <div className="mt-4 rounded-2xl bg-navy-900/[0.03] p-4 ring-1 ring-navy-900/10">
          <p className="text-sm text-ink">✓ Extension terpasang (versi {extVersion}).</p>
          <button
            onClick={hubungkanExtension}
            disabled={sibuk}
            className="mt-3 rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-4 py-2 text-sm font-semibold text-navy-900 transition hover:brightness-110 disabled:opacity-50"
          >
            {sibuk ? "Menghubungkan..." : "Hubungkan extension"}
          </button>
        </div>
      )}

      {sudahTersambung && (
        <div className="mt-4 rounded-2xl bg-gold-400/15 p-4 ring-1 ring-gold-400/40">
          <p className="text-sm text-ink">
            ✓ Extension tersambung{emailTersambung ? ` sebagai ${emailTersambung}` : ""}.
          </p>
          {lisensiAktif === false && (
            // Dua pernyataan yang dua-duanya benar. Sebelum ini keadaan yang
            // sama dilaporkan sebagai satu pernyataan yang salah ("Server
            // menolak token yang baru dibuat"), dan setiap klik ulang mencetak
            // token baru yang tidak menyelesaikan apa pun.
            <p className="mt-1 text-xs text-muted">
              Paket Anda belum aktif, jadi extension belum bisa dipakai membuat
              metadata. Aktifkan paket dulu — penyambungannya sendiri tidak perlu
              diulang.
            </p>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-rose-500">{error}</p>}

      <ul className="mt-4 divide-y divide-navy-900/10">
        {tokens.length === 0 && (
          <li className="py-2 text-sm text-muted">Belum ada perangkat terhubung.</li>
        )}
        {tokens.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="text-ink">{t.label || "Perangkat"}</p>
              <p className="text-xs text-muted">
                Dibuat {new Date(t.createdAt).toLocaleDateString("id-ID")}
                {t.lastUsedAt
                  ? ` · dipakai ${new Date(t.lastUsedAt).toLocaleDateString("id-ID")}`
                  : " · belum dipakai"}
              </p>
            </div>
            <button
              onClick={() => revoke(t.id)}
              className="rounded-full bg-navy-900/5 px-3 py-1 text-xs font-medium text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10"
            >
              Putuskan
            </button>
          </li>
        ))}
      </ul>

      <details className="mt-4">
        <summary className="cursor-pointer text-xs text-muted">
          Kalau tombolnya tidak muncul
        </summary>
        <p className="mt-2 text-xs text-muted">
          Buat token manual di bawah, lalu tempel di popup extension (buka bagian
          &quot;Cara lain&quot; di sana). Dipakai juga untuk Nerona Hub kalau halaman
          persetujuannya tidak bisa dibuka.
        </p>
        {created && (
          <div className="mt-3 rounded-2xl bg-gold-400/15 p-4 ring-1 ring-gold-400/40">
            <p className="text-xs font-semibold text-ink">
              Token baru (salin sekarang — tidak ditampilkan lagi):
            </p>
            <code className="mt-1 block break-all text-sm text-ink">{created}</code>
          </div>
        )}
        <button
          onClick={createToken}
          className="mt-3 rounded-full bg-navy-900/5 px-4 py-2 text-xs font-semibold text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10"
        >
          Buat token manual
        </button>
      </details>
    </div>
  );
}

function namaBrowser(): string {
  const ua = navigator.userAgent;
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("OPR/")) return "Opera";
  if (ua.includes("Chrome/")) return "Chrome";
  return "Browser";
}
