import logging
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, auth, chatbot, llm_chatbot

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chatbot", tags=["chatbot"])


@router.get("/status", response_model=schemas.ChatStatus)
def chatbot_status(current_user: models.User = Depends(auth.get_current_user)):
    return schemas.ChatStatus(llm_enabled=llm_chatbot.is_configured())


@router.get("/history", response_model=List[schemas.ChatMessageOut])
def get_history(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    rows = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.user_id == current_user.id)
        .order_by(models.ChatMessage.created_at.asc())
        .limit(100)
        .all()
    )
    return rows


@router.post("/message", response_model=schemas.ChatResponse)
def send_message(
    payload: schemas.ChatRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    prior_history = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.user_id == current_user.id)
        .order_by(models.ChatMessage.created_at.asc())
        .limit(100)
        .all()
    )

    user_msg = models.ChatMessage(
        user_id=current_user.id, role=models.ChatRole.user, content=payload.message
    )
    db.add(user_msg)
    db.commit()

    # Which engine to use: explicit client choice, falling back to
    # "online if available, else offline" when the client doesn't specify.
    requested_mode = payload.mode or ("online" if llm_chatbot.is_configured() else "offline")

    reply = None
    used_mode = "offline"

    if requested_mode == "online":
        if not llm_chatbot.is_configured():
            reply = (
                "Online mode isn't available right now — no Claude API key is configured "
                "for this server. Switch to offline mode to keep asking about your balance, "
                "budgets, and goals."
            )
        else:
            try:
                reply = llm_chatbot.answer(db, current_user, payload.message, prior_history)
                used_mode = "online"
            except Exception:  # noqa: BLE001
                logger.exception("LLM chatbot failed, falling back to rule-based engine")
                reply = None

    if reply is None:
        reply = chatbot.answer(db, current_user, payload.message)
        used_mode = "offline"

    assistant_msg = models.ChatMessage(
        user_id=current_user.id, role=models.ChatRole.assistant, content=reply
    )
    db.add(assistant_msg)
    db.commit()

    return schemas.ChatResponse(reply=reply, mode=used_mode)


@router.delete("/history")
def clear_history(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    db.query(models.ChatMessage).filter(models.ChatMessage.user_id == current_user.id).delete()
    db.commit()
    return {"cleared": True}