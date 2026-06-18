import uuid
from datetime import date, datetime

from sqlalchemy import DateTime, Float, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class ApplicantScore(Base):
    __tablename__ = "applicant_scores"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    account_holder: Mapped[str | None] = mapped_column(String(255))
    bank_name: Mapped[str | None] = mapped_column(String(255))
    statement_period_start: Mapped[date | None]
    statement_period_end: Mapped[date | None]

    score: Mapped[int] = mapped_column(Integer)
    risk_tier: Mapped[str] = mapped_column(String(20))
    max_loan_amount: Mapped[float] = mapped_column(Numeric(12, 2))
    confidence: Mapped[float] = mapped_column(Float)

    breakdown: Mapped[dict] = mapped_column(JSONB)
    transactions: Mapped[dict] = mapped_column(JSONB, nullable=True)
