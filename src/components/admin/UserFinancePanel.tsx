"use client";
import type { PurchaseView, TxnView } from "@/components/admin/UserDetailTabs";
export function UserFinancePanel(_props: {
  userId: string;
  initialBalance: number;
  initialTransactions: TxnView[];
  purchases: PurchaseView[];
}) {
  return <p className="text-sm text-muted">Finance…</p>;
}
