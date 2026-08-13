"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Icon, type IconName } from "@/components/ui/icons";

interface PlanRow {
  id: string;
  name: string;
  /** Harga bulanan dalam rupiah; null = belum diatur. */
  priceMonthly: number | null;
  activeLicenses?: number;
}

interface DiscountRow {
  months: number;
  label: string;
  percent: number;
}

interface CourseRow {
  id: string;
  slug: string;
  title: string;
  priceLabel: string | null;
  enrollments?: number;
}

/**
 * Paket Agent tidak punya tabel sendiri — harganya disimpan di Setting, jadi
 * `plan` ("pro") yang berperan sebagai id, bukan cuid seperti paket Metadata.
 * Karena itu barisnya dipisah dari PlanRow, bukan digabung dengan penanda.
 */
interface AgentPlanRow {
  plan: string;
  label: string;
  stored: string;
  effective: number;
  activeProfiles: number;
}

function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

/**
 * Kepala bagian, bukan kepala panel.
 *
 * Lima kelompok harga di berkas ini sebelumnya masing-masing memakai resep
 * kartu yang sama persis — cincin, bayangan, dan lencana ikon 36px — sehingga
 * kelimanya berteriak sekeras panel tetangganya di halaman yang sama, dan tidak
 * ada yang menuntun mata. Sekarang semuanya duduk di dalam SATU kartu: kartu
 * itu yang memegang cincin, sedangkan bagian di dalamnya hanya punya ikon polos
 * dan judul. Tiga tingkat garis membentuk urutannya — cincin kartu, garis antar
 * bagian, lalu garis paling tipis antar baris.
 */
function Section({
  icon,
  tone,
  title,
  subtitle,
  children,
}: {
  icon: IconName;
  tone: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="py-6 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <Icon name={icon} className={`mt-1 h-[18px] w-[18px] flex-none ${tone}`} />
        <div className="min-w-0">
          <h2 className="text-title-2 text-ink">{title}</h2>
          <p className="mt-0.5 text-caption text-muted">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function AdminPricingPanel() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [agentPlans, setAgentPlans] = useState<AgentPlanRow[]>([]);
  const [discounts, setDiscounts] = useState<DiscountRow[]>([]);
  const [topup, setTopup] = useState<{ stored: string; effective: string }>({
    stored: "",
    effective: "",
  });
  const [topupDraft, setTopupDraft] = useState("");
  const [topupSaving, setTopupSaving] = useState(false);
  const [topupSaved, setTopupSaved] = useState(false);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [savedId, setSavedId] = useState("");

  async function load() {
    const res = await fetch("/api/admin/pricing");
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setError("Gagal memuat data harga.");
      return;
    }
    setPlans(data.plans);
    setAgentPlans(data.agentPlans ?? []);
    setDiscounts(data.discounts ?? []);
    setCourses(data.courses);
    if (data.topup) {
      setTopup(data.topup);
      setTopupDraft(data.topup.stored);
    }
    const nextDrafts: Record<string, string> = {};
    for (const plan of data.plans) {
      nextDrafts[plan.id] = plan.priceMonthly === null ? "" : String(plan.priceMonthly);
    }
    for (const course of data.courses) nextDrafts[course.id] = course.priceLabel ?? "";
    // Draft diberi awalan per jenis supaya id dari sumber berbeda — cuid, nama
    // paket, dan angka durasi — tidak pernah saling menimpa.
    for (const agent of data.agentPlans ?? []) nextDrafts[`agent:${agent.plan}`] = agent.stored;
    for (const d of data.discounts ?? []) nextDrafts[`discount:${d.months}`] = String(d.percent);
    setDrafts(nextDrafts);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  type PriceType = "plan" | "course" | "agent" | "discount";

  /**
   * Pratinjau memakai paket berbayar pertama yang punya harga. Angka abstrak
   * seperti "10%" sulit dinilai; "6 × Rp 99.000 → Rp 535.000" langsung terlihat
   * masuk akal atau tidak.
   */
  function previewFor(d: DiscountRow): string {
    const sample = plans.find((p) => (p.priceMonthly ?? 0) > 0)?.priceMonthly;
    if (!sample) return "Atur harga paket dulu untuk melihat pratinjau";
    const total = Math.round((sample * d.months * (1 - d.percent / 100)) / 1000) * 1000;
    const saved = sample * d.months - total;
    return `${d.months} × ${formatRupiah(sample)} → ${formatRupiah(total)}${
      saved > 0 ? ` · hemat ${formatRupiah(saved)}` : ""
    }`;
  }

  async function handleSave(type: PriceType, apiId: string, draftKey: string) {
    setError("");
    setSavedId("");
    setSavingId(draftKey);
    const res = await fetch("/api/admin/pricing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id: apiId, priceLabel: drafts[draftKey] ?? "" }),
    });
    setSavingId("");
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(
        data?.reason === "invalid"
          ? "Harga harus berupa angka rupiah, mis. 99000 atau Rp 99.000."
          : "Gagal menyimpan harga."
      );
      return;
    }
    setSavedId(draftKey);
    // Harga berubah → harga semua durasi ikut berubah. Muat ulang supaya
    // pratinjau di kartu diskon tidak memperlihatkan angka lama.
    await load();
  }

  async function saveTopup() {
    setError("");
    setTopupSaved(false);
    setTopupSaving(true);
    const res = await fetch("/api/admin/pricing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      // `id` tidak dipakai untuk top-up, tapi route menolak body tanpa id.
      body: JSON.stringify({ type: "topup", id: "topup", priceLabel: topupDraft }),
    });
    setTopupSaving(false);
    if (!res.ok) {
      setError('Format paket poin tidak valid. Satu baris per paket, "poin=harga".');
      return;
    }
    setTopupSaved(true);
    await load();
  }

  function renderRow(row: {
    type: PriceType;
    /** Yang dikirim ke API: cuid untuk plan/course, nama paket untuk agent. */
    apiId: string;
    /** Kunci draft di state — selalu unik lintas produk. */
    draftKey: string;
    label: string;
    detail: string;
    /** Nilai yang berlaku saat kolomnya masih kosong. */
    placeholder?: string;
    /** Satuan di kanan kolom, mis. "%" untuk diskon. */
    suffix?: string;
  }) {
    const { type, apiId, draftKey, label, detail } = row;
    const isSaved = savedId === draftKey;
    // Titik dua sah di dalam id HTML, tapi menyusahkan pemilih CSS. Diganti
    // supaya penyambungan label dan keterangan tetap aman.
    const inputId = `harga-${draftKey.replace(/:/g, "-")}`;
    const detailId = `${inputId}-ket`;
    return (
      <div key={draftKey} className="py-3.5">
        <div className="flex flex-wrap items-end gap-3">
          {/*
            Field, bukan kolom dengan aria-label seperti sebelumnya: nama paket
            di sebelahnya tidak pernah benar-benar tersambung ke kolomnya, jadi
            mengkliknya tidak memindahkan fokus.

            Mono dipasang di pembungkus, bukan di kolomnya, karena Field tidak
            meneruskan kelas ke elemen isian — angka yang diketik mewarisinya
            dari sini. Label ikut mono, dan itu memang yang diinginkan untuk
            daftar setelan.
          */}
          <Field
            id={inputId}
            label={label}
            className="min-w-[9rem] flex-1 font-mono tabular-nums"
            type="text"
            value={drafts[draftKey] ?? ""}
            onChange={(e) => setDrafts((d) => ({ ...d, [draftKey]: e.target.value }))}
            placeholder={row.placeholder ?? "Rp ..."}
            aria-describedby={detailId}
          />
          {row.suffix && (
            // Satuannya berdiri di samping kolom, tidak lagi melayang di
            // dalamnya: begitu kolom punya label sungguhan, penempatan absolut
            // di tengah tinggi meleset dan hanya bisa diperbaiki dengan angka
            // ajaib.
            <span className="pb-2.5 font-mono text-body text-muted">{row.suffix}</span>
          )}
          <Button
            size="sm"
            variant={isSaved ? "secondary" : "primary"}
            onClick={() => handleSave(type, apiId, draftKey)}
            disabled={savingId === draftKey}
          >
            {savingId === draftKey ? (
              "Menyimpan..."
            ) : isSaved ? (
              <>
                <Icon name="check" className="h-4 w-4 text-success" />
                Tersimpan
              </>
            ) : (
              "Simpan"
            )}
          </Button>
        </div>
        <p id={detailId} className="mt-1.5 font-mono text-label text-muted">
          {detail}
        </p>
      </div>
    );
  }

  return (
    <Card padding="lg">
      {error && (
        <p className="mb-5 rounded-card bg-danger-bg px-3 py-2 text-caption text-danger ring-1 ring-danger/25">
          {error}
        </p>
      )}

      <div className="divide-y divide-border">
        <Section
          icon="image"
          tone="text-brand-blue-ink"
          title="Harga paket Metadata"
          subtitle="Harga per bulan. Harga 3/6/12 bulan dihitung otomatis dari sini."
        >
          <div className="mt-3 divide-y divide-divider">
            {plans.map((plan) =>
              renderRow({
                type: "plan",
                apiId: plan.id,
                draftKey: plan.id,
                label: plan.name,
                detail:
                  plan.priceMonthly === null
                    ? `${plan.activeLicenses ?? 0} lisensi aktif · harga belum diatur`
                    : `${plan.activeLicenses ?? 0} lisensi aktif · ${formatRupiah(plan.priceMonthly)}/bulan`,
                placeholder: "99000",
              })
            )}
          </div>
        </Section>

        <Section
          icon="chat"
          tone="text-brand-sky-ink"
          title="Harga paket Agent"
          subtitle="Harga per bulan. Harga 3/6/12 bulan dihitung otomatis dari sini."
        >
          <div className="mt-3 divide-y divide-divider">
            {agentPlans.map((agent) =>
              renderRow({
                type: "agent",
                apiId: agent.plan,
                draftKey: `agent:${agent.plan}`,
                label: agent.label,
                detail: `${agent.activeProfiles} akun aktif · ${formatRupiah(agent.effective)}/bulan`,
                // Kosongkan kolomnya untuk kembali ke harga bawaan; placeholder
                // memperlihatkan harga apa yang berlaku saat itu terjadi.
                placeholder: String(agent.effective),
              })
            )}
          </div>
        </Section>

        <Section
          icon="tag"
          tone="text-brand-orange-ink"
          title="Diskon durasi"
          subtitle="Potongan untuk paket 3 / 6 / 12 bulan — berlaku untuk Metadata dan Agent"
        >
          <div className="mt-3 divide-y divide-divider">
            {discounts.map((d) =>
              renderRow({
                type: "discount",
                apiId: String(d.months),
                draftKey: `discount:${d.months}`,
                label: d.label,
                detail: previewFor(d),
                placeholder: "0",
                suffix: "%",
              })
            )}
          </div>
          <p className="mt-3 text-caption text-muted">
            Harga akhir dibulatkan ke ribuan terdekat. Kosongkan untuk kembali ke potongan bawaan.
          </p>
        </Section>

        <Section
          icon="wallet"
          tone="text-brand-gold-ink"
          title="Paket poin (top-up)"
          subtitle="Pilihan beli poin satuan di halaman Finance tenant"
        >
          <label htmlFor="topupPackages" className="mt-4 block text-caption text-muted">
            Satu paket per baris, <code className="font-mono text-ink">poin=harga</code>. Contoh:{" "}
            <code className="font-mono text-ink">1000=45000</code>
          </label>
          {/* Ditulis tangan, bukan lewat primitif: Field dan Input keduanya
              hanya melayani elemen input. Gayanya menyalin Input supaya kolom
              ini tidak terlihat berbeda dari kolom lain di halaman. */}
          <textarea
            id="topupPackages"
            rows={4}
            value={topupDraft}
            onChange={(e) => {
              setTopupDraft(e.target.value);
              setTopupSaved(false);
            }}
            placeholder={topup.effective}
            className="mt-2 w-full rounded-control bg-surface px-3.5 py-2.5 font-mono text-body tabular-nums text-ink ring-1 ring-border transition placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-caption text-muted">
              Kosongkan untuk kembali ke paket bawaan. Berlaku sekarang:{" "}
              <span className="font-mono tabular-nums text-ink">
                {topup.effective.replace(/\n/g, " · ")}
              </span>
            </p>
            <Button
              size="sm"
              variant={topupSaved ? "secondary" : "primary"}
              onClick={saveTopup}
              disabled={topupSaving}
            >
              {topupSaving ? (
                "Menyimpan..."
              ) : topupSaved ? (
                <>
                  <Icon name="check" className="h-4 w-4 text-success" />
                  Tersimpan
                </>
              ) : (
                "Simpan"
              )}
            </Button>
          </div>
        </Section>

        <Section
          icon="play"
          tone="text-accent"
          title="Harga kelas"
          subtitle="Kelas belajar di halaman Learn"
        >
          <div className="mt-3 divide-y divide-divider">
            {courses.map((course) =>
              renderRow({
                type: "course",
                apiId: course.id,
                draftKey: course.id,
                label: course.title,
                detail: `${course.enrollments ?? 0} peserta`,
              })
            )}
          </div>
        </Section>
      </div>
    </Card>
  );
}
