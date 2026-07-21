"use client";

import { useState } from "react";

export interface ProductFormValues {
  name: string;
  price: string;
  stock: string;
  description: string;
}

export const EMPTY_PRODUCT: ProductFormValues = { name: "", price: "", stock: "", description: "" };

const inputClass =
  "w-full rounded-xl bg-navy-900/5 px-3 py-2 text-sm text-ink ring-1 ring-navy-900/10 placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-gold-400";

interface ProductFormProps {
  initial: ProductFormValues;
  submitting: boolean;
  serverError?: string;
  onSubmit: (values: ProductFormValues) => void;
  onCancel: () => void;
}

export function ProductForm({ initial, submitting, serverError, onSubmit, onCancel }: ProductFormProps) {
  const [values, setValues] = useState<ProductFormValues>(initial);
  const [error, setError] = useState("");

  function set<K extends keyof ProductFormValues>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleSubmit() {
    if (!values.name.trim() || values.price === "") {
      setError("Nama dan harga wajib diisi.");
      return;
    }
    const priceNum = Number(values.price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setError("Harga harus berupa angka yang valid.");
      return;
    }
    setError("");
    onSubmit(values);
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm text-muted">Nama produk</label>
        <input value={values.name} onChange={(e) => set("name", e.target.value)} className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-muted">Harga (Rp)</label>
          <input
            value={values.price}
            onChange={(e) => set("price", e.target.value)}
            inputMode="numeric"
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-sm text-muted">Stok (opsional)</label>
          <input
            value={values.stock}
            onChange={(e) => set("stock", e.target.value)}
            inputMode="numeric"
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label className="text-sm text-muted">Deskripsi (opsional)</label>
        <input
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          className={inputClass}
        />
      </div>
      {(error || serverError) && (
        <p className="text-sm text-rose-500">{error || serverError}</p>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          className="rounded-full bg-navy-900/5 px-4 py-2 text-sm font-medium text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10"
        >
          Batal
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-4 py-2 text-sm font-semibold text-navy-900 transition hover:brightness-110 disabled:opacity-50"
        >
          {submitting ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </div>
  );
}
