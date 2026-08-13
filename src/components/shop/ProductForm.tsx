"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

export interface ProductFormValues {
  name: string;
  price: string;
  stock: string;
  description: string;
}

export const EMPTY_PRODUCT: ProductFormValues = { name: "", price: "", stock: "", description: "" };

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
      {/* Field membawa label, petunjuk, dan galat sebagai satu benda. Versi
          sebelumnya menulis <label> tanpa htmlFor, jadi labelnya tidak pernah
          benar-benar tersambung ke isiannya bagi pembaca layar. */}
      <Field
        id="produk-nama"
        label="Nama produk"
        value={values.name}
        onChange={(e) => set("name", e.target.value)}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field
          id="produk-harga"
          label="Harga (Rp)"
          value={values.price}
          onChange={(e) => set("price", e.target.value)}
          inputMode="numeric"
        />
        <Field
          id="produk-stok"
          label="Stok (opsional)"
          value={values.stock}
          onChange={(e) => set("stock", e.target.value)}
          inputMode="numeric"
        />
      </div>
      <Field
        id="produk-deskripsi"
        label="Deskripsi (opsional)"
        value={values.description}
        onChange={(e) => set("description", e.target.value)}
      />
      {(error || serverError) && (
        <p className="text-caption text-danger">{error || serverError}</p>
      )}
      {/* Menyimpan produk bukan aksi yang menggerakkan uang, jadi tombolnya
          primary — emas disimpan untuk top-up, pembayaran, dan perpanjangan. */}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel}>
          Batal
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Menyimpan..." : "Simpan"}
        </Button>
      </div>
    </div>
  );
}
