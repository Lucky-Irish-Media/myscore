"use client";

import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  ComposedChart,
} from "recharts";

type MonthlyEntry = {
  month: string;
  income: number;
  expenses: number;
  net: number;
  balance: number | null;
};

export default function MonthlyChart({ data }: { data: MonthlyEntry[] }) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-500">
        No monthly data available
      </p>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    month: d.month.slice(5),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={chartData} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
        <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
        <XAxis dataKey="month" tick={{ fill: "#9ca3af", fontSize: 12 }} />
        <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} />
        <Tooltip
          contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
          labelStyle={{ color: "#e5e7eb" }}
          formatter={(v: number) => [`$${v.toLocaleString()}`, undefined]}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, color: "#d1d5db" }}
        />
        <Bar dataKey="income" fill="#22c55e" name="Income" radius={[2, 2, 0, 0]} />
        <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[2, 2, 0, 0]} />
        <Line type="monotone" dataKey="net" stroke="#3b82f6" name="Net" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
