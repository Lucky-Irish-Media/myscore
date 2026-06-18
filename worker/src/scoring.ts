import type { RiskTier, ScoreResult, ScoringInputs } from "./models"

const WEIGHTS = {
  netCashflowScore: 0.3,
  incomeStabilityScore: 0.25,
  nsfScore: 0.2,
  balanceTrendScore: 0.1,
  redFlagScore: 0.1,
  relationshipScore: 0.05,
}

export function score(inputs: ScoringInputs): ScoreResult {
  const breakdown: Record<string, number> = {}
  let total = 0

  const ncfScore = scoreNetCashflow(inputs.avgMonthlyNetCashflow)
  breakdown.netCashflowScore = ncfScore * WEIGHTS.netCashflowScore
  total += ncfScore * WEIGHTS.netCashflowScore

  const instabScore = scoreIncomeStability(inputs.incomeStability, inputs.totalMonthlyIncome)
  breakdown.incomeStabilityScore = instabScore * WEIGHTS.incomeStabilityScore
  total += instabScore * WEIGHTS.incomeStabilityScore

  const nsf = scoreNsf(inputs.nsfCount)
  breakdown.nsfScore = nsf * WEIGHTS.nsfScore
  total += nsf * WEIGHTS.nsfScore

  const bt = scoreBalanceTrend(inputs.endingBalanceTrend)
  breakdown.balanceTrendScore = bt * WEIGHTS.balanceTrendScore
  total += bt * WEIGHTS.balanceTrendScore

  const rf = scoreRedFlags(inputs.redFlagCount)
  breakdown.redFlagScore = rf * WEIGHTS.redFlagScore
  total += rf * WEIGHTS.redFlagScore

  const rel = scoreRelationship(inputs.bankingRelationshipMonths)
  breakdown.relationshipScore = rel * WEIGHTS.relationshipScore
  total += rel * WEIGHTS.relationshipScore

  const finalScore = Math.round(total * 100)
  const riskTier = determineTier(finalScore)
  const maxLoan = calculateMaxLoan(finalScore, inputs.totalMonthlyIncome, inputs.avgMonthlyNetCashflow)

  return { score: finalScore, riskTier, maxLoanAmount: maxLoan, breakdown, confidence: 1 }
}

function scoreNetCashflow(cashflow: number): number {
  if (cashflow <= 0) return 0
  if (cashflow < 500) return 0.3
  if (cashflow < 1500) return 0.6
  if (cashflow < 5000) return 0.85
  return 1
}

function scoreIncomeStability(stdDev: number, avgIncome: number): number {
  if (avgIncome <= 0) return 0
  const ratio = stdDev / avgIncome
  if (ratio < 0.1) return 1
  if (ratio < 0.25) return 0.75
  if (ratio < 0.5) return 0.5
  if (ratio < 0.75) return 0.25
  return 0
}

function scoreNsf(count: number): number {
  if (count === 0) return 1
  if (count <= 2) return 0.6
  if (count <= 5) return 0.3
  return 0
}

function scoreBalanceTrend(trend: number): number {
  if (trend > 500) return 1
  if (trend > 100) return 0.75
  if (trend > -100) return 0.5
  if (trend > -500) return 0.25
  return 0
}

function scoreRedFlags(count: number): number {
  if (count === 0) return 1
  if (count <= 2) return 0.5
  return 0
}

function scoreRelationship(months: number): number {
  if (months >= 24) return 1
  if (months >= 12) return 0.75
  if (months >= 6) return 0.5
  if (months >= 3) return 0.25
  return 0.1
}

function determineTier(score: number): RiskTier {
  if (score >= 75) return "Low"
  if (score >= 50) return "Medium"
  if (score >= 25) return "High"
  return "Decline"
}

function calculateMaxLoan(score: number, monthlyIncome: number, netCashflow: number): number {
  const incomeBased = monthlyIncome * 0.3
  const cashflowBased = netCashflow * 3
  const multiplier = score / 100
  const base = Math.max(incomeBased, cashflowBased) * multiplier
  return Math.round(Math.max(base, 0) / 100) * 100
}
