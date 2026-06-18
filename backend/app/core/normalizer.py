"""LLM-based normalizer for bank statement text.

Optionally uses an LLM (Claude/GPT) to parse bank statement text
into structured data, handling format variance.
"""

import json
from typing import Optional

import httpx

from .models import ExtractionResult


class LLMNormalizer:
    """Normalizes raw bank statement text using an LLM."""

    SYSTEM_PROMPT = """You are a bank statement parser. Given raw text extracted from a PDF bank statement,
extract all transaction entries and return them as a JSON object with this exact schema:
{
  "metadata": {
    "account_holder": "string or null",
    "bank_name": "string or null",
    "statement_period_start": "YYYY-MM-DD or null",
    "statement_period_end": "YYYY-MM-DD or null",
    "account_number": "string or null"
  },
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "string",
      "debit_amount": number,
      "credit_amount": number,
      "balance": number or null
    }
  ]
}

Rules:
- Parse all transaction lines from the statement.
- If a transaction is a debit (money going out), set debit_amount > 0 and credit_amount = 0.
- If a transaction is a credit (money coming in), set credit_amount > 0 and debit_amount = 0.
- Balance is the running balance after the transaction.
- Return ONLY valid JSON, no other text."""

    def __init__(self, api_key: str = "", model: str = "claude-sonnet-4-20250514"):
        self.api_key = api_key
        self.model = model
        self.client = httpx.AsyncClient(timeout=60.0)

    async def normalize(self, raw_text: str) -> Optional[ExtractionResult]:
        if not self.api_key:
            return None

        try:
            response = await self.client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": self.model,
                    "max_tokens": 4096,
                    "system": self.SYSTEM_PROMPT,
                    "messages": [
                        {"role": "user", "content": f"Parse this bank statement:\n\n{raw_text}"}
                    ],
                },
            )
            response.raise_for_status()
            data = response.json()

            content = data["content"][0]["text"]
            parsed = self._parse_response(content)
            if parsed:
                return parsed

        except Exception:
            return None

        return None

    def _parse_response(self, content: str) -> Optional[ExtractionResult]:
        try:
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()

            data = json.loads(content)
            return ExtractionResult(**data)
        except Exception:
            return None

    async def close(self):
        await self.client.aclose()
