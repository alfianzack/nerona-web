"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";

interface OrderRow {
  id: string;
  product: string;
  planName: string;
  durationMonths: number;
  contactNote: string | null;
  createdAt: string;
  proofUploadedAt: string | null;
  isRenewal: boolean;
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
    /* Satu kolom sempit, bukan selebar halaman: tiap order dibaca dari atas ke
       bawah, dan barisnya pendek-pendek. Lebarnya disamakan dengan kolom detail
       pengguna supaya kedua layar admin terasa satu keluarga. */
    <div className="max-w-2xl space-y-3">
      {error && <p className="text-caption text-danger">{error}</p>}

      {orders.length === 0 && (
        <Card>
          <p className="text-body text-muted">Tidak ada order yang menunggu.</p>
        </Card>
      )}

      {orders.map((order) => (
        <Card key={order.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-body font-semibold text-ink">
                  {order.product === "points"
                    ? "Top-up poin"
                    : order.product === "metadata"
                      ? "Metadata"
                      : "Agent"}{" "}
                  — {order.planName}
                </p>
                {/* Dua chip yang dulu ditulis tangan: satu pil abu-abu, satu
                    pil biru yang warnanya ditulis sebagai hex lepas di tempat.
                    Keduanya turun jadi Badge, jadi langkah warnanya sama dengan
                    chip status di seluruh aplikasi. */}
                {order.durationMonths > 1 && order.product !== "points" && (
                  <Badge>{order.durationMonths} bulan</Badge>
                )}
                {order.isRenewal && <Badge tone="info">Perpanjangan</Badge>}
              </div>
              <p className="mt-1 text-caption text-muted">
                {order.user.name ? `${order.user.name} — ` : ""}
                {order.user.email}
              </p>
            </div>
            <p className="font-mono text-label tabular-nums text-muted">
              {new Date(order.createdAt).toLocaleDateString("id-ID")}
            </p>
          </div>

          {order.contactNote && (
            <p className="mt-2 text-caption text-muted">Catatan: {order.contactNote}</p>
          )}

          {order.proofUploadedAt ? (
            /* Tautan keluar, bukan navigasi dalam aplikasi: buktinya dibuka di
               tab baru lewat route API, jadi TextLink (next/link, plus kurung
               sudut) salah tempat. Glyph ↗ diganti ikon supaya bentuk dan
               warnanya tidak lagi ditentukan font sistem. */
            <a
              href={`/api/orders/${order.id}/proof`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-caption text-accent transition hover:underline"
            >
              Lihat bukti transfer
              <Icon name="external-link" className="h-3.5 w-3.5" />
            </a>
          ) : (
            <p className="mt-2 text-caption text-muted">Belum ada bukti transfer</p>
          )}

          {/* Mengaktifkan order tidak memindahkan uang — uangnya sudah masuk
              lewat transfer bank — jadi tombolnya primary, bukan emas. Menolak
              order membatalkannya untuk selamanya, dan itu aksi merusak. */}
          <div className="mt-4 flex gap-2">
            <Button onClick={() => handleAction(order.id, "fulfill")} disabled={actionId === order.id}>
              Aktifkan
            </Button>
            <Button
              variant="danger"
              onClick={() => handleAction(order.id, "cancel")}
              disabled={actionId === order.id}
            >
              Tolak
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
