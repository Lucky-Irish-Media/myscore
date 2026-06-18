"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = ["#3b82f6", "#8b5cf6", "#ef4444", "#10b981", "#f59e0b", "#6366f1"];

const LABELS: Record<string, string> = {
  netCashflowScore: "Net Cashflow",
  incomeStabilityScore: "Income Stability",
  nsfScore: "NSF / Overdraft",
  balanceTrendScore: "Balance Trend",
  redFlagScore: "Red Flags",
  relationshipScore: "Relationship",
};

export default function DonutChart({
  breakdown,
}: {
  breakdown: Record<string, number>;
}) {
  const data = Object.entries(breakdown)
    .map(([key, val], i) => ({
      name: LABELS[key] || key.replace(/_/g, " "),
      value: +(val * 100).toFixed(1),
      fill: COLORS[i % COLORS.length],
    }))
    .filter((d) => d.value > 0);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((entry, idx) => (
            <Cell key={idx} fill={entry.fill} stroke="transparent" />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
          labelStyle={{ color: "#e5e7eb" }}
          formatter={(v: number, name: string) => [`${v}%`, name]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
