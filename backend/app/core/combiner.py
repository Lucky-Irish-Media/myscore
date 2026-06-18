from pathlib import Path

from .extraction import extract_pdf
from .models import ScoringInputs, StatementMetadata
from .parser import TransactionParser
from .scoring import ScoringEngine


def combine_and_score(pdf_paths: list[Path]) -> dict:
    """Extract transactions from multiple PDFs, merge them, and compute a combined score."""
    parser = TransactionParser()
    engine = ScoringEngine()

    all_txns = []
    seen = set()
    metadata_list = []

    for path in pdf_paths:
        result = extract_pdf(path)
        metadata_list.append(result.metadata)

        for t in result.transactions:
            desc_lower = t.description.lower()
            if any(kw in desc_lower for kw in ["beginning balance", "ending balance"]):
                continue
            key = (t.date, t.description[:40])
            if key not in seen:
                seen.add(key)
                all_txns.append(t)

    all_txns.sort(key=lambda t: (t.date, t.description))

    m = metadata_list[0] if metadata_list else StatementMetadata()
    combined_meta = StatementMetadata(
        bank_name=m.bank_name,
        account_holder=m.account_holder,
        account_number=m.account_number,
        statement_period_start=all_txns[0].date if all_txns else None,
        statement_period_end=all_txns[-1].date if all_txns else None,
    )

    metrics = parser.compute_metrics(all_txns, combined_meta)
    score = engine.score(ScoringInputs(**metrics))

    monthly = parser.compute_monthly_breakdown(all_txns)
    for m in monthly:
        if "balance" in m and m["balance"] is not None:
            m["balance"] = float(m["balance"])
        m["income"] = float(m["income"])
        m["expenses"] = float(m["expenses"])
        m["net"] = float(m["net"])

    return {
        "success": True,
        "statements_combined": len(pdf_paths),
        "transaction_count": len(all_txns),
        "date_range": {
            "from": str(all_txns[0].date) if all_txns else None,
            "to": str(all_txns[-1].date) if all_txns else None,
        },
        "score": score.score,
        "risk_tier": score.risk_tier.value,
        "max_loan_amount": float(score.max_loan_amount),
        "breakdown": score.breakdown,
        "confidence": score.confidence,
        "metrics": {k: str(v) for k, v in metrics.items()},
        "monthly": monthly,
        "metadata": combined_meta.model_dump(exclude_none=True),
    }
