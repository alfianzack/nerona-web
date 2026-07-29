"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

// Darkened brand hues so white initials stay readable.
const AVATAR_COLORS = ["#3B65C4", "#C25717", "#1F7FAE", "#9A6B08", "#3D44A8"];

function avatarFor(row: UserRow): { initials: string; color: string } {
  const source = row.name?.trim() || row.email;
  const words = source.split(/[\s.@_-]+/).filter(Boolean);
  const initials = ((words[0]?.[0] ?? "?") + (words[1]?.[0] ?? "")).toUpperCase();
  let hash = 0;
  for (const ch of row.email) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return { initials, color: AVATAR_COLORS[hash % AVATAR_COLORS.length] };
}

function StatusPill({ state, fallbackLabel }: { state: PlanState | null; fallbackLabel: string }) {
  if (!state) {
    return <span className="text-xs text-muted/60">—</span>;
  }
  const active = state.status === "active" || state.status === "comp";
  const planLabel = state.plan ? state.plan : fallbackLabel;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
        active
          ? "bg-brand-blue/10 text-brand-blue ring-brand-blue/20"
          : "bg-navy-900/5 text-muted ring-navy-900/10"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-muted/50"}`} />
      {planLabel} · {state.status}
    </span>
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
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold text-ink">Pengguna</h2>
        <p className="text-xs text-muted">{total} pengguna</p>
      </div>

      <form onSubmit={handleSearch} className="mt-3 flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl bg-surface px-3 ring-1 ring-navy-900/10 focus-within:ring-2 focus-within:ring-gold-400">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-4 w-4 flex-none text-muted/60"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama atau email..."
            className="w-full bg-transparent py-2 text-sm text-ink placeholder:text-muted/60 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-4 py-2 text-sm font-semibold text-navy-900 transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? "..." : "Cari"}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {FILTER_CHIPS.map((chip) => (
          <button
            key={chip.key}
            type="button"
            aria-pressed={filter === chip.key}
            onClick={() => handleFilter(chip.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${
              filter === chip.key
                ? "bg-brand-blue/12 text-[#3B65C4] ring-brand-blue/35"
                : "bg-surface text-muted ring-navy-900/10 hover:text-ink"
            }`}
          >
            {chip.label}
            {counts ? ` · ${counts[chip.countKey]}` : ""}
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-rose-500">{error}</p>}

      <div className="mt-4 overflow-hidden rounded-2xl bg-gradient-to-b from-surface to-surface2 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-navy-900/10 bg-canvas/60 text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Pengguna</th>
                <th className="px-4 py-3 font-medium">Metadata</th>
                <th className="px-4 py-3 font-medium">Agent</th>
                <th className="px-4 py-3 font-medium">Poin</th>
                <th className="px-4 py-3 font-medium">Terdaftar</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-900/10">
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
                  <tr key={row.id} className="align-middle transition hover:bg-brand-blue/[.045]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: avatar.color }}
                        >
                          {avatar.initials}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">
                            {row.name ?? "—"}
                            {row.adminRole && (
                              <span className="ml-1.5 inline-block rounded-full bg-gold-400/30 px-1.5 py-0.5 align-[1px] text-[10px] font-bold uppercase tracking-wide text-[#9A6B08]">
                                {row.adminRole}
                              </span>
                            )}
                          </p>
                          <p className="truncate text-xs text-muted">{row.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill state={row.metadata} fallbackLabel="Lisensi" />
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill state={row.agent} fallbackLabel="Agent" />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm tabular-nums text-ink">
                      {row.points.toLocaleString("id-ID")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-muted">
                      {new Date(row.createdAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/users/${row.id}`}
                        className="whitespace-nowrap rounded-full bg-navy-900/5 px-3.5 py-1.5 text-sm font-medium text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10"
                      >
                        Kelola
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-navy-900/10 px-4 py-3">
          <span className="text-xs text-muted">
            {total === 0 ? "0 pengguna" : `Menampilkan ${from}–${to} dari ${total} pengguna`}
          </span>
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => load(page - 1, q.trim(), filter)}
              disabled={page <= 1 || loading}
              className="rounded-full bg-navy-900/5 px-3 py-1 text-xs font-medium text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10 disabled:opacity-40"
            >
              ‹ Sebelumnya
            </button>
            <span className="text-xs tabular-nums text-muted">
              Hal {page} / {totalPages}
            </span>
            <button
              onClick={() => load(page + 1, q.trim(), filter)}
              disabled={page >= totalPages || loading}
              className="rounded-full bg-navy-900/5 px-3 py-1 text-xs font-medium text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10 disabled:opacity-40"
            >
              Berikutnya ›
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
