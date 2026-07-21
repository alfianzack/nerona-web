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
import { formatRupiah } from "@/components/shop/ProductManager";

interface SalesChartProps {
  data: { date: string; revenue: number }[];
}

function shortRupiah(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}jt`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}rb`;
  return String(value);
}

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export function SalesChart({ data }: SalesChartProps) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,140,0.15)" />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={{ fontSize: 11, fill: "currentColor" }}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={shortRupiah}
            tick={{ fontSize: 11, fill: "currentColor" }}
            width={44}
          />
          <Tooltip
            formatter={(value: number) => [formatRupiah(value), "Pendapatan"]}
            labelFormatter={(label: string) => shortDate(label)}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
