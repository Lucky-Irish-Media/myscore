export interface Transaction {
  date: string
  description: string
  debitAmount: number
  creditAmount: number
  balance: number | null
}

export interface StatementMetadata {
  accountHolder?: string
  bankName?: string
  statementPeriodStart?: string
  statementPeriodEnd?: string
  accountNumber?: string
}

export interface ExtractionResult {
  metadata: StatementMetadata
  transactions: Transaction[]
  rawText: string
  confidence: number
}

export interface MonthlyEntry {
  month: string
  income: number
  expenses: number
  net: number
  balance: number | null
}

export interface ScoringInputs {
  avgMonthlyNetCashflow: number
  incomeStability: number
  nsfCount: number
  endingBalanceTrend: number
  redFlagCount: number
  bankingRelationshipMonths: number
  totalMonthlyIncome: number
  totalMonthlyExpenses: number
  monthlyBreakdown?: MonthlyEntry[]
}

export type RiskTier = "Low" | "Medium" | "High" | "Decline"

export interface ScoreResult {
  score: number
  riskTier: RiskTier
  maxLoanAmount: number
  breakdown: Record<string, number>
  confidence: number
}
