from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, auth

router = APIRouter(prefix="/api/family", tags=["family"])


def _require_family(current_user: models.User) -> None:
    if not current_user.family_id:
        raise HTTPException(status_code=404, detail="You're not part of a family account yet")


def _require_admin(current_user: models.User) -> None:
    _require_family(current_user)
    if not current_user.is_family_admin:
        raise HTTPException(status_code=403, detail="Only the family admin can do that")


@router.get("", response_model=schemas.FamilyOut)
def get_my_family(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    _require_family(current_user)
    family = db.query(models.Family).filter(models.Family.id == current_user.family_id).first()
    return family


@router.post("", response_model=schemas.FamilyOut)
def create_family(
    payload: schemas.FamilyCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if current_user.family_id:
        raise HTTPException(status_code=400, detail="Leave your current family before creating a new one")

    family = models.Family(name=payload.name)
    db.add(family)
    db.commit()
    db.refresh(family)

    current_user.family_id = family.id
    current_user.is_family_admin = True
    db.commit()
    db.refresh(family)
    return family


@router.post("/join", response_model=schemas.FamilyOut)
def join_family(
    payload: schemas.FamilyJoinRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if current_user.family_id:
        raise HTTPException(status_code=400, detail="Leave your current family before joining another")

    family = db.query(models.Family).filter(
        models.Family.invite_code == payload.invite_code.strip().upper()
    ).first()
    if not family:
        raise HTTPException(status_code=404, detail="Invalid invite code")

    current_user.family_id = family.id
    current_user.is_family_admin = False
    db.commit()
    db.refresh(family)
    return family


@router.post("/invite/regenerate", response_model=schemas.FamilyOut)
def regenerate_invite_code(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    _require_admin(current_user)
    family = db.query(models.Family).filter(models.Family.id == current_user.family_id).first()
    family.invite_code = models.gen_invite_code()
    db.commit()
    db.refresh(family)
    return family


@router.delete("/members/{user_id}", response_model=schemas.FamilyOut)
def remove_member(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    _require_admin(current_user)
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Use leave-family to remove yourself")

    member = db.query(models.User).filter(
        models.User.id == user_id, models.User.family_id == current_user.family_id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found in your family")

    member.family_id = None
    member.is_family_admin = False
    db.commit()

    family = db.query(models.Family).filter(models.Family.id == current_user.family_id).first()
    db.refresh(family)
    return family


@router.post("/leave")
def leave_family(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    _require_family(current_user)

    other_members = db.query(models.User).filter(
        models.User.family_id == current_user.family_id, models.User.id != current_user.id
    ).all()

    if current_user.is_family_admin and other_members:
        raise HTTPException(
            status_code=400,
            detail="Promote another member to admin (or remove them) before you leave",
        )

    family_id = current_user.family_id
    current_user.family_id = None
    current_user.is_family_admin = False
    db.commit()

    # If no members remain, clean up the now-empty family.
    if not other_members:
        family = db.query(models.Family).filter(models.Family.id == family_id).first()
        if family:
            db.delete(family)
            db.commit()

    return {"left": True}


@router.post("/members/{user_id}/promote", response_model=schemas.FamilyOut)
def promote_member(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    _require_admin(current_user)
    member = db.query(models.User).filter(
        models.User.id == user_id, models.User.family_id == current_user.family_id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found in your family")

    member.is_family_admin = True
    db.commit()

    family = db.query(models.Family).filter(models.Family.id == current_user.family_id).first()
    db.refresh(family)
    return family
