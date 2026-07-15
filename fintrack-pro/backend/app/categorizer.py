"""
Auto-categorization for imported bank statement rows.

Strategy:
1. Rule-based keyword matching against common merchant/description patterns
   (fast, transparent, works with zero history).
2. ML fallback: a Naive Bayes text classifier trained on the user's own
   already-categorized transactions, used when keyword rules don't confidently
   match. Improves automatically as the user categorizes more transactions.
"""
from typing import Optional, Tuple, List, Dict

from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB
from sqlalchemy.orm import Session

from app import models

KEYWORD_RULES: Dict[str, List[str]] = {
    "Food": ["swiggy", "zomato", "restaurant", "cafe", "starbucks", "dominos", "mcdonald", "kfc", "food", "grocery", "bigbasket", "blinkit", "zepto"],
    "Rent": ["rent", "landlord", "housing society", "lease"],
    "Shopping": ["amazon", "flipkart", "myntra", "ajio", "mall", "shopping", "store"],
    "Travel": ["uber", "ola", "irctc", "indigo", "makemytrip", "flight", "airlines", "redbus", "cab", "taxi", "petrol", "fuel"],
    "Bills": ["electricity", "water bill", "wifi", "broadband", "recharge", "airtel", "jio", "vodafone", "gas bill", "utility"],
    "Healthcare": ["hospital", "pharmacy", "clinic", "medical", "apollo", "medplus", "doctor", "diagnostic"],
    "Entertainment": ["netflix", "spotify", "prime video", "hotstar", "movie", "cinema", "bookmyshow", "pvr"],
    "Salary": ["salary", "payroll", "monthly pay"],
    "Freelance": ["freelance", "upwork", "fiverr", "contract payment"],
    "Business": ["business income", "invoice payment", "client payment"],
    "Investments": ["dividend", "mutual fund", "stock sale", "interest credit", "sip redemption"],
}


def _keyword_match(description: str) -> Tuple[Optional[str], float]:
    desc = description.lower()
    for category_name, keywords in KEYWORD_RULES.items():
        for kw in keywords:
            if kw in desc:
                return category_name, 0.9
    return None, 0.0


class HistoryClassifier:
    """Lazily-trained Naive Bayes classifier over a user's past transaction descriptions."""

    def __init__(self, db: Session, user_id: str):
        self.ready = False
        rows = (
            db.query(models.Transaction.description, models.Transaction.category_id)
            .filter(
                models.Transaction.user_id == user_id,
                models.Transaction.description.isnot(None),
                models.Transaction.category_id.isnot(None),
            )
            .all()
        )
        texts = [r[0] for r in rows if r[0] and r[0].strip()]
        labels = [r[1] for r in rows if r[0] and r[0].strip()]

        if len(set(labels)) >= 2 and len(texts) >= 5:
            self.vectorizer = CountVectorizer(lowercase=True, stop_words="english")
            X = self.vectorizer.fit_transform(texts)
            self.model = MultinomialNB()
            self.model.fit(X, labels)
            self.ready = True

    def predict(self, description: str) -> Tuple[Optional[str], float]:
        if not self.ready or not description:
            return None, 0.0
        X = self.vectorizer.transform([description])
        proba = self.model.predict_proba(X)[0]
        best_idx = proba.argmax()
        confidence = float(proba[best_idx])
        if confidence < 0.4:
            return None, 0.0
        return self.model.classes_[best_idx], confidence


def build_category_lookup(db: Session, user_id: str) -> Dict[str, models.Category]:
    """Map category name -> Category row (default + user's own)."""
    cats = db.query(models.Category).filter(
        (models.Category.is_default == True) | (models.Category.user_id == user_id)
    ).all()
    return {c.name: c for c in cats}


def suggest_category(
    description: str,
    history_classifier: HistoryClassifier,
    category_lookup: Dict[str, models.Category],
) -> Tuple[Optional[str], Optional[str], float]:
    """Returns (category_id, category_name, confidence)."""
    name, confidence = _keyword_match(description or "")

    if not name:
        cat_id, ml_confidence = history_classifier.predict(description or "")
        if cat_id:
            # cat_id from history classifier is already a category_id (label), not a name
            for cat in category_lookup.values():
                if cat.id == cat_id:
                    return cat.id, cat.name, ml_confidence
        return None, None, 0.0

    category = category_lookup.get(name)
    if category:
        return category.id, category.name, confidence
    return None, name, confidence
