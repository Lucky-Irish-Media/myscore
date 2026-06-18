# PDF Bank Statement Lending Scoring App — Plan

## Best Languages

| Language | Pros | Cons |
|---|---|---|
| **Python** | Rich PDF libs (pdfplumber, PyMuPDF, Camelot, tabula), strong ML/data ecosystem (pandas, scikit-learn, NumPy), fastest prototyping | Slower runtime, heavier deployment |
| **TypeScript/Node.js** | Great for web apps, `pdf-parse` / `pdfjs` libs, unified full-stack, async perf | Weaker table extraction, less mature PDF tooling |
| **Go** | Fast, single binary deploy, good concurrency | Limited PDF extraction libs, more boilerplate |
| **Rust** | Blazing fast, no GC, memory-safe | Steep learning curve, smaller ecosystem for PDF/ML |

**Recommendation: Python** — best ecosystem fit given the core task (PDF data extraction + financial scoring).

---

## PDF Extraction Options

| Approach | Accuracy | Speed | Complexity |
|---|---|---|---|
| **PyMuPDF (fitz)** — text + table extraction | High | Fast | Low |
| **pdfplumber** — best for tables/csv-like data | Very high | Moderate | Low |
| **Camelot** — table detection + extraction | Very high | Slow | Medium |
| **OCR (Tesseract + PaddleOCR)** — scanned PDFs | Moderate-High | Slow | High |
| **LLM-based (GPT-4o, Claude vision)** — send PDF page images | Very high (semantic) | Moderate (API latency) | Low (API cost) |

**Recommendation:** Use **pdfplumber** as primary for text-based PDFs, fallback to **OCR (PaddleOCR)** for scanned statements, and optionally use an **LLM** as a parsing layer to normalize extracted data.

---

## Architecture Options

### Option A: Pure Extraction + Rules Engine
- Extract transactions with pdfplumber → parse into structured data → apply scoring rules (DSCR, income stability, NSF count, etc.)
- **Pros:** Cheap, fast, fully auditable
- **Cons:** Brittle against varied bank formats, requires rule maintenance

### Option B: Extraction + ML Scoring
- Extract data, then train a model on historical loan outcomes
- **Pros:** Adapts to patterns, can learn default risk
- **Cons:** Needs labeled data, harder to explain, regulatory risk

### Option C: LLM-First Pipeline
- Feed PDF text/images to an LLM with structured output prompting (JSON schema)
- **Pros:** Handles format variance, understands context (e.g., "insufficient funds" as negative signal)
- **Cons:** API cost ($0.01–$0.10/statement), latency, some hallucination risk

**Recommendation:** Hybrid — Option A for core extraction + Option C (LLM) as a parsing/normalization layer on top.

---

## Potential Issues

| Issue | Mitigation |
|---|---|
| **Varying bank formats** — 100s of layouts | Build a normalizer layer; use LLM as adapter |
| **Scanned/image PDFs** | Detect and route to OCR pipeline |
| **Password-protected PDFs** | Require user to remove password |
| **Multi-page statements** | Page merging, statement period detection |
| **Fraud / tampered PDFs** | Check PDF metadata, checksum, digital signatures |
| **Regulatory compliance** (Truth in Lending, usury laws) | Consult legal; document scoring methodology |
| **Data privacy (PII in bank statements)** | Process in-memory; don't retain raw PDFs; encrypt at rest |
| **Currency/decimal parsing** | Handle locale-specific formats ($1,234.56 vs 1.234,56) |

---

## Scoring Dimensions (inputs)

- **Net cash flow** (avg monthly income - avg monthly expenses)
- **Income stability** (variance, recurring deposits from employer)
- **NSF / overdraft frequency** (risk signal)
- **Too many small lenders / payday loan debits** (red flag)
- **Ending balance trend** (saving vs drawing down)
- **Debt-to-income ratio** (if loan payments visible)
- **Length of banking relationship**

---

## Recommended Stack

```
Frontend:    Next.js (React) — upload UI, results dashboard
Backend:     Python FastAPI — PDF processing + scoring API
Extraction:  pdfplumber + PaddleOCR (fallback)
Parsing:     LLM (Claude/GPT) for normalization of extracted text
Scoring:     Python rules engine (custom) + optional ML model
Storage:     PostgreSQL (metadata only, not raw PDFs)
Deploy:      Docker on cheap VPS or serverless (AWS Lambda with layers)
```

---

## Alternatives to the Whole Approach

1. **Pre-built APIs** (Plaid, Yodlee, Finicity) — connect via banking API instead of PDF → better data, but requires bank login credentials (UX friction, OAuth complexity)
2. **Open Banking / FDX** — if target market supports it, direct API access eliminates PDF parsing entirely
3. **Outsource to scoring service** — companies like Experian or credit bureaus, but PII/compliance heavy and slow
4. **Manual review + spreadsheet** — for very low volume

---

## Refined Plan (Medium Volume, Text-Based PDFs)

### Pipeline Architecture

```
Upload (Next.js) → FastAPI → pdfplumber → LLM normalizer → Scoring Engine → Response
```

### Step-by-step

1. **Frontend (Next.js)**
   - Drag-and-drop PDF upload, progress indicator, results dashboard
   - Lightweight — could also be a plain HTML/HTMX page if you want to skip JS complexity

2. **Backend (FastAPI)**
   - `/upload` endpoint — receives PDF, validates (< 20MB, is PDF), queues processing
   - Async processing — for medium volume, keep it synchronous in-process; if scale grows, add Celery/Redis queue

3. **Extraction Layer (pdfplumber)**
   - Extract all text + tables page-by-page
   - Pattern-match for: transaction rows (date, description, amount, balance), statement period, account holder
   - Output: dict of `{ transactions: [...], metadata: {...}, raw_text: "..." }`

4. **LLM Normalizer (optional but recommended)**
   - Send extracted text to an LLM with a structured output schema
   - Ask it to: "Parse this bank statement text and return a JSON array of transactions with fields: date, description, debit_amount, credit_amount, balance"
   - Handles format variance without writing 100s of regex patterns
   - At medium volume (100–1k/month), cost is ~$5–$50/month
   - Can skip this step initially and use regex/pattern matching alone; add LLM later as needed

5. **Scoring Engine (Python rule-based)**
   Extract key metrics:
   | Metric | Source | Weight |
   |---|---|---|
   | Average monthly net cash flow | Sum(credits) - Sum(debits) / months | 30% |
   | Income stability | Std dev of monthly income, recurring employer deposits | 25% |
   | NSF/overdraft count | Count of NSF fees, negative balance days | 20% |
   | Ending balance trend | Slope of 3-month ending balances | 10% |
   | Red flag patterns | Payday lender debits, frequent small loans | 10% |
   | Banking relationship length | Oldest transaction date | 5% |

   Output: Score 0–100 + Risk Tier (Low/Medium/High/Decline) + max recommended loan amount

6. **Storage (PostgreSQL)**
   - Store: applicant info, scoring results, extracted metrics, timestamp
   - **Do not store raw PDFs** — only keep for audit if explicitly needed, encrypted
   - Transactions stored as JSONB for flexibility

### Concrete Implementation Order

| Phase | Task | Est. Time |
|---|---|---|
| 1 | Python env, FastAPI skeleton, upload endpoint | 1 day |
| 2 | pdfplumber extraction — text + tables | 2-3 days |
| 3 | Transaction parser (regex extraction of rows) | 2-3 days |
| 4 | Metric calculation + scoring engine | 2-3 days |
| 5 | LLM normalizer integration (optional) | 1-2 days |
| 6 | Frontend (Next.js) — upload + results page | 2-3 days |
| 7 | DB schema + persistence | 1 day |
| 8 | Testing with real bank statements | 2-3 days |

### Key Libraries

- `pdfplumber` — table/text extraction
- `pydantic` — data validation/schemas
- `httpx` — LLM API calls
- `pandas` — analysis/metrics
- `fastapi` + `uvicorn` — API server
- `sqlalchemy` + `asyncpg` — DB
- `next.js` + `tailwind` — frontend

### Risk Mitigation

| Risk | Fix |
|---|---|
| Bank changes format | LLM normalizer adapts; log failures for retraining |
| Parsing errors | Return partial results + confidence score per field |
| Scaling beyond 1k/month | Add queue (Celery + Redis), batch LLM calls |
| Regulatory concerns | Keep scoring logic explainable + documented |
