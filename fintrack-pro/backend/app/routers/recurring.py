from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, auth
from app.recurring import generate_due_transactions

router = APIRouter(prefix="/api/recurring", tags=["recurring"])


@router.get("/", response_model=List[schemas.RecurringTransactionOut])
def list_recurring(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    # Catch up any occurrences that came due since the user was last here,
    # so the list (and the transactions it feeds) are never stale.
    generate_due_transactions(db, current_user.id)
    return (
        db.query(models.RecurringTransaction)
        .filter(models.RecurringTransaction.user_id == current_user.id)
        .order_by(models.RecurringTransaction.next_run_date.asc())
        .all()
    )


@router.post("/", response_model=schemas.RecurringTransactionOut)
def create_recurring(
    payload: schemas.RecurringTransactionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    start = payload.start_date or datetime.utcnow()
    rule = models.RecurringTransaction(
        user_id=current_user.id,
        category_id=payload.category_id,
        type=payload.type,
        amount=payload.amount,
        description=payload.description,
        source=payload.source,
        frequency=payload.frequency,
        start_date=start,
        next_run_date=start,
        end_date=payload.end_date,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    # If start_date is today or in the past, generate the first occurrence
    # right away instead of waiting for the next lazy catch-up.
    generate_due_transactions(db, current_user.id)
    db.refresh(rule)
    return rule


@router.put("/{rule_id}", response_model=schemas.RecurringTransactionOut)
def update_recurring(
    rule_id: str,
    payload: schemas.RecurringTransactionUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    rule = (
        db.query(models.RecurringTransaction)
        .filter(models.RecurringTransaction.id == rule_id, models.RecurringTransaction.user_id == current_user.id)
        .first()
    )
    if not rule:
        raise HTTPException(status_code=404, detail="Recurring rule not found")

    for field, value in payload.dict(exclude_unset=True).items():
        setattr(rule, field, value)

    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/{rule_id}")
def delete_recurring(
    rule_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    rule = (
        db.query(models.RecurringTransaction)
        .filter(models.RecurringTransaction.id == rule_id, models.RecurringTransaction.user_id == current_user.id)
        .first()
    )
    if not rule:
        raise HTTPException(status_code=404, detail="Recurring rule not found")
    db.delete(rule)
    db.commit()
    return {"detail": "Recurring rule deleted"}


@router.post("/run", response_model=schemas.RecurringRunResult)
def run_due_now(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Manually trigger generation of any due occurrences. Useful to make
    the effect visible immediately rather than waiting for the next lazy
    catch-up on page load."""
    created = generate_due_transactions(db, current_user.id)
    return schemas.RecurringRunResult(generated_count=len(created), transactions=created)


@router.post("/from-transaction/{tx_id}", response_model=schemas.RecurringTransactionOut)
def make_transaction_recurring(
    tx_id: str,
    payload: schemas.MakeRecurringRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Convenience: turn an existing transaction into the first occurrence
    of a new recurring rule, using its amount/category/description/source
    as the template. The next occurrence is scheduled one period after
    the original transaction's date, since that one is already posted."""
    tx = (
        db.query(models.Transaction)
        .filter(models.Transaction.id == tx_id, models.Transaction.user_id == current_user.id)
        .first()
    )
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if tx.recurring_transaction_id:
        raise HTTPException(status_code=400, detail="This transaction is already part of a recurring series")

    from app.recurring import _advance

    rule = models.RecurringTransaction(
        user_id=current_user.id,
        category_id=tx.category_id,
        type=tx.type,
        amount=tx.amount,
        description=tx.description,
        source=tx.source,
        frequency=payload.frequency,
        start_date=tx.date,
        next_run_date=_advance(tx.date, payload.frequency),
        end_date=payload.end_date,
    )
    db.add(rule)
    tx.is_recurring = True
    db.flush()
    tx.recurring_transaction_id = rule.id
    db.commit()
    db.refresh(rule)
    return rule
