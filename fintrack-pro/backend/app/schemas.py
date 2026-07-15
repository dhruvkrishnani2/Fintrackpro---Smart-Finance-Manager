from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr

from app.models import TransactionType, GoalStatus, RecurrenceFrequency


# ---------- Auth / User ----------
class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    mfa_enabled: bool
    family_id: Optional[str] = None
    is_family_admin: bool = False
    avatar_url: Optional[str] = None
    has_password: bool = True

    class Config:
        from_attributes = True


class GoogleAuthRequest(BaseModel):
    credential: str  # the ID token returned by Google Identity Services


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class LoginResponse(BaseModel):
    """Returned by /auth/login. Either a full token, or an MFA challenge
    that must be resolved via /auth/mfa/login-verify."""
    mfa_required: bool = False
    temp_token: Optional[str] = None
    access_token: Optional[str] = None
    token_type: str = "bearer"
    user: Optional[UserOut] = None


# ---------- MFA ----------
class MFASetupResponse(BaseModel):
    secret: str
    otpauth_url: str
    qr_code_base64: str  # data:image/png;base64,... ready to drop into an <img>


class MFACodeRequest(BaseModel):
    code: str


class MFALoginVerifyRequest(BaseModel):
    temp_token: str
    code: str


class MFADisableRequest(BaseModel):
    password: str
    code: str


# ---------- Family ----------
class FamilyCreate(BaseModel):
    name: str


class FamilyJoinRequest(BaseModel):
    invite_code: str


class FamilyMemberOut(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    is_family_admin: bool

    class Config:
        from_attributes = True


class FamilyOut(BaseModel):
    id: str
    name: str
    invite_code: str
    members: List[FamilyMemberOut]

    class Config:
        from_attributes = True


# ---------- Category ----------
class CategoryOut(BaseModel):
    id: str
    name: str
    type: TransactionType
    icon: str

    class Config:
        from_attributes = True


# ---------- Transaction ----------
class TransactionCreate(BaseModel):
    type: TransactionType
    amount: float
    category_id: Optional[str] = None
    description: Optional[str] = None
    source: Optional[str] = None
    date: Optional[datetime] = None
    is_recurring: bool = False


class TransactionOut(BaseModel):
    id: str
    type: TransactionType
    amount: float
    category_id: Optional[str]
    description: Optional[str]
    source: Optional[str]
    date: datetime
    is_recurring: bool
    recurring_transaction_id: Optional[str] = None

    class Config:
        from_attributes = True


# ---------- Recurring transactions ----------
class RecurringTransactionCreate(BaseModel):
    type: TransactionType
    amount: float
    category_id: Optional[str] = None
    description: Optional[str] = None
    source: Optional[str] = None
    frequency: RecurrenceFrequency = RecurrenceFrequency.monthly
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class RecurringTransactionUpdate(BaseModel):
    amount: Optional[float] = None
    category_id: Optional[str] = None
    description: Optional[str] = None
    source: Optional[str] = None
    frequency: Optional[RecurrenceFrequency] = None
    end_date: Optional[datetime] = None
    is_active: Optional[bool] = None


class RecurringTransactionOut(BaseModel):
    id: str
    type: TransactionType
    amount: float
    category_id: Optional[str]
    description: Optional[str]
    source: Optional[str]
    frequency: RecurrenceFrequency
    start_date: datetime
    next_run_date: datetime
    end_date: Optional[datetime]
    is_active: bool

    class Config:
        from_attributes = True


class MakeRecurringRequest(BaseModel):
    frequency: RecurrenceFrequency = RecurrenceFrequency.monthly
    end_date: Optional[datetime] = None


class RecurringRunResult(BaseModel):
    generated_count: int
    transactions: List[TransactionOut]


# ---------- Budget ----------
class BudgetCreate(BaseModel):
    category_id: str
    month: int
    year: int
    limit_amount: float


class BudgetOut(BaseModel):
    id: str
    category_id: str
    month: int
    year: int
    limit_amount: float
    spent: float = 0

    class Config:
        from_attributes = True


# ---------- Goal ----------
class GoalCreate(BaseModel):
    name: str
    target_amount: float
    current_amount: float = 0
    target_date: Optional[datetime] = None
    notes: Optional[str] = None


class GoalOut(BaseModel):
    id: str
    name: str
    target_amount: float
    current_amount: float
    target_date: Optional[datetime]
    status: GoalStatus

    class Config:
        from_attributes = True


# ---------- Dashboard / Analytics ----------
class DashboardSummary(BaseModel):
    total_balance: float
    monthly_income: float
    monthly_expenses: float
    monthly_savings: float
    net_cash_flow: float


class CategoryBreakdown(BaseModel):
    category: str
    total: float


class TrendPoint(BaseModel):
    label: str
    income: float
    expenses: float


class BudgetVsActual(BaseModel):
    category: str
    limit_amount: float
    spent: float
    remaining: float
    pct_used: float


class SavingsRatePoint(BaseModel):
    label: str
    income: float
    expenses: float
    savings_rate: float  # percentage of income saved, 0-100 (can go negative)


class CategoryTrendPoint(BaseModel):
    label: str
    values: dict  # category name -> amount for that month


class IncomeBreakdown(BaseModel):
    source: str
    total: float


# ---------- Family analytics ----------
class FamilyMemberSummary(BaseModel):
    user_id: str
    full_name: str
    monthly_income: float
    monthly_expenses: float


class FamilyDashboardSummary(BaseModel):
    total_balance: float
    monthly_income: float
    monthly_expenses: float
    monthly_savings: float
    by_member: List[FamilyMemberSummary]


# ---------- Chatbot ----------
class ChatMessageOut(BaseModel):
    id: str
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ChatRequest(BaseModel):
    message: str
    mode: Optional[str] = None  # "offline" | "online" — defaults to online-if-available


class ChatResponse(BaseModel):
    reply: str
    mode: str  # "offline" | "online" — which engine actually produced this reply


class ChatStatus(BaseModel):
    llm_enabled: bool


# ---------- Bank statement import ----------
class ImportRow(BaseModel):
    row_id: int
    date: datetime
    description: str
    amount: float
    type: TransactionType
    suggested_category_id: Optional[str] = None
    suggested_category_name: Optional[str] = None
    confidence: float = 0.0


class ImportPreviewResponse(BaseModel):
    rows: List[ImportRow]
    total_rows: int
    unmatched_count: int


class ImportConfirmRow(BaseModel):
    date: datetime
    description: str
    amount: float
    type: TransactionType
    category_id: Optional[str] = None


class ImportConfirmRequest(BaseModel):
    rows: List[ImportConfirmRow]


class ImportConfirmResponse(BaseModel):
    created: int