import type { ScoringInputs, StatementMetadata, Transaction } from "./models"

const NSF_KEYWORDS = /\b(nsf|non.?sufficient|insufficient funds|overdraft|returned|bounced)\b/i
const PAYDAY_KEYWORDS = /\b(payday|cashnetusa|advance america|check.?into.?cash|ace cash|speedy cash|loan)\b/i

export function computeMetrics(
  transactions: Transaction[],
  _metadata: StatementMetadata
): ScoringInputs {
  if (transactions.length === 0) {
    return emptyMetrics()
  }

  const monthlyMap = new Map<string, Transaction[]>()

  for (const t of transactions) {
    const month = t.date.slice(0, 7)
    if (!monthlyMap.has(month)) monthlyMap.set(month, [])
    monthlyMap.get(month)!.push(t)
  }

  const months = [...monthlyMap.keys()].sort()
  const monthlyData = months.map(m => {
    const txns = monthlyMap.get(m)!
    const income = txns.reduce((s, t) => s + t.creditAmount, 0)
    const expenses = txns.reduce((s, t) => s + t.debitAmount, 0)
    return { month: m, income, expenses, net: income - expenses }
  })

  const avgNet =
    monthlyData.reduce((s, m) => s + m.net, 0) / monthlyData.length

  const avgIncome =
    monthlyData.reduce((s, m) => s + m.income, 0) / monthlyData.length

  const avgExpenses =
    monthlyData.reduce((s, m) => s + m.expenses, 0) / monthlyData.length

  const incomeMean = avgIncome
  const incomeVariance =
    monthlyData.reduce((s, m) => s + (m.income - incomeMean) ** 2, 0) /
    monthlyData.length
  const incomeStability = Math.sqrt(incomeVariance)

  const nsfCount = transactions.filter(t => NSF_KEYWORDS.test(t.description)).length

  const redFlagCount = transactions.filter(t => PAYDAY_KEYWORDS.test(t.description)).length

  let endingBalanceTrend = 0
  const monthlyBalances = months
    .map(m => {
      const txns = monthlyMap.get(m)!
      const withBal = txns.filter(t => t.balance !== null)
      return withBal.length > 0 ? withBal[withBal.length - 1].balance! : null
    })
    .filter((b): b is number => b !== null)

  if (monthlyBalances.length > 1) {
    const diffs: number[] = []
    for (let i = 1; i < monthlyBalances.length; i++) {
      diffs.push(monthlyBalances[i] - monthlyBalances[i - 1])
    }
    endingBalanceTrend = diffs.reduce((s, d) => s + d, 0) / diffs.length
  }

  return {
    avgMonthlyNetCashflow: Math.round(avgNet * 100) / 100,
    incomeStability: Math.round(incomeStability * 100) / 100,
    nsfCount,
    endingBalanceTrend: Math.round(endingBalanceTrend * 100) / 100,
    redFlagCount,
    bankingRelationshipMonths: months.length,
    totalMonthlyIncome: Math.round(avgIncome * 100) / 100,
    totalMonthlyExpenses: Math.round(avgExpenses * 100) / 100,
    monthlyBreakdown: monthlyData.map(md => {
      const withBal = (monthlyMap.get(md.month) || []).filter(t => t.balance !== null)
      const lastBal = withBal.length > 0 ? withBal[withBal.length - 1].balance! : null
      return {
        month: md.month,
        income: Math.round(md.income * 100) / 100,
        expenses: Math.round(md.expenses * 100) / 100,
        net: Math.round(md.net * 100) / 100,
        balance: lastBal !== null ? Math.round(lastBal * 100) / 100 : null,
      }
    }),
  }
}

function emptyMetrics(): ScoringInputs {
  return {
    avgMonthlyNetCashflow: 0,
    incomeStability: 0,
    nsfCount: 0,
    endingBalanceTrend: 0,
    redFlagCount: 0,
    bankingRelationshipMonths: 0,
    totalMonthlyIncome: 0,
    totalMonthlyExpenses: 0,
  }
}
