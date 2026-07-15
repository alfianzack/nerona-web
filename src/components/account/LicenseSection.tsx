"use client";

import { useState } from "react";

interface LicenseSectionProps {
  licenseKey: string;
  planName: string;
  status: string;
  validUntil: string | null;
}

export function LicenseSection({ licenseKey, planName, status, validUntil }: LicenseSectionProps) {
  const [copied, setCopied] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(licenseKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleManageBilling() {
    setPortalLoading(true);
    const res = await fetch("/api/billing-portal", { method: "POST" });
    const data = await res.json().catch(() => null);
    if (data?.url) {
      window.location.href = data.url;
      return;
    }
    setPortalLoading(false);
  }

  return (
    <div className="mt-4 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <p className="text-sm text-gray-500 dark:text-gray-400">License key</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="rounded bg-gray-100 px-2 py-1 text-sm dark:bg-gray-900">{licenseKey}</code>
        <button onClick={handleCopy} className="text-sm font-medium text-gray-900 underline dark:text-white">
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <p className="mt-3 text-sm">Plan: {planName}</p>
      <p className="text-sm">Status: {status}</p>
      {validUntil && <p className="text-sm">Valid until: {validUntil}</p>}
      <button
        onClick={handleManageBilling}
        disabled={portalLoading}
        className="mt-3 text-sm font-medium text-gray-900 underline disabled:opacity-50 dark:text-white"
      >
        {portalLoading ? "Loading..." : "Manage billing"}
      </button>
    </div>
  );
}
