from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app import models, schemas, auth

router = APIRouter(prefix="/api/budgets", tags=["budgets"])


@router.get("/", response_model=List[schemas.BudgetOut])
def list_budgets(
    month: int = None,
    year: int = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    now = datetime.utcnow()
    month = month or now.month
    year = year or now.year

    budgets = db.query(models.Budget).filter(
        models.Budget.user_id == current_user.id,
        models.Budget.month == month,
        models.Budget.year == year,
    ).all()

    results = []
    for b in budgets:
        spent = db.query(func.coalesce(func.sum(models.Transaction.amount), 0)).filter(
            models.Transaction.user_id == current_user.id,
            models.Transaction.category_id == b.category_id,
            models.Transaction.type == models.TransactionType.expense,
            func.extract("month", models.Transaction.date) == month,
            func.extract("year", models.Transaction.date) == year,
        ).scalar()
        results.append(schemas.BudgetOut(
            id=b.id, category_id=b.category_id, month=b.month, year=b.year,
            limit_amount=b.limit_amount, spent=float(spent or 0),
        ))
    return results


@router.post("/", response_model=schemas.BudgetOut)
def create_budget(
    payload: schemas.BudgetCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    budget = models.Budget(user_id=current_user.id, **payload.dict())
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return schemas.BudgetOut(
        id=budget.id, category_id=budget.category_id, month=budget.month,
        year=budget.year, limit_amount=budget.limit_amount, spent=0,
    )
