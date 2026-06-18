"use client";

import { useCallback, useState } from "react";
import GaugeChart from "../components/GaugeChart";
import BreakdownBarChart from "../components/BreakdownBarChart";
import DonutChart from "../components/DonutChart";
import MonthlyChart from "../components/MonthlyChart";
import BalanceTrendChart from "../components/BalanceTrendChart";
import RadarChart from "../components/RadarChart";
import MetricCards from "../components/MetricCards";

type MonthlyEntry = {
  month: string;
  income: number;
  expenses: number;
  net: number;
  balance: number | null;
};

type ScoreResult = {
  success: boolean;
  score: number;
  riskTier: string;
  maxLoanAmount: number;
  breakdown: Record<string, number>;
  confidence: number;
  metadata: Record<string, string>;
  transactionCount: number;
  statementsCombined?: number;
  dateRange?: { from: string; to: string };
  metrics?: Record<string, string>;
  monthly?: MonthlyEntry[];
};

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [combined, setCombined] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [error, setError] = useState("");

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setFiles(Array.from(e.dataTransfer.files).filter(f => f.type === "application/pdf"));
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files ? Array.from(e.target.files).filter(f => f.type === "application/pdf") : [];
    setFiles(prev => [...prev, ...selected]);
  };

  const removeFile = (i: number) => {
    setFiles(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setLoading(true);
    setError("");
    setResult(null);

    const form = new FormData();
    const base = process.env.NEXT_PUBLIC_API_URL || "";
    const endpoint = combined && files.length > 1
      ? `${base}/api/upload/combined`
      : `${base}/api/upload`;

    if (combined && files.length > 1) {
      files.forEach(f => form.append("files", f));
    } else {
      form.append("file", files[0]);
    }

    try {
      const res = await fetch(endpoint, { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || err.detail || "Upload failed");
      }
      setResult(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="mb-2 text-3xl font-bold">SA Lender</h1>
      <p className="mb-8 text-gray-400">
        Upload one or more PDF bank statements for a lending risk score.
      </p>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-gray-600 p-12 transition hover:border-gray-400"
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />
        <span className="text-4xl">📄</span>
        <p className="text-gray-300">Drop PDFs here or click to browse</p>
      </div>

      {files.length > 0 && (
        <div className="mt-4 space-y-1">
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-between rounded bg-gray-800 px-3 py-1.5 text-sm">
              <span>{f.name}</span>
              <button onClick={() => removeFile(i)} className="ml-2 text-red-400 hover:text-red-300">x</button>
            </div>
          ))}
          <p className="text-xs text-gray-500">{files.length} file(s) selected</p>
        </div>
      )}

      {files.length > 1 && (
        <label className="mt-3 flex items-center gap-2 text-sm text-gray-300">
          <input type="checkbox" checked={combined} onChange={() => setCombined(!combined)} className="rounded" />
          Combine into a single score
        </label>
      )}

      <button
        onClick={handleUpload}
        disabled={files.length === 0 || loading}
        className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading
          ? "Processing..."
          : combined && files.length > 1
            ? "Analyze Combined Statements"
            : "Analyze Statement"}
      </button>

      {error && (
        <div className="mt-6 rounded-lg bg-red-900/50 p-4 text-red-300">{error}</div>
      )}

      {result && (
        <div className="mt-8 space-y-6">
          <div className="rounded-xl bg-gray-900 p-6">
            <div className="mb-2 flex items-center justify-between">
              <span className={`text-2xl font-bold ${result.riskTier === "Low" ? "text-green-400" : result.riskTier === "Medium" ? "text-yellow-400" : result.riskTier === "High" ? "text-orange-400" : "text-red-400"}`}>
                {result.riskTier}
              </span>
              <p className="text-sm text-gray-400">
                Confidence: {(result.confidence * 100).toFixed(0)}% &middot;{" "}
                {result.transactionCount} transactions
                {result.statementsCombined ? ` from ${result.statementsCombined} statements` : ""}
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-1">
                <GaugeChart score={result.score} riskTier={result.riskTier} />
                <p className="mt-2 text-center text-lg">
                  Max loan:{" "}
                  <span className="font-semibold text-green-400">
                    ${result.maxLoanAmount.toLocaleString()}
                  </span>
                </p>
                {result.dateRange && (
                  <p className="text-center text-sm text-gray-500">
                    {result.dateRange.from} → {result.dateRange.to}
                  </p>
                )}
              </div>
              <div className="lg:col-span-2">
                {result.metrics && <MetricCards metrics={result.metrics} />}
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl bg-gray-900 p-4">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
                Score Breakdown
              </h3>
              <BreakdownBarChart breakdown={result.breakdown} />
            </div>
            <div className="rounded-xl bg-gray-900 p-4">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
                Weight Distribution
              </h3>
              <DonutChart breakdown={result.breakdown} />
            </div>
          </div>

          {result.monthly && result.monthly.length > 0 && (
            <>
              <div className="rounded-xl bg-gray-900 p-4">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
                  Monthly Income vs Expenses
                </h3>
                <MonthlyChart data={result.monthly} />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl bg-gray-900 p-4">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
                    Balance Trend
                  </h3>
                  <BalanceTrendChart data={result.monthly} />
                </div>
                <div className="rounded-xl bg-gray-900 p-4">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
                    Financial Health Profile
                  </h3>
                  <RadarChart breakdown={result.breakdown} />
                </div>
              </div>
            </>
          )}

          <details className="rounded-xl bg-gray-900 p-4">
            <summary className="cursor-pointer font-medium text-gray-300">
              Raw Breakdown Values
            </summary>
            <div className="mt-3 space-y-2">
              {Object.entries(result.breakdown).map(([key, val]) => (
                <div key={key} className="flex justify-between text-sm">
                  <span className="text-gray-400">{key.replace(/_/g, " ")}</span>
                  <span>{(val * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </details>

          {result.metadata && Object.keys(result.metadata).length > 0 && (
            <details className="rounded-xl bg-gray-900 p-4">
              <summary className="cursor-pointer font-medium text-gray-300">
                Statement Metadata
              </summary>
              <div className="mt-3 space-y-1 text-sm text-gray-400">
                {Object.entries(result.metadata).map(([key, val]) => (
                  <div key={key}>
                    {key.replace(/_/g, " ")}: {val || "—"}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </main>
  );
}
