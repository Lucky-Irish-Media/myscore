import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile

from app.config import settings
from app.core.combiner import combine_and_score
from app.core.extraction import extract_pdf
from app.core.models import ScoringInputs
from app.core.normalizer import LLMNormalizer
from app.core.parser import TransactionParser
from app.core.scoring import ScoringEngine

router = APIRouter()
scoring_engine = ScoringEngine()


async def _save_upload(file: UploadFile) -> Path:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    content = await file.read()
    if len(content) > settings.max_file_size_mb * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds {settings.max_file_size_mb}MB limit",
        )

    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    tmp_path = upload_dir / f"{uuid.uuid4()}.pdf"
    tmp_path.write_bytes(content)
    return tmp_path


@router.post("/upload")
async def upload_statement(file: UploadFile) -> dict:
    tmp_path = await _save_upload(file)

    try:
        result = extract_pdf(tmp_path)

        normalizer = LLMNormalizer(api_key=settings.llm_api_key, model=settings.llm_model)
        llm_result = await normalizer.normalize(result.raw_text)
        await normalizer.close()

        if llm_result and llm_result.transactions:
            transactions = llm_result.transactions
            metadata = llm_result.metadata
            confidence = llm_result.confidence
        else:
            transactions = result.transactions
            metadata = result.metadata
            confidence = result.confidence

        parser = TransactionParser()
        inputs = ScoringInputs(**parser.compute_metrics(transactions, metadata))
        score_result = scoring_engine.score(inputs)
        score_result.confidence = confidence

        monthly = parser.compute_monthly_breakdown(transactions)
        for m in monthly:
            if "balance" in m and m["balance"] is not None:
                m["balance"] = float(m["balance"])
            m["income"] = float(m["income"])
            m["expenses"] = float(m["expenses"])
            m["net"] = float(m["net"])

        return {
            "success": True,
            "score": score_result.score,
            "risk_tier": score_result.risk_tier.value,
            "max_loan_amount": float(score_result.max_loan_amount),
            "breakdown": score_result.breakdown,
            "confidence": score_result.confidence,
            "metrics": {k: str(v) for k, v in inputs.model_dump().items()},
            "monthly": monthly,
            "metadata": metadata.model_dump(exclude_none=True),
            "transaction_count": len(transactions),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


@router.post("/upload/combined")
async def upload_combined(files: list[UploadFile]) -> dict:
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="Upload at least 2 PDF statements")

    tmp_paths = []
    try:
        for f in files:
            tmp_paths.append(await _save_upload(f))

        result = combine_and_score(tmp_paths)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Combined processing failed: {str(e)}")
    finally:
        for p in tmp_paths:
            if p.exists():
                p.unlink()
