from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, auth

router = APIRouter(prefix="/api/goals", tags=["goals"])


@router.get("/", response_model=List[schemas.GoalOut])
def list_goals(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return db.query(models.Goal).filter(models.Goal.user_id == current_user.id).all()


@router.post("/", response_model=schemas.GoalOut)
def create_goal(
    payload: schemas.GoalCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    goal = models.Goal(user_id=current_user.id, **payload.dict())
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


@router.put("/{goal_id}/contribute", response_model=schemas.GoalOut)
def contribute_to_goal(
    goal_id: str,
    amount: float,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    goal = db.query(models.Goal).filter(
        models.Goal.id == goal_id, models.Goal.user_id == current_user.id
    ).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    goal.current_amount += amount
    if goal.current_amount >= goal.target_amount:
        goal.status = models.GoalStatus.completed
    db.commit()
    db.refresh(goal)
    return goal
