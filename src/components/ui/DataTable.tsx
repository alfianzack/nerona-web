"use client";

import { ReactNode } from "react";
import { Card } from "./Card";
import { Icon } from "./icons";
import { Pagination } from "./Pagination";

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
                  scope="col"
                  aria-sort={
                    col.sortable
                      ? sort === col.key
                        ? order === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                      : undefined
                  }
                  className={`px-4 py-3 ${col.className ?? ""}`}
                >
                  {/* Kepala kolom yang bisa diurutkan adalah tombol sungguhan,
                      bukan <th> ber-onClick. Sebelumnya pengurutan sama sekali
                      tidak bisa dicapai dari papan ketik: elemennya tidak
                      pernah menerima fokus, jadi aturan :focus-visible global
                      pun tidak menolong. */}
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => handleHeaderClick(col)}
                      className="inline-flex select-none items-center gap-1.5 rounded-control transition hover:text-ink"
                    >
                      {col.header}
                      {/* Ikon, bukan glyph teks: glyph panah dirender font
                          sistem, tingginya berbeda antar mesin, ukurannya tidak
                          bisa disetel, dan warnanya tidak ikut teks sekitarnya. */}
                      {sort === col.key && (
                        <Icon
                          name={order === "asc" ? "chevron-up" : "chevron-down"}
                          className="h-3.5 w-3.5"
                        />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
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
      {/* Kaki paginasi bersama; ia tidak mencetak apa pun saat total 0, jadi
          garis atasnya ikut hanya kalau ada isi. */}
      {total > 0 && (
        <Pagination
          className="border-t border-border px-4 py-3"
          page={page}
          total={total}
          pageSize={pageSize}
          onPageChange={onPageChange}
          busy={loading}
        />
      )}
    </Card>
  );
}
