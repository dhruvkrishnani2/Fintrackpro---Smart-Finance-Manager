"""
Finance assistant chatbot.

Rather than calling out to an external LLM (no API key wired into this
project), this answers questions by matching the message against a set of
finance intents and computing the answer live from the user's own
transactions/budgets/goals with pandas. It's transparent, has zero external
dependency/cost, and always reflects the user's real numbers.
"""
import re
from datetime import datetime
from typing import Optional

import pandas as pd
from sqlalchemy.orm import Session

from app import models

FMT = lambda n: f"{n:,.0f}"


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
        ref = (now.replace(day=1) - pd.Timedelta(days=1))
        return (df["date"].dt.month == ref.month) & (df["date"].dt.year == ref.year)
    # default: this_month
    return (df["date"].dt.month == now.month) & (df["date"].dt.year == now.year)


def _detect_period(message: str) -> str:
    if "last month" in message:
        return "last_month"
    return "this_month"


def _detect_category(message: str, categories: list[models.Category]) -> Optional[models.Category]:
    for cat in categories:
        if cat.name.lower() in message:
            return cat
    return None


def _category_lookup(db: Session, user_id: str) -> dict:
    cats = db.query(models.Category).filter(
        (models.Category.is_default == True) | (models.Category.user_id == user_id)  # noqa: E712
    ).all()
    return {c.id: c.name for c in cats}


PERIOD_LABEL = {"this_month": "this month", "last_month": "last month"}


def answer(db: Session, user: models.User, message: str) -> str:
    msg = message.lower().strip()
    df = _tx_dataframe(db, user.id)
    all_categories = db.query(models.Category).filter(
        (models.Category.is_default == True) | (models.Category.user_id == user.id)  # noqa: E712
    ).all()

    # --- greeting / help ---
    if re.search(r"\b(hi|hello|hey|help|what can you do)\b", msg) and len(msg) < 40:
        return (
            f"Hi {user.full_name.split()[0]}! I can answer things like:\n"
            "• \"What's my balance?\"\n"
            "• \"How much did I spend on food this month?\"\n"
            "• \"Am I over budget?\"\n"
            "• \"How are my goals doing?\"\n"
            "• \"What's my savings rate this month?\"\n"
            "• \"Forecast next month's cash flow\"\n"
            "• \"Show my recent transactions\""
        )

    if df.empty:
        return "You don't have any transactions yet, so I don't have anything to analyze — add some or import a statement first."

    period = _detect_period(msg)
    mask = _period_mask(df, period)
    period_df = df[mask]
    category = _detect_category(msg, all_categories)

    # --- category spend ---
    if category and re.search(r"\b(spend|spent|spending|cost|expense)\b", msg):
        total = period_df[(period_df["type"] == "expense") & (period_df["category_id"] == category.id)]["amount"].sum()
        return f"You've spent ₹{FMT(total)} on {category.name} {PERIOD_LABEL[period]}."

    # --- balance ---
    if re.search(r"\bbalance\b", msg):
        income = df[df["type"] == "income"]["amount"].sum()
        expenses = df[df["type"] == "expense"]["amount"].sum()
        return f"Your current balance is ₹{FMT(income - expenses)} (₹{FMT(income)} in, ₹{FMT(expenses)} out, all-time)."

    # --- savings rate ---
    if re.search(r"\bsav(e|ing|ings)\b", msg) and "goal" not in msg:
        income = period_df[period_df["type"] == "income"]["amount"].sum()
        expenses = period_df[period_df["type"] == "expense"]["amount"].sum()
        if income == 0:
            return f"You haven't logged any income {PERIOD_LABEL[period]} yet, so I can't compute a savings rate."
        rate = (income - expenses) / income * 100
        return (
            f"{PERIOD_LABEL[period].capitalize()} you've saved ₹{FMT(income - expenses)} "
            f"out of ₹{FMT(income)} income — a savings rate of {rate:.0f}%."
        )

    # --- forecast ---
    if re.search(r"\b(forecast|predict|next month)\b", msg):
        import numpy as np
        from sklearn.linear_model import LinearRegression

        fdf = df.copy()
        fdf["period"] = fdf["date"].dt.to_period("M")
        fdf["signed_amount"] = np.where(fdf["type"] == "income", fdf["amount"], -fdf["amount"])
        monthly = fdf.groupby("period")["signed_amount"].sum().reset_index()
        if len(monthly) < 3:
            avg = monthly["signed_amount"].mean() if not monthly.empty else 0
            return f"Not much history yet — a rough estimate for next month's net cash flow is ₹{FMT(avg)}."
        monthly["idx"] = range(len(monthly))
        model = LinearRegression().fit(monthly[["idx"]].values, monthly["signed_amount"].values)
        prediction = model.predict([[monthly["idx"].max() + 1]])[0]
        return f"Based on your trend, I'd expect next month's net cash flow to be around ₹{FMT(prediction)}."

    # --- income ---
    if re.search(r"\bincome\b", msg) and "expense" not in msg:
        total = period_df[period_df["type"] == "income"]["amount"].sum()
        return f"You've earned ₹{FMT(total)} {PERIOD_LABEL[period]}."

    # --- expenses (general) ---
    if re.search(r"\b(spend|spent|spending|expense|expenses|cost)\b", msg):
        total = period_df[period_df["type"] == "expense"]["amount"].sum()
        cats = _category_lookup(db, user.id)
        by_cat = period_df[period_df["type"] == "expense"].groupby("category_id")["amount"].sum()
        by_cat = by_cat.sort_values(ascending=False).head(3)
        breakdown = ", ".join(f"{cats.get(cid, 'Uncategorized')} ₹{FMT(amt)}" for cid, amt in by_cat.items())
        extra = f" Top categories: {breakdown}." if breakdown else ""
        return f"You've spent ₹{FMT(total)} {PERIOD_LABEL[period]}.{extra}"

    # --- budget status ---
    if re.search(r"\bbudget\b", msg):
        now = datetime.utcnow()
        budgets = db.query(models.Budget).filter(
            models.Budget.user_id == user.id, models.Budget.month == now.month, models.Budget.year == now.year
        ).all()
        if not budgets:
            return "You haven't set any budgets for this month yet."
        cats = _category_lookup(db, user.id)
        this_month = df[_period_mask(df, "this_month") & (df["type"] == "expense")]
        spend_by_cat = this_month.groupby("category_id")["amount"].sum()
        over = []
        ok = []
        for b in budgets:
            spent = float(spend_by_cat.get(b.category_id, 0))
            name = cats.get(b.category_id, "Unknown")
            if spent > b.limit_amount:
                over.append(f"{name} (₹{FMT(spent)} of ₹{FMT(b.limit_amount)})")
            else:
                ok.append(name)
        if over:
            return f"You're over budget on: {', '.join(over)}. " + (f"On track for: {', '.join(ok)}." if ok else "")
        return f"You're within budget on all {len(budgets)} categories this month. Nice work."

    # --- goals ---
    if re.search(r"\bgoal", msg):
        goals = db.query(models.Goal).filter(
            models.Goal.user_id == user.id, models.Goal.status == models.GoalStatus.active
        ).all()
        if not goals:
            return "You don't have any active savings goals right now."
        lines = []
        for g in goals:
            pct = min(100, (g.current_amount / g.target_amount) * 100) if g.target_amount else 0
            lines.append(f"{g.name}: {pct:.0f}% (₹{FMT(g.current_amount)} of ₹{FMT(g.target_amount)})")
        return "Here's where your goals stand:\n" + "\n".join(f"• {l}" for l in lines)

    # --- recent transactions ---
    if re.search(r"\b(recent|latest|last few)\b.*\btransaction", msg) or re.search(r"\btransactions\b", msg):
        recent = df.sort_values("date", ascending=False).head(5)
        cats = _category_lookup(db, user.id)
        lines = []
        for _, r in recent.iterrows():
            sign = "+" if r["type"] == "income" else "-"
            cat_name = cats.get(r["category_id"], "Uncategorized")
            lines.append(f"{r['date'].strftime('%b %d')} · {r['description'] or cat_name} · {sign}₹{FMT(r['amount'])}")
        return "Your most recent transactions:\n" + "\n".join(f"• {l}" for l in lines)

    return (
        "I'm not sure how to answer that yet. Try asking about your balance, income, "
        "spending in a category, budgets, goals, savings rate, or a cash flow forecast."
    )