"use client";

import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";

const tierColors: Record<string, string> = {
  Low: "#4ade80",
  Medium: "#facc15",
  High: "#fb923c",
  Decline: "#f87171",
};

export default function GaugeChart({
  score,
  riskTier,
}: {
  score: number;
  riskTier: string;
}) {
  const data = [{ name: "Score", value: score, fill: tierColors[riskTier] || "#6b7280" }];

  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width="100%" height={180}>
        <RadialBarChart
          cx="50%"
          cy="100%"
          innerRadius="60%"
          outerRadius="100%"
          barSize={20}
          data={data}
          startAngle={180}
          endAngle={0}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar dataKey="value" cornerRadius={10} background={{ fill: "#374151" }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="-mt-10 text-center">
        <span className="text-4xl font-bold" style={{ color: tierColors[riskTier] || "#6b7280" }}>
          {score}
        </span>
        <span className="ml-1 text-lg text-gray-400">/100</span>
      </div>
    </div>
  );
}
