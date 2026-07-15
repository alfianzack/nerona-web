"use client";

import { useState } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthButton } from "@/components/auth/AuthButton";

export default function PricingPage() {
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubscribe() {
    setError("");
    setLoading(true);

    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interval }),
    });

    if (res.status === 401) {
      window.location.href = "/login?callbackUrl=/pricing";
      return;
    }

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.url) {
      setError(data?.message || "Something went wrong.");
      setLoading(false);
      return;
    }

    window.location.href = data.url;
  }

  return (
    <AuthCard title="Nerona Pro" subtitle="Full access across every supported marketplace.">
      <div className="flex justify-center gap-2">
        <button
          onClick={() => setInterval("monthly")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            interval === "monthly"
              ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
              : "border border-gray-300 text-gray-900 dark:border-gray-700 dark:text-white"
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setInterval("yearly")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            interval === "yearly"
              ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
              : "border border-gray-300 text-gray-900 dark:border-gray-700 dark:text-white"
          }`}
        >
          Yearly
        </button>
      </div>

      {error && <p className="mt-4 text-center text-sm text-red-600">{error}</p>}

      <div className="mt-6">
        <AuthButton onClick={handleSubscribe} disabled={loading}>
          {loading ? "Redirecting..." : `Subscribe (${interval})`}
        </AuthButton>
      </div>
    </AuthCard>
  );
}
