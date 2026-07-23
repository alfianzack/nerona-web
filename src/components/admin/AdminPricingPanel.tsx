"use client";

import { useEffect, useState } from "react";

interface PlanRow {
  id: string;
  name: string;
  priceLabel: string | null;
  activeLicenses?: number;
}

interface CourseRow {
  id: string;
  slug: string;
  title: string;
  priceLabel: string | null;
  enrollments?: number;
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
    setCourses(data.courses);
    const nextDrafts: Record<string, string> = {};
    for (const plan of data.plans) nextDrafts[plan.id] = plan.priceLabel ?? "";
    for (const course of data.courses) nextDrafts[course.id] = course.priceLabel ?? "";
    setDrafts(nextDrafts);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave(type: "plan" | "course", id: string) {
    setError("");
    setSavedId("");
    setSavingId(id);
    const res = await fetch("/api/admin/pricing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id, priceLabel: drafts[id] ?? "" }),
    });
    setSavingId("");
    if (!res.ok) {
      setError("Gagal menyimpan harga.");
      return;
    }
    setSavedId(id);
  }

  function renderRow(type: "plan" | "course", id: string, label: string, detail: string) {
    const isSaved = savedId === id;
    return (
      <div key={id} className="flex items-center justify-between gap-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{label}</p>
          <p className="truncate text-xs text-muted">{detail}</p>
        </div>
        <div className="flex flex-none items-center gap-2">
          <input
            type="text"
            value={drafts[id] ?? ""}
            onChange={(e) => setDrafts((d) => ({ ...d, [id]: e.target.value }))}
            placeholder="Rp ..."
            aria-label={`Harga ${label}`}
            className={inputClass}
          />
          <button
            onClick={() => handleSave(type, id)}
            disabled={savingId === id}
            className={isSaved ? savedClass : saveClass}
          >
            {savingId === id ? "Menyimpan..." : isSaved ? "Tersimpan ✓" : "Simpan"}
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
          title="Harga paket"
          subtitle="Label harga yang tampil di halaman pricing"
        />
        <div className="mt-2 divide-y divide-navy-900/10">
          {plans.map((plan) =>
            renderRow("plan", plan.id, plan.name, `${plan.activeLicenses ?? 0} lisensi aktif`)
          )}
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
            renderRow("course", course.id, course.title, `${course.enrollments ?? 0} peserta`)
          )}
        </div>
      </div>
    </div>
  );
}
