import { Hono } from "hono"
import { cors } from "hono/cors"

import { combineAndScore } from "./combiner"
import { extractPdf } from "./extraction"
import { computeMetrics } from "./parser"
import { score } from "./scoring"

const app = new Hono()

app.use("/*", cors({ origin: "*" }))

app.get("/health", (c) => c.json({ status: "ok" }))

app.post("/api/upload", async (c) => {
  const form = await c.req.formData()
  const file = form.get("file")
  if (!file || !(file instanceof File)) {
    return c.json({ error: "No file uploaded" }, 400)
  }
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return c.json({ error: "Only PDF files are accepted" }, 400)
  }

  const buf = await file.arrayBuffer()
  const result = await extractPdf(buf)

  const metrics = computeMetrics(result.transactions, result.metadata)
  const s = score(metrics)
  s.confidence = result.confidence

  return c.json({
    success: true,
    score: s.score,
    riskTier: s.riskTier,
    maxLoanAmount: s.maxLoanAmount,
    breakdown: s.breakdown,
    confidence: s.confidence,
    metadata: Object.fromEntries(
      Object.entries(result.metadata).filter(([_, v]) => v !== undefined) as [string, string][]
    ),
    transactionCount: result.transactions.length,
  })
})

app.post("/api/upload/combined", async (c) => {
  const form = await c.req.formData()
  const files = form.getAll("files") as File[]

  if (files.length < 2) {
    return c.json({ error: "Upload at least 2 PDF statements" }, 400)
  }

  for (const f of files) {
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      return c.json({ error: `"${f.name}" is not a PDF` }, 400)
    }
  }

  const buffers = await Promise.all(files.map((f) => f.arrayBuffer()))
  const result = await combineAndScore(buffers)

  return c.json(result)
})

export default app
