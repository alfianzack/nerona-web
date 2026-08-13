"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export interface MetadataLogRow {
  id: string;
  marketplace: string;
  pageUrl: string;
  title: string;
  keywords: string;
  keywordCount: number;
  createdAt: string;
  /** Hanya diisi di tampilan admin. */
  owner?: string | null;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Keyword ditampilkan penuh hanya kalau barisnya dibuka. Satu baris bisa berisi
 * 50 keyword; menampilkan semuanya sekaligus membuat daftar 100 baris tidak
 * terbaca sama sekali.
 */
function KeywordCell({ keywords, count }: { keywords: string; count: number }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(keywords);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard bisa ditolak browser; tombolnya diam saja daripada memunculkan error.
    }
  }

  if (!keywords) return <span className="text-caption text-muted">—</span>;

  return (
    <div className="min-w-0">
      <p className={`text-caption text-muted ${open ? "" : "line-clamp-2"}`}>{keywords}</p>
      {/* Margin kiri negatif menarik padding tombol pertama kembali sejajar
          dengan teks di atasnya — tanpa itu barisnya terlihat menjorok. */}
      <div className="-ml-3 mt-1 flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
          {/* Satu span membungkus seluruh label karena isi tombol ditata
              dengan flex: dua potongan teks yang berdiri sendiri akan diberi
              jarak antar-item, bukan spasi biasa. */}
          {open ? (
            "Tutup"
          ) : (
            <span>
              Lihat <span className="font-mono tabular-nums">{count}</span> keyword
            </span>
          )}
        </Button>
        <Button variant="ghost" size="sm" onClick={copy}>
          {copied ? "Tersalin" : "Salin"}
        </Button>
      </div>
    </div>
  );
}

export function MetadataLogTable({ rows }: { rows: MetadataLogRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-body text-muted">
        Belum ada metadata yang tercatat. Riwayat terisi otomatis setiap kali extension
        selesai men-generate satu gambar.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-divider">
      {rows.map((row) => (
        <li key={row.id} className="py-3">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <p className="min-w-0 flex-1 text-body font-medium text-ink">
              {row.title || "(tanpa judul)"}
            </p>
            <Badge className="whitespace-nowrap">{row.marketplace}</Badge>
          </div>
          {/* Baris keterangan: mono supaya tanggal dan URL berbaris, tapi huruf
              kecil biasa karena isinya bukan label kolom. */}
          <p className="mt-1 font-mono text-label text-muted">
            {fmtDateTime(row.createdAt)}
            {row.owner ? ` · ${row.owner}` : ""}
            {row.pageUrl ? (
              <>
                {" · "}
                <a
                  href={row.pageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all underline-offset-2 hover:underline"
                >
                  {row.pageUrl}
                </a>
              </>
            ) : null}
          </p>
          <div className="mt-1.5">
            <KeywordCell keywords={row.keywords} count={row.keywordCount} />
          </div>
        </li>
      ))}
    </ul>
  );
}
