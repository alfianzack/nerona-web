"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Icon } from "@/components/ui/icons";
import { formatRupiah } from "@/lib/format";

export interface ProductOption {
  id: string;
  name: string;
  price: number;
}

export interface OrderItemPayload {
  productId: string | null;
  productName: string;
  qty: number;
  unitPrice: number;
}

export interface OrderFormPayload {
  customerName: string;
  note: string;
  items: OrderItemPayload[];
}

interface DraftItem {
  productId: string;
  productName: string;
  qty: string;
  unitPrice: string;
}

const emptyItem = (): DraftItem => ({ productId: "", productName: "", qty: "1", unitPrice: "" });

/**
 * Belum ada primitive untuk <select>. Bentuknya dijiplak dari Input supaya
 * pemilih produk dan keempat isian di baris yang sama punya tinggi, radius,
 * dan cincin fokus yang sama.
 */
const selectClass =
  "w-full rounded-control bg-surface px-3 py-2.5 text-body text-ink ring-1 ring-border transition focus:outline-none focus:ring-2 focus:ring-accent";

interface OrderFormProps {
  products: ProductOption[];
  submitting: boolean;
  serverError?: string;
  onSubmit: (payload: OrderFormPayload) => void;
  onCancel: () => void;
}

export function OrderForm({ products, submitting, serverError, onSubmit, onCancel }: OrderFormProps) {
  const [customerName, setCustomerName] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [error, setError] = useState("");

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function onPickProduct(index: number, productId: string) {
    const product = products.find((p) => p.id === productId);
    if (product) {
      updateItem(index, { productId, productName: product.name, unitPrice: String(product.price) });
    } else {
      updateItem(index, { productId: "" });
    }
  }

  const draftTotal = items.reduce(
    (sum, item) => sum + (Number(item.qty) || 0) * (Number(item.unitPrice) || 0),
    0
  );

  function handleSubmit() {
    const cleaned = items.filter((item) => item.productName.trim() && Number(item.qty) > 0);
    if (cleaned.length === 0) {
      setError("Tambahkan minimal satu item dengan nama dan jumlah.");
      return;
    }
    setError("");
    onSubmit({
      customerName,
      note,
      items: cleaned.map((item) => ({
        productId: item.productId || null,
        productName: item.productName.trim(),
        qty: Number(item.qty),
        unitPrice: Number(item.unitPrice) || 0,
      })),
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Nama pelanggan (opsional)"
        />
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Catatan (opsional)"
        />
      </div>

      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <select
              value={item.productId}
              onChange={(e) => onPickProduct(index, e.target.value)}
              className={`${selectClass} sm:w-40`}
            >
              <option value="">— pilih produk —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <Input
              value={item.productName}
              onChange={(e) => updateItem(index, { productName: e.target.value })}
              placeholder="Nama item"
              className="sm:flex-1"
            />
            <Input
              value={item.qty}
              onChange={(e) => updateItem(index, { qty: e.target.value })}
              placeholder="Qty"
              inputMode="numeric"
              className="font-mono tabular-nums sm:w-16"
            />
            <Input
              value={item.unitPrice}
              onChange={(e) => updateItem(index, { unitPrice: e.target.value })}
              placeholder="Harga"
              inputMode="numeric"
              className="font-mono tabular-nums sm:w-24"
            />
            {/* Ikon, bukan glyph ✕: glyph teks dirender oleh huruf sistem, jadi
                tingginya tidak pernah sama dengan tinggi isian di sebelahnya.
                Tombolnya sengaja telanjang — tombol merah pekat di setiap baris
                item terbaca lebih keras daripada aksinya. */}
            <button
              onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
              className="rounded-control p-2 text-danger transition hover:bg-danger-bg"
              aria-label="Hapus item"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={() => setItems((prev) => [...prev, emptyItem()])}>
          + Item
        </Button>
      </div>

      <div className="flex items-center justify-between border-t border-divider pt-3">
        <span className="text-body font-semibold text-ink">Total</span>
        {/* Tinta, bukan aksen: aksen menandai sesuatu yang bisa ditekan, dan
            total bukan tautan. Disamakan dengan CheckoutView dan detail order. */}
        <span className="font-mono text-title-2 tabular-nums text-ink">
          {formatRupiah(draftTotal)}
        </span>
      </div>

      {(error || serverError) && (
        <p className="text-caption text-danger">{error || serverError}</p>
      )}

      {/* Mencatat transaksi bukan aksi yang menggerakkan uang — tidak ada yang
          dibayar di sini — jadi tombolnya primary, bukan emas. */}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onCancel}>
          Batal
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Menyimpan..." : "Simpan transaksi"}
        </Button>
      </div>
    </div>
  );
}
