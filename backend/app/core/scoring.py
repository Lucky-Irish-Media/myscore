"""Scoring engine that evaluates borrower risk from bank statement data."""

from decimal import Decimal

from .models import RiskTier, ScoreResult, ScoringInputs


class ScoringEngine:
    """Rule-based scoring engine for lending decisions.

    Produces a score 0-100 and risk tier based on financial health metrics.
    """

    WEIGHTS = {
        "net_cashflow_score": 0.30,
        "income_stability_score": 0.25,
        "nsf_score": 0.20,
        "balance_trend_score": 0.10,
        "red_flag_score": 0.10,
        "relationship_score": 0.05,
    }

    def score(self, inputs: ScoringInputs) -> ScoreResult:
        breakdown = {}
        total = 0.0

        ncf_score = self._score_net_cashflow(inputs.avg_monthly_net_cashflow)
        breakdown["net_cashflow_score"] = ncf_score * self.WEIGHTS["net_cashflow_score"]
        total += ncf_score * self.WEIGHTS["net_cashflow_score"]

        instab_score = self._score_income_stability(
            inputs.income_stability, inputs.total_monthly_income
        )
        breakdown["income_stability_score"] = instab_score * self.WEIGHTS["income_stability_score"]
        total += instab_score * self.WEIGHTS["income_stability_score"]

        nsf_score = self._score_nsf(inputs.nsf_count)
        breakdown["nsf_score"] = nsf_score * self.WEIGHTS["nsf_score"]
        total += nsf_score * self.WEIGHTS["nsf_score"]

        bt_score = self._score_balance_trend(inputs.ending_balance_trend)
        breakdown["balance_trend_score"] = bt_score * self.WEIGHTS["balance_trend_score"]
        total += bt_score * self.WEIGHTS["balance_trend_score"]

        rf_score = self._score_red_flags(inputs.red_flag_count)
        breakdown["red_flag_score"] = rf_score * self.WEIGHTS["red_flag_score"]
        total += rf_score * self.WEIGHTS["red_flag_score"]

        rel_score = self._score_relationship(inputs.banking_relationship_months)
        breakdown["relationship_score"] = rel_score * self.WEIGHTS["relationship_score"]
        total += rel_score * self.WEIGHTS["relationship_score"]

        final_score = round(total * 100)
        risk_tier = self._determine_tier(final_score)

        max_loan = self._calculate_max_loan(
            final_score, inputs.total_monthly_income, inputs.avg_monthly_net_cashflow
        )

        return ScoreResult(
            score=final_score,
            risk_tier=risk_tier,
            max_loan_amount=max_loan,
            breakdown=breakdown,
            confidence=1.0,
        )

    def _score_net_cashflow(self, cashflow: Decimal) -> float:
        cf = float(cashflow)
        if cf <= 0:
            return 0.0
        if cf < 500:
            return 0.3
        if cf < 1500:
            return 0.6
        if cf < 5000:
            return 0.85
        return 1.0

    def _score_income_stability(self, std_dev: Decimal, avg_income: Decimal) -> float:
        if avg_income <= 0:
            return 0.0
        ratio = float(std_dev) / float(avg_income)
        if ratio < 0.1:
            return 1.0
        if ratio < 0.25:
            return 0.75
        if ratio < 0.5:
            return 0.5
        if ratio < 0.75:
            return 0.25
        return 0.0

    def _score_nsf(self, nsf_count: int) -> float:
        if nsf_count == 0:
            return 1.0
        if nsf_count <= 2:
            return 0.6
        if nsf_count <= 5:
            return 0.3
        return 0.0

    def _score_balance_trend(self, trend: Decimal) -> float:
        t = float(trend)
        if t > 500:
            return 1.0
        if t > 100:
            return 0.75
        if t > -100:
            return 0.5
        if t > -500:
            return 0.25
        return 0.0

    def _score_red_flags(self, count: int) -> float:
        if count == 0:
            return 1.0
        if count <= 2:
            return 0.5
        return 0.0

    def _score_relationship(self, months: int) -> float:
        if months >= 24:
            return 1.0
        if months >= 12:
            return 0.75
        if months >= 6:
            return 0.5
        if months >= 3:
            return 0.25
        return 0.1

    def _determine_tier(self, score: int) -> RiskTier:
        if score >= 75:
            return RiskTier.low
        if score >= 50:
            return RiskTier.medium
        if score >= 25:
            return RiskTier.high
        return RiskTier.decline

    def _calculate_max_loan(
        self, score: int, monthly_income: Decimal, net_cashflow: Decimal
    ) -> Decimal:
        income_based = float(monthly_income) * 0.3
        cashflow_based = float(net_cashflow) * 3
        multiplier = score / 100.0
        base = max(income_based, cashflow_based) * multiplier
        return Decimal(str(round(max(base, 0), -2)))
