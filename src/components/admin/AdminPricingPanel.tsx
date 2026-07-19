"use client";

import { useEffect, useState } from "react";

interface PlanRow {
  id: string;
  name: string;
  priceLabel: string | null;
}

interface CourseRow {
  id: string;
  slug: string;
  title: string;
  priceLabel: string | null;
}

const inputClass =
  "w-44 rounded-xl bg-white/5 px-3 py-2 text-sm text-white ring-1 ring-white/10 placeholder:text-navy-300/60 focus:outline-none focus:ring-2 focus:ring-gold-400";
const saveClass =
  "rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-3.5 py-1.5 text-sm font-semibold text-navy-900 transition hover:brightness-110 disabled:opacity-50";

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

  function renderRow(type: "plan" | "course", id: string, label: string) {
    return (
      <div key={id} className="flex items-center justify-between gap-3 py-2">
        <span className="text-sm text-white">{label}</span>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={drafts[id] ?? ""}
            onChange={(e) => setDrafts((d) => ({ ...d, [id]: e.target.value }))}
            placeholder="Rp ..."
            className={inputClass}
          />
          <button onClick={() => handleSave(type, id)} disabled={savingId === id} className={saveClass}>
            {savingId === id ? "Menyimpan..." : savedId === id ? "Tersimpan ✓" : "Simpan"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 max-w-xl">
      <h2 className="text-lg font-semibold text-white">Harga</h2>
      {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}

      <div className="mt-2 rounded-2xl bg-gradient-to-b from-navy-800 to-navy-900 p-5 shadow-lg shadow-black/40 ring-1 ring-white/10">
        <p className="text-sm font-medium text-navy-300">Paket</p>
        <div className="mt-1 divide-y divide-white/10">
          {plans.map((plan) => renderRow("plan", plan.id, plan.name))}
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-gradient-to-b from-navy-800 to-navy-900 p-5 shadow-lg shadow-black/40 ring-1 ring-white/10">
        <p className="text-sm font-medium text-navy-300">Kelas</p>
        <div className="mt-1 divide-y divide-white/10">
          {courses.map((course) => renderRow("course", course.id, course.title))}
        </div>
      </div>
    </div>
  );
}
