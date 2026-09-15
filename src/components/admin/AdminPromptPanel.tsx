"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/**
 * Panel prompt Nerona — owner saja.
 *
 * Pemeriksaan peran di sini hanya demi tampilan; yang berwenang tetap
 * /api/admin/prompts, yang menolak `support` dengan 403.
 *
 * Sejak panel ini ada, prompt yang berjalan di produksi bisa berbeda dari yang
 * tertulis di kode, dan tests/lib/extension-prompts.test.ts hanya menjaga
 * bawaannya. Itu sebabnya lencana "Dioverride" ada: perbedaan itu tidak boleh
 * jadi kejutan saat menelusuri keluhan hasil.
 */
const ISIAN =
  "w-full rounded-control bg-surface px-3.5 py-2.5 font-mono text-caption text-ink transition " +
  "ring-1 ring-border placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent";

type Field = "advanced" | "contract";
type Versi = "v4" | "pra_v4" | "kustom";

/**
 * Yang ditawarkan di layar cuma dua (keputusan owner 2026-09-15). "kustom"
 * tetap hidup di lapisan data supaya override yang sudah dipasang SEBELUM
 * saklar ini ada tidak mati diam-diam, tapi ia tidak punya kontrol sendiri:
 * kotak teks yang tidak bisa berlaku adalah kontrol yang tidak melakukan
 * apa-apa, dan itu dilarang aturan antislop proyek ini.
 */
const PILIHAN: Array<Exclude<Versi, "kustom">> = ["v4", "pra_v4"];

const NAMA_VERSI: Record<Versi, string> = {
  v4: "v4, yang berlaku sekarang",
  pra_v4: "Sebelum v4, perilaku lama",
  kustom: "Teks sendiri (tersimpan, tidak ditawarkan lagi)",
};

const KETERANGAN_VERSI: Record<Versi, string> = {
  v4: "Berhenti saat kata kunci jujurnya habis, dan mengikuti batas tiap marketplace.",
  pra_v4:
    "Mewajibkan tepat 50 kata kunci. Pada uji tujuh gambar, itu menghasilkan 5,33 tag yang tidak ada di gambar per gambar, lawan 0,64 pada v4.",
  kustom:
    "Teks yang pernah Anda simpan sendiri. Memilih salah satu versi di atas akan menggantikannya, dan teksnya tetap tersimpan.",
};

export function AdminPromptPanel() {
  const [advanced, setAdvanced] = useState("");
  const [contract, setContract] = useState("");
  // Hanya ekor kontrak yang masih punya penanda override. Badan prompt sekarang
  // dipilih lewat versi, jadi "dioverride" tidak berarti apa-apa untuknya.
  const [contractOverridden, setContractOverridden] = useState(false);
  const [versi, setVersi] = useState<Versi>("v4");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function muat() {
    setLoading(true);
    const res = await fetch("/api/admin/prompts");
    const data = await res.json().catch(() => null);
    if (res.status === 403) {
      setError("Hanya owner yang bisa membuka prompt Nerona.");
    } else if (!res.ok || !data?.ok) {
      setError("Gagal memuat prompt.");
    } else {
      setAdvanced(data.settings.advanced);
      setContract(data.settings.contract);
      setVersi(data.settings.versi ?? "v4");
      setContractOverridden(Boolean(data.settings.contractOverridden));
      setError("");
    }
    setLoading(false);
  }

  useEffect(() => {
    void muat();
  }, []);

  async function kirim(values: Partial<Record<Field, string>> & { versi?: Versi }) {
    setBusy(true);
    setSaved(false);
    setError("");
    const res = await fetch("/api/admin/prompts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok || !data?.ok) {
      setError(data?.message || "Gagal menyimpan.");
      return;
    }
    setSaved(true);
    await muat();
  }

  return (
    <Card padding="lg">
      <h2 className="text-title-2 text-ink">Prompt Metadata Nerona</h2>
      <p className="mt-1 max-w-prose text-body text-muted">
        Prompt bawaan yang dipakai setiap tenant yang belum memasang prompt sendiri. Tidak pernah
        ditampilkan di sisi tenant. Pilih versi yang dipakai di bawah.
      </p>

      {loading ? (
        <p className="mt-4 text-body text-muted">Memuat…</p>
      ) : (
        <div className="mt-6 grid gap-6">
          <div className="grid gap-1.5">
            <label htmlFor="prompt-versi" className="text-caption font-medium text-muted">
              Versi yang dipakai
            </label>
            <select
              id="prompt-versi"
              className="min-h-[44px] w-full rounded-control bg-surface px-3.5 py-2.5 text-body text-ink ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-accent"
              value={versi}
              disabled={busy}
              onChange={(e) => {
                const baru = e.target.value as Versi;
                setVersi(baru);
                void kirim({ versi: baru });
              }}
            >
              {(versi === "kustom" ? ([...PILIHAN, "kustom"] as Versi[]) : PILIHAN).map((v) => (
                <option key={v} value={v}>
                  {NAMA_VERSI[v]}
                </option>
              ))}
            </select>
            <p className="text-caption text-muted">{KETERANGAN_VERSI[versi]}</p>
            <p className="text-caption text-muted">
              Panjang prompt yang sedang hidup: {advanced.length.toLocaleString("id-ID")} karakter.
            </p>
          </div>

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="prompt-contract" className="text-caption font-medium text-muted">
                Ekor kontrak (hanya untuk prompt kustom tenant)
              </label>
              {contractOverridden && <Badge tone="warning">Dioverride</Badge>}
            </div>
            <textarea
              id="prompt-contract"
              rows={10}
              className={ISIAN}
              value={contract}
              onChange={(e) => setContract(e.target.value)}
            />
            <p className="max-w-prose text-caption text-muted">
              Ditempel di akhir prompt tenant. Ia yang menjaga keluaran tetap JSON yang bisa dibaca
              extension dan Hub, dan yang menahan endpoint generate dipakai sebagai LLM serbaguna.
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => kirim({ contract })} disabled={busy}>
                Simpan ekor
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => kirim({ contract: "" })}
                disabled={busy || !contractOverridden}
              >
                Kembalikan ke bawaan
              </Button>
            </div>
          </div>
        </div>
      )}

      {saved && <p className="mt-4 text-caption text-success">Tersimpan.</p>}
      {error && <p className="mt-4 text-caption text-danger">{error}</p>}
    </Card>
  );
}
