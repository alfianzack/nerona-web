"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

/**
 * Layar generate gambar.
 *
 * Spec: docs/superpowers/specs/2026-09-15-generate-gambar-design.md
 * Mockup yang disetujui owner 2026-09-15 memakai tata letak yang sama: panel
 * kiri untuk permintaan, galeri di kanan.
 *
 * Yang SENGAJA tidak ada di sini, dan jangan ditambahkan sebagai kontrol mati:
 * tab Video, filter Upscaled, Prompt Studio, pilihan gaya, gambar acuan. Tab
 * Video baru boleh muncul bersama fiturnya, bukan sebelumnya.
 */

const UKURAN = [
  { label: "1024 px", nilai: "1024x1024", rasio: "1:1" },
  { label: "1024 x 1536", nilai: "1024x1536", rasio: "2:3" },
  { label: "1536 x 1024", nilai: "1536x1024", rasio: "3:2" },
];

const JUMLAH = [1, 2, 3, 4];
const MAKS_PROMPT = 2000;

export interface HasilGenerate {
  id: string;
  prompt: string;
  url: string;
  points: number;
  hidup: boolean;
  waktu: string;
  /** Sudah punya thumbnail tersimpan, jadi kartunya tetap bergambar saat tautannya mati. */
  punyaThumb: boolean;
}

/**
 * Mengecilkan gambar yang sudah tampil lalu mengirimnya sebagai thumbnail.
 *
 * Dikerjakan di browser karena `sharp` bukan dependensi repo ini. Gambarnya
 * datang dari CDN provider, jadi canvas hanya bisa dibaca kalau CDN itu
 * mengirim header CORS; kalau tidak, toBlob melempar dan kita DIAM SAJA. Kolom
 * thumbnail memang nullable, dan galeri tanpa thumbnail masih menyimpan
 * prompt-nya. Menampilkan galat untuk ini akan menakuti tenant soal sesuatu
 * yang tidak bisa ia perbaiki.
 */
async function kirimThumbnail(id: string, url: string): Promise<boolean> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    await img.decode();

    const sisi = 256;
    const kanvas = document.createElement("canvas");
    kanvas.width = sisi;
    kanvas.height = sisi;
    const ctx = kanvas.getContext("2d");
    if (!ctx) return false;
    // Dipotong tengah supaya rasio apa pun tetap jadi kotak, sama dengan kartunya.
    const sisiSumber = Math.min(img.naturalWidth, img.naturalHeight);
    ctx.drawImage(
      img,
      (img.naturalWidth - sisiSumber) / 2,
      (img.naturalHeight - sisiSumber) / 2,
      sisiSumber,
      sisiSumber,
      0,
      0,
      sisi,
      sisi
    );

    const blob = await new Promise<Blob | null>((selesai) =>
      kanvas.toBlob(selesai, "image/jpeg", 0.7)
    );
    if (!blob) return false;
    const res = await fetch(`/api/generate/image/${id}/thumbnail`, {
      method: "PATCH",
      headers: { "Content-Type": "image/jpeg" },
      body: blob,
    });
    return res.ok;
  } catch {
    return false;
  }
}

interface Props {
  /** Ongkos satu gambar, dari tarif baris model. Null berarti belum diatur. */
  poinPerGambar: number | null;
  saldo: number;
  awal: HasilGenerate[];
}

const PESAN: Record<string, string> = {
  blocked: "Prompt kamu ditolak penyaring provider. Yang perlu diubah prompt-nya, dan poin kamu tidak terpotong.",
  no_points: "Poin kamu tidak cukup untuk permintaan ini. Isi ulang di halaman Transaksi, lalu kembali ke sini.",
  plan: "Paket kamu belum mencakup generate gambar.",
  no_model: "Generate gambar belum diaktifkan. Hubungi kami, ini bukan kesalahan kamu.",
  no_image: "Provider menjawab tanpa gambar. Poin kamu tidak terpotong, coba sekali lagi.",
  upstream: "Provider sedang gagal. Poin kamu tidak terpotong, coba beberapa saat lagi.",
  prompt_kosong: "Tulis dulu gambar yang kamu inginkan.",
};

export function StudioGenerator({ poinPerGambar, saldo, awal }: Props) {
  const [prompt, setPrompt] = useState("");
  const [ukuran, setUkuran] = useState(UKURAN[0].nilai);
  const [jumlah, setJumlah] = useState(1);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [hasil, setHasil] = useState<HasilGenerate[]>(awal);
  const [cari, setCari] = useState("");
  /**
   * Baris yang thumbnail-nya ternyata tidak bisa dimuat. Tanpa ini, gambar yang
   * gagal meninggalkan ikon rusak dengan alt text panjang yang meluber keluar
   * kartu, dan itu terbaca sebagai halaman rusak, bukan sebagai tautan yang
   * memang sudah lewat masanya.
   */
  const [thumbGagal, setThumbGagal] = useState<Record<string, true>>({});
  const [sisa, setSisa] = useState(saldo);

  const ongkos = poinPerGambar === null ? null : poinPerGambar * jumlah;
  const tidakSiap = poinPerGambar === null;

  // Saldo yang tidak cukup dikatakan SEBELUM diklik, bukan sesudah. Server tetap
  // memeriksanya lagi; ini supaya tenant tidak menekan tombol yang sudah pasti
  // ditolak.
  const kurangPoin = ongkos !== null && sisa < ongkos;

  useEffect(() => {
    if (galat) setGalat(null);
    // Galat lama tidak boleh menggantung di layar sesudah tenant mengubah
    // permintaannya; ia menjelaskan percobaan yang sudah tidak ada lagi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, ukuran, jumlah]);

  async function buat(e: React.FormEvent) {
    e.preventDefault();
    if (sibuk || tidakSiap) return;
    setSibuk(true);
    setGalat(null);
    try {
      const res = await fetch("/api/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, size: ukuran, jumlah }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setGalat(PESAN[data?.error] ?? "Gagal membuat gambar. Poin kamu tidak terpotong.");
        return;
      }
      const baru: HasilGenerate[] = (data.urls as string[]).map((url, i) => ({
        id: (data.ids as string[])[i],
        prompt,
        url,
        points: data.points / data.urls.length,
        hidup: true,
        waktu: "baru saja",
        punyaThumb: false,
      }));
      setHasil((lama) => [...baru, ...lama]);
      setSisa(data.pointsBalance);

      // Menyusul, tanpa menahan layar: tenant sudah melihat gambarnya, dan
      // thumbnail cuma menentukan apa yang tersisa BESOK, sesudah tautan
      // providernya mati.
      for (const b of baru) {
        void kirimThumbnail(b.id, b.url).then((jadi) => {
          if (jadi) {
            setHasil((lama) =>
              lama.map((h) => (h.id === b.id ? { ...h, punyaThumb: true } : h))
            );
          }
        });
      }
    } catch {
      setGalat("Tidak bisa menghubungi Nerona. Poin kamu tidak terpotong.");
    } finally {
      setSibuk(false);
    }
  }

  const terlihat = cari.trim()
    ? hasil.filter((h) => h.prompt.toLowerCase().includes(cari.trim().toLowerCase()))
    : hasil;

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr] lg:items-start">
      <Card padding="md">
        <form onSubmit={buat}>
          <label htmlFor="prompt" className="block text-label uppercase text-muted">
            Prompt
          </label>
          <textarea
            id="prompt"
            value={prompt}
            maxLength={MAKS_PROMPT}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ikon vektor datar pohon cemara, tiga segitiga hijau, latar kosong"
            className="mt-2 min-h-[132px] w-full resize-y rounded-control bg-surface-sunken p-3 text-body text-ink ring-1 ring-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          />
          <p className="mt-1.5 text-right font-mono text-caption text-muted">
            {prompt.length}/{MAKS_PROMPT}
          </p>

          <label htmlFor="ukuran" className="mt-4 block text-label uppercase text-muted">
            Ukuran
          </label>
          <select
            id="ukuran"
            value={ukuran}
            onChange={(e) => setUkuran(e.target.value)}
            className="mt-2 min-h-[44px] w-full rounded-control bg-surface px-3 text-body text-ink ring-1 ring-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            {UKURAN.map((u) => (
              <option key={u.nilai} value={u.nilai}>
                {u.label} ({u.rasio})
              </option>
            ))}
          </select>

          <p className="mt-4 text-label uppercase text-muted">Jumlah gambar</p>
          <div className="mt-2 flex gap-1.5" role="group" aria-label="Jumlah gambar">
            {JUMLAH.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={jumlah === n}
                onClick={() => setJumlah(n)}
                className={
                  jumlah === n
                    ? "min-h-[44px] min-w-[46px] rounded-control bg-accent/10 text-body font-semibold text-accent ring-1 ring-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    : "min-h-[44px] min-w-[46px] rounded-control bg-surface text-body text-muted ring-1 ring-border hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                }
              >
                {n}
              </button>
            ))}
          </div>

          <Button type="submit" full size="lg" className="mt-5" disabled={sibuk || tidakSiap || kurangPoin}>
            {sibuk ? "Sedang membuat..." : jumlah > 1 ? `Buat ${jumlah} gambar` : "Buat gambar"}
            {ongkos !== null && (
              <span className="rounded-chip bg-gold-400/20 px-2 py-0.5 font-mono text-caption text-gold-400 ring-1 ring-gold-400/40">
                {ongkos} poin
              </span>
            )}
          </Button>

          <p className="mt-2.5 text-center text-caption text-muted">
            {tidakSiap
              ? "Generate gambar belum diaktifkan di akun ini."
              : kurangPoin
                ? `Saldo kamu ${sisa} poin, kurang untuk ${jumlah} gambar.`
                : `Saldo kamu ${sisa} poin, cukup untuk ${Math.floor(sisa / (ongkos || 1))} kali lagi.`}
          </p>

          {galat && (
            <p
              role="alert"
              className="mt-4 rounded-card bg-warning-bg p-3 text-caption text-warning ring-1 ring-warning/25"
            >
              {galat}
            </p>
          )}
        </form>
      </Card>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-title-2 text-ink">Hasil kamu</h2>
            <p className="mt-0.5 text-caption text-muted">
              Tautan gambar berumur 24 jam. Unduh yang mau kamu simpan.
            </p>
          </div>
          <input
            type="search"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari prompt..."
            aria-label="Cari prompt"
            className="min-h-[44px] w-60 rounded-control bg-surface px-3 text-body text-ink ring-1 ring-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          />
        </div>

        {terlihat.length === 0 ? (
          <Card padding="lg" variant="sunken">
            <h3 className="text-title-2 text-ink">
              {hasil.length === 0 ? "Belum ada hasil" : "Tidak ada yang cocok"}
            </h3>
            <p className="mt-1.5 max-w-prose text-body text-muted">
              {hasil.length === 0
                ? "Tulis satu kalimat tentang gambar yang kamu inginkan di panel kiri, lalu tekan Buat gambar. Hasil pertamanya muncul di sini dalam beberapa detik."
                : "Coba kata lain, atau kosongkan kolom pencarian untuk melihat semuanya."}
            </p>
          </Card>
        ) : (
          <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-4 p-0">
            {terlihat.map((h) => (
              <li key={h.id} className="overflow-hidden rounded-card bg-surface ring-1 ring-border">
                {h.hidup || (h.punyaThumb && !thumbGagal[h.id]) ? (
                  // Tautan provider selagi hidup, thumbnail tersimpan sesudah ia mati.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={h.hidup ? h.url : `/api/generate/image/${h.id}/thumbnail`}
                    alt={h.prompt}
                    onError={() => setThumbGagal((x) => ({ ...x, [h.id]: true }))}
                    // onError saja tidak cukup: gambar ini dirender di server,
                    // jadi kegagalannya bisa terjadi SEBELUM React memasang
                    // penanganannya, dan peristiwa yang sudah lewat tidak pernah
                    // terkirim ulang. Ref ini memeriksa keadaan yang sudah jadi.
                    ref={(el) => {
                      if (el && el.complete && el.naturalWidth === 0) {
                        setThumbGagal((x) => (x[h.id] ? x : { ...x, [h.id]: true }));
                      }
                    }}
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  <div className="grid aspect-square w-full place-items-center bg-surface-sunken p-3 text-center text-caption text-muted">
                    tautan sudah kedaluwarsa
                  </div>
                )}
                <div className="grid gap-2 p-3.5">
                  <p className="text-caption text-ink">{h.prompt}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-caption text-muted">
                    <span>
                      {h.waktu} &middot; {h.points} poin
                    </span>
                    {h.hidup ? (
                      <a
                        href={h.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-control px-3 text-body text-ink ring-1 ring-border hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        Buka
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPrompt(h.prompt)}
                        className="inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-control px-3 text-body text-ink ring-1 ring-border hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        Pakai prompt
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
