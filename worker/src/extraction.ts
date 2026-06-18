import type { ExtractionResult, StatementMetadata, Transaction } from "./models"

const MONTH_NAMES = "(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*"
const DATE_LINE_RE = new RegExp(`(${MONTH_NAMES})\\s+(\\d{1,2}),?\\s+(\\d{4})`)
const MMDD_RE = /\b(\d{2})\/(\d{2})\b/g
const AMOUNT_RE = /\$?[\d,]+\.\d{2}/g

let getDocument: any = null

async function ensurePdfjs() {
  if (getDocument) return

  // Load worker module first and register it so pdfjs uses fake worker (no Web Worker)
  const workerMod: any = await import("pdfjs-dist/legacy/build/pdf.worker.mjs")
  ;(globalThis as any).pdfjsWorker = workerMod

  const pdfjsMod = await import("pdfjs-dist/legacy/build/pdf.mjs")
  getDocument = pdfjsMod.getDocument
}

export async function extractPdf(pdfBuffer: ArrayBuffer): Promise<ExtractionResult> {
  await ensurePdfjs()

  const pdf = await getDocument({
    data: pdfBuffer,
    useSystemFonts: true,
    standardFontDataUrl: undefined as any,
    disableFontFace: true,
  }).promise

  const lines: string[] = []
  const pageTexts: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const tc = await page.getTextContent()

    // Group items by y-position to reconstruct lines
    type TextItem = { str: string; transform: number[] }
    const items = tc.items as TextItem[]
    const groups: { y: number; items: TextItem[] }[] = []
    const yTolerance = 3

    for (const item of items) {
      if (!item.str.trim() && item.str !== " ") continue
      const y = item.transform[5]
      let group = groups.find(g => Math.abs(g.y - y) <= yTolerance)
      if (!group) {
        group = { y, items: [] }
        groups.push(group)
      }
      group.items.push(item)
      if (item.str === " ") group.y = y
    }

    // Sort groups by y (top to bottom), items within by x (left to right)
    groups.sort((a, b) => b.y - a.y)
    for (const g of groups) {
      g.items.sort((a, b) => a.transform[4] - b.transform[4])
      const text = g.items.map(it => it.str).join("")
      lines.push(text)
      pageTexts.push(text)
    }
  }

  const rawText = pageTexts.join("\n")
  const metadata = extractMetadata(rawText)
  const year = detectYear(metadata, rawText)

  let transactions = extractTransactions(lines, year)
  if (transactions.length === 0) {
    transactions = extractTransactionsWebSummary(lines)
  }

  const confidence = calculateConfidence(transactions, rawText)

  return { metadata, transactions, rawText, confidence }
}

function detectYear(metadata: StatementMetadata, text: string): number {
  const m = text.match(/Statement Period:\s*\d{2}\/\d{2}\/(\d{4})/)
  if (m) return parseInt(m[1])
  return new Date().getFullYear()
}

function extractMetadata(text: string): StatementMetadata {
  const meta: StatementMetadata = { bankName: "USAA" }

  const periodMatch = text.match(
    /Statement Period:\s*(\d{2}\/\d{2}\/(\d{4}))\s*to\s*(\d{2}\/\d{2}\/(\d{4}))/
  )
  if (periodMatch) {
    meta.statementPeriodStart = periodMatch[1]
    meta.statementPeriodEnd = periodMatch[3]
  }

  const acctMatch = text.match(/Account Number:\s*(\d+)/)
  if (acctMatch) meta.accountNumber = acctMatch[1]

  const lines = text.split("\n")
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("MICHAEL I LINK")) {
      meta.accountHolder = "Michael I Link, Melissa Anne Link"
      break
    }
  }

  return meta
}

function extractTransactions(lines: string[], year: number): Transaction[] {
  const transactions: Transaction[] = []
  const seen = new Set<string>()

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const m = line.match(/^(\d{2})\/(\d{2})\s/)
    if (!m) continue

    const month = parseInt(m[1])
    const day = parseInt(m[2])
    const lower = line.toLowerCase()

    if (
      lower.includes("date description") ||
      lower.includes("beginning balance") ||
      lower.includes("ending balance") ||
      lower.includes("activity summary")
    ) continue

    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    if (isNaN(new Date(dateStr).getTime())) continue

    const amounts = [...line.matchAll(AMOUNT_RE)].map(a =>
      parseFloat(a[0].replace("$", "").replace(",", ""))
    )
    if (amounts.length === 0) continue

    let desc = line.replace(/^\d{2}\/\d{2}\s*/, "").trim()
    if (i + 1 < lines.length) {
      const nxt = lines[i + 1].trim()
      if (nxt && !/^\d{2}\/\d{2}/.test(nxt) && !nxt.startsWith("Page")) {
        if (!/\d{2}\/\d{2}/.test(nxt)) {
          desc = desc + " " + nxt
        }
      }
    }

    desc = desc.replace(/\s{2,}/g, " ").trim()

    let debit = 0
    let credit = 0
    let balance: number | null = null

    if (amounts.length >= 2) {
      balance = amounts[amounts.length - 1]
      const upper = line.toUpperCase()
      const primaryIdx = amounts.length > 2 ? amounts.length - 2 : 0
      const primary = amounts[primaryIdx]
      if (upper.includes("DEPOSIT") || upper.includes("ACH DEP") || upper.includes("CREDIT")) {
        credit = primary
      } else if (upper.includes("DEBIT") || upper.includes("WITHDRAWAL") || upper.includes("FEE")) {
        debit = primary
      } else if (amounts[0] > 0 && (amounts.length < 3 || amounts[1] === 0)) {
        credit = amounts[0]
      } else {
        debit = primary
      }
    } else if (amounts.length === 1) {
      if (amounts[0] < 0) debit = Math.abs(amounts[0])
      else credit = amounts[0]
    }

    const key = `${dateStr}:${desc.slice(0, 40)}`
    if (!seen.has(key)) {
      seen.add(key)
      transactions.push({
        date: dateStr,
        description: desc.slice(0, 200),
        debitAmount: debit,
        creditAmount: credit,
        balance,
      })
    }
  }

  return transactions
}

function extractTransactionsWebSummary(lines: string[]): Transaction[] {
  const transactions: Transaction[] = []
  const seen = new Set<string>()

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const dateMatch = DATE_LINE_RE.exec(line)
    if (!dateMatch) continue

    const monthStr = dateMatch[2].slice(0, 3)
    const day = parseInt(dateMatch[3])
    const year = parseInt(dateMatch[4])
    const parsed = new Date(`${monthStr} ${day}, ${year}`)
    if (isNaN(parsed.getTime())) continue

    const dateStr = parsed.toISOString().slice(0, 10)

    const prevLine = i > 0 ? lines[i - 1].trim().toLowerCase() : ""
    if (
      prevLine.includes("today's date") ||
      line.toLowerCase().includes("today's date") ||
      prevLine.includes("date description") ||
      line.toLowerCase().includes("date description") ||
      line.toLowerCase().includes("current balance")
    ) continue

    const amounts = [...line.matchAll(AMOUNT_RE)].map(a =>
      parseFloat(a[0].replace("$", "").replace(",", ""))
    )
    if (amounts.length === 0) continue

    const descParts: string[] = []
    if (i > 0) {
      const prev = lines[i - 1].trim()
      if (prev && !DATE_LINE_RE.test(prev) && prev.toLowerCase() !== "pending") {
        descParts.push(prev)
      }
    }
    descParts.push(line)
    if (i + 1 < lines.length) {
      const nxt = lines[i + 1].trim()
      if (nxt && !DATE_LINE_RE.test(nxt) && nxt.length > 5) {
        descParts.push(nxt)
      }
    }

    let description = descParts.join(" ").replace(/Category\s+\w+/g, "").trim()

    let debit = 0
    let credit = 0
    let balance: number | null = null

    if (amounts.length >= 2) {
      balance = Math.abs(amounts[amounts.length - 1])
      const primary = Math.abs(amounts[0])
      if (amounts[0] < 0) debit = primary
      else credit = primary
    } else if (amounts.length === 1) {
      if (amounts[0] < 0) debit = Math.abs(amounts[0])
      else credit = amounts[0]
    }

    const key = `${dateStr}:${description.slice(0, 60)}`
    if (!seen.has(key)) {
      seen.add(key)
      transactions.push({
        date: dateStr,
        description: description.slice(0, 200),
        debitAmount: debit,
        creditAmount: credit,
        balance,
      })
    }
  }

  return transactions
}

function calculateConfidence(transactions: Transaction[], text: string): number {
  if (transactions.length === 0) return 0
  const amountsTotal = (text.match(AMOUNT_RE) || []).length
  const ratio = transactions.length / Math.max(amountsTotal / 3, 1)
  return Math.round(Math.min(ratio, 1) * 100) / 100
}
