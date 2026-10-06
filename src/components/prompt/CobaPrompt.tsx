"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { MARKETPLACES } from "@/lib/marketplaces";
import { MIME_DITERIMA, kecilkanGambar, type GambarSiap } from "./kecilkan-gambar";

export interface ModelUji {
  id: string;
  label: string;
  estimatedPoints: number;
  isDefault: boolean;
}

export type SumberPrompt = { jenis: "editor" } | { jenis: "preset"; nama: string } | { jenis: "nerona" };

interface CobaPromptProps {
  /** Teks editor yang sedang terbuka; kosong berarti prompt yang berlaku sekarang. */
  teks: string;
  sumber: SumberPrompt;
  models: ModelUji[];
  /** Pilihan tersimpan tenant di halaman Model AI; null = bawaan. */
  modelTersimpanId: string | null;
  saldoAwal: number;
}

interface Hasil {
  title: string;
  description: string;
  keywords: string[];
  model: { id: string | null; label: string | null };
  pointsCharged: number;
  marketplace: string;
  sumber: string;
}

/** Keyword terpenting yang ditandai. Prompt meminta urutan "most important first". */
const DITANDAI = 10;

const ISIAN =
  "w-full rounded-control bg-surface px-3 text-body text-ink ring-1 ring-border transition " +
  "min-h-11 focus:outline-none focus:ring-2 focus:ring-accent";

function labelSumber(sumber: SumberPrompt) {
  if (sumber.jenis === "editor") return "Teks di editor, belum disimpan";
  if (sumber.jenis === "preset") return `Aktif: ${sumber.nama}`;
  return "Prompt Nerona";
}

const formatPoin = (n: number) => n.toLocaleString("id-ID");

/**
 * Kartu Coba prompt: satu gambar, satu generate, hasilnya dibaca di sini.
 *
 * Yang dikirim adalah teks editor apa adanya, disimpan atau belum, supaya
 * tenant bisa menyunting dan mencoba berulang sebelum menyalakan presetnya.
 * Prompt yang dirakit server (termasuk prompt Nerona saat editor kosong) tidak
 * pernah kembali ke sini, hanya metadatanya.
 */
export function CobaPrompt({ teks, sumber, models, modelTersimpanId, saldoAwal }: CobaPromptProps) {
  const bawaanId = modelTersimpanId ?? models.find((m) => m.isDefault)?.id ?? null;
  const [modelExtensionId, setModelExtensionId] = useState<string | null>(bawaanId);
  const [aiModelId, setAiModelId] = useState<string>(bawaanId ?? models[0]?.id ?? "");
  const [marketplace, setMarketplace] = useState<string>(MARKETPLACES[0].key);
  const [saldo, setSaldo] = useState(saldoAwal);

  const [pratinjau, setPratinjau] = useState<string | null>(null);
  const [namaBerkas, setNamaBerkas] = useState("");
  const [gambar, setGambar] = useState<GambarSiap | null>(null);
  const [menyiapkan, setMenyiapkan] = useState(false);
  const [diSeret, setDiSeret] = useState(false);

  const [proses, setProses] = useState(false);
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [galat, setGalat] = useState<{ pesan: string; topup?: boolean } | null>(null);
  const [berkasDitolak, setBerkasDitolak] = useState(false);
  const [pakaiStatus, setPakaiStatus] = useState<"diam" | "proses" | "selesai" | "gagal">("diam");

  const input = useRef<HTMLInputElement>(null);

  // Object URL pratinjau dilepas saat diganti atau saat kartu hilang, supaya
  // gambar yang sudah tidak dipakai tidak tertahan di memori tab.
  useEffect(() => {
    return () => {
      if (pratinjau) URL.revokeObjectURL(pratinjau);
    };
  }, [pratinjau]);

  const model = models.find((m) => m.id === aiModelId) ?? null;

  async function ambil(berkas: File | undefined) {
    if (!berkas) return;
    setGalat(null);
    if (!(MIME_DITERIMA as readonly string[]).includes(berkas.type)) {
      setBerkasDitolak(true);
      setGalat({ pesan: "Berkas ini tidak bisa dibaca sebagai gambar. Pakai JPG, PNG, WebP, atau SVG." });
      return;
    }
    setBerkasDitolak(false);
    setMenyiapkan(true);
    try {
      const siap = await kecilkanGambar(berkas);
      setGambar(siap);
      setPratinjau(URL.createObjectURL(berkas));
      setNamaBerkas(berkas.name);
    } catch {
      setBerkasDitolak(true);
      setGalat({ pesan: "Gambar ini tidak bisa dibuka browser. Coba simpan ulang sebagai JPG atau PNG." });
    } finally {
      setMenyiapkan(false);
    }
  }

  async function generate() {
    if (!gambar) return;
    setProses(true);
    setGalat(null);
    setPakaiStatus("diam");
    const label = MARKETPLACES.find((m) => m.key === marketplace)?.label ?? marketplace;
    const sumberSaatIni = labelSumber(sumber);

    const res = await fetch("/api/prompts/coba", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: teks, marketplace, aiModelId: aiModelId || undefined, image: gambar }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    setProses(false);

    if (typeof data?.pointsBalance === "number") setSaldo(data.pointsBalance);

    if (res?.ok && data?.ok) {
      setHasil({ ...data, marketplace: label, sumber: sumberSaatIni });
      return;
    }

    setHasil(null);
    if (res?.status === 402) {
      setGalat({ pesan: "Saldo poin tidak cukup untuk percobaan ini.", topup: true });
    } else if (data?.error === "ai_unparsed") {
      setGalat({
        pesan: `Balasan model bukan metadata yang bisa dibaca, dan ${formatPoin(data.pointsCharged)} poin sudah terpotong. Biasanya karena prompt meminta bentuk jawaban lain. Periksa lagi teks prompt Anda.`,
      });
    } else if (data?.error === "ai_empty" || data?.error === "ai_truncated" || data?.error === "ai_error") {
      setGalat({
        pesan: "Model tidak mengembalikan metadata yang bisa dibaca. Poin tidak dipotong. Coba lagi, atau pilih model lain.",
      });
    } else {
      setGalat({ pesan: data?.message || "Percobaan gagal, dan poin tidak dipotong. Periksa koneksi lalu coba lagi." });
    }
  }

  async function pakaiUntukExtension(id: string) {
    setPakaiStatus("proses");
    const res = await fetch("/api/model", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ modelId: id }),
    }).catch(() => null);
    if (res?.ok) {
      setModelExtensionId(id);
      setPakaiStatus("selesai");
    } else {
      setPakaiStatus("gagal");
    }
  }

  const bolehGenerate = !!gambar && !proses && !menyiapkan;

  return (
    <Card padding="lg" className="lg:sticky lg:top-6">
      <h2 className="text-title-2 text-ink">Coba prompt</h2>
      <p className="mt-1 max-w-prose text-body text-muted">
        Unggah satu gambar dan lihat metadata yang dihasilkan sebelum prompt ini dipakai di extension.
        Memotong poin seperti generate biasa, dan tidak masuk Riwayat Metadata.
      </p>

      <div className="mt-5 grid gap-5 sm:grid-cols-[5fr_6fr] lg:grid-cols-1 xl:grid-cols-[5fr_6fr]">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDiSeret(true);
            }}
            onDragLeave={() => setDiSeret(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDiSeret(false);
              void ambil(e.dataTransfer.files[0]);
            }}
            aria-label={pratinjau ? `Ganti gambar ${namaBerkas}` : "Pilih gambar untuk dicoba"}
            className={cn(
              "relative grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-control p-4 text-center transition",
              diSeret
                ? "bg-brand-blue/10 ring-2 ring-accent"
                : berkasDitolak
                  ? "bg-danger-bg ring-1 ring-danger"
                  : "bg-surface-sunken ring-1 ring-border"
            )}
          >
            {pratinjau ? (
              // eslint-disable-next-line @next/next/no-img-element -- object URL lokal, next/image tidak bisa mengoptimalkannya
              <img src={pratinjau} alt="" className="absolute inset-0 h-full w-full object-contain" />
            ) : (
              <span className="grid max-w-[26ch] justify-items-center gap-1.5">
                <Icon name="image" className="size-7 text-muted" />
                <span className="text-body font-medium text-ink">
                  {menyiapkan ? "Menyiapkan gambar…" : "Seret gambar ke sini atau pilih berkas"}
                </span>
                <span className="text-caption text-muted">
                  JPG, PNG, WebP, atau SVG. Gambar diperkecil di browser sebelum dikirim.
                </span>
              </span>
            )}
          </button>
          <input
            ref={input}
            type="file"
            accept={MIME_DITERIMA.join(",")}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              void ambil(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {pratinjau && (
            <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
              <span className="min-w-0 truncate text-caption text-muted">{namaBerkas}</span>
              <Button size="sm" variant="ghost" onClick={() => input.current?.click()} disabled={proses}>
                Ganti gambar
              </Button>
            </div>
          )}
        </div>

        <div className="grid min-w-0 content-start gap-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-label uppercase text-muted">Prompt</span>
            <Badge tone={sumber.jenis === "editor" ? "warning" : sumber.jenis === "preset" ? "success" : "neutral"}>
              {labelSumber(sumber)}
            </Badge>
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="coba-marketplace" className="text-caption font-medium text-muted">
              Marketplace
            </label>
            <select
              id="coba-marketplace"
              className={ISIAN}
              value={marketplace}
              onChange={(e) => setMarketplace(e.target.value)}
            >
              {MARKETPLACES.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Registri kosong: semua generate memakai model Koneksi AI, jadi tidak ada yang bisa dipilih. */}
          {models.length > 0 && (
            <div className="grid gap-1.5">
              <label htmlFor="coba-model" className="text-caption font-medium text-muted">
                Model
              </label>
              <select
                id="coba-model"
                className={ISIAN}
                value={aiModelId}
                onChange={(e) => setAiModelId(e.target.value)}
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} · ±{formatPoin(m.estimatedPoints)} poin
                  </option>
                ))}
              </select>
              <span className="text-caption text-muted">
                {aiModelId === modelExtensionId
                  ? "Terpilih: model yang dipakai extension Anda. Pilihan di sini hanya untuk percobaan ini."
                  : "Hanya untuk percobaan ini. Extension tetap memakai model di halaman Model AI."}
              </span>
            </div>
          )}

          <Button onClick={generate} disabled={!bolehGenerate} className="min-h-11">
            {proses && (
              <span
                aria-hidden="true"
                className="size-4 rounded-full border-2 border-on-action/35 border-t-on-action motion-safe:animate-spin"
              />
            )}
            {proses ? "Membuat metadata…" : "Generate metadata"}
          </Button>

          <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-caption">
            <span className="text-muted">
              {model ? `Perkiraan ±${formatPoin(model.estimatedPoints)} poin` : "Poin dipotong sesuai pemakaian"}
            </span>
            <span className="text-ink">
              Saldo <span className="font-mono font-medium tabular-nums text-brand-gold-ink">{formatPoin(saldo)}</span> poin
            </span>
          </div>

          {!gambar && !galat && <p className="text-caption text-muted">Pilih gambar dulu untuk mengaktifkan Generate.</p>}

          {galat && (
            <div role="alert" className="flex items-start gap-2.5 rounded-control bg-danger-bg px-3.5 py-3 text-body text-danger">
              <Icon name="close" className="mt-0.5 size-4 flex-none" />
              <span>
                {galat.pesan}{" "}
                {galat.topup && (
                  <Link href="/finance" className="font-medium underline underline-offset-2">
                    Top-up poin
                  </Link>
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      <div aria-live="polite">
        {proses && (
          <div className="mt-6 grid gap-3 border-t border-divider pt-6">
            <p className="text-caption text-muted">Menunggu balasan {model?.label ?? "model"}…</p>
            {["w-4/5", "w-11/12", "w-3/5"].map((w) => (
              <div key={w} className={cn("h-3.5 rounded bg-surface-sunken motion-safe:animate-pulse", w)} />
            ))}
          </div>
        )}

        {hasil && !proses && (
          <div className="mt-6 grid gap-4 border-t border-divider pt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-x-3.5 gap-y-1 font-mono text-caption tabular-nums text-muted">
                <span className="font-medium text-ink">{hasil.model.label ?? "Model bawaan"}</span>
                <span>{hasil.marketplace}</span>
                <span>{hasil.sumber}</span>
                <span>{formatPoin(hasil.pointsCharged)} poin terpotong</span>
              </div>
              {hasil.model.id && hasil.model.id !== modelExtensionId && pakaiStatus !== "selesai" && (
                <button
                  type="button"
                  onClick={() => pakaiUntukExtension(hasil.model.id as string)}
                  disabled={pakaiStatus === "proses"}
                  className="min-h-11 text-caption font-medium text-accent underline underline-offset-2 disabled:opacity-50"
                >
                  {pakaiStatus === "gagal" ? "Gagal mengganti. Coba lagi" : `Pakai ${hasil.model.label} untuk extension`}
                </button>
              )}
              {pakaiStatus === "selesai" && (
                <span className="text-caption text-success">Model extension diganti ke {hasil.model.label}</span>
              )}
            </div>

            <Keluaran judul="Judul" hitung={`${hasil.title.length} karakter`}>
              <p className="break-words text-body-lg font-semibold text-ink">{hasil.title}</p>
            </Keluaran>

            {hasil.description && (
              <Keluaran judul="Deskripsi" hitung={`${hasil.description.length} karakter`}>
                <p className="break-words text-body text-ink">{hasil.description}</p>
              </Keluaran>
            )}

            <Keluaran
              judul="Keyword"
              hitung={
                hasil.keywords.length > DITANDAI
                  ? `${hasil.keywords.length} keyword · ${DITANDAI} pertama ditandai`
                  : `${hasil.keywords.length} keyword`
              }
            >
              <ul className="flex flex-wrap gap-1.5">
                {hasil.keywords.map((kw, i) => (
                  <li
                    key={kw}
                    className={cn(
                      "break-all rounded-chip px-2 py-1 font-mono text-caption ring-1",
                      // Mint = "ini keluaran model", warna yang sama dengan chip contoh di beranda.
                      i < DITANDAI
                        ? "bg-result-bg text-result-ink ring-result/25"
                        : "bg-surface-sunken text-ink ring-border"
                    )}
                  >
                    {kw}
                  </li>
                ))}
              </ul>
            </Keluaran>
          </div>
        )}
      </div>
    </Card>
  );
}

function Keluaran({ judul, hitung, children }: { judul: string; hitung: string; children: React.ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-label uppercase text-muted">{judul}</span>
        <span className="font-mono text-caption tabular-nums text-muted">{hitung}</span>
      </div>
      {children}
    </div>
  );
}
