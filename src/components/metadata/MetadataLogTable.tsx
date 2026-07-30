"use client";

import { useState } from "react";

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

  if (!keywords) return <span className="text-xs text-muted">—</span>;

  return (
    <div className="min-w-0">
      <p className={`text-xs text-muted ${open ? "" : "line-clamp-2"}`}>{keywords}</p>
      <div className="mt-1 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-[11px] font-medium text-ink underline-offset-2 hover:underline"
        >
          {open ? "Tutup" : `Lihat ${count} keyword`}
        </button>
        <button
          type="button"
          onClick={copy}
          className="text-[11px] font-medium text-ink underline-offset-2 hover:underline"
        >
          {copied ? "Tersalin" : "Salin"}
        </button>
      </div>
    </div>
  );
}

export function MetadataLogTable({ rows }: { rows: MetadataLogRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-sm text-muted">
        Belum ada metadata yang tercatat. Riwayat terisi otomatis setiap kali extension
        selesai men-generate satu gambar.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-navy-900/10">
      {rows.map((row) => (
        <li key={row.id} className="py-3">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <p className="min-w-0 flex-1 text-sm font-medium text-ink">{row.title || "(tanpa judul)"}</p>
            <span className="whitespace-nowrap rounded-full bg-navy-900/5 px-2.5 py-0.5 text-[11px] font-medium text-ink ring-1 ring-navy-900/10">
              {row.marketplace}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-muted">
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
