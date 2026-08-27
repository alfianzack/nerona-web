"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/icons";

/**
 * Prompt Nerona tidak pernah muncul di berkas ini, dan tidak boleh.
 *
 * Editor mulai kosong, tanpa tombol salin dan tanpa pratinjau bawaan: prompt
 * Nerona adalah aset inti produk, dan menampilkannya sebagai titik awal sama
 * dengan membagikannya. Contoh di placeholder di bawah adalah contoh mainan
 * yang ditulis untuk halaman ini, bukan potongan prompt yang sebenarnya.
 */
const CONTOH =
  "Kamu penulis metadata microstock. Fokus niche wedding Indonesia. Judul deskriptif, hindari kata korporat…";

const MAX_BODY = 6_000;
const MAX_NAMA = 60;
const MAX_PRESET = 20;

const ISIAN =
  "w-full rounded-control bg-surface px-3.5 py-2.5 text-body text-ink transition " +
  "ring-1 ring-border placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent";

interface Preset {
  id: string;
  name: string;
  body: string;
  isActive: boolean;
}

export function PromptPresetManager() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  /** null = formulir tertutup; "" = sedang membuat baru; id = sedang menyunting. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nama, setNama] = useState("");
  const [isi, setIsi] = useState("");

  const aktif = presets.find((p) => p.isActive) || null;

  async function muat() {
    setLoading(true);
    const res = await fetch("/api/prompts");
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setError("Gagal memuat prompt.");
    } else {
      setPresets(data.presets);
      setError("");
    }
    setLoading(false);
  }

  useEffect(() => {
    void muat();
  }, []);

  async function kirim(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError("");
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok || !data?.ok) {
      setError(data?.message || "Gagal menyimpan.");
      return false;
    }
    await muat();
    return true;
  }

  function bukaBaru() {
    setEditingId("");
    setNama("");
    setIsi("");
    setError("");
  }

  function bukaSunting(preset: Preset) {
    setEditingId(preset.id);
    setNama(preset.name);
    setIsi(preset.body);
    setError("");
  }

  async function simpan() {
    const ok =
      editingId === ""
        ? await kirim("/api/prompts", "POST", { name: nama, body: isi })
        : await kirim(`/api/prompts/${editingId}`, "PATCH", { name: nama, body: isi });
    if (ok) setEditingId(null);
  }

  const terlaluPanjang = isi.length > MAX_BODY;
  const penuh = presets.length >= MAX_PRESET;

  return (
    <div className="grid gap-6">
      <Card padding="lg">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-title-2 text-ink">
              {aktif ? `Prompt saya — ${aktif.name}` : "Prompt Nerona"}
            </h2>
            <p className="mt-1 max-w-prose text-body text-muted">
              {aktif
                ? "Prompt Anda yang dipakai untuk setiap generate metadata, di extension maupun di Nerona Hub."
                : "Prompt bawaan Nerona: menghasilkan judul, deskripsi, dan 50 keyword yang berorientasi pembeli. Sudah dipakai sekarang — tidak ada yang perlu Anda atur."}
            </p>
          </div>
          {aktif && (
            <Button
              variant="secondary"
              onClick={() => kirim(`/api/prompts/${aktif.id}`, "PATCH", { isActive: false })}
              disabled={busy}
            >
              Kembali ke prompt Nerona
            </Button>
          )}
        </div>
      </Card>

      <Card padding="lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-title-2 text-ink">Prompt saya</h2>
          <Button onClick={bukaBaru} disabled={busy || penuh || editingId === ""}>
            Tulis prompt baru
          </Button>
        </div>

        {penuh && (
          <p className="mt-2 text-caption text-muted">
            Sudah {MAX_PRESET} preset — hapus salah satu dulu untuk menambah.
          </p>
        )}

        {loading ? (
          <p className="mt-4 text-body text-muted">Memuat…</p>
        ) : presets.length === 0 && editingId === null ? (
          <p className="mt-4 max-w-prose text-body text-muted">
            Belum ada. Anda bisa menulis prompt sendiri — misalnya untuk satu niche tertentu — dan
            menyalakannya kapan saja. Selama belum dinyalakan, prompt Nerona yang dipakai.
          </p>
        ) : (
          <ul className="mt-4 grid gap-2">
            {presets.map((preset) => (
              <li
                key={preset.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-control px-3.5 py-3 ring-1 ring-border"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-body font-medium text-ink">{preset.name}</span>
                    {preset.isActive && <Badge tone="success">Aktif</Badge>}
                  </div>
                  <p className="mt-0.5 truncate text-caption text-muted">{preset.body}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!preset.isActive && (
                    <Button
                      size="sm"
                      onClick={() => kirim(`/api/prompts/${preset.id}`, "PATCH", { isActive: true })}
                      disabled={busy}
                    >
                      Pakai
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => bukaSunting(preset)} disabled={busy}>
                    Sunting
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => kirim(`/api/prompts/${preset.id}`, "DELETE")}
                    disabled={busy}
                  >
                    Hapus
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {editingId !== null && (
          <div className="mt-6 grid gap-4 border-t border-border pt-6">
            <Field
              id="prompt-nama"
              label="Nama preset"
              placeholder="Wedding Indonesia"
              maxLength={MAX_NAMA}
              value={nama}
              onChange={(e) => setNama(e.target.value)}
            />

            <div className="grid gap-1.5">
              <label htmlFor="prompt-isi" className="text-caption font-medium text-muted">
                Prompt Anda
              </label>
              <textarea
                id="prompt-isi"
                rows={12}
                className={ISIAN + " font-mono text-caption"}
                placeholder={CONTOH}
                value={isi}
                onChange={(e) => setIsi(e.target.value)}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="max-w-prose text-caption text-muted">
                  Nerona otomatis menambahkan aturan format keluaran dan konteks marketplace di akhir
                  prompt Anda. Tidak perlu Anda tulis, dan tidak bisa dihapus.
                </p>
                <span
                  className={
                    "shrink-0 font-mono text-caption tabular-nums " +
                    (terlaluPanjang ? "text-danger" : "text-muted")
                  }
                >
                  {isi.length.toLocaleString("id-ID")} / {MAX_BODY.toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={simpan} disabled={busy || terlaluPanjang || !nama.trim() || !isi.trim()}>
                {editingId === "" ? "Simpan preset" : "Simpan perubahan"}
              </Button>
              <Button variant="ghost" onClick={() => setEditingId(null)} disabled={busy}>
                Batal
              </Button>
            </div>
          </div>
        )}

        {error && (
          <p className="mt-4 flex items-center gap-1.5 text-caption text-danger">
            <Icon name="close" className="size-4" />
            {error}
          </p>
        )}
      </Card>
    </div>
  );
}
