from datetime import date
from decimal import Decimal
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class RiskTier(str, Enum):
    low = "Low"
    medium = "Medium"
    high = "High"
    decline = "Decline"


class Transaction(BaseModel):
    date: date
    description: str
    debit_amount: Decimal = Field(default=Decimal("0.00"), ge=0)
    credit_amount: Decimal = Field(default=Decimal("0.00"), ge=0)
    balance: Optional[Decimal] = None


class StatementMetadata(BaseModel):
    account_holder: Optional[str] = None
    bank_name: Optional[str] = None
    statement_period_start: Optional[date] = None
    statement_period_end: Optional[date] = None
    account_number: Optional[str] = None


class ExtractionResult(BaseModel):
    metadata: StatementMetadata
    transactions: list[Transaction]
    raw_text: str
    confidence: float = Field(ge=0.0, le=1.0)


class ScoringInputs(BaseModel):
    avg_monthly_net_cashflow: Decimal
    income_stability: Decimal
    nsf_count: int
    ending_balance_trend: Decimal
    red_flag_count: int
    banking_relationship_months: int
    total_monthly_income: Decimal
    total_monthly_expenses: Decimal


class ScoreResult(BaseModel):
    score: int = Field(ge=0, le=100)
    risk_tier: RiskTier
    max_loan_amount: Decimal
    breakdown: dict[str, float]
    confidence: float = Field(ge=0.0, le=1.0)
