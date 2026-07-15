"""
Read-only data-fetching helpers for the chatbot. Each function returns a
plain JSON-serializable dict/list computed straight from the database, so
both the offline rule-based chatbot and the LLM tool-calling chatbot can
share one source of truth (and the LLM can never "make up" a number — it
can only relay what these functions actually computed).
"""
from datetime import datetime

import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from app import models


def _tx_dataframe(db: Session, user_id: str) -> pd.DataFrame:
    rows = db.query(models.Transaction).filter(models.Transaction.user_id == user_id).all()
    data = [{
        "amount": r.amount,
        "type": r.type.value,
        "category_id": r.category_id,
        "description": r.description or "",
        "date": r.date,
    } for r in rows]
    df = pd.DataFrame(data)
    if not df.empty:
        df["date"] = pd.to_datetime(df["date"])
    return df


def _period_mask(df: pd.DataFrame, period: str) -> pd.Series:
    now = datetime.utcnow()
    if period == "last_month":
        ref = now.replace(day=1) - pd.Timedelta(days=1)
        return (df["date"].dt.month == ref.month) & (df["date"].dt.year == ref.year)
    return (df["date"].dt.month == now.month) & (df["date"].dt.year == now.year)


def category_lookup(db: Session, user_id: str) -> dict:
    cats = db.query(models.Category).filter(
        (models.Category.is_default == True) | (models.Category.user_id == user_id)  # noqa: E712
    ).all()
    return {c.id: c.name for c in cats}


def list_categories(db: Session, user_id: str) -> dict:
    names = sorted(set(category_lookup(db, user_id).values()))
    return {"categories": names}


def find_category_by_name(db: Session, user_id: str, name: str):
    name = (name or "").strip().lower()
    cats = db.query(models.Category).filter(
        (models.Category.is_default == True) | (models.Category.user_id == user_id)  # noqa: E712
    ).all()
    for c in cats:
        if c.name.lower() == name:
            return c
    for c in cats:
        if name in c.name.lower() or c.name.lower() in name:
            return c
    return None


def get_balance(db: Session, user_id: str) -> dict:
    df = _tx_dataframe(db, user_id)
    if df.empty:
        return {"total_balance": 0, "total_income": 0, "total_expenses": 0, "has_data": False}
    income = float(df[df["type"] == "income"]["amount"].sum())
    expenses = float(df[df["type"] == "expense"]["amount"].sum())
    return {
        "total_balance": income - expenses,
        "total_income": income,
        "total_expenses": expenses,
        "has_data": True,
    }


def get_period_summary(db: Session, user_id: str, period: str = "this_month") -> dict:
    df = _tx_dataframe(db, user_id)
    if df.empty:
        return {"period": period, "income": 0, "expenses": 0, "savings": 0, "savings_rate_pct": None, "has_data": False}
    p = df[_period_mask(df, period)]
    income = float(p[p["type"] == "income"]["amount"].sum())
    expenses = float(p[p["type"] == "expense"]["amount"].sum())
    savings_rate = round((income - expenses) / income * 100, 1) if income > 0 else None

    cats = category_lookup(db, user_id)
    by_cat = p[p["type"] == "expense"].groupby("category_id")["amount"].sum().sort_values(ascending=False)
    top_categories = [
        {"category": cats.get(cid, "Uncategorized"), "amount": float(amt)}
        for cid, amt in by_cat.head(5).items()
    ]

    return {
        "period": period,
        "income": income,
        "expenses": expenses,
        "savings": income - expenses,
        "savings_rate_pct": savings_rate,
        "top_expense_categories": top_categories,
        "has_data": True,
    }


def get_category_spend(db: Session, user_id: str, category_name: str, period: str = "this_month") -> dict:
    category = find_category_by_name(db, user_id, category_name)
    if not category:
        return {"error": f"No category matching '{category_name}' found", "known_categories": list_categories(db, user_id)["categories"]}

    df = _tx_dataframe(db, user_id)
    if df.empty:
        return {"category": category.name, "period": period, "amount": 0}
    p = df[_period_mask(df, period)]
    total = float(p[(p["type"] == "expense") & (p["category_id"] == category.id)]["amount"].sum())
    return {"category": category.name, "period": period, "amount": total}


def get_budget_status(db: Session, user_id: str) -> dict:
    now = datetime.utcnow()
    budgets = db.query(models.Budget).filter(
        models.Budget.user_id == user_id, models.Budget.month == now.month, models.Budget.year == now.year
    ).all()
    if not budgets:
        return {"has_budgets": False, "budgets": []}

    cats = category_lookup(db, user_id)
    df = _tx_dataframe(db, user_id)
    spend_by_cat = pd.Series(dtype=float)
    if not df.empty:
        this_month = df[_period_mask(df, "this_month") & (df["type"] == "expense")]
        spend_by_cat = this_month.groupby("category_id")["amount"].sum()

    result = []
    for b in budgets:
        spent = float(spend_by_cat.get(b.category_id, 0))
        result.append({
            "category": cats.get(b.category_id, "Unknown"),
            "limit": b.limit_amount,
            "spent": spent,
            "over_budget": spent > b.limit_amount,
        })
    return {"has_budgets": True, "budgets": result}


def get_goals(db: Session, user_id: str) -> dict:
    goals = db.query(models.Goal).filter(
        models.Goal.user_id == user_id, models.Goal.status == models.GoalStatus.active
    ).all()
    return {
        "goals": [
            {
                "name": g.name,
                "target_amount": g.target_amount,
                "current_amount": g.current_amount,
                "progress_pct": round(min(100, (g.current_amount / g.target_amount) * 100), 1) if g.target_amount else 0,
                "target_date": g.target_date.isoformat() if g.target_date else None,
            }
            for g in goals
        ]
    }


def get_forecast(db: Session, user_id: str) -> dict:
    from sklearn.linear_model import LinearRegression

    df = _tx_dataframe(db, user_id)
    if df.empty or len(df) < 3:
        return {"forecast_next_month": 0, "confidence": "low", "message": "Not enough transaction history yet."}

    df["period"] = df["date"].dt.to_period("M")
    df["signed_amount"] = np.where(df["type"] == "income", df["amount"], -df["amount"])
    monthly = df.groupby("period")["signed_amount"].sum().reset_index()
    monthly["idx"] = range(len(monthly))

    if len(monthly) < 3:
        avg = float(monthly["signed_amount"].mean())
        return {"forecast_next_month": avg, "confidence": "low", "message": "Estimated from limited history."}

    model = LinearRegression().fit(monthly[["idx"]].values, monthly["signed_amount"].values)
    prediction = model.predict([[monthly["idx"].max() + 1]])[0]
    return {
        "forecast_next_month": round(float(prediction), 2),
        "confidence": "medium" if len(monthly) < 6 else "high",
        "message": "Linear trend forecast based on transaction history.",
    }


def get_recent_transactions(db: Session, user_id: str, limit: int = 5) -> dict:
    limit = max(1, min(int(limit or 5), 20))
    df = _tx_dataframe(db, user_id)
    if df.empty:
        return {"transactions": []}
    cats = category_lookup(db, user_id)
    recent = df.sort_values("date", ascending=False).head(limit)
    return {
        "transactions": [
            {
                "date": r["date"].strftime("%Y-%m-%d"),
                "description": r["description"] or cats.get(r["category_id"], "Uncategorized"),
                "category": cats.get(r["category_id"], "Uncategorized"),
                "type": r["type"],
                "amount": float(r["amount"]),
            }
            for _, r in recent.iterrows()
        ]
    }
