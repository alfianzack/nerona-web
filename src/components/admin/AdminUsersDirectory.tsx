"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Icon } from "@/components/ui/icons";

interface PlanState {
  status: string;
  plan: string | null;
}

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  adminRole: string | null;
  metadata: PlanState | null;
  agent: PlanState | null;
  points: number;
}

interface FilterCounts {
  all: number;
  license: number;
  agent: number;
  none: number;
}

type FilterKey = "" | "license" | "agent" | "none";

const FILTER_CHIPS: { key: FilterKey; label: string; countKey: keyof FilterCounts }[] = [
  { key: "", label: "Semua", countKey: "all" },
  { key: "license", label: "Punya lisensi", countKey: "license" },
  { key: "agent", label: "Punya agent", countKey: "agent" },
  { key: "none", label: "Tanpa paket", countKey: "none" },
];

/**
 * Empat varian aman-kontras merek plus satu ungu navy, sebagai kelas token.
 *
 * Sebelumnya kelimanya hex lepas yang dipasang lewat gaya inline. Hex yang
 * sama sudah punya nama di lapisan token, dan warna yang hidup di luar token
 * tidak ikut berubah kalau paletnya digeser.
 */
const AVATAR_COLORS = [
  "bg-brand-blue-ink",
  "bg-brand-orange-ink",
  "bg-brand-sky-ink",
  "bg-brand-gold-ink",
  "bg-navy-500",
];

function avatarFor(row: UserRow): { initials: string; colorClass: string } {
  const source = row.name?.trim() || row.email;
  const words = source.split(/[\s.@_-]+/).filter(Boolean);
  const initials = ((words[0]?.[0] ?? "?") + (words[1]?.[0] ?? "")).toUpperCase();
  let hash = 0;
  for (const ch of row.email) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return { initials, colorClass: AVATAR_COLORS[hash % AVATAR_COLORS.length] };
}

/**
 * Titik status hilang, warnanya yang bekerja: hijau untuk paket yang hidup,
 * abu-abu untuk yang tidak. Statusnya juga tetap tertulis sebagai kata di
 * dalam chip, jadi keterangannya tidak bergantung pada warna saja.
 */
function StatusPill({ state, fallbackLabel }: { state: PlanState | null; fallbackLabel: string }) {
  if (!state) {
    return <span className="text-caption text-muted">—</span>;
  }
  const active = state.status === "active" || state.status === "comp";
  const planLabel = state.plan ? state.plan : fallbackLabel;
  return (
    <Badge tone={active ? "success" : "neutral"}>
      {planLabel} · {state.status}
    </Badge>
  );
}

export function AdminUsersDirectory() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterKey>("");
  const [counts, setCounts] = useState<FilterCounts | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(nextPage: number, search: string, nextFilter: FilterKey) {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(nextPage) });
    if (search) params.set("q", search);
    if (nextFilter) params.set("filter", nextFilter);
    const res = await fetch(`/api/admin/users?${params.toString()}`);
    const data = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok || !data?.ok) {
      setError("Gagal memuat daftar pengguna.");
      return;
    }
    setRows(data.users);
    setPage(data.page);
    setTotalPages(data.totalPages);
    setTotal(data.total);
    setCounts(data.counts ?? null);
  }

  useEffect(() => {
    load(1, "", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    load(1, q.trim(), filter);
  }

  function handleFilter(key: FilterKey) {
    setFilter(key);
    load(1, q.trim(), key);
  }

  const from = total === 0 ? 0 : (page - 1) * 25 + 1;
  const to = Math.min(page * 25, total);

  return (
    <div>
      <PageHeader
        title="Pengguna"
        actions={<Badge tone="neutral">{total} pengguna</Badge>}
      />

      {/* Isian pencarian tidak memakai primitive Input: ikon kaca pembesar
          duduk di dalam kotaknya, jadi cincin dan latarnya milik pembungkus
          dan isiannya sendiri harus bening. Cincin fokusnya aksen, bukan emas
          — mencari sesuatu tidak memindahkan uang. */}
      <form onSubmit={handleSearch} className="mt-6 flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-control bg-surface px-3 ring-1 ring-border focus-within:ring-2 focus-within:ring-accent">
          {/* Digambar di tempat karena daftar ikon bersama belum punya kaca
              pembesar. Bentuk, tebal garis, dan ukurannya disamakan. */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-4 w-4 flex-none text-muted"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama atau email..."
            className="w-full bg-transparent py-2 text-body text-ink placeholder:text-muted/60 focus:outline-none"
          />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? "..." : "Cari"}
        </Button>
      </form>

      {/* Chip penyaring meminjam bentuk dan ukuran Badge — keduanya chip di
          mata pembaca — tapi tetap tombol, jadi kelasnya ditulis di sini dan
          bukan Badge yang dibungkus tombol: keadaan tunjuk butuh warna yang
          Badge tidak sediakan. */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {FILTER_CHIPS.map((chip) => (
          <button
            key={chip.key}
            type="button"
            aria-pressed={filter === chip.key}
            onClick={() => handleFilter(chip.key)}
            className={`inline-flex items-center rounded-chip px-2.5 py-1 font-mono text-label font-semibold tabular-nums ring-1 transition ${
              filter === chip.key
                ? "bg-brand-blue/10 text-brand-blue-ink ring-brand-blue/25"
                : "bg-surface text-muted ring-border hover:text-ink"
            }`}
          >
            {chip.label}
            {counts ? ` · ${counts[chip.countKey]}` : ""}
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-body text-danger">{error}</p>}

      {/* Lebar minimum tabel dipertahankan: enam kolom tidak muat di layar
          sempit, dan yang benar di sana adalah menggulir mendatar, bukan
          meremas kolomnya. */}
      <Card padding="none" className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-body">
            <thead>
              <tr className="border-b border-border font-mono text-label uppercase text-muted">
                <th className="px-4 py-3">Pengguna</th>
                <th className="px-4 py-3">Metadata</th>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Poin</th>
                <th className="px-4 py-3">Terdaftar</th>
                <th className="px-4 py-3">
                  <span className="sr-only">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    Tidak ada pengguna.
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                const avatar = avatarFor(row);
                return (
                  <tr key={row.id} className="align-middle transition hover:bg-surface-sunken">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {/* Lingkaran hanya untuk avatar dan chip; bentuk lain
                            di dalam aplikasi memakai radius token. */}
                        <span
                          className={`flex h-9 w-9 flex-none items-center justify-center rounded-full text-caption font-semibold text-white ${avatar.colorClass}`}
                        >
                          {avatar.initials}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-body font-semibold text-ink">
                            {row.name ?? "—"}
                            {/* Peran admin dulu berchip emas. Emas menandai
                                uang, dan sebuah peran bukan uang. */}
                            {row.adminRole && (
                              <Badge tone="info" className="ml-1.5 align-[1px] uppercase">
                                {row.adminRole}
                              </Badge>
                            )}
                          </p>
                          <p className="truncate font-mono text-caption text-muted">{row.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill state={row.metadata} fallbackLabel="Lisensi" />
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill state={row.agent} fallbackLabel="Agent" />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-body tabular-nums text-ink">
                      {row.points.toLocaleString("id-ID")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-caption tabular-nums text-muted">
                      {new Date(row.createdAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ButtonLink href={`/admin/users/${row.id}`} variant="secondary" size="sm">
                        Kelola
                      </ButtonLink>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Kurung sudut ‹ dan › berhenti dipakai sebagai panah: keduanya glyph
            teks, dirender font sistem, jadi tingginya berbeda antar mesin dan
            ukurannya tidak bisa disetel. Arah "berikutnya" memakai chevron
            yang diputar seperempat putaran — daftar ikon bersama baru punya
            chevron atas dan bawah. */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
          <span className="text-caption text-muted">
            {total === 0 ? (
              <>
                <span className="font-mono tabular-nums text-ink">0</span> pengguna
              </>
            ) : (
              <>
                Menampilkan{" "}
                <span className="font-mono tabular-nums text-ink">
                  {from}–{to}
                </span>{" "}
                dari <span className="font-mono tabular-nums text-ink">{total}</span> pengguna
              </>
            )}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => load(page - 1, q.trim(), filter)}
              disabled={page <= 1 || loading}
            >
              <Icon name="arrow-left" className="h-4 w-4 flex-none" />
              Sebelumnya
            </Button>
            <span className="font-mono text-caption tabular-nums text-muted">
              Hal {page} / {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => load(page + 1, q.trim(), filter)}
              disabled={page >= totalPages || loading}
            >
              Berikutnya
              <Icon name="chevron-down" className="h-4 w-4 flex-none -rotate-90" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
