"use client";

import { useEffect, useState } from "react";

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

const inputClass =
  "w-44 rounded-xl bg-surface px-3 py-2 text-sm text-ink ring-1 ring-navy-900/[.12] placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-gold-400";
const saveClass =
  "whitespace-nowrap rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-3.5 py-1.5 text-sm font-semibold text-navy-900 transition hover:brightness-110 disabled:opacity-50";
const savedClass =
  "whitespace-nowrap rounded-full bg-emerald-500/10 px-3.5 py-1.5 text-sm font-semibold text-emerald-700";

function PanelHeader({
  chipClass,
  icon,
  title,
  subtitle,
}: {
  chipClass: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-xl ${chipClass}`}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="h-[18px] w-[18px]"
        >
          {icon}
        </svg>
      </span>
      <div>
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <p className="text-xs text-muted">{subtitle}</p>
      </div>
    </div>
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
    return (
      <div key={draftKey} className="flex items-center justify-between gap-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{label}</p>
          <p className="truncate text-xs text-muted">{detail}</p>
        </div>
        <div className="flex flex-none items-center gap-2">
          <div className="relative">
            <input
              type="text"
              value={drafts[draftKey] ?? ""}
              onChange={(e) => setDrafts((d) => ({ ...d, [draftKey]: e.target.value }))}
              placeholder={row.placeholder ?? "Rp ..."}
              aria-label={`Harga ${label}`}
              className={`${inputClass} ${row.suffix ? "pr-8" : ""}`}
            />
            {row.suffix && (
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                {row.suffix}
              </span>
            )}
          </div>
          <button
            onClick={() => handleSave(type, apiId, draftKey)}
            disabled={savingId === draftKey}
            className={isSaved ? savedClass : saveClass}
          >
            {savingId === draftKey ? "Menyimpan..." : isSaved ? "Tersimpan ✓" : "Simpan"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-rose-500">{error}</p>}

      <div className="rounded-2xl bg-gradient-to-b from-surface to-surface2 p-5 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
        <PanelHeader
          chipClass="bg-gold-400/30 text-[#9A6B08]"
          icon={
            <>
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </>
          }
          title="Harga paket Metadata"
          subtitle="Harga per bulan. Harga 3/6/12 bulan dihitung otomatis dari sini."
        />
        <div className="mt-2 divide-y divide-navy-900/10">
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
      </div>

      <div className="rounded-2xl bg-gradient-to-b from-surface to-surface2 p-5 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
        <PanelHeader
          chipClass="bg-emerald-500/15 text-emerald-700"
          icon={
            <>
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </>
          }
          title="Harga paket Agent"
          subtitle="Harga per bulan. Harga 3/6/12 bulan dihitung otomatis dari sini."
        />
        <div className="mt-2 divide-y divide-navy-900/10">
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
      </div>

      <div className="rounded-2xl bg-gradient-to-b from-surface to-surface2 p-5 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
        <PanelHeader
          chipClass="bg-brand-orange/15 text-[#C25717]"
          icon={
            <>
              <line x1="19" y1="5" x2="5" y2="19" />
              <circle cx="6.5" cy="6.5" r="2.5" />
              <circle cx="17.5" cy="17.5" r="2.5" />
            </>
          }
          title="Diskon durasi"
          subtitle="Potongan untuk paket 3 / 6 / 12 bulan — berlaku untuk Metadata dan Agent"
        />
        <div className="mt-2 divide-y divide-navy-900/10">
          {discounts.map((d) => (
            <div key={d.months}>
              {renderRow({
                type: "discount",
                apiId: String(d.months),
                draftKey: `discount:${d.months}`,
                label: d.label,
                detail: previewFor(d),
                placeholder: "0",
                suffix: "%",
              })}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          Harga akhir dibulatkan ke ribuan terdekat. Kosongkan untuk kembali ke potongan bawaan.
        </p>
      </div>

      <div className="rounded-2xl bg-gradient-to-b from-surface to-surface2 p-5 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
        <PanelHeader
          chipClass="bg-gold-400/30 text-[#9A6B08]"
          icon={
            <>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v10M9.5 9.5h5M9.5 14.5h5" />
            </>
          }
          title="Paket poin (top-up)"
          subtitle="Pilihan beli poin satuan di halaman Finance tenant"
        />
        <label htmlFor="topupPackages" className="mt-3 block text-xs text-muted">
          Satu paket per baris, <code>poin=harga</code>. Contoh: <code>1000=45000</code>
        </label>
        <textarea
          id="topupPackages"
          rows={4}
          value={topupDraft}
          onChange={(e) => {
            setTopupDraft(e.target.value);
            setTopupSaved(false);
          }}
          placeholder={topup.effective}
          className="mt-2 w-full rounded-xl bg-surface px-3 py-2 font-mono text-sm text-ink ring-1 ring-navy-900/[.12] placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-gold-400"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-xs text-muted">
            Kosongkan untuk kembali ke paket bawaan. Berlaku sekarang:{" "}
            <span className="font-medium text-ink">{topup.effective.replace(/\n/g, " · ")}</span>
          </p>
          <button
            onClick={saveTopup}
            disabled={topupSaving}
            className={topupSaved ? savedClass : saveClass}
          >
            {topupSaving ? "Menyimpan..." : topupSaved ? "Tersimpan ✓" : "Simpan"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-gradient-to-b from-surface to-surface2 p-5 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
        <PanelHeader
          chipClass="bg-brand-blue/15 text-[#3B65C4]"
          icon={
            <>
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </>
          }
          title="Harga kelas"
          subtitle="Kelas belajar di halaman Learn"
        />
        <div className="mt-2 divide-y divide-navy-900/10">
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
      </div>
    </div>
  );
}
