import io
from datetime import datetime
from typing import Optional

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, auth
from app.categorizer import HistoryClassifier, build_category_lookup, suggest_category

router = APIRouter(prefix="/api/imports", tags=["imports"])

DATE_CANDIDATES = ["date", "transaction date", "value date", "txn date"]
DESC_CANDIDATES = ["description", "narration", "particulars", "details", "remarks"]
AMOUNT_CANDIDATES = ["amount", "transaction amount"]
DEBIT_CANDIDATES = ["debit", "withdrawal", "withdrawal amt", "debit amount"]
CREDIT_CANDIDATES = ["credit", "deposit", "deposit amt", "credit amount"]


def _find_column(columns, candidates) -> Optional[str]:
    lower_map = {c.lower().strip(): c for c in columns}
    for cand in candidates:
        if cand in lower_map:
            return lower_map[cand]
    for cand in candidates:
        for lc, original in lower_map.items():
            if cand in lc:
                return original
    return None


def _read_statement(file: UploadFile) -> pd.DataFrame:
    content = file.file.read()
    filename = (file.filename or "").lower()

    if filename.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(content))
    elif filename.endswith(".xlsx") or filename.endswith(".xls"):
        df = pd.read_excel(io.BytesIO(content))
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type. Upload a .csv or .xlsx statement.")

    df.columns = [str(c).strip() for c in df.columns]
    return df


def _normalize_rows(df: pd.DataFrame) -> list[dict]:
    date_col = _find_column(df.columns, DATE_CANDIDATES)
    desc_col = _find_column(df.columns, DESC_CANDIDATES)
    amount_col = _find_column(df.columns, AMOUNT_CANDIDATES)
    debit_col = _find_column(df.columns, DEBIT_CANDIDATES)
    credit_col = _find_column(df.columns, CREDIT_CANDIDATES)

    if not date_col or not desc_col or not (amount_col or debit_col or credit_col):
        raise HTTPException(
            status_code=400,
            detail="Couldn't detect Date, Description, and Amount (or Debit/Credit) columns in this file.",
        )

    normalized = []
    for _, row in df.iterrows():
        try:
            date_val = pd.to_datetime(row[date_col], errors="coerce")
            if pd.isna(date_val):
                continue
        except Exception:
            continue

        description = str(row[desc_col]).strip() if pd.notna(row.get(desc_col)) else ""

        if amount_col:
            raw_amount = row.get(amount_col)
            if pd.isna(raw_amount):
                continue
            amount = float(raw_amount)
            tx_type = "income" if amount >= 0 else "expense"
            amount = abs(amount)
        else:
            debit = row.get(debit_col) if debit_col else None
            credit = row.get(credit_col) if credit_col else None
            debit = float(debit) if pd.notna(debit) else 0.0
            credit = float(credit) if pd.notna(credit) else 0.0
            if credit > 0:
                amount, tx_type = credit, "income"
            elif debit > 0:
                amount, tx_type = debit, "expense"
            else:
                continue

        if amount == 0 or not description:
            continue

        normalized.append({
            "date": date_val.to_pydatetime(),
            "description": description,
            "amount": amount,
            "type": tx_type,
        })

    return normalized


@router.post("/preview", response_model=schemas.ImportPreviewResponse)
def preview_statement(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    df = _read_statement(file)
    rows = _normalize_rows(df)

    if not rows:
        raise HTTPException(status_code=400, detail="No valid transactions found in this file.")

    history_classifier = HistoryClassifier(db, current_user.id)
    category_lookup = build_category_lookup(db, current_user.id)

    result_rows = []
    unmatched = 0
    for i, r in enumerate(rows):
        cat_id, cat_name, confidence = suggest_category(r["description"], history_classifier, category_lookup)
        if not cat_id:
            unmatched += 1
        result_rows.append(schemas.ImportRow(
            row_id=i,
            date=r["date"],
            description=r["description"],
            amount=r["amount"],
            type=r["type"],
            suggested_category_id=cat_id,
            suggested_category_name=cat_name,
            confidence=confidence,
        ))

    return schemas.ImportPreviewResponse(
        rows=result_rows, total_rows=len(result_rows), unmatched_count=unmatched
    )


@router.post("/confirm", response_model=schemas.ImportConfirmResponse)
def confirm_import(
    payload: schemas.ImportConfirmRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    created = 0
    for row in payload.rows:
        tx = models.Transaction(
            user_id=current_user.id,
            type=row.type,
            amount=row.amount,
            category_id=row.category_id,
            description=row.description,
            date=row.date,
        )
        db.add(tx)
        created += 1
    db.commit()
    return schemas.ImportConfirmResponse(created=created)
