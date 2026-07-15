from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from starlette.responses import StreamingResponse

from app.database import get_db
from app import models, schemas, auth, reports
from app.filters import resolve_date_range
from app.routers.analytics import _tx_dataframe
from app.routers.budgets import list_budgets

router = APIRouter(prefix="/api/reports", tags=["reports"])

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
PDF_MEDIA_TYPE = "application/pdf"

MONTH_NAMES = [
    "", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]


def _filtered_transactions(db: Session, user_id: str, month: Optional[int], year: Optional[int], type: Optional[schemas.TransactionType]):
    q = db.query(models.Transaction).filter(models.Transaction.user_id == user_id)
    date_range = resolve_date_range(month, year)
    if date_range:
        start, end = date_range
        q = q.filter(models.Transaction.date >= start, models.Transaction.date < end)
    if type:
        q = q.filter(models.Transaction.type == type)
    return q.order_by(models.Transaction.date.desc()).all()


def _range_label(month: Optional[int], year: Optional[int], type: Optional[schemas.TransactionType]) -> str:
    parts = []
    if month:
        parts.append(f"{MONTH_NAMES[month]} {year or datetime.utcnow().year}")
    elif year:
        parts.append(str(year))
    if type:
        parts.append(type.value.capitalize())
    return " • ".join(parts)


def _download(buf, filename: str, media_type: str) -> StreamingResponse:
    return StreamingResponse(
        buf,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _dashboard_summary_dict(db: Session, user_id: str) -> dict:
    df = _tx_dataframe(db, user_id)
    if df.empty:
        return {
            "total_balance": 0, "monthly_income": 0, "monthly_expenses": 0,
            "monthly_savings": 0, "net_cash_flow": 0,
        }
    import pandas as pd

    now = datetime.utcnow()
    df["date"] = pd.to_datetime(df["date"])
    this_month = df[(df["date"].dt.month == now.month) & (df["date"].dt.year == now.year)]

    monthly_income = float(this_month[this_month["type"] == "income"]["amount"].sum())
    monthly_expenses = float(this_month[this_month["type"] == "expense"]["amount"].sum())
    total_income = float(df[df["type"] == "income"]["amount"].sum())
    total_expenses = float(df[df["type"] == "expense"]["amount"].sum())

    return {
        "total_balance": total_income - total_expenses,
        "monthly_income": monthly_income,
        "monthly_expenses": monthly_expenses,
        "monthly_savings": monthly_income - monthly_expenses,
        "net_cash_flow": monthly_income - monthly_expenses,
    }


def _category_breakdown_list(db: Session, user_id: str) -> list:
    df = _tx_dataframe(db, user_id)
    if df.empty:
        return []
    expenses = df[df["type"] == "expense"]
    grouped = expenses.groupby("category_id")["amount"].sum().reset_index()
    cats = {c.id: c.name for c in db.query(models.Category).all()}
    return [
        {"category": cats.get(row["category_id"], "Uncategorized"), "total": float(row["amount"])}
        for _, row in grouped.iterrows()
    ]


def _trend_list(db: Session, user_id: str, months: int = 6) -> list:
    df = _tx_dataframe(db, user_id)
    if df.empty:
        return []
    import pandas as pd

    df["date"] = pd.to_datetime(df["date"])
    df["period"] = df["date"].dt.to_period("M")
    pivot = df.pivot_table(index="period", columns="type", values="amount", aggfunc="sum", fill_value=0)
    pivot = pivot.tail(months)
    return [
        {"label": str(period), "income": float(row.get("income", 0)), "expenses": float(row.get("expense", 0))}
        for period, row in pivot.iterrows()
    ]


# ---------------------------------------------------------------------------
# Transaction ledger exports
# ---------------------------------------------------------------------------
@router.get("/transactions/excel")
def export_transactions_excel(
    month: Optional[int] = None,
    year: Optional[int] = None,
    type: Optional[schemas.TransactionType] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    transactions = _filtered_transactions(db, current_user.id, month, year, type)
    categories = db.query(models.Category).all()
    buf = reports.build_transactions_excel(transactions, categories)
    label = _range_label(month, year, type)
    suffix = f"-{label.replace(' • ', '-').replace(' ', '')}" if label else ""
    filename = f"fintrack-transactions{suffix}-{datetime.utcnow().strftime('%Y%m%d')}.xlsx"
    return _download(buf, filename, XLSX_MEDIA_TYPE)


@router.get("/transactions/pdf")
def export_transactions_pdf(
    month: Optional[int] = None,
    year: Optional[int] = None,
    type: Optional[schemas.TransactionType] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    transactions = _filtered_transactions(db, current_user.id, month, year, type)
    categories = db.query(models.Category).all()
    label = _range_label(month, year, type)
    buf = reports.build_transactions_pdf(transactions, categories, current_user.full_name, label)
    suffix = f"-{label.replace(' • ', '-').replace(' ', '')}" if label else ""
    filename = f"fintrack-transactions{suffix}-{datetime.utcnow().strftime('%Y%m%d')}.pdf"
    return _download(buf, filename, PDF_MEDIA_TYPE)


# ---------------------------------------------------------------------------
# Full financial report exports
# ---------------------------------------------------------------------------
@router.get("/full-report/excel")
def export_full_report_excel(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    now = datetime.utcnow()
    summary = _dashboard_summary_dict(db, current_user.id)
    breakdown = _category_breakdown_list(db, current_user.id)
    trend = _trend_list(db, current_user.id)
    transactions = _filtered_transactions(db, current_user.id, None, None, None)
    budgets = [b.dict() for b in list_budgets(month=now.month, year=now.year, db=db, current_user=current_user)]
    goals = db.query(models.Goal).filter(models.Goal.user_id == current_user.id).all()
    categories = db.query(models.Category).all()

    buf = reports.build_full_report_excel(
        current_user.full_name, summary, breakdown, trend, transactions, budgets, goals, categories,
    )
    filename = f"fintrack-report-{datetime.utcnow().strftime('%Y%m%d')}.xlsx"
    return _download(buf, filename, XLSX_MEDIA_TYPE)


@router.get("/full-report/pdf")
def export_full_report_pdf(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    now = datetime.utcnow()
    summary = _dashboard_summary_dict(db, current_user.id)
    breakdown = _category_breakdown_list(db, current_user.id)
    trend = _trend_list(db, current_user.id)
    budgets = [b.dict() for b in list_budgets(month=now.month, year=now.year, db=db, current_user=current_user)]
    goals = db.query(models.Goal).filter(models.Goal.user_id == current_user.id).all()
    categories = db.query(models.Category).all()

    buf = reports.build_full_report_pdf(
        current_user.full_name, summary, breakdown, trend, budgets, goals, categories,
    )
    filename = f"fintrack-report-{datetime.utcnow().strftime('%Y%m%d')}.pdf"
    return _download(buf, filename, PDF_MEDIA_TYPE)
