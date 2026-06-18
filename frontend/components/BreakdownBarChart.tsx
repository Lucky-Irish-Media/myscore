"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const COLORS = ["#3b82f6", "#8b5cf6", "#ef4444", "#10b981", "#f59e0b", "#6366f1"];

const LABELS: Record<string, string> = {
  netCashflowScore: "Net Cashflow",
  incomeStabilityScore: "Income Stability",
  nsfScore: "NSF / Overdraft",
  balanceTrendScore: "Balance Trend",
  redFlagScore: "Red Flags",
  relationshipScore: "Relationship",
};

export default function BreakdownBarChart({
  breakdown,
}: {
  breakdown: Record<string, number>;
}) {
  const data = Object.entries(breakdown).map(([key, val], i) => ({
    name: LABELS[key] || key.replace(/_/g, " "),
    value: +(val * 100).toFixed(1),
    fill: COLORS[i % COLORS.length],
  }));

  return (
    <ResponsiveContainer width="100%" height={data.length * 48 + 20}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
        <XAxis type="number" domain={[0, 100]} tick={{ fill: "#9ca3af" }} />
        <YAxis type="category" dataKey="name" width={130} tick={{ fill: "#d1d5db", fontSize: 12 }} />
        <Tooltip
          contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
          labelStyle={{ color: "#e5e7eb" }}
          formatter={(v: number) => [`${v}%`, "Weighted Score"]}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((entry, idx) => (
            <Cell key={idx} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
