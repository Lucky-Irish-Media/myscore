"use client";

import {
  RadarChart as RechartsRadar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const LABELS: Record<string, string> = {
  netCashflowScore: "Net Cashflow",
  incomeStabilityScore: "Income Stability",
  nsfScore: "NSF Score",
  balanceTrendScore: "Balance Trend",
  redFlagScore: "Red Flags",
  relationshipScore: "Relationship",
};

export default function RadarChart({
  breakdown,
}: {
  breakdown: Record<string, number>;
}) {
  const raw = Object.entries(breakdown).map(([key, val]) => ({
    dimension: LABELS[key] || key.replace(/_/g, " "),
    value: +(val * 100).toFixed(1),
    fullMark: 100,
  }));

  if (raw.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-500">
        No breakdown data available
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <RechartsRadar cx="50%" cy="50%" outerRadius="75%" data={raw}>
        <PolarGrid stroke="#374151" />
        <PolarAngleAxis dataKey="dimension" tick={{ fill: "#d1d5db", fontSize: 11 }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#6b7280", fontSize: 10 }} />
        <Radar
          name="Score"
          dataKey="value"
          stroke="#3b82f6"
          fill="#3b82f6"
          fillOpacity={0.25}
        />
        <Tooltip
          contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
          formatter={(v: number) => [`${v}%`, "Score"]}
        />
      </RechartsRadar>
    </ResponsiveContainer>
  );
}
