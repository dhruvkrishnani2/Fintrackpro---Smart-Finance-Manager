from datetime import datetime
from typing import List

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends
from sklearn.linear_model import LinearRegression
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, auth
from app.recurring import generate_due_transactions

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _tx_dataframe(db: Session, user_id: str) -> pd.DataFrame:
    rows = db.query(models.Transaction).filter(models.Transaction.user_id == user_id).all()
    data = [{
        "amount": r.amount,
        "type": r.type.value,
        "category_id": r.category_id,
        "date": r.date,
    } for r in rows]
    return pd.DataFrame(data)


@router.get("/dashboard", response_model=schemas.DashboardSummary)
def dashboard_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    generate_due_transactions(db, current_user.id)
    df = _tx_dataframe(db, current_user.id)
    if df.empty:
        return schemas.DashboardSummary(
            total_balance=0, monthly_income=0, monthly_expenses=0,
            monthly_savings=0, net_cash_flow=0,
        )

    now = datetime.utcnow()
    df["date"] = pd.to_datetime(df["date"])
    this_month = df[(df["date"].dt.month == now.month) & (df["date"].dt.year == now.year)]

    monthly_income = this_month[this_month["type"] == "income"]["amount"].sum()
    monthly_expenses = this_month[this_month["type"] == "expense"]["amount"].sum()
    total_income = df[df["type"] == "income"]["amount"].sum()
    total_expenses = df[df["type"] == "expense"]["amount"].sum()

    return schemas.DashboardSummary(
        total_balance=float(total_income - total_expenses),
        monthly_income=float(monthly_income),
        monthly_expenses=float(monthly_expenses),
        monthly_savings=float(monthly_income - monthly_expenses),
        net_cash_flow=float(monthly_income - monthly_expenses),
    )


@router.get("/category-breakdown", response_model=List[schemas.CategoryBreakdown])
def category_breakdown(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    df = _tx_dataframe(db, current_user.id)
    if df.empty:
        return []
    expenses = df[df["type"] == "expense"]
    grouped = expenses.groupby("category_id")["amount"].sum().reset_index()

    cats = {c.id: c.name for c in db.query(models.Category).all()}
    return [
        schemas.CategoryBreakdown(category=cats.get(row["category_id"], "Uncategorized"), total=float(row["amount"]))
        for _, row in grouped.iterrows()
    ]


@router.get("/trend", response_model=List[schemas.TrendPoint])
def spending_trend(
    months: int = 6,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    df = _tx_dataframe(db, current_user.id)
    if df.empty:
        return []
    df["date"] = pd.to_datetime(df["date"])
    df["period"] = df["date"].dt.to_period("M")

    pivot = df.pivot_table(index="period", columns="type", values="amount", aggfunc="sum", fill_value=0)
    pivot = pivot.tail(months)

    return [
        schemas.TrendPoint(
            label=str(period),
            income=float(row.get("income", 0)),
            expenses=float(row.get("expense", 0)),
        )
        for period, row in pivot.iterrows()
    ]


@router.get("/budget-vs-actual", response_model=List[schemas.BudgetVsActual])
def budget_vs_actual(
    month: int = None,
    year: int = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Compares each budget's monthly limit against actual spend, for a
    grouped bar chart. Defaults to the current month."""
    now = datetime.utcnow()
    month = month or now.month
    year = year or now.year

    budgets = (
        db.query(models.Budget)
        .filter(
            models.Budget.user_id == current_user.id,
            models.Budget.month == month,
            models.Budget.year == year,
        )
        .all()
    )
    if not budgets:
        return []

    cats = {c.id: c.name for c in db.query(models.Category).all()}

    df = _tx_dataframe(db, current_user.id)
    spent_by_cat = {}
    if not df.empty:
        df["date"] = pd.to_datetime(df["date"])
        month_df = df[
            (df["date"].dt.month == month) & (df["date"].dt.year == year) & (df["type"] == "expense")
        ]
        spent_by_cat = month_df.groupby("category_id")["amount"].sum().to_dict()

    results = []
    for b in budgets:
        spent = float(spent_by_cat.get(b.category_id, 0))
        results.append(
            schemas.BudgetVsActual(
                category=cats.get(b.category_id, "Uncategorized"),
                limit_amount=float(b.limit_amount),
                spent=spent,
                remaining=float(b.limit_amount) - spent,
                pct_used=round((spent / b.limit_amount) * 100, 1) if b.limit_amount else 0,
            )
        )
    return sorted(results, key=lambda r: r.pct_used, reverse=True)


@router.get("/savings-rate", response_model=List[schemas.SavingsRatePoint])
def savings_rate(
    months: int = 6,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Monthly savings rate (%) = (income - expenses) / income, for
    tracking financial health trend over time."""
    df = _tx_dataframe(db, current_user.id)
    if df.empty:
        return []
    df["date"] = pd.to_datetime(df["date"])
    df["period"] = df["date"].dt.to_period("M")

    pivot = df.pivot_table(index="period", columns="type", values="amount", aggfunc="sum", fill_value=0)
    pivot = pivot.tail(months)

    points = []
    for period, row in pivot.iterrows():
        income = float(row.get("income", 0))
        expenses = float(row.get("expense", 0))
        rate = round(((income - expenses) / income) * 100, 1) if income else 0.0
        points.append(
            schemas.SavingsRatePoint(label=str(period), income=income, expenses=expenses, savings_rate=rate)
        )
    return points


@router.get("/category-trend", response_model=List[schemas.CategoryTrendPoint])
def category_trend(
    months: int = 6,
    top_n: int = 5,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Monthly expense totals broken down by the top N spending categories,
    for a stacked bar chart showing how the spending mix shifts over time."""
    df = _tx_dataframe(db, current_user.id)
    if df.empty:
        return []
    df["date"] = pd.to_datetime(df["date"])
    df["period"] = df["date"].dt.to_period("M")
    expenses = df[df["type"] == "expense"].copy()
    if expenses.empty:
        return []

    cats = {c.id: c.name for c in db.query(models.Category).all()}
    expenses["category_name"] = expenses["category_id"].map(cats).fillna("Uncategorized")

    top_categories = (
        expenses.groupby("category_name")["amount"].sum().sort_values(ascending=False).head(top_n).index.tolist()
    )
    expenses["category_bucket"] = expenses["category_name"].where(
        expenses["category_name"].isin(top_categories), "Other"
    )

    pivot = expenses.pivot_table(
        index="period", columns="category_bucket", values="amount", aggfunc="sum", fill_value=0
    )
    pivot = pivot.tail(months)

    return [
        schemas.CategoryTrendPoint(label=str(period), values={k: float(v) for k, v in row.items()})
        for period, row in pivot.iterrows()
    ]


@router.get("/income-breakdown", response_model=List[schemas.IncomeBreakdown])
def income_breakdown(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Total income grouped by source (salary, freelance, business, etc.)."""
    df = _tx_dataframe(db, current_user.id)
    if df.empty:
        return []
    income = df[df["type"] == "income"].copy()
    if income.empty:
        return []
    rows = db.query(models.Transaction).filter(
        models.Transaction.user_id == current_user.id,
        models.Transaction.type == models.TransactionType.income,
    ).all()
    src_totals = {}
    for r in rows:
        key = r.source or "Other"
        src_totals[key] = src_totals.get(key, 0) + r.amount
    return [
        schemas.IncomeBreakdown(source=k, total=float(v))
        for k, v in sorted(src_totals.items(), key=lambda kv: kv[1], reverse=True)
    ]


@router.get("/family/dashboard", response_model=schemas.FamilyDashboardSummary)
def family_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if not current_user.family_id:
        return schemas.FamilyDashboardSummary(
            total_balance=0, monthly_income=0, monthly_expenses=0, monthly_savings=0, by_member=[],
        )

    members = db.query(models.User).filter(models.User.family_id == current_user.family_id).all()
    now = datetime.utcnow()

    total_balance = 0.0
    monthly_income_total = 0.0
    monthly_expenses_total = 0.0
    by_member: List[schemas.FamilyMemberSummary] = []

    for member in members:
        df = _tx_dataframe(db, member.id)
        if df.empty:
            by_member.append(schemas.FamilyMemberSummary(
                user_id=member.id, full_name=member.full_name,
                monthly_income=0, monthly_expenses=0,
            ))
            continue

        df["date"] = pd.to_datetime(df["date"])
        this_month = df[(df["date"].dt.month == now.month) & (df["date"].dt.year == now.year)]

        m_income = float(this_month[this_month["type"] == "income"]["amount"].sum())
        m_expenses = float(this_month[this_month["type"] == "expense"]["amount"].sum())
        t_income = float(df[df["type"] == "income"]["amount"].sum())
        t_expenses = float(df[df["type"] == "expense"]["amount"].sum())

        total_balance += t_income - t_expenses
        monthly_income_total += m_income
        monthly_expenses_total += m_expenses

        by_member.append(schemas.FamilyMemberSummary(
            user_id=member.id, full_name=member.full_name,
            monthly_income=m_income, monthly_expenses=m_expenses,
        ))

    return schemas.FamilyDashboardSummary(
        total_balance=total_balance,
        monthly_income=monthly_income_total,
        monthly_expenses=monthly_expenses_total,
        monthly_savings=monthly_income_total - monthly_expenses_total,
        by_member=by_member,
    )


@router.get("/forecast")
def cash_flow_forecast(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Simple linear regression forecast of next month's net cash flow,
    based on historical monthly totals. Falls back gracefully with sparse data."""
    df = _tx_dataframe(db, current_user.id)
    if df.empty or len(df) < 3:
        return {"forecast_next_month": 0, "confidence": "low", "message": "Not enough data yet."}

    df["date"] = pd.to_datetime(df["date"])
    df["period"] = df["date"].dt.to_period("M")
    df["signed_amount"] = np.where(df["type"] == "income", df["amount"], -df["amount"])

    monthly = df.groupby("period")["signed_amount"].sum().reset_index()
    monthly["idx"] = range(len(monthly))

    if len(monthly) < 3:
        avg = float(monthly["signed_amount"].mean())
        return {"forecast_next_month": avg, "confidence": "low", "message": "Estimated from limited history."}

    X = monthly[["idx"]].values
    y = monthly["signed_amount"].values
    model = LinearRegression().fit(X, y)
    next_idx = [[monthly["idx"].max() + 1]]
    prediction = model.predict(next_idx)[0]

    return {
        "forecast_next_month": round(float(prediction), 2),
        "confidence": "medium" if len(monthly) < 6 else "high",
        "message": "Linear trend forecast based on your transaction history.",
    }
