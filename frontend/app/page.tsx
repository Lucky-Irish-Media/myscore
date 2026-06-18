"use client";

import { useCallback, useState } from "react";

type ScoreResult = {
  success: boolean;
  score: number;
  risk_tier: string;
  max_loan_amount: number;
  breakdown: Record<string, number>;
  confidence: number;
  metadata: Record<string, string>;
  transaction_count: number;
  statements_combined?: number;
  date_range?: { from: string; to: string };
  metrics?: Record<string, string>;
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
    const endpoint = combined && files.length > 1
      ? "http://localhost:8000/api/upload/combined"
      : "http://localhost:8000/api/upload";

    if (combined && files.length > 1) {
      files.forEach(f => form.append("files", f));
    } else {
      form.append("file", files[0]);
    }

    try {
      const res = await fetch(endpoint, { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Upload failed");
      }
      setResult(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const tierColor = (tier: string) => {
    switch (tier) {
      case "Low": return "text-green-400";
      case "Medium": return "text-yellow-400";
      case "High": return "text-orange-400";
      case "Decline": return "text-red-400";
      default: return "text-gray-400";
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
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
        <div className="mt-8 space-y-4">
          <div className="rounded-xl bg-gray-900 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Score: {result.score}/100</h2>
              <span className={`text-2xl font-bold ${tierColor(result.risk_tier)}`}>
                {result.risk_tier}
              </span>
            </div>

            <div className="mb-4 h-3 overflow-hidden rounded-full bg-gray-700">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${result.score}%` }}
              />
            </div>

            <p className="text-lg">
              Max loan amount:{" "}
              <span className="font-semibold text-green-400">
                ${result.max_loan_amount.toLocaleString()}
              </span>
            </p>
            <p className="text-sm text-gray-400">
              Confidence: {(result.confidence * 100).toFixed(0)}% &middot;{" "}
              {result.transaction_count} transactions
              {result.statements_combined ? ` from ${result.statements_combined} statements` : ""}
            </p>
            {result.date_range && (
              <p className="text-sm text-gray-500">
                {result.date_range.from} → {result.date_range.to}
              </p>
            )}
          </div>

          <details className="rounded-xl bg-gray-900 p-4">
            <summary className="cursor-pointer font-medium text-gray-300">
              Breakdown Details
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

          {result.metrics && Object.keys(result.metrics).length > 0 && (
            <details className="rounded-xl bg-gray-900 p-4">
              <summary className="cursor-pointer font-medium text-gray-300">
                Financial Metrics
              </summary>
              <div className="mt-3 space-y-1 text-sm text-gray-400">
                {Object.entries(result.metrics).map(([key, val]) => (
                  <div key={key} className="flex justify-between">
                    <span>{key.replace(/_/g, " ")}:</span>
                    <span>{key.includes("count") ? val : `$${Number(val).toLocaleString()}`}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

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
