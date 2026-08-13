"use client";

import { useState } from "react";
import { UserPlanManager } from "@/components/admin/UserPlanManager";
import { UserFinancePanel } from "@/components/admin/UserFinancePanel";

export interface TxnView {
  id: string;
  delta: number;
  reason: string;
  note: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface PurchaseView {
  id: string;
  kind: "plan" | "order";
  label: string;
  detail: string | null;
  amount: number | null;
  date: string;
}

type Tab = "paket" | "finance";

const TABS: { key: Tab; label: string }[] = [
  { key: "paket", label: "Paket" },
  { key: "finance", label: "Finance" },
];

export function UserDetailTabs(props: {
  userEmail: string;
  userId: string;
  balance: number;
  transactions: TxnView[];
  purchases: PurchaseView[];
}) {
  const [tab, setTab] = useState<Tab>("paket");

  return (
    <div>
      {/* Tab aktif ditandai batang aksen, bukan emas: emas di dalam aplikasi
          hanya menandai aksi yang menggerakkan uang, sedangkan "tab yang
          sedang dibuka" adalah keadaan diam — pola yang sama dipakai keadaan
          aktif di sidebar. Tab tak-aktif tetap menyediakan tebal batangnya
          dalam warna tembus pandang supaya labelnya tidak bergeser 2px saat
          tab berpindah. */}
      <div className="flex gap-1.5 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-body font-semibold transition ${
              tab === t.key
                ? "border-accent text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "paket" ? (
          <UserPlanManager userEmail={props.userEmail} />
        ) : (
          <UserFinancePanel
            userId={props.userId}
            initialBalance={props.balance}
            initialTransactions={props.transactions}
            purchases={props.purchases}
          />
        )}
      </div>
    </div>
  );
}
