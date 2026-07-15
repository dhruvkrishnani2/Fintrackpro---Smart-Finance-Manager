import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Float, Integer, Boolean, DateTime, ForeignKey, Enum, Text
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class TransactionType(str, enum.Enum):
    income = "income"
    expense = "expense"


class RecurrenceFrequency(str, enum.Enum):
    weekly = "weekly"
    monthly = "monthly"
    yearly = "yearly"


def gen_invite_code():
    return uuid.uuid4().hex[:8].upper()


class Family(Base):
    __tablename__ = "families"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    invite_code = Column(String, unique=True, index=True, default=gen_invite_code)
    created_at = Column(DateTime, default=datetime.utcnow)

    members = relationship("User", back_populates="family")


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)
    google_id = Column(String, unique=True, index=True, nullable=True)
    avatar_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    mfa_enabled = Column(Boolean, default=False)
    mfa_secret = Column(String, nullable=True)
    family_id = Column(UUID(as_uuid=False), ForeignKey("families.id"), nullable=True)
    is_family_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    family = relationship("Family", back_populates="members")
    transactions = relationship("Transaction", back_populates="owner", cascade="all, delete-orphan")
    budgets = relationship("Budget", back_populates="owner", cascade="all, delete-orphan")
    goals = relationship("Goal", back_populates="owner", cascade="all, delete-orphan")
    recurring_transactions = relationship(
        "RecurringTransaction", back_populates="owner", cascade="all, delete-orphan"
    )

    @property
    def has_password(self) -> bool:
        return bool(self.hashed_password)


class ChatRole(str, enum.Enum):
    user = "user"
    assistant = "assistant"


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    role = Column(Enum(ChatRole), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Category(Base):
    __tablename__ = "categories"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    type = Column(Enum(TransactionType), nullable=False)
    icon = Column(String, default="tag")
    is_default = Column(Boolean, default=True)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    category_id = Column(UUID(as_uuid=False), ForeignKey("categories.id"), nullable=True)
    type = Column(Enum(TransactionType), nullable=False)
    amount = Column(Float, nullable=False)
    description = Column(String, nullable=True)
    source = Column(String, nullable=True)  # salary, freelance, business, investment, etc.
    date = Column(DateTime, default=datetime.utcnow)
    is_recurring = Column(Boolean, default=False)
    recurring_transaction_id = Column(
        UUID(as_uuid=False), ForeignKey("recurring_transactions.id"), nullable=True
    )
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="transactions")
    category = relationship("Category")
    recurring_transaction = relationship("RecurringTransaction", back_populates="generated_transactions")


class RecurringTransaction(Base):
    """A template/rule (e.g. 'Rent, ₹18,000, monthly') that the recurring
    engine uses to auto-generate real Transaction rows as each occurrence
    comes due, instead of the user re-entering it every period."""

    __tablename__ = "recurring_transactions"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    category_id = Column(UUID(as_uuid=False), ForeignKey("categories.id"), nullable=True)
    type = Column(Enum(TransactionType), nullable=False)
    amount = Column(Float, nullable=False)
    description = Column(String, nullable=True)
    source = Column(String, nullable=True)
    frequency = Column(Enum(RecurrenceFrequency), nullable=False, default=RecurrenceFrequency.monthly)
    start_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    next_run_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    end_date = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    last_generated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="recurring_transactions")
    category = relationship("Category")
    generated_transactions = relationship("Transaction", back_populates="recurring_transaction")


class Budget(Base):
    __tablename__ = "budgets"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    category_id = Column(UUID(as_uuid=False), ForeignKey("categories.id"), nullable=False)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    limit_amount = Column(Float, nullable=False)

    owner = relationship("User", back_populates="budgets")
    category = relationship("Category")


class GoalStatus(str, enum.Enum):
    active = "active"
    completed = "completed"
    paused = "paused"


class Goal(Base):
    __tablename__ = "goals"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    target_amount = Column(Float, nullable=False)
    current_amount = Column(Float, default=0)
    target_date = Column(DateTime, nullable=True)
    status = Column(Enum(GoalStatus), default=GoalStatus.active)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="goals")
