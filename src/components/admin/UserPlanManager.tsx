"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

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

/**
 * Belum ada primitive untuk <select>. Bentuknya dijiplak dari Input — radius
 * kendali, cincin border, dan cincin fokus aksen yang sama — supaya pemilih
 * paket tidak berbeda tinggi dari kedua isian di atasnya.
 */
const selectClass =
  "rounded-control bg-surface px-3.5 py-2.5 text-body text-ink ring-1 ring-border transition focus:outline-none focus:ring-2 focus:ring-accent";

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
    return <p className="text-body text-danger">{error}</p>;
  }
  if (!user) {
    return <p className="text-body text-muted">Memuat...</p>;
  }

  const license = user.licenses[0];
  const enrolledCourseIds = new Set(user.enrollments.map((e) => e.courseId));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-body font-semibold text-ink">{user.name ?? user.email}</p>
        <p className="mt-0.5 text-caption text-muted">{user.email}</p>
      </div>

      {error && <p className="text-caption text-danger">{error}</p>}

      {/* Kedua isian ini tidak punya label terlihat, hanya placeholder — yang
          hilang begitu orang mulai mengetik. aria-label menyalin kata yang sama
          supaya pembaca layar tetap tahu isian mana yang sedang diisi. */}
      <div className="flex flex-wrap gap-2">
        <Input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Catatan (opsional)"
          aria-label="Catatan (opsional)"
          className="flex-1"
        />
        <Input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Jumlah Rp (opsional)"
          aria-label="Jumlah Rp (opsional)"
          className="w-40"
        />
      </div>

      <Card padding="lg">
        <h3 className="text-title-2 text-ink">Lisensi Metadata</h3>
        {/* Nilai statusnya kata mesin — "active", "comp", "revoked" — jadi
            ditulis mono seperti ID, bukan seperti kalimat. */}
        <p className="mt-1 text-caption text-muted">
          Status: <span className="font-mono text-ink">{license?.status ?? "belum ada"}</span>
        </p>
        <select
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          aria-label="Paket"
          className={`mt-3 ${selectClass}`}
        >
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name} — {plan.priceMonthly === null ? "harga belum diatur" : `Rp ${plan.priceMonthly.toLocaleString("id-ID")}/bulan`}
            </option>
          ))}
        </select>
        {/* Mencabut lisensi mematikan akses orang yang sudah membayar, dan itu
            tidak bisa dibatalkan dari layar ini — jadi tombolnya danger. */}
        <div className="mt-4 flex gap-2">
          <Button onClick={() => handleLicenseAction("grant")} disabled={actionLoading || !planId}>
            Berikan
          </Button>
          <Button
            variant="danger"
            onClick={() => handleLicenseAction("revoke")}
            disabled={actionLoading || !license || license.status === "revoked"}
          >
            Cabut
          </Button>
        </div>
      </Card>

      <Card padding="lg">
        <h3 className="text-title-2 text-ink">Agent</h3>
        <p className="mt-1 text-caption text-muted">
          Status: <span className="font-mono text-ink">{user.agentProfile?.status ?? "belum ada"}</span>
          {user.agentProfile?.whatsappPhone
            ? ` — ${user.agentProfile.whatsappPhone} (${
                user.agentProfile.phoneVerifiedAt ? "terverifikasi" : "belum terverifikasi"
              })`
            : ""}
        </p>
        <select
          value={agentPlan}
          onChange={(e) => setAgentPlan(e.target.value)}
          aria-label="Paket agent"
          className={`mt-3 ${selectClass}`}
        >
          {AGENT_PLANS.map((plan) => (
            <option key={plan} value={plan}>
              {plan}
            </option>
          ))}
        </select>
        {/* Menonaktifkan agent memutus nomor WhatsApp pelanggan dari layanan —
            sekelas mencabut lisensi, jadi nadanya sama. */}
        <div className="mt-4 flex gap-2">
          <Button onClick={() => handleAgentAction("activate")} disabled={actionLoading}>
            {user.agentProfile?.status === "active" ? "Perbarui paket" : "Aktifkan"}
          </Button>
          <Button
            variant="danger"
            onClick={() => handleAgentAction("disable")}
            disabled={actionLoading || !user.agentProfile || user.agentProfile.status === "disabled"}
          >
            Nonaktifkan
          </Button>
        </div>
      </Card>

      <div className="space-y-3">
        <h3 className="text-title-2 text-ink">Kelas</h3>
        {courses.map((course) => {
          const enrolled = enrolledCourseIds.has(course.id);
          return (
            /* Baris daftar, bukan panel: padding lebih rapat dan tombolnya
               ukuran kecil, supaya deretan kelas tidak menyaingi kedua kartu
               di atasnya. */
            <Card
              key={course.id}
              padding="sm"
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <span className="min-w-0 text-body text-ink">
                {course.title}
                {enrolled ? " — terdaftar" : ""}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleEnrollmentAction(course.id, "grant")}
                  disabled={actionLoading || enrolled}
                >
                  Berikan
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleEnrollmentAction(course.id, "revoke")}
                  disabled={actionLoading || !enrolled}
                >
                  Cabut
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
