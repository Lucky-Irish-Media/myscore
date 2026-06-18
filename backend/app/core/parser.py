"""Parse extracted bank statement text into structured transaction data.

This handles the wide variety of bank statement formats by using
pattern matching and normalization rules.
"""

import re
from datetime import date
from decimal import Decimal
from typing import Optional

from .models import StatementMetadata, Transaction


class TransactionParser:
    """Parses raw bank statement text into structured transactions."""

    DATE_PATTERNS = [
        (re.compile(r"\b(\d{2})/(\d{2})/(\d{4})\b"), lambda m: (int(m[1]), int(m[2]), int(m[3]))),
        (re.compile(r"\b(\d{2})/(\d{2})/(\d{2})\b"), lambda m: (int(m[1]), int(m[2]), 2000 + int(m[3]))),
        (re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b"), lambda m: (int(m[1]), int(m[2]), int(m[3]))),
        (re.compile(r"\b(\d{2})-(\d{2})-(\d{4})\b"), lambda m: (int(m[1]), int(m[2]), int(m[3]))),
    ]

    AMOUNT_RE = re.compile(r"([+-]?)\s*\$?([\d,]+\.\d{2})")
    NSF_KEYWORDS = re.compile(
        r"(nsf|non.?sufficient|insufficient funds|overdraft|returned|bounced)", re.IGNORECASE
    )
    PAYDAY_LENDER_KEYWORDS = re.compile(
        r"(payday|cashnetusa|advance america|check.?into.?cash|ace cash|speedy cash|loan)", re.IGNORECASE
    )
    DEPOSIT_KEYWORDS = re.compile(
        r"(deposit|payroll|direct deposit|salary|wage|income)", re.IGNORECASE
    )

    def __init__(self):
        self.seen = set()

    def parse_transactions(self, text: str) -> list[Transaction]:
        transactions = []
        lines = text.split("\n")

        for line in lines:
            line = line.strip()
            if not line:
                continue

            parsed_date = self._extract_date(line)
            if not parsed_date:
                continue

            amounts = self._extract_amounts(line)
            if not amounts:
                continue

            description = self._extract_description(line, parsed_date, amounts)
            key = (parsed_date, description[:40])
            if key in self.seen:
                continue
            self.seen.add(key)

            debit, credit, balance = self._classify_amounts(amounts)

            transactions.append(
                Transaction(
                    date=parsed_date,
                    description=description[:200],
                    debit_amount=debit,
                    credit_amount=credit,
                    balance=balance,
                )
            )

        return transactions

    def classify_transaction(self, transaction: Transaction) -> dict[str, bool]:
        desc = transaction.description
        return {
            "is_income": bool(self.DEPOSIT_KEYWORDS.search(desc)),
            "is_nsf": bool(self.NSF_KEYWORDS.search(desc)),
            "is_red_flag": bool(self.PAYDAY_LENDER_KEYWORDS.search(desc)),
        }

    def _extract_date(self, text: str) -> Optional[date]:
        for pattern, converter in self.DATE_PATTERNS:
            match = pattern.search(text)
            if match:
                parts = converter(match)
                try:
                    return date(parts[2], parts[0], parts[1])
                except ValueError:
                    try:
                        return date(parts[2], parts[1], parts[0])
                    except ValueError:
                        continue
        return None

    def _extract_amounts(self, text: str) -> list[Decimal]:
        amounts = []
        for match in self.AMOUNT_RE.finditer(text):
            sign = -1 if match.group(1) == "-" else 1
            val = Decimal(match.group(2).replace(",", "")) * sign
            amounts.append(val)
        return amounts

    def _extract_description(self, line: str, parsed_date: date, amounts: list[Decimal]) -> str:
        desc = line
        date_strs = [f"{parsed_date.month:02d}/{parsed_date.day:02d}/{parsed_date.year:04d}",
                     f"{parsed_date.month:02d}/{parsed_date.day:02d}/{str(parsed_date.year)[-2:]}",
                     f"{parsed_date.month:02d}-{parsed_date.day:02d}-{parsed_date.year:04d}"]
        for ds in date_strs:
            desc = desc.replace(ds, "")
        for amt in amounts:
            fmt = f"${abs(amt):,.2f}"
            desc = desc.replace(f"+{fmt}", "").replace(f"-{fmt}", "").replace(fmt, "")
            desc = desc.replace(str(abs(amt)), "")
        return desc.strip()

    def _classify_amounts(self, amounts: list[Decimal]) -> tuple[Decimal, Decimal, Optional[Decimal]]:
        debit = Decimal("0.00")
        credit = Decimal("0.00")
        balance = None

        if len(amounts) >= 2:
            balance = abs(amounts[-1])

            if amounts[0] < 0:
                debit = abs(amounts[0])
            else:
                credit = amounts[0]
        elif amounts:
            if amounts[0] < 0:
                debit = abs(amounts[0])
            else:
                credit = amounts[0]

        return debit, credit, balance

    def compute_metrics(
        self, transactions: list[Transaction], metadata: StatementMetadata
    ) -> dict:
        """Compute scoring-relevant metrics from parsed transactions."""
        import pandas as pd

        if not transactions:
            return self._empty_metrics()

        df = pd.DataFrame([t.model_dump() for t in transactions])
        df["date"] = pd.to_datetime(df["date"])
        df["month"] = df["date"].dt.to_period("M")
        df["net"] = df["credit_amount"].astype(float) - df["debit_amount"].astype(float)

        monthly = df.groupby("month").agg(
            total_income=("credit_amount", "sum"),
            total_expenses=("debit_amount", "sum"),
            net_cashflow=("net", "sum"),
        )

        nsf_count = int(df[df["description"].str.contains(
            "nsf|non.?sufficient|insufficient|overdraft|returned|bounced",
            case=False, na=False
        )].shape[0])

        red_flag_count = int(df[df["description"].str.contains(
            "payday|cashnetusa|advance america|check.?into.?cash|ace cash|speedy cash",
            case=False, na=False
        )].shape[0])

        income_series = monthly["total_income"].astype(float)
        income_stability = float(income_series.std()) if len(income_series) > 1 else 0.0

        ending_balances = df.dropna(subset=["balance"]).groupby("month")["balance"].last().astype(float)
        if len(ending_balances) > 1:
            ending_balance_trend = float(ending_balances.diff().mean())
        else:
            ending_balance_trend = 0.0

        return {
            "avg_monthly_net_cashflow": Decimal(str(round(float(monthly["net_cashflow"].mean()), 2))) if len(monthly) > 0 else Decimal("0.00"),
            "income_stability": Decimal(str(round(income_stability, 2))),
            "nsf_count": nsf_count,
            "ending_balance_trend": Decimal(str(round(ending_balance_trend, 2))),
            "red_flag_count": red_flag_count,
            "banking_relationship_months": len(monthly),
            "total_monthly_income": Decimal(str(round(float(monthly["total_income"].mean()), 2))) if len(monthly) > 0 else Decimal("0.00"),
            "total_monthly_expenses": Decimal(str(round(float(monthly["total_expenses"].mean()), 2))) if len(monthly) > 0 else Decimal("0.00"),
        }

    def _empty_metrics(self) -> dict:
        return {
            "avg_monthly_net_cashflow": Decimal("0.00"),
            "income_stability": Decimal("0.00"),
            "nsf_count": 0,
            "ending_balance_trend": Decimal("0.00"),
            "red_flag_count": 0,
            "banking_relationship_months": 0,
            "total_monthly_income": Decimal("0.00"),
            "total_monthly_expenses": Decimal("0.00"),
        }
