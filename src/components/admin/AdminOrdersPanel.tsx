"use client";

import { useEffect, useState } from "react";

interface OrderRow {
  id: string;
  product: string;
  planName: string;
  contactNote: string | null;
  createdAt: string;
  user: { email: string; name: string | null };
}

export function AdminOrdersPanel() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState("");

  async function load() {
    const res = await fetch("/api/admin/orders");
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setError("Gagal memuat daftar order.");
      return;
    }
    setOrders(data.orders);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAction(orderId: string, action: "fulfill" | "cancel") {
    setError("");
    setActionId(orderId);
    const res = await fetch("/api/admin/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, action }),
    });
    setActionId("");
    if (!res.ok) {
      setError(action === "fulfill" ? "Gagal mengaktifkan order." : "Gagal membatalkan order.");
      return;
    }
    await load();
  }

  return (
    <div className="mt-8 max-w-xl">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Order Masuk</h2>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-2 space-y-3">
        {orders.length === 0 && (
          <p className="rounded-2xl bg-white p-5 text-sm text-gray-500 shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-900 dark:text-gray-400 dark:ring-white/10">
            Tidak ada order yang menunggu.
          </p>
        )}
        {orders.map((order) => (
          <div
            key={order.id}
            className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-900 dark:ring-white/10"
          >
            <div className="flex items-center justify-between">
              <p className="font-medium text-gray-900 dark:text-white">
                {order.product === "metadata" ? "Metadata" : "Agent"} — {order.planName}
              </p>
              <p className="text-xs text-gray-400">
                {new Date(order.createdAt).toLocaleDateString("id-ID")}
              </p>
            </div>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {order.user.name ? `${order.user.name} — ` : ""}
              {order.user.email}
            </p>
            {order.contactNote && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Catatan: {order.contactNote}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => handleAction(order.id, "fulfill")}
                disabled={actionId === order.id}
                className="rounded-full bg-blue-600 px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
              >
                Aktifkan
              </button>
              <button
                onClick={() => handleAction(order.id, "cancel")}
                disabled={actionId === order.id}
                className="rounded-full bg-gray-100 px-3.5 py-1.5 text-sm font-medium text-gray-950 transition hover:bg-gray-200 disabled:opacity-50 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
              >
                Tolak
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
