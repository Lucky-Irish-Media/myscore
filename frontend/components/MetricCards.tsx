"use client";

const LABELS: Record<string, string> = {
  avg_monthly_net_cashflow: "Avg Monthly Net Cashflow",
  total_monthly_income: "Avg Monthly Income",
  total_monthly_expenses: "Avg Monthly Expenses",
  income_stability: "Income Stability (std dev)",
  nsf_count: "NSF / Overdraft Count",
  ending_balance_trend: "Ending Balance Trend",
  red_flag_count: "Red Flag Count",
  banking_relationship_months: "Banking Relationship",
};

const FORMAT_DOLLAR = (v: string) => {
  const n = parseFloat(v);
  return isNaN(n) ? v : `$${n.toLocaleString()}`;
};

export default function MetricCards({
  metrics,
}: {
  metrics: Record<string, string>;
}) {
  const entries = Object.entries(metrics).filter(([key]) => LABELS[key]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {entries.map(([key, val]) => {
        const isDollar = !key.includes("count") && !key.includes("months") && !key.includes("stability") && !key.includes("trend");
        return (
          <div
            key={key}
            className="rounded-lg bg-gray-800 p-3"
          >
            <p className="text-xs text-gray-400">{LABELS[key] || key.replace(/_/g, " ")}</p>
            <p className="mt-1 text-lg font-semibold text-gray-100">
              {isDollar ? FORMAT_DOLLAR(val) : val}
            </p>
          </div>
        );
      })}
    </div>
  );
}
