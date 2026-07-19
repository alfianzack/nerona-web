"use client";

import { useState } from "react";

interface CourseSummary {
  id: string;
  slug: string;
  title: string;
}

interface PlanSummary {
  id: string;
  name: string;
  priceLabel: string | null;
}

interface UserResult {
  id: string;
  email: string;
  name: string | null;
  licenses: { id: string; status: string; source: string; planId: string | null }[];
  enrollments: { courseId: string; source: string; course: { slug: string; title: string } }[];
  agentProfile: { status: string; whatsappPhone: string | null; phoneVerifiedAt: string | null } | null;
}

export function AdminUserPanel() {
  const [email, setEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState<UserResult | null>(null);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [planId, setPlanId] = useState("");
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  async function handleSearch() {
    setError("");
    setSearching(true);
    setUser(null);

    const res = await fetch(`/api/admin/users/search?email=${encodeURIComponent(email)}`);
    const data = await res.json().catch(() => null);
    setSearching(false);

    if (!res.ok || !data?.ok) {
      setError(data?.message || "Pengguna tidak ditemukan.");
      return;
    }
    setUser(data.user);
    setCourses(data.courses);
    setPlans(data.plans);
    setPlanId((current) => current || data.user.licenses[0]?.planId || data.plans[0]?.id || "");
  }

  function currentAmount(): number | undefined {
    if (!amount) return undefined;
    const parsed = Number(amount);
    return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
  }

  async function handleLicenseAction(action: "grant" | "revoke") {
    if (!user) return;
    setActionLoading(true);
    await fetch("/api/admin/licenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userEmail: user.email,
        action,
        planId: action === "grant" ? planId : undefined,
        note: note || undefined,
        amount: currentAmount(),
      }),
    });
    await handleSearch();
    setActionLoading(false);
  }

  async function handleEnrollmentAction(courseId: string, action: "grant" | "revoke") {
    if (!user) return;
    setActionLoading(true);
    await fetch("/api/admin/enrollments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userEmail: user.email,
        courseId,
        action,
        note: note || undefined,
        amount: currentAmount(),
      }),
    });
    await handleSearch();
    setActionLoading(false);
  }

  async function handleAgentAction(action: "activate" | "disable") {
    if (!user) return;
    setActionLoading(true);
    await fetch("/api/admin/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userEmail: user.email, action }),
    });
    await handleSearch();
    setActionLoading(false);
  }

  const license = user?.licenses[0];
  const enrolledCourseIds = new Set(user?.enrollments.map((e) => e.courseId));

  return (
    <div className="mt-8 max-w-xl">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Pengguna</h2>

      <div className="mt-2 flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="pengguna@contoh.com"
          className="flex-1 rounded-xl bg-gray-100 px-3 py-2 text-sm ring-0 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 dark:bg-white/10 dark:focus:bg-gray-900 text-gray-950 dark:text-white"
        />
        <button
          onClick={handleSearch}
          disabled={searching || !email}
          className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
        >
          {searching ? "Mencari..." : "Cari"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {user && (
        <div className="mt-6 space-y-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {user.name ?? user.email} ({user.email})
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Catatan (opsional)"
              className="flex-1 rounded-xl bg-gray-100 px-3 py-2 text-sm ring-0 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 dark:bg-white/10 dark:focus:bg-gray-900 text-gray-950 dark:text-white"
            />
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Jumlah Rp (opsional)"
              className="w-36 rounded-xl bg-gray-100 px-3 py-2 text-sm ring-0 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 dark:bg-white/10 dark:focus:bg-gray-900 text-gray-950 dark:text-white"
            />
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-900 dark:ring-white/10">
            <p className="font-medium text-gray-900 dark:text-white">Lisensi</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Status: {license?.status ?? "belum ada"}
            </p>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="mt-2 rounded-xl bg-gray-100 px-3 py-2 text-sm ring-0 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 dark:bg-white/10 dark:focus:bg-gray-900 text-gray-950 dark:text-white"
            >
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} — {plan.priceLabel ?? "harga belum diatur"}
                </option>
              ))}
            </select>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => handleLicenseAction("grant")}
                disabled={actionLoading || !planId}
                className="rounded-full bg-blue-600 px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
              >
                Berikan
              </button>
              <button
                onClick={() => handleLicenseAction("revoke")}
                disabled={actionLoading || !license || license.status === "revoked"}
                className="rounded-full bg-gray-100 px-3.5 py-1.5 text-sm font-medium text-gray-950 transition hover:bg-gray-200 disabled:opacity-50 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
              >
                Cabut
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-900 dark:ring-white/10">
            <p className="font-medium text-gray-900 dark:text-white">Agent</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Status: {user.agentProfile?.status ?? "belum ada"}
              {user.agentProfile?.whatsappPhone
                ? ` — ${user.agentProfile.whatsappPhone} (${
                    user.agentProfile.phoneVerifiedAt ? "terverifikasi" : "belum terverifikasi"
                  })`
                : ""}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => handleAgentAction("activate")}
                disabled={actionLoading || user.agentProfile?.status === "active"}
                className="rounded-full bg-blue-600 px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
              >
                Aktifkan
              </button>
              <button
                onClick={() => handleAgentAction("disable")}
                disabled={actionLoading || !user.agentProfile || user.agentProfile.status === "disabled"}
                className="rounded-full bg-gray-100 px-3.5 py-1.5 text-sm font-medium text-gray-950 transition hover:bg-gray-200 disabled:opacity-50 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
              >
                Nonaktifkan
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <p className="font-medium text-gray-900 dark:text-white">Kelas</p>
            {courses.map((course) => {
              const enrolled = enrolledCourseIds.has(course.id);
              return (
                <div
                  key={course.id}
                  className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-900 dark:ring-white/10"
                >
                  <span className="text-sm text-gray-900 dark:text-white">
                    {course.title}
                    {enrolled ? " — terdaftar" : ""}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEnrollmentAction(course.id, "grant")}
                      disabled={actionLoading || enrolled}
                      className="rounded-full bg-blue-600 px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
                    >
                      Berikan
                    </button>
                    <button
                      onClick={() => handleEnrollmentAction(course.id, "revoke")}
                      disabled={actionLoading || !enrolled}
                      className="rounded-full bg-gray-100 px-3.5 py-1.5 text-sm font-medium text-gray-950 transition hover:bg-gray-200 disabled:opacity-50 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                    >
                      Cabut
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
