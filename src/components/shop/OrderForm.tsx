"use client";

import { useState } from "react";
import { formatRupiah } from "@/components/shop/ProductManager";

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

const inputClass =
  "w-full rounded-xl bg-navy-900/5 px-3 py-2 text-sm text-ink ring-1 ring-navy-900/10 placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-gold-400";
const secondaryBtn =
  "rounded-full bg-navy-900/5 px-3.5 py-1.5 text-sm font-medium text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10 disabled:opacity-50";

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
        <input
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Nama pelanggan (opsional)"
          className={inputClass}
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Catatan (opsional)"
          className={inputClass}
        />
      </div>

      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <select
              value={item.productId}
              onChange={(e) => onPickProduct(index, e.target.value)}
              className={`${inputClass} sm:w-40`}
            >
              <option value="">— pilih produk —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              value={item.productName}
              onChange={(e) => updateItem(index, { productName: e.target.value })}
              placeholder="Nama item"
              className={`${inputClass} sm:flex-1`}
            />
            <input
              value={item.qty}
              onChange={(e) => updateItem(index, { qty: e.target.value })}
              placeholder="Qty"
              inputMode="numeric"
              className={`${inputClass} sm:w-16`}
            />
            <input
              value={item.unitPrice}
              onChange={(e) => updateItem(index, { unitPrice: e.target.value })}
              placeholder="Harga"
              inputMode="numeric"
              className={`${inputClass} sm:w-24`}
            />
            <button
              onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
              className="rounded-full px-2 py-1 text-sm text-rose-600 transition hover:bg-rose-500/10"
              aria-label="Hapus item"
            >
              ✕
            </button>
          </div>
        ))}
        <button onClick={() => setItems((prev) => [...prev, emptyItem()])} className={secondaryBtn}>
          + Item
        </button>
      </div>

      <div className="flex items-center justify-between border-t border-navy-900/10 pt-3">
        <span className="text-sm font-semibold text-ink">Total</span>
        <span className="text-lg font-extrabold text-brand-blue">{formatRupiah(draftTotal)}</span>
      </div>

      {(error || serverError) && (
        <p className="text-sm text-rose-500">{error || serverError}</p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className={secondaryBtn}>
          Batal
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-4 py-2 text-sm font-semibold text-navy-900 transition hover:brightness-110 disabled:opacity-50"
        >
          {submitting ? "Menyimpan..." : "Simpan transaksi"}
        </button>
      </div>
    </div>
  );
}
