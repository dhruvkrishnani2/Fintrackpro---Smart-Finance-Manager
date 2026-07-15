"""Engine that turns a RecurringTransaction rule (e.g. 'Rent, ₹18,000,
monthly') into real Transaction rows as each occurrence comes due.

There's no task queue or cron in this app, so instead of relying on a
background scheduler, due occurrences are generated lazily: whenever a
user hits an endpoint that should reflect up-to-date data (listing
transactions, the dashboard, or the recurring list itself) we first
catch up any rules whose next_run_date has arrived. main.py also runs a
catch-up across all users on server startup. A manual "run now" endpoint
exists too, mostly so the effect is visible/demoable without waiting.
"""

import calendar
from datetime import datetime, timedelta
from typing import List

from sqlalchemy.orm import Session

from app import models


def _advance(date: datetime, frequency: models.RecurrenceFrequency) -> datetime:
    """Return the next occurrence after `date` for the given frequency.
    Monthly/yearly advances are calendar-aware (e.g. Jan 31 -> Feb 28)
    rather than naively adding a fixed number of days.
    """
    if frequency == models.RecurrenceFrequency.weekly:
        return date + timedelta(days=7)

    if frequency == models.RecurrenceFrequency.monthly:
        month = date.month + 1
        year = date.year + (month - 1) // 12
        month = ((month - 1) % 12) + 1
        day = min(date.day, calendar.monthrange(year, month)[1])
        return date.replace(year=year, month=month, day=day)

    if frequency == models.RecurrenceFrequency.yearly:
        year = date.year + 1
        day = date.day
        if date.month == 2 and date.day == 29 and not calendar.isleap(year):
            day = 28
        return date.replace(year=year, day=day)

    raise ValueError(f"Unknown frequency: {frequency}")


def generate_due_transactions(
    db: Session, user_id: str, as_of: datetime = None, max_per_rule: int = 24
) -> List[models.Transaction]:
    """Generate every due occurrence (there may be more than one if the
    app wasn't opened for a while) for a single user's active recurring
    rules, up to `max_per_rule` per rule as a safety cap. Returns the
    newly created Transaction rows. Commits internally.
    """
    as_of = as_of or datetime.utcnow()

    due_rules = (
        db.query(models.RecurringTransaction)
        .filter(
            models.RecurringTransaction.user_id == user_id,
            models.RecurringTransaction.is_active == True,  # noqa: E712
            models.RecurringTransaction.next_run_date <= as_of,
        )
        .all()
    )
    if not due_rules:
        return []

    created: List[models.Transaction] = []

    for rule in due_rules:
        occurrences = 0
        while rule.next_run_date <= as_of and occurrences < max_per_rule:
            if rule.end_date and rule.next_run_date > rule.end_date:
                rule.is_active = False
                break

            tx = models.Transaction(
                user_id=rule.user_id,
                category_id=rule.category_id,
                type=rule.type,
                amount=rule.amount,
                description=rule.description,
                source=rule.source,
                date=rule.next_run_date,
                is_recurring=True,
                recurring_transaction_id=rule.id,
            )
            db.add(tx)
            created.append(tx)

            rule.next_run_date = _advance(rule.next_run_date, rule.frequency)
            rule.last_generated_at = as_of
            occurrences += 1

            if rule.end_date and rule.next_run_date > rule.end_date:
                rule.is_active = False
                break

    db.commit()
    for tx in created:
        db.refresh(tx)
    return created


def generate_due_for_all_users(db: Session, as_of: datetime = None) -> int:
    """Catch-up pass across every user with at least one active recurring
    rule. Used on server startup so a restart doesn't leave generation
    stalled until each user happens to open the app."""
    as_of = as_of or datetime.utcnow()
    user_ids = [
        row[0]
        for row in db.query(models.RecurringTransaction.user_id)
        .filter(models.RecurringTransaction.is_active == True)  # noqa: E712
        .distinct()
        .all()
    ]
    total = 0
    for user_id in user_ids:
        total += len(generate_due_transactions(db, user_id, as_of=as_of))
    return total
