"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatRupiah } from "@/lib/format";

interface SalesChartProps {
  data: { date: string; revenue: number }[];
}

/**
 * Satu-satunya tempat di gelombang ini yang menulis hex langsung, dan sebabnya
 * bukan kemalasan: recharts menaruh warna sebagai atribut SVG (`stroke`), bukan
 * sebagai kelas, jadi utilitas Tailwind tidak pernah sampai ke sana. Nilainya
 * disalin dari lembar token supaya tetap satu sumber:
 *
 *   LINE = --brand-blue-ink, varian aman-kontras dari biru merek. Yang lama
 *          adalah biru bawaan Tailwind, warna yang tidak ada di logo.
 *   GRID = --border, garis rambut yang sama dengan pemisah kartu. Yang lama
 *          abu-abu keunguan dengan alfa, tidak terikat permukaan mana pun.
 *
 * Warna teks sumbu tidak ikut ditulis di sini — `currentColor` membuatnya
 * mewarisi text-muted dari pembungkusnya, jadi bagian itu tetap bertoken.
 */
const LINE = "#3B65C4";
const GRID = "#E2E7EE";

function shortRupiah(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}jt`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}rb`;
  return String(value);
}

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

// Angka sumbu ikut aturan yang sama dengan angka di tabel: mono, berbaris.
const TICK = { fontSize: 11, fill: "currentColor", fontFamily: "var(--font-mono)" };

export function SalesChart({ data }: SalesChartProps) {
  return (
    <div className="h-64 w-full text-muted">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={TICK} minTickGap={24} />
          <YAxis tickFormatter={shortRupiah} tick={TICK} width={44} />
          <Tooltip
            formatter={(value: number) => [formatRupiah(value), "Pendapatan"]}
            labelFormatter={(label: string) => shortDate(label)}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke={LINE}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
