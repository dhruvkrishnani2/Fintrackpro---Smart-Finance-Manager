from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine, SessionLocal
from app.config import settings
from app import models
from app.recurring import generate_due_for_all_users
from app.routers import auth, transactions, budgets, goals, analytics, categories, imports, family, chatbot, reports, recurring

Base.metadata.create_all(bind=engine)

app = FastAPI(title="FinTrack Pro API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(transactions.router)
app.include_router(budgets.router)
app.include_router(goals.router)
app.include_router(analytics.router)
app.include_router(categories.router)
app.include_router(imports.router)
app.include_router(family.router)
app.include_router(chatbot.router)
app.include_router(reports.router)
app.include_router(recurring.router)


DEFAULT_CATEGORIES = [
    ("Salary", "income", "briefcase"),
    ("Freelance", "income", "laptop"),
    ("Business", "income", "store"),
    ("Investments", "income", "trending-up"),
    ("Food", "expense", "utensils"),
    ("Rent", "expense", "home"),
    ("Shopping", "expense", "shopping-bag"),
    ("Travel", "expense", "plane"),
    ("Bills", "expense", "file-text"),
    ("Healthcare", "expense", "heart-pulse"),
    ("Entertainment", "expense", "film"),
]


@app.on_event("startup")
def seed_categories():
    db = SessionLocal()
    try:
        existing = db.query(models.Category).filter(models.Category.is_default == True).count()
        if existing == 0:
            for name, type_, icon in DEFAULT_CATEGORIES:
                db.add(models.Category(name=name, type=type_, icon=icon, is_default=True))
            db.commit()
    finally:
        db.close()


@app.on_event("startup")
def catch_up_recurring_transactions():
    """A restart can leave recurring rules stalled if no user opens the
    app for a while; this makes sure due occurrences are generated as
    soon as the server comes back up, on top of the lazy per-request
    catch-up in the transactions/analytics/recurring endpoints."""
    db = SessionLocal()
    try:
        generate_due_for_all_users(db)
    finally:
        db.close()


@app.get("/")
def root():
    """
    Landing endpoint. Visiting http://localhost:8000/ in a browser hits this
    route, so it doubles as a human-readable "yes, the API is up" check plus
    a quick explanation of what this API is for.
    """
    return {
        "status": "running",
        "service": "FinTrack Pro API",
        "version": "1.0.0",
        "message": "✅ FinTrack Pro API is up and running.",
        "what_this_api_is_for": (
            "This is the backend REST API for FinTrack Pro, a personal finance "
            "analytics app. The frontend (a separate React app, normally on "
            "http://localhost:5173) calls this API to authenticate users, "
            "store and categorize transactions, track budgets and savings "
            "goals, generate spending analytics/reports, handle CSV imports, "
            "manage shared family accounts, and power the AI finance chatbot."
        ),
        "authentication": (
            "Endpoints under /api/auth handle email/password login and "
            "registration, Google Sign-In, and optional two-factor (MFA) "
            "verification, all using JWT access tokens."
        ),
        "ai_chatbot": {
            "description": (
                "The /api/chatbot endpoints answer free-text questions about "
                "the signed-in user's own finances, backed by real transaction "
                "data rather than invented numbers."
            ),
            "gemini_api_key_configured": bool(settings.gemini_api_key),
            "note": (
                "If no GEMINI_API_KEY is set, the chatbot automatically "
                "falls back to a simpler offline rule-based assistant instead "
                "of failing."
            ),
        },
        "explore_the_api": {
            "interactive_docs": "/docs",
            "openapi_schema": "/openapi.json",
            "health_check": "/api/health",
        },
    }


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "FinTrack Pro API"}
