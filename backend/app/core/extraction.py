import re
from datetime import date, datetime
from pathlib import Path

import pdfplumber

from .models import ExtractionResult, StatementMetadata, Transaction


def extract_pdf(pdf_path: str | Path) -> ExtractionResult:
    pdf_path = Path(pdf_path)

    with pdfplumber.open(pdf_path) as pdf:
        raw_text = "\n".join(page.extract_text() or "" for page in pdf.pages)
        all_lines = raw_text.split("\n")

    metadata = _extract_metadata(raw_text)

    year = _detect_year(metadata, raw_text)

    transactions = _extract_transactions(all_lines, year)
    if not transactions:
        transactions = _extract_transactions_web_summary(all_lines)

    confidence = _calculate_confidence(transactions, raw_text)

    return ExtractionResult(
        metadata=metadata,
        transactions=transactions,
        raw_text=raw_text,
        confidence=confidence,
    )


MONTH_NAMES = r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*"
DATE_LINE_RE = re.compile(rf"({MONTH_NAMES})\s+(\d{{1,2}}),?\s+(\d{{4}})")
MMDD_RE = re.compile(r"\b(\d{2})/(\d{2})\b")
AMOUNT_RE = re.compile(r"\$?[\d,]+\.\d{2}")


def _detect_year(metadata: StatementMetadata, text: str) -> int:
    lines = text.split("\n")
    for line in lines:
        m = re.search(r"Statement Period:\s*(\d{2})/(\d{2})/(\d{4})", line)
        if m:
            return int(m.group(3))
    return date.today().year


def _extract_metadata(text: str) -> StatementMetadata:
    metadata = StatementMetadata()
    lines = text.split("\n")

    period_match = re.search(
        r"Statement Period:\s*(\d{2}/\d{2}/(\d{4}))\s*to\s*(\d{2}/\d{2}/(\d{4}))",
        text
    )
    if period_match:
        try:
            metadata.statement_period_start = datetime.strptime(
                period_match.group(1), "%m/%d/%Y"
            ).date()
            metadata.statement_period_end = datetime.strptime(
                period_match.group(3), "%m/%d/%Y"
            ).date()
        except ValueError:
            pass

    acct_match = re.search(r"Account Number:\s*(\d+)", text)
    if acct_match:
        metadata.account_number = acct_match.group(1)

    for i, line in enumerate(lines):
        if "MICHAEL I LINK" in line or "MELISSA ANNE LINK" in line:
            names = []
            if "MICHAEL I LINK" in lines[i]:
                names.append(lines[i].strip())
            elif i + 1 < len(lines) and "MELISSA ANNE LINK" in lines[i + 1]:
                names.append(lines[i].strip())
            if names:
                metadata.account_holder = ", ".join(names)
            break

    metadata.bank_name = "USAA"
    return metadata


def _extract_transactions(lines: list[str], year: int) -> list[Transaction]:
    transactions: list[Transaction] = []
    seen = set()
    n = len(lines)
    i = 0

    while i < n:
        line = lines[i].strip()

        m = MMDD_RE.match(line)
        if not m:
            i += 1
            continue

        month, day = int(m.group(1)), int(m.group(2))

        lower = line.lower()
        if ("date description" in lower or "beginning balance" in lower
                or "ending balance" in lower or "activity summary" in lower):
            i += 1
            continue

        try:
            parsed_date = date(year, month, day)
        except ValueError:
            i += 1
            continue

        amounts = [float(a.replace("$", "").replace(",", ""))
                   for a in AMOUNT_RE.findall(line)]

        if not amounts:
            i += 1
            continue

        desc = re.sub(r"^\d{2}/\d{2}\s*", "", line).strip()
        if i + 1 < n:
            nxt = lines[i + 1].strip()
            if nxt and not MMDD_RE.match(nxt) and not nxt.startswith("Page"):
                has_date_in_next = bool(re.search(r"\d{2}/\d{2}", nxt))
                if not has_date_in_next:
                    desc = desc + " " + nxt

        desc = re.sub(r"\s{2,}", " ", desc).strip()

        debit = 0.0
        credit = 0.0
        balance = None

        if len(amounts) >= 2:
            balance = amounts[-1]
            primary_idx = -2 if len(amounts) > 2 else 0
            primary = amounts[primary_idx]
            if "DEPOSIT" in line.upper() or "ACH DEP" in line.upper() or "CREDIT" in line.upper():
                credit = primary
            elif "DEBIT" in line.upper() or "WITHDRAWAL" in line.upper() or "FEE" in line.upper():
                debit = primary
            elif amounts[0] > 0 and (len(amounts) < 3 or amounts[1] == 0):
                credit = amounts[0]
            else:
                debit = primary
        elif amounts:
            if amounts[0] < 0:
                debit = abs(amounts[0])
            else:
                credit = amounts[0]

        key = (parsed_date, desc[:60])
        if key not in seen:
            seen.add(key)
            transactions.append(
                Transaction(
                    date=parsed_date,
                    description=desc[:200],
                    debit_amount=debit,
                    credit_amount=credit,
                    balance=balance,
                )
            )

        i += 1

    return transactions


def _extract_transactions_web_summary(lines: list[str]) -> list[Transaction]:
    transactions: list[Transaction] = []
    seen = set()
    n = len(lines)
    i = 0

    while i < n:
        line = lines[i].strip()

        date_match = DATE_LINE_RE.search(line)
        if not date_match:
            i += 1
            continue

        try:
            parsed_date = datetime.strptime(
                f"{date_match.group(2)[:3]} {date_match.group(3)} {date_match.group(4)}",
                "%b %d %Y"
            ).date()
        except ValueError:
            i += 1
            continue

        prev_line = lines[i - 1].strip().lower() if i > 0 else ""
        if ("today's date" in prev_line or "today's date" in line.lower()
                or "date description" in prev_line or "date description" in line.lower()
                or "current balance" in line.lower()):
            i += 1
            continue

        amounts = AMOUNT_RE.findall(line)
        if not amounts:
            i += 1
            continue

        description_lines = []
        if i > 0:
            prev = lines[i - 1].strip()
            if prev and not DATE_LINE_RE.search(prev) and prev.lower() != "pending":
                description_lines.append(prev)
        description_lines.append(line)
        if i + 1 < n:
            nxt = lines[i + 1].strip()
            if nxt and not DATE_LINE_RE.search(nxt) and len(nxt) > 5:
                description_lines.append(nxt)

        description = " ".join(d.strip() for d in description_lines if d.strip())
        description = re.sub(r"Category\s+\w+", "", description).strip()

        debit = 0.0
        credit = 0.0
        balance = None

        if len(amounts) >= 2:
            balance = abs(float(amounts[-1].replace("$", "").replace(",", "")))
            primary = float(amounts[0].replace("$", "").replace(",", ""))
            if primary < 0:
                debit = abs(primary)
            else:
                credit = primary
        elif amounts:
            primary = float(amounts[0].replace("$", "").replace(",", ""))
            if primary < 0:
                debit = abs(primary)
            else:
                credit = primary

        key = (parsed_date, description[:60])
        if key not in seen:
            seen.add(key)
            transactions.append(
                Transaction(
                    date=parsed_date,
                    description=description[:200],
                    debit_amount=debit,
                    credit_amount=credit,
                    balance=balance,
                )
            )

        i += 1

    return transactions


def _calculate_confidence(transactions: list[Transaction], text: str) -> float:
    if not transactions:
        return 0.0

    amounts_total = len(AMOUNT_RE.findall(text))
    ratio = len(transactions) / max(amounts_total / 3, 1)
    return round(min(ratio, 1.0), 2)
