"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type MonthlyEntry = {
  month: string;
  balance: number | null;
};

export default function BalanceTrendChart({ data }: { data: MonthlyEntry[] }) {
  const chartData = data
    .filter((d) => d.balance !== null)
    .map((d) => ({
      month: d.month.slice(5),
      balance: d.balance as number,
    }));

  if (chartData.length < 2) {
    return (
      <p className="py-8 text-center text-sm text-gray-500">
        Need at least 2 months of balance data
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
        <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
        <XAxis dataKey="month" tick={{ fill: "#9ca3af", fontSize: 12 }} />
        <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} />
        <Tooltip
          contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
          labelStyle={{ color: "#e5e7eb" }}
          formatter={(v: number) => [`$${v.toLocaleString()}`, "Balance"]}
        />
        <Line
          type="monotone"
          dataKey="balance"
          stroke="#10b981"
          strokeWidth={2}
          dot={{ r: 4, fill: "#10b981" }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
