"use client";

import { useCallback, useEffect, useState } from "react";

interface CourseSummary {
  id: string;
  slug: string;
  title: string;
}

interface PlanSummary {
  id: string;
  name: string;
  priceMonthly: number | null;
}

interface UserResult {
  id: string;
  email: string;
  name: string | null;
  licenses: { id: string; status: string; source: string; planId: string | null }[];
  enrollments: { courseId: string; source: string; course: { slug: string; title: string } }[];
  agentProfile: { status: string; plan: string; whatsappPhone: string | null; phoneVerifiedAt: string | null } | null;
}

const AGENT_PLANS = ["free", "pro", "business"];

const cardClass =
  "rounded-2xl bg-gradient-to-b from-surface to-surface2 p-5 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10";
const inputClass =
  "rounded-xl bg-navy-900/5 px-3 py-2 text-sm text-ink ring-1 ring-navy-900/10 placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-gold-400";
const primaryBtn =
  "rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-3.5 py-1.5 text-sm font-semibold text-navy-900 transition hover:brightness-110 disabled:opacity-50";
const secondaryBtn =
  "rounded-full bg-navy-900/5 px-3.5 py-1.5 text-sm font-medium text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10 disabled:opacity-50";

export function UserPlanManager({ userEmail }: { userEmail: string }) {
  const [error, setError] = useState("");
  const [user, setUser] = useState<UserResult | null>(null);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [planId, setPlanId] = useState("");
  const [agentPlan, setAgentPlan] = useState("free");
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setError("");
    const res = await fetch(`/api/admin/users/search?email=${encodeURIComponent(userEmail)}`);
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setError(data?.message || "Pengguna tidak ditemukan.");
      return;
    }
    setUser(data.user);
    setCourses(data.courses);
    setPlans(data.plans);
    setPlanId((current) => current || data.user.licenses[0]?.planId || data.plans[0]?.id || "");
    setAgentPlan((current) => data.user.agentProfile?.plan || current || "free");
  }, [userEmail]);

  useEffect(() => {
    load();
  }, [load]);

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
    await load();
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
    await load();
    setActionLoading(false);
  }

  async function handleAgentAction(action: "activate" | "disable") {
    if (!user) return;
    setActionLoading(true);
    await fetch("/api/admin/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userEmail: user.email,
        action,
        plan: action === "activate" ? agentPlan : undefined,
      }),
    });
    await load();
    setActionLoading(false);
  }

  if (error && !user) {
    return <p className="text-sm text-rose-500">{error}</p>;
  }
  if (!user) {
    return <p className="text-sm text-muted">Memuat...</p>;
  }

  const license = user.licenses[0];
  const enrolledCourseIds = new Set(user.enrollments.map((e) => e.courseId));

  return (
    <div className="space-y-6">
      <div>
        <p className="font-medium text-ink">{user.name ?? user.email}</p>
        <p className="text-sm text-muted">{user.email}</p>
      </div>

      {error && <p className="text-sm text-rose-500">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Catatan (opsional)"
          className={`flex-1 ${inputClass}`}
        />
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Jumlah Rp (opsional)"
          className={`w-40 ${inputClass}`}
        />
      </div>

      <div className={cardClass}>
        <p className="font-medium text-ink">Lisensi Metadata</p>
        <p className="text-sm text-muted">Status: {license?.status ?? "belum ada"}</p>
        <select
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          className={`mt-2 ${inputClass}`}
        >
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name} — {plan.priceMonthly === null ? "harga belum diatur" : `Rp ${plan.priceMonthly.toLocaleString("id-ID")}/bulan`}
            </option>
          ))}
        </select>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => handleLicenseAction("grant")}
            disabled={actionLoading || !planId}
            className={primaryBtn}
          >
            Berikan
          </button>
          <button
            onClick={() => handleLicenseAction("revoke")}
            disabled={actionLoading || !license || license.status === "revoked"}
            className={secondaryBtn}
          >
            Cabut
          </button>
        </div>
      </div>

      <div className={cardClass}>
        <p className="font-medium text-ink">Agent</p>
        <p className="text-sm text-muted">
          Status: {user.agentProfile?.status ?? "belum ada"}
          {user.agentProfile?.whatsappPhone
            ? ` — ${user.agentProfile.whatsappPhone} (${
                user.agentProfile.phoneVerifiedAt ? "terverifikasi" : "belum terverifikasi"
              })`
            : ""}
        </p>
        <select
          value={agentPlan}
          onChange={(e) => setAgentPlan(e.target.value)}
          className={`mt-2 ${inputClass}`}
        >
          {AGENT_PLANS.map((plan) => (
            <option key={plan} value={plan}>
              {plan}
            </option>
          ))}
        </select>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => handleAgentAction("activate")}
            disabled={actionLoading}
            className={primaryBtn}
          >
            {user.agentProfile?.status === "active" ? "Perbarui paket" : "Aktifkan"}
          </button>
          <button
            onClick={() => handleAgentAction("disable")}
            disabled={actionLoading || !user.agentProfile || user.agentProfile.status === "disabled"}
            className={secondaryBtn}
          >
            Nonaktifkan
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <p className="font-medium text-ink">Kelas</p>
        {courses.map((course) => {
          const enrolled = enrolledCourseIds.has(course.id);
          return (
            <div
              key={course.id}
              className="flex items-center justify-between rounded-2xl bg-gradient-to-b from-surface to-surface2 p-4 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10"
            >
              <span className="text-sm text-ink">
                {course.title}
                {enrolled ? " — terdaftar" : ""}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEnrollmentAction(course.id, "grant")}
                  disabled={actionLoading || enrolled}
                  className={primaryBtn}
                >
                  Berikan
                </button>
                <button
                  onClick={() => handleEnrollmentAction(course.id, "revoke")}
                  disabled={actionLoading || !enrolled}
                  className={secondaryBtn}
                >
                  Cabut
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
