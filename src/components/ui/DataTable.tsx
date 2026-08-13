"use client";

import { ReactNode } from "react";
import { Button } from "./Button";
import { Card } from "./Card";
import { Icon } from "./icons";

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  sort: string;
  order: "asc" | "desc";
  loading?: boolean;
  emptyMessage?: string;
  rowKey: (row: T) => string;
  onPageChange: (page: number) => void;
  onSortChange: (sort: string, order: "asc" | "desc") => void;
}

export function DataTable<T>({
  columns,
  rows,
  total,
  page,
  pageSize,
  sort,
  order,
  loading,
  emptyMessage = "Belum ada data.",
  rowKey,
  onPageChange,
  onSortChange,
}: DataTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  function handleHeaderClick(col: Column<T>) {
    if (!col.sortable) return;
    if (sort === col.key) {
      onSortChange(col.key, order === "asc" ? "desc" : "asc");
    } else {
      onSortChange(col.key, "asc");
    }
  }

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-body">
          <thead>
            <tr className="border-b border-border font-mono text-label uppercase text-muted">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleHeaderClick(col)}
                  className={`px-4 py-3 ${col.sortable ? "cursor-pointer select-none hover:text-ink" : ""} ${col.className ?? ""}`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {col.header}
                    {/* Ikon, bukan glyph teks. ▲ dan ▼ dirender font sistem:
                        tingginya berbeda antar mesin, tidak bisa disetel
                        ukurannya, dan tidak ikut warna teks di sekitarnya. */}
                    {col.sortable && sort === col.key && (
                      <Icon
                        name={order === "asc" ? "chevron-up" : "chevron-down"}
                        className="h-3.5 w-3.5"
                      />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-muted">
                  Memuat...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-muted">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row) => (
                <tr key={rowKey(row)} className="border-b border-divider last:border-0">
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 text-ink ${col.className ?? ""}`}>
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-caption text-muted">
        <span>
          Menampilkan <span className="font-mono tabular-nums text-ink">{from}–{to}</span> dari{" "}
          <span className="font-mono tabular-nums text-ink">{total}</span>
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            Sebelumnya
          </Button>
          <span className="font-mono tabular-nums text-ink">
            {page} / {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            Berikutnya
          </Button>
        </div>
      </div>
    </Card>
  );
}
