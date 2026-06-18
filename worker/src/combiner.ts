import type { Transaction, StatementMetadata } from "./models"
import { extractPdf } from "./extraction"
import { computeMetrics } from "./parser"
import { score } from "./scoring"

export async function combineAndScore(pdfBuffers: ArrayBuffer[]): Promise<Record<string, unknown>> {
  const allTxns: Transaction[] = []
  const seen = new Set<string>()
  let firstMeta: StatementMetadata = {}

  for (const buf of pdfBuffers) {
    const result = await extractPdf(buf)
    if (!firstMeta.accountHolder) firstMeta = result.metadata

    for (const t of result.transactions) {
      const lower = t.description.toLowerCase()
      if (lower.includes("beginning balance") || lower.includes("ending balance")) continue
      const key = `${t.date}:${t.description.slice(0, 40)}`
      if (!seen.has(key)) {
        seen.add(key)
        allTxns.push(t)
      }
    }
  }

  allTxns.sort((a, b) => a.date.localeCompare(b.date) || a.description.localeCompare(b.description))

  const combinedMeta: StatementMetadata = {
    bankName: firstMeta.bankName,
    accountHolder: firstMeta.accountHolder,
    accountNumber: firstMeta.accountNumber,
    statementPeriodStart: allTxns[0]?.date,
    statementPeriodEnd: allTxns[allTxns.length - 1]?.date,
  }

  const metrics = computeMetrics(allTxns, combinedMeta)
  const result = score(metrics)

  return {
    success: true,
    statementsCombined: pdfBuffers.length,
    transactionCount: allTxns.length,
    dateRange: {
      from: allTxns[0]?.date,
      to: allTxns[allTxns.length - 1]?.date,
    },
    score: result.score,
    riskTier: result.riskTier,
    maxLoanAmount: result.maxLoanAmount,
    breakdown: result.breakdown,
    confidence: result.confidence,
    metrics: Object.fromEntries(
      Object.entries(metrics).map(([k, v]) => [k, String(v)])
    ),
    metadata: Object.fromEntries(
      Object.entries(combinedMeta).filter(([_, v]) => v !== undefined) as [string, string][]
    ),
  }
}
