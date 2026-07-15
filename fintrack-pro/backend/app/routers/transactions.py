from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, auth
from app.filters import resolve_date_range
from app.recurring import generate_due_transactions

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


@router.get("/", response_model=List[schemas.TransactionOut])
def list_transactions(
    month: Optional[int] = None,
    year: Optional[int] = None,
    type: Optional[schemas.TransactionType] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    # Catch up any recurring occurrences due since the user was last here.
    generate_due_transactions(db, current_user.id)

    q = db.query(models.Transaction).filter(models.Transaction.user_id == current_user.id)
    date_range = resolve_date_range(month, year)
    if date_range:
        start, end = date_range
        q = q.filter(models.Transaction.date >= start, models.Transaction.date < end)
    if type:
        q = q.filter(models.Transaction.type == type)
    return q.order_by(models.Transaction.date.desc()).all()


@router.post("/", response_model=schemas.TransactionOut)
def create_transaction(
    payload: schemas.TransactionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    tx = models.Transaction(
        user_id=current_user.id,
        type=payload.type,
        amount=payload.amount,
        category_id=payload.category_id,
        description=payload.description,
        source=payload.source,
        date=payload.date or datetime.utcnow(),
        is_recurring=payload.is_recurring,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


@router.delete("/{tx_id}")
def delete_transaction(
    tx_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    tx = db.query(models.Transaction).filter(
        models.Transaction.id == tx_id, models.Transaction.user_id == current_user.id
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(tx)
    db.commit()
    return {"ok": True}
